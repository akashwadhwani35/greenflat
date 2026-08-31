/**
 * Staged signup: phone → OTP → email → OTP → password.
 *
 * The old one-shot POST /auth/signup still exists and still works. This is the
 * funnel the app walks a new user through, and it exists because each step has
 * to be verifiable before the next: there is no account to attach a verified
 * phone number to until the very last call.
 *
 * State lives in pending_registrations, keyed by an opaque registration token.
 * That token authorises nothing except finishing this one signup — it is not a
 * JWT, carries no user id, and is useless once the account exists.
 *
 * PHONE IS ENFORCED ONLY WHEN AN SMS PROVIDER IS CONFIGURED. Twilio is not wired
 * up in production yet, so today the app reads GET /auth/capabilities, sees
 * `sms: false`, and skips the two phone screens. The moment the SMS credentials
 * land, `sms` flips to true and the phone steps become mandatory server-side with
 * no code change and no client release.
 */
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../config/database';
import { DAILY_LIMITS } from '../utils/constants';
import { canUseDevOtpBypass, isSmsConfigured } from '../services/sms.service';
import { isEmailConfigured, normalizeEmail } from '../services/email.service';
import {
  checkOtp,
  issueOtp,
  normalizeOtpCode,
  normalizePhone,
  type OtpTarget,
} from '../services/otp.service';
import {
  buildUserPayload,
  initializeUserDefaults,
  signAuthToken,
  PLACEHOLDER_CITY,
  PLACEHOLDER_DOB,
  PLACEHOLDER_NAME,
} from '../services/accounts.service';

const REGISTRATION_TTL_HOURS = 24;
const MIN_PASSWORD_LENGTH = 8;

/** Phone verification is required whenever we can actually deliver an SMS. */
const isPhoneStepRequired = () => isSmsConfigured() || canUseDevOtpBypass();

type PendingRow = {
  id: number;
  token: string;
  phone: string | null;
  phone_verified: boolean;
  email: string | null;
  email_verified: boolean;
  google_sub: string | null;
  expires_at: Date;
};

const sweepExpired = async () => {
  await pool.query('DELETE FROM pending_registrations WHERE expires_at < NOW()');
};

const loadPending = async (token: unknown): Promise<PendingRow | null> => {
  if (typeof token !== 'string' || token.length < 16) return null;
  const result = await pool.query(
    'SELECT * FROM pending_registrations WHERE token = $1 AND expires_at > NOW()',
    [token]
  );
  return result.rows[0] || null;
};

const emailTaken = async (email: string): Promise<boolean> => {
  const result = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
  return result.rows.length > 0;
};

/**
 * What the client can actually use right now.
 *
 * The app renders its signup funnel from this rather than from a hardcoded list
 * of steps, so a provider that is not configured produces a shorter funnel
 * instead of a screen that dead-ends on a 503.
 */
export const getCapabilities = async (_req: Request, res: Response) => {
  const googleConfigured = Boolean(
    (process.env.GOOGLE_OAUTH_CLIENT_IDS || process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim()
  );

  return res.json({
    sms: isPhoneStepRequired(),
    email: isEmailConfigured() || canUseDevOtpBypass(),
    google: googleConfigured,
    min_password_length: MIN_PASSWORD_LENGTH,
  });
};

/** Opens a funnel and hands back the token the remaining steps are keyed by. */
export const startRegistration = async (_req: Request, res: Response) => {
  try {
    await sweepExpired();

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + REGISTRATION_TTL_HOURS * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO pending_registrations (token, expires_at) VALUES ($1, $2)',
      [token, expiresAt]
    );

    return res.status(201).json({
      registration_token: token,
      expires_at: expiresAt.toISOString(),
      phone_required: isPhoneStepRequired(),
    });
  } catch (error) {
    console.error('Start registration error:', error);
    return res.status(500).json({ error: 'Failed to start registration' });
  }
};

