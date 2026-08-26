/**
 * Migration runner.
 *
 * Applies every .sql file in ./migrations exactly once, in filename order, and
 * records what it applied in a schema_migrations ledger. Safe to run repeatedly
 * and safe to run from several instances at once (guarded by a Postgres
 * advisory lock), so it can be called on boot without racing itself.
 */
import fs from 'fs';
import path from 'path';
import pool from '../config/database';

// tsc does not copy .sql files into dist/, and the Dockerfile stages src/database
// beside it. Try next to this file first (ts-node/dev), then the staged copy.
const resolveMigrationsDir = (): string => {
  const candidates = [
    path.join(__dirname, 'migrations'),
    path.join(process.cwd(), 'src', 'database', 'migrations'),
  ];
  return candidates.find((dir) => fs.existsSync(dir)) || candidates[0];
};

const MIGRATIONS_DIR = resolveMigrationsDir();

// Arbitrary but fixed: two runners must pick the same number to exclude each other.
const ADVISORY_LOCK_KEY = 4977231;

const ensureLedger = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const listMigrationFiles = (): string[] => {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
};

const getApplied = async (): Promise<Set<string>> => {
  const result = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map((r: any) => r.filename));
};

// The numbered migrations are incremental changes ON TOP of schema.sql, so a
// brand new database has to be given the base schema first. Recorded in the
// ledger under this name so it is never applied twice (schema.sql creates its
// indexes unguarded and would fail on a second run).
const BASE_SCHEMA_LEDGER_NAME = '000_schema.sql';

const resolveSchemaFile = (): string | null => {
  const candidates = [
    path.join(__dirname, 'schema.sql'),
    path.join(process.cwd(), 'src', 'database', 'schema.sql'),
  ];
  return candidates.find((f) => fs.existsSync(f)) || null;
};

const applyBaseSchemaIfMissing = async (applied: Set<string>): Promise<string | null> => {
  if (applied.has(BASE_SCHEMA_LEDGER_NAME)) return null;

  // If core tables already exist this database predates the runner. Record the
  // base schema as done rather than trying to recreate it.
  const existing = await pool.query(`SELECT to_regclass('public.users') AS users`);
  if (existing.rows[0]?.users) {
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [
      BASE_SCHEMA_LEDGER_NAME,
    ]);
    return null;
  }

  const schemaFile = resolveSchemaFile();
  if (!schemaFile) {
    throw new Error('Base schema not found and the database is empty');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(schemaFile, 'utf8'));
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [
      BASE_SCHEMA_LEDGER_NAME,
    ]);
    await client.query('COMMIT');
    console.log(`  ✅ ${BASE_SCHEMA_LEDGER_NAME} (base schema, fresh database)`);
    return BASE_SCHEMA_LEDGER_NAME;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`  ❌ ${BASE_SCHEMA_LEDGER_NAME} failed, rolled back:`, (error as Error).message);
    throw error;
  } finally {
    client.release();
  }
};

export const runMigrations = async (): Promise<{ applied: string[]; skipped: number }> => {
  await pool.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);

  try {
    await ensureLedger();

    const files = listMigrationFiles();
    const applied = await getApplied();

    // Must run before the numbered migrations, which assume it exists.
    const baseSchema = await applyBaseSchemaIfMissing(applied);

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      return { applied: baseSchema ? [baseSchema] : [], skipped: files.length };
    }

    const done: string[] = baseSchema ? [baseSchema] : [];

    for (const filename of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        done.push(filename);
        console.log(`  ✅ ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`  ❌ ${filename} failed, rolled back:`, (error as Error).message);
        throw error;
      } finally {
        client.release();
      }
    }

    // done can include the base schema, which is not one of `files`.
    return { applied: done, skipped: Math.max(0, files.length - pending.length) };
  } finally {
    await pool.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
  }
};

// Allow `npm run migrate` to invoke this file directly.
if (require.main === module) {
  runMigrations()
    .then(({ applied, skipped }) => {
      if (applied.length === 0) {
        console.log(`Migrations up to date (${skipped} already applied).`);
      } else {
        console.log(`Applied ${applied.length} migration(s); ${skipped} already applied.`);
      }
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration run failed:', error);
      process.exit(1);
    });
}
