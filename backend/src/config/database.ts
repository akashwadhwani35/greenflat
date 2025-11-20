import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const sanitizeSchemaForInMemoryDb = (schema: string) =>
  schema
    .replace(/DECIMAL\(\s*\d+\s*,\s*\d+\s*\)/gi, 'FLOAT')
    .replace(/\bTIMESTAMP\b(?!\s*WITH\s+TIME\s+ZONE)/gi, 'TIMESTAMPTZ');

const createTestPool = () => {
  // Lazy require to avoid bundling pg-mem in production builds
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { newDb } = require('pg-mem') as typeof import('pg-mem');
  const db = newDb({ autoCreateForeignKeyIndices: true });

  db.public.registerFunction({
    name: 'now',
    implementation: () => new Date(),
  });

  const schemaPath = path.join(__dirname, '../database/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const normalizedSchema = sanitizeSchemaForInMemoryDb(schema);
  db.public.none(normalizedSchema);

  const { Pool: PgMemPool } = db.adapters.createPg();
  return new PgMemPool();
};

const createPool = () => {
  if (process.env.NODE_ENV === 'test') {
    return createTestPool();
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
};

const pool = createPool();

const attachListeners = () => {
  const candidate = pool as unknown as { on?: (event: string, handler: (arg: any) => void) => void };

  if (candidate && typeof candidate.on === 'function' && process.env.NODE_ENV !== 'test') {
    candidate.on('connect', () => {
      console.log('✅ Database connected successfully');
    });

    candidate.on('error', (err: Error) => {
      console.error('❌ Unexpected database error:', err);
      process.exit(-1);
    });
  }
};

attachListeners();

export default pool;
