import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';
import { analyzeSelfieAge } from '../services/openai.service';
import { canUseDevOtpBypass, isSmsConfigured, sendOtpSms } from '../services/sms.service';

const OTP_TTL_SECONDS = 300;
const OTP_REQUEST_COOLDOWN_SECONDS = 60;
const OTP_REQUEST_LIMIT_PER_HOUR = 5;
const OTP_VERIFY_MAX_ATTEMPTS = 5;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

const normalizePhone = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const stripped = raw.replace(/[^\d+]/g, '');
  if (!stripped.startsWith('+')) return null;
  const digits = stripped.slice(1);
  if (!/^\d{8,15}$/.test(digits)) return null;
  return `+${digits}`;
};

const getOrCreateVerificationStatus = async (userId: number) => {
  const existing = await pool.query(
    'SELECT * FROM verification_status WHERE user_id = $1',
    [userId]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const inserted = await pool.query(
    `INSERT INTO verification_status (user_id) VALUES ($1) RETURNING *`,
    [userId]
  );
  return inserted.rows[0];
};

export const requestOtp = async (req: Request, res: Response) => {
  try {
    const normalizedPhone = normalizePhone((req.body as any)?.phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Phone is required' });
    }

    const smsConfigured = isSmsConfigured();
    const devBypass = canUseDevOtpBypass();
    if (!smsConfigured && !devBypass) {
      return res.status(503).json({ error: 'SMS provider is not configured' });
    }

    const recentOtp = await pool.query(
      'SELECT created_at FROM otp_codes WHERE phone = $1',
      [normalizedPhone]
    );
    if (recentOtp.rows.length > 0) {
      const createdAt = new Date(recentOtp.rows[0].created_at).getTime();
      const secondsSinceLast = Math.floor((Date.now() - createdAt) / 1000);
      if (secondsSinceLast < OTP_REQUEST_COOLDOWN_SECONDS) {
        return res.status(429).json({
          error: 'Please wait before requesting another OTP',
          retry_in_seconds: OTP_REQUEST_COOLDOWN_SECONDS - secondsSinceLast,
        });
      }
    }

    const hourlyCount = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM otp_request_audit
       WHERE phone = $1 AND created_at >= NOW() - INTERVAL '1 hour'`,
      [normalizedPhone]
    );
    if (hourlyCount.rows[0]?.count >= OTP_REQUEST_LIMIT_PER_HOUR) {
      return res.status(429).json({
        error: 'Too many OTP requests. Try again later.',
        retry_after_seconds: 3600,
      });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    await pool.query(
      `
        INSERT INTO otp_codes (phone, code, expires_at, verify_attempts)
        VALUES ($1, $2, $3, 0)
        ON CONFLICT (phone) DO UPDATE SET code = $2, expires_at = $3, verify_attempts = 0, created_at = NOW()
      `,
      [normalizedPhone, code, expiresAt]
    );

    await pool.query(
      'INSERT INTO otp_request_audit (phone) VALUES ($1)',
      [normalizedPhone]
    );

    if (smsConfigured) {
      await sendOtpSms(normalizedPhone, code);
    }

    return res.json({
      message: 'OTP sent',
      expires_in_seconds: OTP_TTL_SECONDS,
      ...(smsConfigured ? {} : { dev_code: code, delivery: 'dev-bypass' }),
    });
  } catch (error) {
    console.error('Request OTP error', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

export const verifyOtp = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const normalizedPhone = normalizePhone((req.body as any)?.phone);
    const { code } = req.body;
    if (!normalizedPhone || !code) {
      return res.status(400).json({ error: 'Phone and code are required' });
    }
    const otpResult = await pool.query(
      'SELECT * FROM otp_codes WHERE phone = $1',
      [normalizedPhone]
    );
    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    const record = otpResult.rows[0];
    if (record.code !== code) {
      const nextAttempts = Number(record.verify_attempts || 0) + 1;
      if (nextAttempts >= OTP_VERIFY_MAX_ATTEMPTS) {
        await pool.query('DELETE FROM otp_codes WHERE phone = $1', [normalizedPhone]);
        return res.status(429).json({ error: 'Too many invalid attempts. Request a new OTP.' });
      }
      await pool.query(
        'UPDATE otp_codes SET verify_attempts = $2 WHERE phone = $1',
        [normalizedPhone, nextAttempts]
      );
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    await pool.query('DELETE FROM otp_codes WHERE phone = $1', [normalizedPhone]);
    await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [userId]);
    const statusResult = await pool.query(
      `INSERT INTO verification_status (user_id, phone, otp_verified, updated_at)
       VALUES ($1, $2, TRUE, NOW())
       ON CONFLICT (user_id) DO UPDATE SET phone = $2, otp_verified = TRUE, updated_at = NOW()
       RETURNING *`,
      [userId, normalizedPhone]
    );

    res.json({ message: 'OTP verified', status: statusResult.rows[0] });
  } catch (error) {
    console.error('Verify OTP error', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

export const verifySelfieAge = async (req: AuthRequest, res: Response) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'Selfie verification is not configured' });
    }
    const userId = req.userId!;
    const { photo_url } = req.body;
    if (!photo_url) {
      return res.status(400).json({ error: 'photo_url is required' });
    }

    const result = await analyzeSelfieAge(photo_url);
    if (!result.isAdult || result.confidence < 0.6) {
      await pool.query(
        `INSERT INTO verification_status (user_id, face_status, age_verified, updated_at)
         VALUES ($1, 'failed', FALSE, NOW())
         ON CONFLICT (user_id) DO UPDATE SET face_status = 'failed', age_verified = FALSE, updated_at = NOW()`,
        [userId]
      );
      return res.status(400).json({ error: 'Age verification failed', reasoning: result.reasoning });
    }

    await pool.query(
      `INSERT INTO verification_status (user_id, face_status, age_verified, updated_at)
       VALUES ($1, 'verified', TRUE, NOW())
       ON CONFLICT (user_id) DO UPDATE SET face_status = 'verified', age_verified = TRUE, updated_at = NOW()`,
      [userId]
    );

    res.json({
      message: 'Selfie verified',
      confidence: result.confidence,
      reasoning: result.reasoning,
    });
  } catch (error: any) {
    console.error('verifySelfieAge error', error);
    res.status(500).json({ error: error.message || 'Failed to verify selfie' });
  }
};

export const verifyLocation = (req: AuthRequest, res: Response) => {
  const doWork = async () => {
    try {
      const userId = req.userId!;
      const { lat, lng, city } = req.body;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return res.status(400).json({ error: 'lat and lng required' });
      }

      let resolvedCity = city || null;
      if (!resolvedCity && GOOGLE_MAPS_API_KEY) {
        try {
          const geoResponse = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
          );
          if (geoResponse.ok) {
            const geoJson = (await geoResponse.json()) as any;
            const loc = geoJson.results?.[0];
            const cityComponent = loc?.address_components?.find((c: any) =>
              c.types?.includes('locality')
            );
            resolvedCity = cityComponent?.long_name || loc?.formatted_address || null;
          }
        } catch (geoError) {
          console.error('Geocode lookup failed', geoError);
        }
      }

      await pool.query(
        `INSERT INTO verification_status (user_id, location_verified, location_lat, location_lng, location_city, updated_at)
         VALUES ($1, TRUE, $2, $3, $4, NOW())
         ON CONFLICT (user_id) DO UPDATE SET location_verified = TRUE, location_lat = $2, location_lng = $3, location_city = $4, updated_at = NOW()`,
        [userId, lat, lng, resolvedCity]
      );

      // Store coordinates on user record to support distance-based matching
      await pool.query(
        `UPDATE users
         SET latitude = $1, longitude = $2, city = COALESCE($3, city), updated_at = NOW()
         WHERE id = $4`,
        [lat, lng, resolvedCity, userId]
      );

      res.json({ message: 'Location verified', city: resolvedCity });
    } catch (error) {
      console.error('Verify location error', error);
      res.status(500).json({ error: 'Failed to verify location' });
    }
  };

  void doWork();
};

export const getVerificationStatus = (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    getOrCreateVerificationStatus(userId)
      .then((status) => res.json({ status }))
      .catch((err) => {
        console.error('Get verification status db error', err);
        res.status(500).json({ error: 'Failed to fetch status' });
      });
  } catch (error) {
    console.error('Get verification status error', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
};

// Public geocode endpoint (no auth required) for onboarding
export const publicGeocode = async (req: Request, res: Response) => {
  try {
    const { lat, lng, query } = req.body;
    const hasCoords = typeof lat === 'number' && typeof lng === 'number';
    const hasQuery = typeof query === 'string' && query.trim().length > 0;

    if (!hasCoords && !hasQuery) {
      return res.status(400).json({ error: 'Provide lat/lng or query' });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      if (hasQuery) {
        return res.json({
          city: query,
          suggestions: [{ city: query, lat: undefined, lng: undefined }],
        });
      }
      return res.status(500).json({ error: 'Google Maps API key not configured' });
    }

    const url = hasCoords
      ? `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      : `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;

    let city = null;
    let coords: { lat?: number; lng?: number } = {};
    let geoJson: any = { results: [] as any[] };

    try {
      const geoResponse = await fetch(url);
      if (geoResponse.ok) {
        geoJson = (await geoResponse.json()) as any;
        const loc = geoJson.results?.[0];
        const cityComponent = loc?.address_components?.find((c: any) =>
          c.types?.includes('locality')
        );
        city = cityComponent?.long_name || loc?.formatted_address || null;
        coords = loc?.geometry?.location || {};
      }
    } catch (geoError) {
      console.error('Geocode lookup failed', geoError);
    }

    const suggestions = (geoJson?.results || []).slice(0, 5).map((r: any) => ({
      city:
        r.address_components?.find((c: any) => c.types?.includes('locality'))?.long_name ||
        r.formatted_address ||
        query,
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
    }));

    res.json({ city: city || null, lat: coords.lat, lng: coords.lng, suggestions });
  } catch (error) {
    console.error('Public geocode error', error);
    res.status(500).json({ error: 'Failed to geocode location' });
  }
};
