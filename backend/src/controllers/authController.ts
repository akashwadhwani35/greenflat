import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { JWT_CONFIG, DAILY_LIMITS } from '../utils/constants';
import { canUseDevOtpBypass, isSmsConfigured, sendOtpSms } from '../services/sms.service';
import { normalizeEmail } from '../services/email.service';
import {
  checkOtp,
  issueOtp,
  isChannelConfigured,
  normalizeOtpCode,
  type OtpTarget,
} from '../services/otp.service';
import {
  buildUserPayload,
  initializeUserDefaults,
  signAuthToken,
  PLACEHOLDER_CITY,
  PLACEHOLDER_DOB,
  type AuthUserRow,
} from '../services/accounts.service';

const OTP_TTL_SECONDS = 300;
const DEFAULT_GOOGLE_DOB = PLACEHOLDER_DOB;
const DEFAULT_GOOGLE_CITY = PLACEHOLDER_CITY;

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
       RETURNING id, email, name, gender, interested_in, pronouns, city, is_verified, is_premium, credit_balance, cooldown_enabled, is_admin, onboarding_completed_at, created_at`,
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
      'SELECT id, email, password_hash, name, gender, interested_in, pronouns, city, is_verified, is_premium, credit_balance, cooldown_enabled, is_admin, is_banned, onboarding_completed_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account has been suspended. Contact support@gflag.app for assistance.' });
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
      `SELECT id, email, name, gender, interested_in, pronouns, city, is_verified, is_premium, credit_balance,
              cooldown_enabled, is_admin, is_banned, google_sub, onboarding_completed_at
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
        return res.status(403).json({ error: 'Your account has been suspended. Contact support@gflag.app for assistance.' });
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
           RETURNING id, email, name, gender, interested_in, pronouns, city, is_verified,
                     is_premium, credit_balance, cooldown_enabled, is_admin, is_banned, google_sub,
                     onboarding_completed_at`,
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
         RETURNING id, email, name, gender, interested_in, pronouns, city, is_verified, is_premium, credit_balance, cooldown_enabled, is_admin, onboarding_completed_at`,
        [email, passwordHash, displayName, DEFAULT_GOOGLE_DOB, DEFAULT_GOOGLE_CITY, cooldown_enabled, googleSub]
      );

      user = userResult.rows[0];
      await initializeUserDefaults(client, user.id);
    }

    // The signup funnel offers "connect with Google" on the same screen as
    // "add email". Taking that branch must not throw away the phone number the
    // user already verified two screens earlier.
    const registrationToken = typeof req.body?.registration_token === 'string'
      ? req.body.registration_token
      : null;

    if (registrationToken) {
      const pending = await client.query(
        `SELECT id, phone, phone_verified
         FROM pending_registrations
         WHERE token = $1 AND expires_at > NOW()`,
        [registrationToken]
      );

      const row = pending.rows[0];
      if (row?.phone_verified && row.phone) {
        await client.query(
          `INSERT INTO verification_status (user_id, phone, email, email_verified, otp_verified, updated_at)
           VALUES ($1, $2, $3, TRUE, TRUE, NOW())
           ON CONFLICT (user_id) DO UPDATE
             SET phone = $2, email = $3, email_verified = TRUE, otp_verified = TRUE, updated_at = NOW()`,
          [user.id, row.phone, user.email]
        );
      }
      if (row) {
        await client.query('DELETE FROM pending_registrations WHERE id = $1', [row.id]);
      }
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

/**
 * Password reset.
 *
 * The code goes to the account's own email address, not to a verified phone.
 * Phone was the only channel here, which made reset impossible for everyone:
 * SMS is not configured, so this endpoint returned 503 to every request, and
 * even with SMS live it only worked for users who had completed phone
 * verification. Email is the address they just typed in and the one every
 * account is guaranteed to have.
 *
 * Phone remains a fallback for accounts with a verified number when email
 * delivery is unavailable, so nothing that worked before stops working.
 */
export const forgotPassword = async (req: Request, res: Response) => {
  // Deliberately identical whether or not the address exists, so this cannot be
  // used to find out who has an account.
  const genericResponse = {
    message: 'If that email is registered, a reset code has been sent to it.',
    expires_in_seconds: OTP_TTL_SECONDS,
  };

  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.json(genericResponse);
    }
    const userId = userResult.rows[0].id;

    // Email first. Fall back to a verified phone only if email cannot be sent.
    let target: OtpTarget = { channel: 'email', value: email };
    if (!isChannelConfigured('email') && !canUseDevOtpBypass()) {
      const phoneResult = await pool.query(
        'SELECT phone FROM verification_status WHERE user_id = $1 AND otp_verified = TRUE',
        [userId]
      );
      const phone = phoneResult.rows[0]?.phone;
      if (!phone) {
        return res.status(503).json({
          error: 'Password reset is temporarily unavailable. Please contact support.',
        });
      }
      target = { channel: 'phone', value: phone };
    }

    const outcome = await issueOtp(target);
    if (!outcome.ok) {
      // A rate limit is about this address, so it is safe to report honestly.
      if (outcome.status === 429) {
        return res.status(429).json({ error: outcome.error });
      }
      return res.status(outcome.status).json({ error: outcome.error });
    }

    return res.json({
      ...genericResponse,
      channel: target.channel,
      destination_hint: outcome.destinationHint,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Failed to start password reset' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = normalizeOtpCode(req.body?.code);
    const newPassword = typeof req.body?.new_password === 'string' ? req.body.new_password : '';

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new_password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    const userId = userResult.rows[0].id;

    // Try the email code first, then a phone code, matching whichever channel
    // forgotPassword actually used for this account.
    let outcome = await checkOtp({ channel: 'email', value: email }, code);

    if (!outcome.ok) {
      const phoneResult = await pool.query(
        'SELECT phone FROM verification_status WHERE user_id = $1 AND otp_verified = TRUE',
        [userId]
      );
      const phone = phoneResult.rows[0]?.phone;
      if (phone) {
        const phoneOutcome = await checkOtp({ channel: 'phone', value: phone }, code);
        if (phoneOutcome.ok) outcome = phoneOutcome;
      }
    }

    if (!outcome.ok) {
      return res.status(outcome.status).json({ error: outcome.error });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      passwordHash,
      userId,
    ]);

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};
