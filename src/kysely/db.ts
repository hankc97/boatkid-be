import { Kysely, PostgresDialect, Transaction } from "kysely";
import { Pool, PoolConfig, types } from "pg";
import Cursor from "pg-cursor";
import { Log } from "../utils/logging";
import { repr } from "../utils/misc";
import { DB } from "./types";

type DatabaseOptions = PoolConfig;

export const getDatabase = (
  connectionString: string,
  options?: DatabaseOptions
) => {
  types.setTypeParser(types.builtins.INT8, (val) => Number(val));
  types.setTypeParser(types.builtins.NUMERIC, (val) => Number(val));

  const logger = new Log("db");
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString,
        ...options,
      }),
      cursor: Cursor,
    }),
    log(event): void {
      if (event.level === "query") {
        logger.silly(event.query.sql);
        if (event.query.parameters.length) {
          logger.silly(repr(event.query.parameters));
        }
      } else {
        logger.error(repr(event.error));
      }
    },
  });
};

export const withDB = async <T>(
  callback: (db: Kysely<DB>, params?: unknown[]) => Promise<T>,
  options?: DatabaseOptions & { params?: unknown[] }
): Promise<T> => {
  const db = getDatabase(process.env.DATABASE_URL!, {
    max: 4,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 20_000,
    ...options,
  });

  try {
    // Pass the db instance to the callback
    return await callback(db, options?.params);
  } finally {
    // Ensure the connection is always closed
    await db.destroy();
  }
};

export const withTrx = async <T>(
  callback: (trx: Transaction<DB>, params?: unknown[]) => Promise<T>,
  options?: DatabaseOptions & { params?: unknown[] }
): Promise<T> => {
  return await withDB<T>(
    async (db) => {
      // Pass the db instance to the callback
      return db.transaction().execute(async (trx) => {
        return await callback(trx);
      });
    },
    { max: 1, ...options }
  );
};

export const withConnection = async <T>(
  callback: (db: Kysely<DB>, params?: unknown[]) => Promise<T>,
  options?: Omit<DatabaseOptions, "max"> & { params?: unknown[] }
): Promise<T> => {
  return await withDB<T>(callback, { ...options, max: 1 });
};
