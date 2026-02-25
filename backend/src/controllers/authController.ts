import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { JWT_CONFIG, DAILY_LIMITS } from '../utils/constants';
import { canUseDevOtpBypass, isSmsConfigured, sendOtpSms } from '../services/sms.service';

const OTP_TTL_SECONDS = 300;
const DEFAULT_GOOGLE_DOB = '1995-01-01';
const DEFAULT_GOOGLE_CITY = 'Unknown';

type AuthUserRow = {
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
};

type GoogleTokenInfo = {
  aud: string;
  email: string;
  email_verified?: string | boolean;
  exp: string;
  given_name?: string;
  iss: string;
  name?: string;
  picture?: string;
  sub: string;
};

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

const buildUserPayload = (user: AuthUserRow) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  gender: user.gender,
  interested_in: user.interested_in,
  city: user.city,
  is_verified: user.is_verified,
  is_premium: user.is_premium,
  credit_balance: Number(user.credit_balance || 0),
  cooldown_enabled: user.cooldown_enabled,
  is_admin: user.is_admin || false,
});

const signAuthToken = (userId: number) =>
  jwt.sign(
    { userId },
    JWT_CONFIG.secret,
    { expiresIn: JWT_CONFIG.expiresIn } as any
  );

const initializeUserDefaults = async (client: any, userId: number) => {
  await client.query(
    `INSERT INTO user_activity_limits (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  await client.query(
    `INSERT INTO user_privacy_settings (user_id, hide_distance, hide_city, incognito_mode, show_online_status)
     VALUES ($1, FALSE, FALSE, FALSE, TRUE)
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

const getAllowedGoogleClientIds = (): string[] => {
  const raw = [process.env.GOOGLE_OAUTH_CLIENT_IDS, process.env.GOOGLE_OAUTH_CLIENT_ID]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(',');

  const ids = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(ids)];
};

const verifyGoogleIdToken = async (idToken: string): Promise<GoogleTokenInfo> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    );

    const body = (await response.json().catch(() => null)) as GoogleTokenInfo | null;
    if (!response.ok || !body) {
      throw new Error('INVALID_GOOGLE_TOKEN');
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const sub = typeof body.sub === 'string' ? body.sub.trim() : '';
    const audience = typeof body.aud === 'string' ? body.aud.trim() : '';
    const issuer = typeof body.iss === 'string' ? body.iss.trim() : '';
    const expiryMs = Number(body.exp) * 1000;

    if (!email || !sub || !audience || !issuer || !Number.isFinite(expiryMs)) {
      throw new Error('INVALID_GOOGLE_TOKEN');
    }

    if (!GOOGLE_ISSUERS.has(issuer)) {
      throw new Error('INVALID_GOOGLE_ISSUER');
    }

    const emailVerified = String(body.email_verified || '').toLowerCase() === 'true';
    if (!emailVerified) {
      throw new Error('UNVERIFIED_GOOGLE_EMAIL');
    }

    if (expiryMs <= Date.now()) {
      throw new Error('EXPIRED_GOOGLE_TOKEN');
    }

    const allowedClientIds = getAllowedGoogleClientIds();
    if (allowedClientIds.length === 0 && process.env.NODE_ENV === 'production') {
      throw new Error('MISSING_GOOGLE_AUDIENCE_CONFIG');
    }
    if (allowedClientIds.length > 0 && !allowedClientIds.includes(audience)) {
      throw new Error('GOOGLE_AUDIENCE_MISMATCH');
    }

    return {
      ...body,
      email,
      sub,
      aud: audience,
      iss: issuer,
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('GOOGLE_TOKEN_TIMEOUT');
    }
    if (error instanceof Error) throw error;
    throw new Error('GOOGLE_TOKEN_VERIFY_FAILED');
  } finally {
    clearTimeout(timeout);
  }
};

