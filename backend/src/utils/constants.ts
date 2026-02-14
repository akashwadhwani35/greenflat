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

// Personality Traits Mapping
export const PERSONALITY_TRAITS_MAP: Record<string, string[]> = {
  A: ['Funny', 'Playful', 'Positive', 'Outgoing', 'Social', 'Adventurous', 'Spontaneous', 'Charismatic', 'Witty', 'Free-spirited'],
  B: ['Caring', 'Empathetic', 'Emotionally aware', 'Romantic', 'Thoughtful', 'Reliable', 'Warm', 'Compassionate', 'Selfless'],
  C: ['Logical', 'Respectful', 'Calm', 'Rational', 'Serious', 'Grounded', 'Mature', 'Reliable', 'Structured', 'Focused'],
  D: ['Responsible', 'Supportive', 'Independent', 'Confident', 'Chill', 'Adaptable', 'Laid-back', 'Easy-going'],
};

// JWT Configuration
const resolvedJwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : '');
if (!resolvedJwtSecret) {
  throw new Error('JWT_SECRET is required');
}

export const JWT_CONFIG = {
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  secret: resolvedJwtSecret,
};
