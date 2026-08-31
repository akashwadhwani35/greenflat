import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';
import { analyzeSelfieAgainstProfile } from '../services/openai.service';
import { normalizeEmail } from '../services/email.service';
import {
  checkOtp,
  issueOtp,
  maskPhone,
  normalizeOtpCode,
  normalizePhone,
  resolveOtpTarget,
  type OtpChannel,
  type OtpTarget,
} from '../services/otp.service';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

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
    const target = resolveOtpTarget(req.body);
    if (!target) {
      return res.status(400).json({ error: 'A valid email address or phone number is required' });
    }

    const outcome = await issueOtp(target);
    if (!outcome.ok) {
      return res.status(outcome.status).json({
        error: outcome.error,
        ...(outcome.status === 429 && 'retryInSeconds' in outcome && outcome.retryInSeconds !== undefined
          ? { retry_in_seconds: outcome.retryInSeconds }
          : {}),
        ...(outcome.status === 429 && 'retryAfterSeconds' in outcome && outcome.retryAfterSeconds !== undefined
          ? { retry_after_seconds: outcome.retryAfterSeconds }
          : {}),
      });
    }

    return res.json({
      message: 'OTP sent',
      channel: target.channel,
      expires_in_seconds: outcome.expiresInSeconds,
      destination_hint: outcome.destinationHint,
      // Kept for older clients that read these fields.
      phone_hint: target.channel === 'phone' ? maskPhone(target.value) : undefined,
      normalized_phone: target.channel === 'phone' ? target.value : undefined,
    });
  } catch (error) {
    console.error('Request OTP error', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

export const verifyOtp = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const target = resolveOtpTarget(req.body);
    const normalizedCode = normalizeOtpCode((req.body as any)?.code);
    if (!target || !normalizedCode) {
      return res.status(400).json({
        error: 'A valid email address or phone number and a 6-digit code are required',
      });
    }

    const outcome = await checkOtp(target, normalizedCode);
    if (!outcome.ok) {
      return res.status(outcome.status).json({ error: outcome.error });
    }

    await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [userId]);

    const statusResult = target.channel === 'email'
      ? await pool.query(
          `INSERT INTO verification_status (user_id, email, email_verified, otp_verified, updated_at)
           VALUES ($1, $2, TRUE, TRUE, NOW())
           ON CONFLICT (user_id) DO UPDATE
             SET email = $2, email_verified = TRUE, otp_verified = TRUE, updated_at = NOW()
           RETURNING *`,
          [userId, target.value]
        )
      : await pool.query(
          `INSERT INTO verification_status (user_id, phone, otp_verified, updated_at)
           VALUES ($1, $2, TRUE, NOW())
           ON CONFLICT (user_id) DO UPDATE
             SET phone = $2, otp_verified = TRUE, updated_at = NOW()
           RETURNING *`,
          [userId, target.value]
        );

    return res.json({
      // `status` is the field the shipped client reads; keep it.
      message: 'OTP verified',
      channel: target.channel,
      status: statusResult.rows[0],
      verification: statusResult.rows[0],
    });
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

    const profilePhotoResult = await pool.query(
      `SELECT photo_url
       FROM photos
       WHERE user_id = $1
       ORDER BY is_primary DESC, order_index ASC, id ASC
       LIMIT 1`,
      [userId]
    );

    if (profilePhotoResult.rows.length === 0 || !profilePhotoResult.rows[0].photo_url) {
      return res.status(400).json({ error: 'Upload a profile photo before selfie verification' });
    }

    const profilePhotoUrl = profilePhotoResult.rows[0].photo_url as string;
    const result = await analyzeSelfieAgainstProfile(photo_url, profilePhotoUrl);
    if (!result.isAdult || !result.isMatch || result.confidence < 0.6) {
      await pool.query(
        `INSERT INTO verification_status (user_id, face_status, age_verified, updated_at)
         VALUES ($1, 'failed', FALSE, NOW())
         ON CONFLICT (user_id) DO UPDATE SET face_status = 'failed', age_verified = FALSE, updated_at = NOW()`,
        [userId]
      );
      const errorMessage = !result.isMatch
        ? 'Selfie does not match your profile photo'
        : 'Age verification failed';
      return res.status(400).json({ error: errorMessage, reasoning: result.reasoning });
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
export const verifyLocation = async (req: AuthRequest, res: Response) => {
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
