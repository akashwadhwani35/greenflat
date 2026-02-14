import dotenv from 'dotenv';
import pool from '../config/database';

dotenv.config();

const DEMO_EMAIL_PATTERNS = [
  '%@example.com',
  'demo+%@%',
  'demo_%@%',
  'test+%@%',
  'test_%@%',
  'seed+%@%',
  'seed_%@%',
  'mock+%@%',
  'mock_%@%',
];

const DEMO_NAME_PATTERNS = [
  'demo %',
  '% demo',
  '% test user%',
  'test user%',
];

const APPLY_CHANGES = process.env.APPLY_CHANGES === 'true';

type CandidateRow = {
  id: number;
  email: string;
  name: string;
  city: string | null;
  created_at: string;
};

const main = async () => {
  const emailWhere = DEMO_EMAIL_PATTERNS.map((_, i) => `email ILIKE $${i + 1}`).join(' OR ');
  const nameStart = DEMO_EMAIL_PATTERNS.length;
  const nameWhere = DEMO_NAME_PATTERNS.map((_, i) => `name ILIKE $${nameStart + i + 1}`).join(' OR ');
  const params = [...DEMO_EMAIL_PATTERNS, ...DEMO_NAME_PATTERNS];

  const candidatesResult = await pool.query(
    `
      SELECT id, email, name, city, created_at
      FROM users
      WHERE (${emailWhere}) OR (${nameWhere})
      ORDER BY created_at DESC
    `,
    params
  );

  const candidates = candidatesResult.rows as CandidateRow[];

  if (candidates.length === 0) {
    console.log('No demo/test profiles found.');
    await pool.end();
    return;
  }

  console.log(`Found ${candidates.length} demo/test profile(s):`);
  candidates.forEach((row: CandidateRow) => {
    console.log(`- #${row.id} ${row.name} <${row.email}> (${row.city ?? 'Unknown city'})`);
  });

  if (!APPLY_CHANGES) {
    console.log('Dry run only. Re-run with APPLY_CHANGES=true to delete these profiles.');
    await pool.end();
    return;
  }

  const ids = candidates.map((row: CandidateRow) => row.id);
  await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [ids]);

  console.log(`Deleted ${ids.length} demo/test profile(s).`);
  await pool.end();
};

main().catch(async (error) => {
  console.error('Failed to purge demo profiles:', error);
  try {
    await pool.end();
  } catch {
    // ignore shutdown errors
  }
  process.exit(1);
});
