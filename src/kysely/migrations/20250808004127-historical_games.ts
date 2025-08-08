import { Kysely, sql } from "kysely";

const HISTORICAL_GAMES_TABLE_NAME = "boatkid_historical_games";

// note - migrations run in a transaction w/the PostgresDialect
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable(HISTORICAL_GAMES_TABLE_NAME)
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
    // Game identification
    .addColumn("game_address", "text", (col) => col.notNull().unique())
    .addColumn("game_id", "text", (col) => col.notNull())
    .addColumn("nonce", "integer", (col) => col.notNull())

    // Game configuration
    .addColumn("max_participants", "integer", (col) => col.notNull())
    .addColumn("max_bet_size", "numeric", (col) => col.notNull())

    // Game lifecycle
    .addColumn("status", "text", (col) => col.notNull()) // waiting, active, finished
    .addColumn("on_chain_status", "text", (col) => col.notNull()) // initialized, started, resolved
    .addColumn("created_at_timestamp", "bigint", (col) => col.notNull()) // unix timestamp from blockchain
    .addColumn("resolved_at", "timestamptz", (col) =>
      col.defaultTo(sql`current_timestamp`)
    )

    // Game outcome
    .addColumn("winner_address", "text", (col) => col.notNull())
    .addColumn("transaction_signature", "text", (col) => col.notNull())
    .addColumn("total_participants", "integer", (col) => col.notNull())
    .addColumn("total_prize_pool", "numeric", (col) => col.notNull()) // in token units
    .addColumn("total_prize_pool_raw", "bigint", (col) => col.notNull()) // raw amount from blockchain

    // Timer information
    .addColumn("timer_started_at", "bigint", (col) => col.defaultTo(null))
    .addColumn("timer_ends_at", "bigint", (col) => col.defaultTo(null))
    .addColumn("timer_duration", "integer", (col) => col.defaultTo(null))
    .addColumn("auto_resolved", "boolean", (col) =>
      col.notNull().defaultTo(false)
    )

    // Additional metadata
    .addColumn("participants_data", "jsonb", (col) => col.defaultTo(null)) // store participant info as JSON
    .addColumn("game_state_snapshot", "jsonb", (col) => col.defaultTo(null)) // store final game state

    .execute();

  // Create indexes for better query performance
  await db.schema
    .createIndex(`${HISTORICAL_GAMES_TABLE_NAME}_game_address_idx`)
    .on(HISTORICAL_GAMES_TABLE_NAME)
    .column("game_address")
    .execute();

  await db.schema
    .createIndex(`${HISTORICAL_GAMES_TABLE_NAME}_winner_idx`)
    .on(HISTORICAL_GAMES_TABLE_NAME)
    .column("winner_address")
    .execute();

  await db.schema
    .createIndex(`${HISTORICAL_GAMES_TABLE_NAME}_resolved_at_idx`)
    .on(HISTORICAL_GAMES_TABLE_NAME)
    .column("resolved_at")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable(HISTORICAL_GAMES_TABLE_NAME).execute();
}
