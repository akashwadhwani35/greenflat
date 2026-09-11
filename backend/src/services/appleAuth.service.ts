/**
 * Verifying a Sign in with Apple identity token.
 *
 * The token is a JWT signed by Apple with one of a rotating set of keys, so the
 * signature has to be checked against Apple's published JWKS rather than a
 * shared secret. Nothing in the token is trusted until that passes — the client
 * could send anything.
 *
 * What comes back that we can rely on:
 *  - `sub`, stable for this person across our whole developer team, and the only
 *    durable identifier. The email may be a private relay address and can
 *    change; the name is sent by the *client* on first authorisation only and
 *    never appears in the token at all.
 *
 * The keys are fetched and converted with node's own crypto rather than a JWKS
 * library: it is a dozen lines, avoids a dependency that ships ESM Jest cannot
 * parse, and keeps the cache policy visible here.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';
const KEY_CACHE_MS = 24 * 60 * 60 * 1000;

type Jwk = { kid: string; kty: string; n: string; e: string; alg?: string; use?: string };

let cachedKeys: { fetchedAt: number; keys: Jwk[] } | null = null;

const fetchAppleKeys = async (force = false): Promise<Jwk[]> => {
  const fresh = cachedKeys && Date.now() - cachedKeys.fetchedAt < KEY_CACHE_MS;
  if (fresh && !force) return cachedKeys!.keys;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(APPLE_JWKS_URI, { signal: controller.signal });
    if (!response.ok) throw new Error(`JWKS HTTP ${response.status}`);
    const body = (await response.json()) as { keys?: Jwk[] };
    const keys = Array.isArray(body.keys) ? body.keys : [];
    if (keys.length === 0) throw new Error('JWKS empty');
    cachedKeys = { fetchedAt: Date.now(), keys };
    return keys;
  } finally {
    clearTimeout(timeout);
  }
};

/** The signing key for this token's `kid`, refetching once if it is unknown. */
const publicKeyForKid = async (kid: string): Promise<string> => {
  let keys = await fetchAppleKeys();
  let jwk = keys.find((k) => k.kid === kid);
  if (!jwk) {
    // Apple rotated since the cache was filled.
    keys = await fetchAppleKeys(true);
    jwk = keys.find((k) => k.kid === kid);
  }
  if (!jwk) throw new Error('APPLE_SIGNING_KEY_NOT_FOUND');
  return crypto.createPublicKey({ key: jwk as any, format: 'jwk' }).export({ type: 'spki', format: 'pem' }).toString();
};

const DEFAULT_AUDIENCE = 'app.gflag.greenflag';

/** Typed as non-empty because jsonwebtoken's `audience` option requires it. */
const allowedAudiences = (): [string, ...string[]] => {
  const raw = (process.env.APPLE_CLIENT_IDS || process.env.IOS_BUNDLE_ID || DEFAULT_AUDIENCE).trim();
  const list = [...new Set(raw.split(',').map((v) => v.trim()).filter(Boolean))];
  return list.length > 0 ? (list as [string, ...string[]]) : [DEFAULT_AUDIENCE];
};

export type AppleIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  /** True when Apple is relaying to a private address rather than the real one. */
  isPrivateRelay: boolean;
};

export const verifyAppleIdentityToken = async (identityToken: string): Promise<AppleIdentity> => {
  if (typeof identityToken !== 'string' || identityToken.length < 20) {
    throw new Error('INVALID_APPLE_TOKEN');
  }

  const decoded = jwt.decode(identityToken, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid || decoded?.header?.alg !== 'RS256') throw new Error('INVALID_APPLE_TOKEN');

  const publicKey = await publicKeyForKid(kid);

  let payload: any;
  try {
    payload = jwt.verify(identityToken, publicKey, {
      algorithms: ['RS256'],
      issuer: APPLE_ISSUER,
      audience: allowedAudiences(),
    });
  } catch (err: any) {
    // jsonwebtoken's messages are precise; keep them in the log, not the response.
    console.error('Apple token verification failed:', err?.message || err);
    if (err?.name === 'TokenExpiredError') throw new Error('EXPIRED_APPLE_TOKEN');
    if (/audience/i.test(err?.message || '')) throw new Error('APPLE_AUDIENCE_MISMATCH');
    throw new Error('INVALID_APPLE_TOKEN');
  }

  const sub = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
  if (!sub) throw new Error('INVALID_APPLE_TOKEN');

  const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : null;
  // Apple sends these as the strings "true"/"false" as often as booleans.
  const asBool = (v: unknown) => v === true || String(v).toLowerCase() === 'true';

  return {
    sub,
    email,
    emailVerified: asBool(payload?.email_verified),
    isPrivateRelay: asBool(payload?.is_private_email),
  };
};