export const setRegistrationPhone = async (req: Request, res: Response) => {
  try {
    const pending = await loadPending(req.body?.registration_token);
    if (!pending) {
      return res.status(404).json({ error: 'Registration session not found or expired' });
    }

    const phone = normalizePhone(req.body?.phone);
    if (!phone) {
      return res.status(400).json({ error: 'A valid phone number is required' });
    }

    const target: OtpTarget = { channel: 'phone', value: phone };
    const outcome = await issueOtp(target);
    if (!outcome.ok) {
      return res.status(outcome.status).json({
        error: outcome.error,
        ...('retryInSeconds' in outcome && outcome.retryInSeconds !== undefined
          ? { retry_in_seconds: outcome.retryInSeconds }
          : {}),
        ...('retryAfterSeconds' in outcome && outcome.retryAfterSeconds !== undefined
          ? { retry_after_seconds: outcome.retryAfterSeconds }
          : {}),
      });
    }

    // Changing the number invalidates any verification already achieved on the old one.
    const keepPhoneVerified = pending.phone === phone && pending.phone_verified;
    await pool.query(
      `UPDATE pending_registrations
       SET phone = $2, phone_verified = $3, updated_at = NOW()
       WHERE id = $1`,
      [pending.id, phone, keepPhoneVerified]
    );

    return res.json({
      message: 'OTP sent',
      channel: 'phone',
      expires_in_seconds: outcome.expiresInSeconds,
      destination_hint: outcome.destinationHint,
    });
  } catch (error) {
    console.error('Registration phone error:', error);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
};

export const verifyRegistrationPhone = async (req: Request, res: Response) => {
  try {
    const pending = await loadPending(req.body?.registration_token);
    if (!pending) {
      return res.status(404).json({ error: 'Registration session not found or expired' });
    }
    if (!pending.phone) {
      return res.status(400).json({ error: 'No phone number on this registration' });
    }

    const code = normalizeOtpCode(req.body?.code);
    if (!code) {
      return res.status(400).json({ error: 'A 6-digit code is required' });
    }

    const outcome = await checkOtp({ channel: 'phone', value: pending.phone }, code);
    if (!outcome.ok) {
      return res.status(outcome.status).json({ error: outcome.error });
    }

    await pool.query(
      'UPDATE pending_registrations SET phone_verified = TRUE, updated_at = NOW() WHERE id = $1',
      [pending.id]
    );

    return res.json({ message: 'Phone verified', phone_verified: true });
  } catch (error) {
    console.error('Verify registration phone error:', error);
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

export const setRegistrationEmail = async (req: Request, res: Response) => {
  try {
    const pending = await loadPending(req.body?.registration_token);
    if (!pending) {
      return res.status(404).json({ error: 'Registration session not found or expired' });
    }

    if (isPhoneStepRequired() && !pending.phone_verified) {
      return res.status(409).json({ error: 'Verify your phone number first' });
    }

    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    // Fail here rather than at the end, so nobody fills in a password for an
    // account that was never going to be created.
    if (await emailTaken(email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const outcome = await issueOtp({ channel: 'email', value: email });
    if (!outcome.ok) {
      return res.status(outcome.status).json({
        error: outcome.error,
        ...('retryInSeconds' in outcome && outcome.retryInSeconds !== undefined
          ? { retry_in_seconds: outcome.retryInSeconds }
          : {}),
        ...('retryAfterSeconds' in outcome && outcome.retryAfterSeconds !== undefined
          ? { retry_after_seconds: outcome.retryAfterSeconds }
          : {}),
      });
    }

    // Same rule as the phone step: a new address is a new thing to verify.
    const keepEmailVerified = pending.email === email && pending.email_verified;
    await pool.query(
      `UPDATE pending_registrations
       SET email = $2, email_verified = $3, updated_at = NOW()
       WHERE id = $1`,
      [pending.id, email, keepEmailVerified]
    );

    return res.json({
      message: 'OTP sent',
      channel: 'email',
      expires_in_seconds: outcome.expiresInSeconds,
      destination_hint: outcome.destinationHint,
    });
  } catch (error) {
    console.error('Registration email error:', error);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
};

export const verifyRegistrationEmail = async (req: Request, res: Response) => {
  try {
    const pending = await loadPending(req.body?.registration_token);
    if (!pending) {
      return res.status(404).json({ error: 'Registration session not found or expired' });
    }
    if (!pending.email) {
      return res.status(400).json({ error: 'No email address on this registration' });
    }

    const code = normalizeOtpCode(req.body?.code);
    if (!code) {
      return res.status(400).json({ error: 'A 6-digit code is required' });
    }

    const outcome = await checkOtp({ channel: 'email', value: pending.email }, code);
    if (!outcome.ok) {
      return res.status(outcome.status).json({ error: outcome.error });
    }

    await pool.query(
      'UPDATE pending_registrations SET email_verified = TRUE, updated_at = NOW() WHERE id = $1',
      [pending.id]
    );

    return res.json({ message: 'Email verified', email_verified: true });
  } catch (error) {
    console.error('Verify registration email error:', error);
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

/**
 * Last step: sets the password and creates the real account.
 *
 * The account is created with placeholder name/city/date-of-birth because the
 * app asks for those in onboarding, which comes after this. It is deliberately
 * NOT discoverable yet — users.onboarding_completed_at stays null until the
 * profile is filled in, and discovery filters on it.
 */
export const completeRegistration = async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const pending = await loadPending(req.body?.registration_token);
    if (!pending) {
      return res.status(404).json({ error: 'Registration session not found or expired' });
    }

    if (isPhoneStepRequired() && !pending.phone_verified) {
      return res.status(409).json({ error: 'Verify your phone number first' });
    }
    if (!pending.email || !pending.email_verified) {
      return res.status(409).json({ error: 'Verify your email address first' });
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    // Re-checked inside the transaction: the address was free when we sent the
    // code, which was minutes ago.
    if (await emailTaken(pending.email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (
         email, password_hash, name, gender, interested_in, date_of_birth, city,
         cooldown_enabled, auth_provider, is_verified
       )
       VALUES ($1, $2, $3, 'other', 'both', $4, $5, $6, 'password', TRUE)
       RETURNING id, email, name, gender, interested_in, pronouns, city, is_verified,
                 is_premium, credit_balance, cooldown_enabled, is_admin, onboarding_completed_at`,
      [
        pending.email,
        passwordHash,
        PLACEHOLDER_NAME,
        PLACEHOLDER_DOB,
        PLACEHOLDER_CITY,
        // Real default is set from gender during onboarding; men default to off.
        DAILY_LIMITS.male.cooldown_enabled_default,
      ]
    );

    const user = userResult.rows[0];
    await initializeUserDefaults(client, user.id);

    // Carry the verification work done in the funnel onto the new account.
    await client.query(
      `INSERT INTO verification_status (user_id, phone, email, email_verified, otp_verified, updated_at)
       VALUES ($1, $2, $3, TRUE, TRUE, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET phone = $2, email = $3, email_verified = TRUE, otp_verified = TRUE, updated_at = NOW()`,
      [user.id, pending.phone, pending.email]
    );

    await client.query('DELETE FROM pending_registrations WHERE id = $1', [pending.id]);

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Account created',
      user: buildUserPayload(user),
      token: signAuthToken(user.id),
      // The app sends them straight into onboarding on this.
      onboarding_required: true,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Complete registration error:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  } finally {
    client.release();
  }
};
