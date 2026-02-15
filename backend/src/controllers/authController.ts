import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import pool from '../config/database';
import { JWT_CONFIG, DAILY_LIMITS } from '../utils/constants';
import { canUseDevOtpBypass, isSmsConfigured, sendOtpSms } from '../services/sms.service';

const OTP_TTL_SECONDS = 300;

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

    // Initialize user activity limits
    await client.query(
      `INSERT INTO user_activity_limits (user_id)
       VALUES ($1)`,
      [user.id]
    );

    await client.query(
      `INSERT INTO user_privacy_settings (user_id, hide_distance, hide_city, incognito_mode, show_online_status)
       VALUES ($1, FALSE, FALSE, FALSE, TRUE)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    await client.query(
      `INSERT INTO user_notification_preferences (
         user_id, likes, matches, messages, daily_picks, product_updates
       ) VALUES ($1, TRUE, TRUE, TRUE, TRUE, TRUE)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    await client.query('COMMIT');

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      JWT_CONFIG.secret,
      { expiresIn: JWT_CONFIG.expiresIn } as any
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
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
      },
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

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      JWT_CONFIG.secret,
      { expiresIn: JWT_CONFIG.expiresIn } as any
    );

    res.json({
      message: 'Login successful',
      user: {
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
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
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
