import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';
import { createYotiSession, getYotiSessionResult, isYotiConfigured } from '../services/yoti.service';
import { analyzeSelfieAge } from '../services/openai.service';

const OTP_TTL_SECONDS = 300;
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
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone is required' });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    await pool.query(
      `
        INSERT INTO otp_codes (phone, code, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (phone) DO UPDATE SET code = $2, expires_at = $3, created_at = NOW()
      `,
      [phone, code, expiresAt]
    );

    res.json({
      message: 'OTP sent (demo)',
      demo_code: code, // NOTE: return only for demo/testing
      expires_in_seconds: OTP_TTL_SECONDS,
    });
  } catch (error) {
    console.error('Request OTP error', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

export const verifyOtp = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and code are required' });
    }
    const otpResult = await pool.query(
      'SELECT * FROM otp_codes WHERE phone = $1',
      [phone]
    );
    if (otpResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    const record = otpResult.rows[0];
    if (record.code !== code) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    await pool.query('DELETE FROM otp_codes WHERE phone = $1', [phone]);
    await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [userId]);
    const statusResult = await pool.query(
      `INSERT INTO verification_status (user_id, phone, otp_verified, updated_at)
       VALUES ($1, $2, TRUE, NOW())
       ON CONFLICT (user_id) DO UPDATE SET phone = $2, otp_verified = TRUE, updated_at = NOW()
       RETURNING *`,
      [userId, phone]
    );

    res.json({ message: 'OTP verified', status: statusResult.rows[0] });
  } catch (error) {
    console.error('Verify OTP error', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

export const startFaceCheck = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Check if Yoti is configured
    if (!isYotiConfigured()) {
      // Fallback to demo mode
      await pool.query(
        `INSERT INTO verification_status (user_id, face_status, updated_at)
         VALUES ($1, 'pending', NOW())
         ON CONFLICT (user_id) DO UPDATE SET face_status = 'pending', updated_at = NOW()`,
        [userId]
      );
      return res.json({
        message: 'Face verification started (demo mode - Yoti not configured)',
        demo: true
      });
    }

    // Create Yoti session
    const yotiSession = await createYotiSession(userId);

    // Store session ID in verification status
    await pool.query(
      `INSERT INTO verification_status (user_id, face_status, updated_at)
       VALUES ($1, 'pending', NOW())
       ON CONFLICT (user_id) DO UPDATE SET face_status = 'pending', updated_at = NOW()`,
      [userId]
    );

    // Store session ID temporarily (you might want to add a yoti_session_id column)
    // For now, we'll return it to the client
    res.json({
      message: 'Yoti session created',
      sessionId: yotiSession.sessionId,
      clientSessionToken: yotiSession.clientSessionToken,
      sessionUrl: yotiSession.sessionUrl,
      demo: false,
    });
  } catch (error: any) {
    console.error('Start face check error', error);
    res.status(500).json({ error: error.message || 'Failed to start face check' });
  }
};

export const completeFaceCheck = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { success, age_verified, sessionId } = req.body;

    // If sessionId provided, retrieve Yoti results
    if (sessionId && isYotiConfigured()) {
      const yotiResult = await getYotiSessionResult(sessionId);

      if (yotiResult.error) {
        return res.status(400).json({ error: yotiResult.error });
      }

      // Update verification status with Yoti results
      await pool.query(
        `INSERT INTO verification_status (user_id, face_status, age_verified, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET face_status = $2, age_verified = $3, updated_at = NOW()`,
        [userId, yotiResult.success ? 'verified' : 'failed', yotiResult.ageVerified]
      );

      return res.json({
        message: yotiResult.success ? 'Verification successful' : 'Verification failed',
        ageVerified: yotiResult.ageVerified,
        livenessVerified: yotiResult.livenessVerified,
        dateOfBirth: yotiResult.dateOfBirth,
        documentType: yotiResult.documentType,
        issuingCountry: yotiResult.issuingCountry,
      });
    }

    // Fallback to demo mode
    await pool.query(
      `INSERT INTO verification_status (user_id, face_status, age_verified, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET face_status = $2, age_verified = (verification_status.age_verified OR $3), updated_at = NOW()`,
      [userId, success ? 'verified' : 'failed', Boolean(age_verified)]
    );

    res.json({
      message: success ? 'Face verified (demo)' : 'Face verification failed (demo)',
      demo: true
    });
  } catch (error: any) {
    console.error('Complete face check error', error);
    res.status(500).json({ error: error.message || 'Failed to complete face check' });
  }
};

export const verifySelfieAge = async (req: AuthRequest, res: Response) => {
  try {
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
