import { Kysely, sql } from "kysely";

const HISTORICAL_PLAYERS_TABLE_NAME = "boatkid_historical_players";

// note - migrations run in a transaction w/the PostgresDialect
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable(HISTORICAL_PLAYERS_TABLE_NAME)
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`generate_ulid()`)
    )
    .addColumn("inserted_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    .addColumn("last_modified_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`current_timestamp`)
    )
    // Player identification
    .addColumn("player_address", "text", (col) => col.notNull())
    .addColumn("game_address", "text", (col) => col.notNull())
    .addColumn("game_id", "text", (col) => col.notNull())

    // Bet information
    .addColumn("bet_amount", "numeric", (col) => col.notNull()) // in token units
    .addColumn("bet_amount_raw", "bigint", (col) => col.notNull()) // raw amount from blockchain
    .addColumn("token_mint", "text", (col) => col.notNull())
    .addColumn("bet_pda", "text", (col) => col.defaultTo(null))

    // Game participation
    .addColumn("joined_at", "bigint", (col) => col.notNull()) // unix timestamp from blockchain
    .addColumn("player_position", "integer", (col) => col.notNull()) // 1, 2, 3, etc.
    .addColumn("is_winner", "boolean", (col) => col.notNull().defaultTo(false))

    // Probability and odds
    .addColumn("win_probability", "numeric", (col) => col.defaultTo(null)) // calculated win chance
    .addColumn("bet_percentage", "numeric", (col) => col.defaultTo(null)) // percentage of total pot

    // Additional data
    .addColumn("player_data", "jsonb", (col) => col.defaultTo(null)) // store additional player info

    .execute();

  // Create indexes for better query performance
  await db.schema
    .createIndex(`${HISTORICAL_PLAYERS_TABLE_NAME}_player_address_idx`)
    .on(HISTORICAL_PLAYERS_TABLE_NAME)
    .column("player_address")
    .execute();

  await db.schema
    .createIndex(`${HISTORICAL_PLAYERS_TABLE_NAME}_game_address_idx`)
    .on(HISTORICAL_PLAYERS_TABLE_NAME)
    .column("game_address")
    .execute();

  await db.schema
    .createIndex(`${HISTORICAL_PLAYERS_TABLE_NAME}_winner_idx`)
    .on(HISTORICAL_PLAYERS_TABLE_NAME)
    .column("is_winner")
    .execute();

  // Create composite index for game-player lookups
  await db.schema
    .createIndex(`${HISTORICAL_PLAYERS_TABLE_NAME}_game_player_idx`)
    .on(HISTORICAL_PLAYERS_TABLE_NAME)
    .columns(["game_address", "player_address"])
    .execute();

  // Add foreign key constraint to link players to games
  await db.schema
    .alterTable(HISTORICAL_PLAYERS_TABLE_NAME)
    .addForeignKeyConstraint(
      `${HISTORICAL_PLAYERS_TABLE_NAME}_game_fk`,
      ["game_address"],
      "boatkid_historical_games",
      ["game_address"]
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable(HISTORICAL_PLAYERS_TABLE_NAME).execute();
}
