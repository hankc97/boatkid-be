import { Command } from '@commander-js/extra-typings';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import {
  FileMigrationProvider,
  MigrationResult,
  Migrator,
  NO_MIGRATIONS,
  sql,
} from 'kysely';
import path from 'node:path';
import pc from 'picocolors';
import readline from 'readline';
import { getErrorMessage } from '../utils/errors';
import {
  consoleLoggerOptions,
  Log,
  registerLogger,
  simpleLogFormat,
} from '../utils/logging';
import { repr } from '../utils/misc';
import { getDatabase } from './db';

const scriptName = path.basename(__filename);

function askForConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `${pc.yellow(question)} ${pc.green('(Y/n):')} `,
      (answer: string) => {
        // Convert answer to uppercase and check if it's 'Y'
        if (answer.trim().toUpperCase() === 'Y') {
          resolve(true);
        } else {
          resolve(false);
        }
        rl.close();
      },
    );
  });
}

const generateFilename = ({
  name,
  migrationsDir,
}: {
  name: string;
  migrationsDir: string;
}) => {
  // this date prefix matches what sequelize-cli generates
  const datePrefix = new Date().toJSON().replace(/[-:T]/g, '').split(/[.]/)[0];
  return path.join(migrationsDir, `${datePrefix}-${name}.ts`);
};

const cleanTableName = (name: string) => {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
};

const writeMigration = async ({
  name,
  migrationsDir,
  contents,
}: {
  name: string;
  migrationsDir: string;
  contents: string;
}) => {
  const filename = generateFilename({ name, migrationsDir });
  await fs.outputFile(filename, contents);
  new Log('generate').info(pc.green(`Created migration file: ${filename}`));
};

const generateMigration = async ({
  client,
  name,
  migrationsDir,
}: {
  client: string;
  name: string;
  migrationsDir: string;
}) => {
  const suggestedTableName = cleanTableName(`${client}_${name}`);
  const varPrefix = cleanTableName(name).toUpperCase();

  // the skeleton file we want to write
  const skeletonFile = `import { Kysely, sql } from 'kysely';

const ${varPrefix}_TABLE_NAME = "${suggestedTableName}";

// note - migrations run in a transaction w/the PostgresDialect
export async function up(db: Kysely<any>): Promise<void> {
   await db.schema
    .createTable(${varPrefix}_TABLE_NAME)
    .ifNotExists()
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql\`generate_ulid()\`),
    )
    .addColumn("inserted_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql\`current_timestamp\`),
    )
    .addColumn("last_modified_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql\`current_timestamp\`),
    )
    // TODO add more fields
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable(${varPrefix}_TABLE_NAME).execute();
}
`;

  await writeMigration({ name, migrationsDir, contents: skeletonFile });
};

const generateInit = async ({
  client,
  migrationsDir,
}: {
  client: string;
  migrationsDir: string;
}) => {
  // the skeleton file we want to write
  const skeletonFile = `import { Kysely, sql } from 'kysely';

// note - migrations run in a transaction w/the PostgresDialect
export async function up(db: Kysely<any>): Promise<void> {
  // Used for generating random bytes in ULID creation
  await sql\`CREATE EXTENSION IF NOT EXISTS pgcrypto\`.execute(db);

  // ULID generation function for creating unique IDs without centralized coordination.
  // Avoids limitations of a monotonic (auto-incrementing) ID.
  await sql\`CREATE OR REPLACE FUNCTION generate_ulid() RETURNS uuid
    LANGUAGE sql STRICT PARALLEL SAFE
    RETURN ((lpad(to_hex((floor((EXTRACT(epoch FROM clock_timestamp()) * (1000)::numeric)))::bigint), 12, '0'::text) || encode(public.gen_random_bytes(10), 'hex'::text)))::uuid;
  \`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql\`DROP FUNCTION IF EXISTS generate_ulid\`.execute(db);
}
`;

  await writeMigration({
    name: cleanTableName(`${client}_init`),
    migrationsDir,
    contents: skeletonFile,
  });
};

const processResults = (error: unknown, results?: MigrationResult[]) => {
  const logger = new Log(scriptName);
  results?.forEach((it) => {
    if (it.status === 'Success') {
      logger.info(
        pc.green(`migration "${it.migrationName}" was executed successfully`),
      );
    } else if (it.status === 'Error') {
      logger.error(pc.red(`failed to execute migration "${it.migrationName}"`));
    }
  });

  if (error) {
    console.error(pc.red('failed to migrate'));
    console.error(error);
    process.exit(1);
  }
};

const getMigrator = async ({
  client,
  migrationsDir: dir,
  migrationsTable: table,
}: {
  client: string;
  migrationsDir?: string;
  migrationsTable?: string;
}) => {
  const migrationsDir = path.resolve(
    dir || path.join(process.cwd(), 'migrations'),
  );

  const db = getDatabase(process.env.DATABASE_URL!);

  const migrationsTable = table || `${client}_migrations`;
  const {
    rows: [{ current_catalog, current_user }],
  } = await sql
    .raw<{
      current_catalog: string;
      current_user: string;
    }>('select current_catalog, current_user')
    .execute(db);

  return {
    migrator: new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: migrationsDir,
      }),
      migrationTableName: migrationsTable,
      migrationLockTableName: `${migrationsTable}_lock`,
    }),
    currentCatalog: current_catalog,
    currentUser: current_user,
  };
};

