// Daily Limits Configuration
export const DAILY_LIMITS = {
  male: {
    on_grid_likes: 1,
    off_grid_likes: 4,
    on_grid_results: 3,
    off_grid_results: 4,
    messages_per_day: 3,
    cooldown_enabled_default: false,
  },
  female: {
    on_grid_likes: 3,
    off_grid_likes: 7, // 5-7 range, using max
    on_grid_results: 6,
    off_grid_results: 4,
    messages_per_day: 10,
    cooldown_enabled_default: true,
  },
};

// Cooldown Configuration
export const COOLDOWN_DURATION_HOURS = 10; // 8-12 hours, using middle value
export const LIKE_RESET_HOURS = 12;

// Premium Features
export const PREMIUM_BENEFITS = {
  on_grid_likes_bonus: 2,
  off_grid_likes_bonus: 10,
  unlimited_rewind: true,
  bookmark_access: true,
  read_receipts: true,
  search_shine: true,
};

// Free tokens.
//
// A new account starts with SIGNUP_TOKENS (the column default) and is then
// granted WEEKLY_FREE_TOKENS once per interval. The grant is additive, per the
// product board ("5 free tokens each week"), replacing an earlier top-up-to-a-
// floor design. At five a week the stockpiling that design guarded against is
// not worth guarding against, and this is what was asked for.
//
// Every AI search is a real model call, so the weekly grant is also the per-user
// ceiling on OpenAI spend for anyone who does not buy tokens.
export const SIGNUP_TOKENS = 19;
export const WEEKLY_FREE_TOKENS = Number(process.env.FREE_TOKEN_ALLOWANCE || 5);
export const TOKEN_ALLOWANCE_INTERVAL_HOURS = Number(
  process.env.TOKEN_ALLOWANCE_INTERVAL_HOURS || 24 * 7
);

export const TOKEN_COSTS = {
  AI_SEARCH: 1,
  SUPER_LIKE: 4,
  COMPLIMENT: 6,
  BOOST: 20,
} as const;

// Personality traits now live per question+option in utils/personalityQuestions.ts.
// A flat A/B/C/D map cannot express a situational quiz, where the same letter
// means something different on each question.

// JWT Configuration
const resolvedJwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : '');
if (!resolvedJwtSecret) {
  throw new Error('JWT_SECRET is required');
}

export const JWT_CONFIG = {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  secret: resolvedJwtSecret,
};
