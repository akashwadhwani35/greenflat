import pool from '../config/database';

process.env.OPENAI_API_KEY = '';
process.env.OPENAI_MODEL = '';
process.env.OPENAI_EMBEDDING_MODEL = '';

const tables = [
  'token_purchases',
  'subscriptions',
  'reports',
  'profile_views',
  'search_history',
  'off_grid_history',
  'bookmarks',
  'messages',
  'matches',
  'blocks',
  'likes',
  'user_notification_preferences',
  'user_privacy_settings',
  'photos',
  'personality_responses',
  'user_profiles',
  'user_activity_limits',
  'user_ai_profiles',
  'pending_registrations',
  'otp_request_audit',
  'otp_codes',
  'verification_status',
  'support_messages',
  'users'
];

const truncateTables = async () => {
  // Plain DELETEs, in the child-first order the list is already in. No CASCADE:
  // messages references itself (reply_to_message_id) and pg-mem follows a
  // cascade back into the same table forever, from any parent that reaches it.
  // Real Postgres does not have this problem; only the in-memory test DB does.
  for (const table of tables) {
    await pool.query(`DELETE FROM ${table}`);
  }
};

beforeEach(async () => {
  await truncateTables();
});

afterAll(async () => {
  await pool.end();
});