const main = async () => {
  const generateProgram = new Command()
    .command('generate')
    .description('Generate a new migration file')
    .argument('<name>', 'the name of the migration')
    .requiredOption('-c, --client <client>', 'name of the client')
    .option(
      '-d, --dir <dir>',
      'specify the output migrations directory (default: ./migrations)',
    )
    .showHelpAfterError()
    .action(async (name, args) => {
      // current working dir
      const migrationsDir = args.dir || path.join(process.cwd(), 'migrations');

      await generateMigration({
        client: args.client,
        migrationsDir,
        name,
      });
    });

  const initProgram = new Command()
    .command('init')
    .description('Create the initialization migration and any necessary setup')
    .requiredOption('-c, --client <client>', 'name of the client')
    .option(
      '-d, --dir <dir>',
      'specify the output migrations directory (default: ./migrations)',
    )
    .showHelpAfterError()
    .action(async (args) => {
      // current working dir
      const migrationsDir = args.dir || path.join(process.cwd(), 'migrations');

      await generateInit({
        client: args.client,
        migrationsDir,
      });
    });

  const migrateProgram = new Command()
    .command('migrate')
    .description('Runs migrations')
    .requiredOption('-c, --client <client>', 'name of the client')
    .option(
      '-d, --dir <dir>',
      'specify the output migrations directory (default: ./migrations)',
    )
    .option(
      '--migrations-table <name>',
      'specify the name of the migrations table',
    )
    .showHelpAfterError()
    .action(async (args) => {
      const { migrator, currentCatalog, currentUser } = await getMigrator({
        client: args.client,
        migrationsDir: args.dir,
        migrationsTable: args.migrationsTable,
      });

      const doIt = await askForConfirmation(
        `Are you sure you want to run migrations on ${pc.magenta(
          currentCatalog,
        )} with user ${pc.magenta(currentUser)}?`,
      );
      const logger = new Log('migrate');
      if (doIt) {
        logger.info(pc.green(`🔨 Running migrations`));
        const { error, results } = await migrator.migrateToLatest();
        processResults(error, results);
      } else {
        logger.info(pc.yellow(`⊘ Migration cancelled`));
      }
    });

  const undoProgram = new Command()
    .command('undo')
    .description('Undo the last migration')
    .requiredOption('-c, --client <client>', 'name of the client')
    .option(
      '-d, --dir <dir>',
      'specify the output migrations directory (default: ./migrations)',
    )
    .option(
      '--migrations-table <name>',
      'specify the name of the migrations table',
    )
    .showHelpAfterError()
    .action(async (args) => {
      const { migrator, currentCatalog, currentUser } = await getMigrator({
        client: args.client,
        migrationsDir: args.dir,
        migrationsTable: args.migrationsTable,
      });

      const doIt = await askForConfirmation(
        `Are you sure you want to undo the last migration on ${pc.magenta(
          currentCatalog,
        )} with user ${pc.magenta(currentUser)}?`,
      );
      const logger = new Log('undo');
      if (doIt) {
        logger.info(pc.green(`🔨 Undoing last migration`));
        const { error, results } = await migrator.migrateDown();
        processResults(error, results);
      } else {
        logger.info(pc.yellow(`⊘ Undo cancelled`));
      }
    });

  const resetProgram = new Command()
    .command('reset')
    .description('Undo all migrations')
    .requiredOption('-c, --client <client>', 'name of the client')
    .option(
      '-d, --dir <dir>',
      'specify the output migrations directory (default: ./migrations)',
    )
    .option(
      '--migrations-table <name>',
      'specify the name of the migrations table',
    )
    .showHelpAfterError()
    .action(async (args) => {
      const { migrator, currentCatalog, currentUser } = await getMigrator({
        client: args.client,
        migrationsDir: args.dir,
        migrationsTable: args.migrationsTable,
      });

      const doIt = await askForConfirmation(
        `Are you sure you want to undo ALL migrations on ${pc.magenta(
          currentCatalog,
        )} with user ${pc.magenta(currentUser)}?`,
      );
      const logger = new Log('undo');
      if (doIt) {
        logger.info(pc.green(`🔨 Undoing all migrations`));
        const { error, results } = await migrator.migrateTo(NO_MIGRATIONS);
        processResults(error, results);
      } else {
        logger.info(pc.yellow(`⊘ Reset cancelled`));
      }
    });

  const program = new Command()
    .name(scriptName)
    .description('CLI for database migrations management')
    .allowUnknownOption(true)
    .option(
      '-e, --env <file>',
      'specify the environment file to load (default: .env) - several variables may override defaults',
    )
    .hook('preAction', (cmd) => {
      dotenv.config({ path: cmd.opts().env || '.env', override: true });
      registerLogger(
        consoleLoggerOptions(process.env.LOG_LEVEL || 'info', {
          format: simpleLogFormat(),
        }),
      ).newLogger();
    });
  program.addCommand(initProgram);
  program.addCommand(generateProgram);
  program.addCommand(migrateProgram);
  program.addCommand(undoProgram);
  program.addCommand(resetProgram);
  try {
    await program.parseAsync();
    process.exit(0);
  } catch (e) {
    console.log({ e });
    new Log(scriptName).error(pc.red(getErrorMessage(e)));
    process.exit(1);
  }
};

if (require.main === module) {
  main().catch((e) => {
    new Log(scriptName).error(pc.red(repr(e)));
    process.exit(1);
  });
}
