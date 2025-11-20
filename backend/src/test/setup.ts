import pool from '../config/database';

process.env.OPENAI_API_KEY = '';
process.env.OPENAI_MODEL = '';
process.env.OPENAI_EMBEDDING_MODEL = '';

const tables = [
  'reports',
  'profile_views',
  'search_history',
  'bookmarks',
  'messages',
  'matches',
  'likes',
  'photos',
  'personality_responses',
  'user_profiles',
  'user_activity_limits',
  'user_ai_profiles',
  'users'
];

const truncateTables = async () => {
  for (const table of tables) {
    await pool.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
  }
};

beforeEach(async () => {
  await truncateTables();
});

afterAll(async () => {
  await pool.end();
});