export const signup = async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const {
      email,
      password,
      name,
      gender,
      interested_in,
      date_of_birth,
      city,
    } = req.body;

    // Validation
    if (!email || !password || !name || !gender || !interested_in || !date_of_birth || !city) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Set cooldown default based on gender
    const cooldown_enabled = gender === 'female' ? DAILY_LIMITS.female.cooldown_enabled_default : DAILY_LIMITS.male.cooldown_enabled_default;

    await client.query('BEGIN');

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, name, gender, interested_in, date_of_birth, city, cooldown_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, name, gender, interested_in, city, is_verified, is_premium, credit_balance, cooldown_enabled, is_admin, created_at`,
      [email, password_hash, name, gender, interested_in, date_of_birth, city, cooldown_enabled]
    );

    const user = userResult.rows[0];

    await initializeUserDefaults(client, user.id);

    await client.query('COMMIT');

    const token = signAuthToken(user.id);

    res.status(201).json({
      message: 'User created successfully',
      user: buildUserPayload(user),
      token,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  } finally {
    client.release();
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, name, gender, interested_in, city, is_verified, is_premium, credit_balance, cooldown_enabled, is_admin, is_banned FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account has been suspended. Contact support@greenflag.app for assistance.' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signAuthToken(user.id);

    res.json({
      message: 'Login successful',
      user: buildUserPayload(user),
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const googleAuth = async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const idToken = typeof req.body?.id_token === 'string' ? req.body.id_token.trim() : '';
    if (!idToken) {
      return res.status(400).json({ error: 'id_token is required' });
    }

    let tokenInfo: GoogleTokenInfo;
    try {
      tokenInfo = await verifyGoogleIdToken(idToken);
    } catch (verificationError: any) {
      const code = String(verificationError?.message || 'GOOGLE_TOKEN_VERIFY_FAILED');
      if (code === 'GOOGLE_AUDIENCE_MISMATCH') {
        return res.status(401).json({ error: 'Google token audience is not allowed for this app' });
      }
      if (code === 'MISSING_GOOGLE_AUDIENCE_CONFIG') {
        return res.status(503).json({ error: 'Google sign-in is temporarily unavailable' });
      }
      if (
        code === 'INVALID_GOOGLE_TOKEN' ||
        code === 'INVALID_GOOGLE_ISSUER' ||
        code === 'UNVERIFIED_GOOGLE_EMAIL' ||
        code === 'EXPIRED_GOOGLE_TOKEN'
      ) {
        return res.status(401).json({ error: 'Invalid Google sign-in token' });
      }
      if (code === 'GOOGLE_TOKEN_TIMEOUT') {
        return res.status(504).json({ error: 'Google token verification timed out. Please try again.' });
      }
      console.error('Google token verification failed:', verificationError);
      return res.status(502).json({ error: 'Unable to verify Google sign-in right now' });
    }

    const email = tokenInfo.email;
    const googleSub = tokenInfo.sub;
    const displayNameSource = tokenInfo.name || tokenInfo.given_name || tokenInfo.email.split('@')[0] || 'GreenFlag User';
    const displayName = displayNameSource.trim().slice(0, 100) || 'GreenFlag User';

    await client.query('BEGIN');

    const existingUserResult = await client.query(
      `SELECT id, email, name, gender, interested_in, city, is_verified, is_premium, credit_balance,
              cooldown_enabled, is_admin, is_banned, google_sub
       FROM users
       WHERE email = $1
       FOR UPDATE`,
      [email]
    );

    let user: AuthUserRow;
    let isNewUser = false;

    if (existingUserResult.rows.length > 0) {
      user = existingUserResult.rows[0];

      if (user.is_banned) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Your account has been suspended. Contact support@greenflag.app for assistance.' });
      }

      const existingGoogleSub = user.google_sub ? String(user.google_sub) : '';
      if (existingGoogleSub && existingGoogleSub !== googleSub) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'This email is already linked to another Google account.',
        });
      }

      if (!existingGoogleSub) {
        const linkResult = await client.query(
          `UPDATE users
           SET google_sub = $2, updated_at = NOW()
           WHERE id = $1
           RETURNING id, email, name, gender, interested_in, city, is_verified,
                     is_premium, credit_balance, cooldown_enabled, is_admin, is_banned, google_sub`,
          [user.id, googleSub]
        );
        user = linkResult.rows[0];
      }
    } else {
      isNewUser = true;
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      const cooldown_enabled = DAILY_LIMITS.male.cooldown_enabled_default;

      const userResult = await client.query(
        `INSERT INTO users (
           email, password_hash, name, gender, interested_in, date_of_birth, city,
           cooldown_enabled, auth_provider, google_sub
         )
         VALUES ($1, $2, $3, 'other', 'both', $4, $5, $6, 'google', $7)
         RETURNING id, email, name, gender, interested_in, city, is_verified, is_premium, credit_balance, cooldown_enabled, is_admin`,
        [email, passwordHash, displayName, DEFAULT_GOOGLE_DOB, DEFAULT_GOOGLE_CITY, cooldown_enabled, googleSub]
      );

      user = userResult.rows[0];
      await initializeUserDefaults(client, user.id);
    }

    await client.query('COMMIT');

    const token = signAuthToken(user.id);
    return res.json({
      message: 'Google authentication successful',
      user: buildUserPayload(user),
      token,
      is_new_user: isNewUser,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Google auth error:', error);
    return res.status(500).json({ error: 'Google authentication failed' });
  } finally {
    client.release();
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const smsConfigured = isSmsConfigured();
    const devBypass = canUseDevOtpBypass();
    if (!smsConfigured && !devBypass) {
      return res.status(503).json({ error: 'SMS provider is not configured' });
    }

    // Look up user
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      // Don't reveal whether email exists
      return res.json({ message: 'If that email is registered and has a verified phone, an OTP has been sent.' });
    }
    const userId = userResult.rows[0].id;

    // Find verified phone
    const vsResult = await pool.query(
      'SELECT phone FROM verification_status WHERE user_id = $1 AND otp_verified = TRUE',
      [userId]
    );
    if (vsResult.rows.length === 0 || !vsResult.rows[0].phone) {
      return res.json({
        message: 'No verified phone on file. Please contact support@greenflag.app for account recovery.',
      });
    }
    const phone = vsResult.rows[0].phone as string;

    // Generate OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    await pool.query(
      `INSERT INTO otp_codes (phone, code, expires_at, verify_attempts)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (phone) DO UPDATE SET code = $2, expires_at = $3, verify_attempts = 0, created_at = NOW()`,
      [phone, code, expiresAt]
    );

    await pool.query('INSERT INTO otp_request_audit (phone) VALUES ($1)', [phone]);

    if (smsConfigured) {
      await sendOtpSms(phone, code);
    }

    const phoneHint = '***' + phone.slice(-4);

    if (!smsConfigured) {
      console.log(`[DEV] Password reset OTP for ${phoneHint}: ${code}`);
    }

    return res.json({
      message: 'OTP sent to your verified phone number.',
      phone_hint: phoneHint,
      expires_in_seconds: OTP_TTL_SECONDS,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, code, new_password } = req.body;
    if (!email || !code || !new_password) {
      return res.status(400).json({ error: 'Email, code, and new_password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Look up user
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    const userId = userResult.rows[0].id;

    // Find their verified phone
    const vsResult = await pool.query(
      'SELECT phone FROM verification_status WHERE user_id = $1 AND otp_verified = TRUE',
      [userId]
    );
    if (vsResult.rows.length === 0 || !vsResult.rows[0].phone) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    const phone = vsResult.rows[0].phone as string;

    // Verify OTP
    const otpResult = await pool.query('SELECT * FROM otp_codes WHERE phone = $1', [phone]);
    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    const record = otpResult.rows[0];

    if (new Date(record.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    if (record.code !== code) {
      const nextAttempts = Number(record.verify_attempts || 0) + 1;
      if (nextAttempts >= 5) {
        await pool.query('DELETE FROM otp_codes WHERE phone = $1', [phone]);
        return res.status(429).json({ error: 'Too many invalid attempts. Request a new OTP.' });
      }
      await pool.query('UPDATE otp_codes SET verify_attempts = $2 WHERE phone = $1', [phone, nextAttempts]);
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // OTP valid — update password
    const passwordHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);
    await pool.query('DELETE FROM otp_codes WHERE phone = $1', [phone]);

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};
