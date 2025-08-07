import { Kysely, sql } from "kysely";

const ADMIN_TABLE_NAME = "nochill_admin";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable(ADMIN_TABLE_NAME)
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
    .addColumn("wallet_address", "text", (col) => col.notNull().unique())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable(ADMIN_TABLE_NAME).execute();
}
