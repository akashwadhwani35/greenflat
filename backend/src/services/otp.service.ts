/**
 * One-time codes, shared by post-signup verification and the signup funnel.
 *
 * Both paths need identical rate limiting, expiry and attempt counting, and the
 * cost of them drifting apart is a bypass: a funnel that forgot the per-hour cap
 * would be an open SMS relay. So the rules live here once and the controllers
 * only decide what a verified code means.
 *
 * Delivery is by email or SMS. Email is the default path — it needs no carrier
 * registration and Resend's free tier covers our volume — while SMS to Indian
 * numbers requires TRAI DLT registration. When neither provider is configured
 * and ALLOW_DEV_OTP_BYPASS is on, codes are logged instead of sent.
 */
import pool from '../config/database';
import { canUseDevOtpBypass, isSmsConfigured, sendOtpSms } from './sms.service';
import { isEmailConfigured, normalizeEmail, sendOtpEmail } from './email.service';

export const OTP_TTL_SECONDS = 300;
export const OTP_REQUEST_COOLDOWN_SECONDS = 60;
export const OTP_REQUEST_LIMIT_PER_HOUR = 5;
export const OTP_VERIFY_MAX_ATTEMPTS = 5;

const DEFAULT_COUNTRY_CODE = process.env.OTP_DEFAULT_COUNTRY_CODE || '+1';

export type OtpChannel = 'email' | 'phone';
export type OtpTarget = { channel: OtpChannel; value: string };

export const normalizePhone = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;

  const plusPrefixed = value.startsWith('+');
  const digitsOnly = value.replace(/\D/g, '');

  if (!digitsOnly) return null;

  let normalized = '';
  if (plusPrefixed) {
    normalized = `+${digitsOnly}`;
  } else if (digitsOnly.length === 10) {
    // Default to US when users enter a local 10-digit number.
    normalized = `${DEFAULT_COUNTRY_CODE}${digitsOnly}`;
  } else {
    // Accept international numbers entered without a plus sign.
    normalized = `+${digitsOnly}`;
  }

  const normalizedDigits = normalized.startsWith('+') ? normalized.slice(1) : normalized;
  if (!/^\d{8,15}$/.test(normalizedDigits)) return null;
  return `+${normalizedDigits}`;
};

export const normalizeOtpCode = (raw: unknown): string | null => {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const digits = String(raw).replace(/\D/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
};

export const maskPhone = (phone: string) => {
  if (phone.length <= 4) return phone;
  return `${'*'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
};

export const maskEmail = (email: string) => {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const head = user.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(1, user.length - 1))}@${domain}`;
};

export const maskTarget = (t: OtpTarget) =>
  t.channel === 'email' ? maskEmail(t.value) : maskPhone(t.value);

export const resolveOtpTarget = (body: any): OtpTarget | null => {
  const email = normalizeEmail(body?.email);
  if (email) return { channel: 'email', value: email };

  const phone = normalizePhone(body?.phone);
  if (phone) return { channel: 'phone', value: phone };

  return null;
};

/** Which provider must be live for this channel, and whether it is. */
export const isChannelConfigured = (channel: OtpChannel) =>
  channel === 'email' ? isEmailConfigured() : isSmsConfigured();

export type IssueOutcome =
  | { ok: true; expiresInSeconds: number; destinationHint: string }
  | { ok: false; status: 503; error: string }
  | { ok: false; status: 429; error: string; retryInSeconds?: number; retryAfterSeconds?: number };

/**
 * Creates (or replaces) the live code for a destination and delivers it.
 *
 * There is at most one live code per destination: requesting again overwrites
 * the previous one and resets the attempt counter, which is why the cooldown
 * below matters — without it a resend loop would keep the counter at zero.
 */
export const issueOtp = async (target: OtpTarget): Promise<IssueOutcome> => {
  const column = target.channel;
  const configured = isChannelConfigured(target.channel);
  const devBypass = canUseDevOtpBypass();

  if (!configured && !devBypass) {
    return {
      ok: false,
      status: 503,
      error:
        target.channel === 'email'
          ? 'Email provider is not configured'
          : 'SMS provider is not configured',
    };
  }

  const recentOtp = await pool.query(`SELECT created_at FROM otp_codes WHERE ${column} = $1`, [
    target.value,
  ]);
  if (recentOtp.rows.length > 0) {
    const createdAt = new Date(recentOtp.rows[0].created_at).getTime();
    const secondsSinceLast = Math.floor((Date.now() - createdAt) / 1000);
    if (secondsSinceLast < OTP_REQUEST_COOLDOWN_SECONDS) {
      return {
        ok: false,
        status: 429,
        error: 'Please wait before requesting another OTP',
        retryInSeconds: OTP_REQUEST_COOLDOWN_SECONDS - secondsSinceLast,
      };
    }
  }

  const hourlyCount = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM otp_request_audit
     WHERE ${column} = $1 AND created_at >= NOW() - INTERVAL '1 hour'`,
    [target.value]
  );
  if (hourlyCount.rows[0]?.count >= OTP_REQUEST_LIMIT_PER_HOUR) {
    return {
      ok: false,
      status: 429,
      error: 'Too many OTP requests. Try again later.',
      retryAfterSeconds: 3600,
    };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await pool.query(
    `INSERT INTO otp_codes (${column}, code, expires_at, verify_attempts)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (${column}) DO UPDATE
       SET code = $2, expires_at = $3, verify_attempts = 0, created_at = NOW()`,
    [target.value, code, expiresAt]
  );

  await pool.query(`INSERT INTO otp_request_audit (${column}) VALUES ($1)`, [target.value]);

  if (configured) {
    if (target.channel === 'email') {
      await sendOtpEmail(target.value, code);
    } else {
      await sendOtpSms(target.value, code);
    }
  } else {
    console.log(`[DEV] Verification OTP for ${target.value}: ${code}`);
  }

  return {
    ok: true,
    expiresInSeconds: OTP_TTL_SECONDS,
    destinationHint: maskTarget(target),
  };
};

export type CheckOutcome =
  | { ok: true }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 429; error: string };

/**
 * Consumes the code on success, so a code is single-use. A wrong code burns an
 * attempt and the whole record is destroyed once the attempt budget is spent,
 * which forces the requester back through the rate-limited issue path.
 */
export const checkOtp = async (target: OtpTarget, code: string): Promise<CheckOutcome> => {
  const column = target.channel;
  const otpResult = await pool.query(`SELECT * FROM otp_codes WHERE ${column} = $1`, [target.value]);

  if (otpResult.rows.length === 0) {
    return { ok: false, status: 400, error: 'Invalid or expired code' };
  }

  const record = otpResult.rows[0];

  if (record.code !== code) {
    const nextAttempts = Number(record.verify_attempts || 0) + 1;
    if (nextAttempts >= OTP_VERIFY_MAX_ATTEMPTS) {
      await pool.query(`DELETE FROM otp_codes WHERE ${column} = $1`, [target.value]);
      return { ok: false, status: 429, error: 'Too many invalid attempts. Request a new OTP.' };
    }
    await pool.query(`UPDATE otp_codes SET verify_attempts = $2 WHERE ${column} = $1`, [
      target.value,
      nextAttempts,
    ]);
    return { ok: false, status: 400, error: 'Invalid or expired code' };
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 400, error: 'Invalid or expired code' };
  }

  await pool.query(`DELETE FROM otp_codes WHERE ${column} = $1`, [target.value]);
  return { ok: true };
};
