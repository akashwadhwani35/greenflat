/**
 * Account creation shared by every route that can mint a user: the classic
 * one-shot signup, Google sign-in, and the staged registration funnel.
 *
 * The rows a new user needs (activity limits, privacy settings, notification
 * preferences) are created in one place because a user missing any of them fails
 * later in ways that look like unrelated bugs — a null privacy row reads as
 * "incognito unknown" at query time, not as "signup was incomplete".
 */
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../utils/constants';

/**
 * Stand-ins for the profile fields the app collects during onboarding rather
 * than at signup. Both the Google path and the registration funnel create the
 * account before the user has told us their name or date of birth, and the
 * columns are NOT NULL.
 *
 * These values must never reach discovery: users.onboarding_completed_at gates
 * that, and it is only stamped once the real values have replaced these.
 */
export const PLACEHOLDER_DOB = '1995-01-01';
export const PLACEHOLDER_CITY = 'Unknown';
export const PLACEHOLDER_NAME = 'GreenFlag User';

export type AuthUserRow = {
  id: number;
  email: string;
  name: string;
  gender: string;
  interested_in: string;
  city: string;
  is_verified: boolean;
  is_premium: boolean;
  credit_balance: number | string | null;
  cooldown_enabled: boolean;
  is_admin?: boolean | null;
  is_banned?: boolean | null;
  google_sub?: string | null;
  pronouns?: string[] | null;
  onboarding_completed_at?: Date | string | null;
};

export const buildUserPayload = (user: AuthUserRow) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  gender: user.gender,
  interested_in: user.interested_in,
  pronouns: user.pronouns || [],
  city: user.city,
  is_verified: user.is_verified,
  is_premium: user.is_premium,
  credit_balance: Number(user.credit_balance || 0),
  cooldown_enabled: user.cooldown_enabled,
  is_admin: user.is_admin || false,
  // The app uses this to decide whether to send someone into onboarding.
  onboarding_completed: Boolean(user.onboarding_completed_at),
});

export const signAuthToken = (userId: number) =>
  jwt.sign({ userId }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn } as any);

export const initializeUserDefaults = async (client: any, userId: number) => {
  await client.query(
    `INSERT INTO user_activity_limits (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  await client.query(
    `INSERT INTO user_privacy_settings (user_id, hide_distance, hide_city, incognito_mode, show_online_status)
     VALUES ($1, FALSE, FALSE, FALSE, FALSE)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  await client.query(
    `INSERT INTO user_notification_preferences (
       user_id, likes, matches, messages, daily_picks, product_updates
     ) VALUES ($1, TRUE, TRUE, TRUE, TRUE, TRUE)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
};
