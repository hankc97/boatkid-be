import { Kysely, sql } from 'kysely';

// note - migrations run in a transaction w/the PostgresDialect
export async function up(db: Kysely<any>): Promise<void> {
  // Used for generating random bytes in ULID creation
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);

  // ULID generation function for creating unique IDs without centralized coordination.
  // Avoids limitations of a monotonic (auto-incrementing) ID.
  await sql`CREATE OR REPLACE FUNCTION generate_ulid() RETURNS uuid
    LANGUAGE sql STRICT PARALLEL SAFE
    RETURN ((lpad(to_hex((floor((EXTRACT(epoch FROM clock_timestamp()) * (1000)::numeric)))::bigint), 12, '0'::text) || encode(public.gen_random_bytes(10), 'hex'::text)))::uuid;
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP FUNCTION IF EXISTS generate_ulid`.execute(db);
}
