import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import pool from '../config/database';
import { JWT_CONFIG, DAILY_LIMITS } from '../utils/constants';

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
       RETURNING id, email, name, gender, interested_in, city, is_verified, is_premium, credit_balance, cooldown_enabled, created_at`,
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
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

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
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};
