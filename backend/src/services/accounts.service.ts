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

/**
 * The app sends its install id as `x-device-id` (Android ID / iOS vendor id).
 * Opaque, not secret; only used to notice one phone creating many accounts.
 */
export const deviceIdFromRequest = (req: { headers: Record<string, unknown> }): string | null => {
  const raw = req.headers['x-device-id'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(trimmed)) return null;
  return trimmed;
};

/**
 * One account per phone, softly.
 *
 * A resettable device id is a speed bump, not a wall — a factory reset or a
 * second Android profile defeats it — but it costs nothing and stops the lazy
 * case of one person farming accounts. Deliberately recoverable: shared and
 * hand-me-down phones are real, and until SMS verification lands there is no
 * other way back in, so the caller turns this into "contact support", never a
 * dead end.
 *
 * Banned and deleted accounts still count; letting a ban be shed by making a
 * new account is the hole this is here to close.
 */
export const deviceHasAccount = async (
  deviceId: string | null,
  db: { query: (text: string, params?: any[]) => Promise<{ rows: any[] }> }
): Promise<boolean> => {
  if (!deviceId) return false;
  const existing = await db.query(
    'SELECT 1 FROM users WHERE device_id = $1 LIMIT 1',
    [deviceId]
  );
  return existing.rows.length > 0;
};
