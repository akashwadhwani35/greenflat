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
    // Disabled under test so suites are not throttled by their own traffic.
    // ENABLE_RATE_LIMIT_IN_TESTS turns it back on for the tests that assert the
    // budgets themselves, which is the only way a mis-sized limit gets caught.
    if (process.env.NODE_ENV === 'test' && process.env.ENABLE_RATE_LIMIT_IN_TESTS !== 'true') {
      return next();
    }

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

/** Clears all counters. For tests that exercise the limiter directly. */
export const resetRateLimits = () => store.clear();

// Auth-specific rate limiters
// Login: 10 attempts per 15 minutes per IP
export const loginLimiter = rateLimit(15 * 60 * 1000, 10, 'login');

// Signup: 5 attempts per hour per IP
export const signupLimiter = rateLimit(60 * 60 * 1000, 5, 'signup');

// Password reset: 5 attempts per 15 minutes per IP
export const forgotPasswordLimiter = rateLimit(15 * 60 * 1000, 5, 'forgot-pw');

// Reset password verify: 10 attempts per 15 minutes per IP
export const resetPasswordLimiter = rateLimit(15 * 60 * 1000, 10, 'reset-pw');

/**
 * Staged signup.
 *
 * These CANNOT share the signup limiter. One honest user walking the funnel
 * makes six requests (start, phone, verify, email, verify, complete), which on
 * its own exceeds that limiter's budget of five per hour — every real signup
 * would 429 on the final step.
 *
 * The budgets below are deliberately loose, because per-IP is the wrong key for
 * the abuse that actually matters here and it punishes the wrong people:
 * mobile carriers put thousands of users behind one CGNAT address, so a tight
 * per-IP cap locks out a whole cell before it inconveniences an attacker with a
 * proxy pool.
 *
 * The real defences are keyed to the thing being abused, and live in
 * otp.service: at most one code per destination per 60s, five sends per
 * destination per hour (this is what stops SMS pumping), and a five-attempt
 * budget per code before it is destroyed (this is what stops code brute force).
 * What per-IP limiting is good for is bulk account creation, so the tighter
 * numbers are on the two endpoints that actually create things.
 */
// Opening funnels: 15 per hour per IP.
export const registrationStartLimiter = rateLimit(60 * 60 * 1000, 15, 'reg-start');

// The middle steps: generous. Each already requires a valid registration token,
// and sends are capped per destination.
export const registrationStepLimiter = rateLimit(60 * 60 * 1000, 60, 'reg-step');

// Accounts actually created: 15 per hour per IP.
export const registrationCompleteLimiter = rateLimit(60 * 60 * 1000, 15, 'reg-complete');
