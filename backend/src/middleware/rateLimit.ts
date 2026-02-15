import { Request, Response, NextFunction } from 'express';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Simple in-memory rate limiter.
 * @param windowMs - Time window in milliseconds
 * @param maxRequests - Maximum requests per window per key
 * @param keyPrefix - Prefix to namespace different limiters
 */
export const rateLimit = (windowMs: number, maxRequests: number, keyPrefix: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test') return next();

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retry_after_seconds: retryAfter,
      });
    }

    entry.count++;
    next();
  };
};

// Auth-specific rate limiters
// Login: 10 attempts per 15 minutes per IP
export const loginLimiter = rateLimit(15 * 60 * 1000, 10, 'login');

// Signup: 5 attempts per hour per IP
export const signupLimiter = rateLimit(60 * 60 * 1000, 5, 'signup');

// Password reset: 5 attempts per 15 minutes per IP
export const forgotPasswordLimiter = rateLimit(15 * 60 * 1000, 5, 'forgot-pw');

// Reset password verify: 10 attempts per 15 minutes per IP
export const resetPasswordLimiter = rateLimit(15 * 60 * 1000, 10, 'reset-pw');
