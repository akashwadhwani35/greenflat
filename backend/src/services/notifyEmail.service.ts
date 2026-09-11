/**
 * Transactional email dispatch, looked up by user id.
 *
 * Call sites know a user id, not an address, and none of them should grow a
 * query and a try/catch just to send a courtesy email. Everything here is
 * fire-and-forget: it resolves the address itself, never throws, and never
 * blocks the signup, purchase or match that triggered it.
 */
import pool from '../config/database';
import {
  renderWelcomeEmail,
  renderPurchaseEmail,
  renderMatchEmail,
  sendTransactionalEmail,
} from './email.service';

const recipient = async (userId: number): Promise<{ email: string; name: string } | null> => {
  try {
    const result = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
    const row = result.rows[0];
    if (!row?.email) return null;
    const email = String(row.email).toLowerCase();
    // Phone-first signups get a placeholder address that cannot receive mail.
    if (email.endsWith('@phone.greenflag.app')) return null;
    // Reserved and seed domains. These hard-bounce, and a run of bounces is
    // charged against the sending domain's reputation, so seeding a demo set
    // must not cost us deliverability for real users.
    if (/@(example\.(com|org|net)|test|invalid|localhost)$/.test(email)) return null;
    return { email: row.email, name: row.name || '' };
  } catch (error) {
    console.error('Email recipient lookup failed', userId, error);
    return null;
  }
};

/** "Your account is ready." Sent once, when the account is created. */
export const emailAccountCreated = async (userId: number): Promise<void> => {
  const to = await recipient(userId);
  if (!to) return;
  await sendTransactionalEmail(to.email, renderWelcomeEmail(to.name));
};

/** Receipt for a token pack or a plan. */
export const emailPurchase = async (
  userId: number,
  item: string,
  amountCents: number,
  currency: string,
  tokens?: number
): Promise<void> => {
  const to = await recipient(userId);
  if (!to) return;
  const amount = `${(amountCents / 100).toFixed(2)} ${String(currency || 'USD').toUpperCase()}`;
  await sendTransactionalEmail(to.email, renderPurchaseEmail(to.name, item, amount, tokens));
};

/**
 * "You matched." Unlike the other two this is promotional rather than a record
 * of something the person did, so it honours the same `matches` preference the
 * push notification does.
 */
export const emailMatch = async (userId: number, matchName: string): Promise<void> => {
  try {
    const prefs = await pool.query(
      'SELECT matches FROM user_notification_preferences WHERE user_id = $1',
      [userId]
    );
    if (prefs.rows.length > 0 && prefs.rows[0].matches === false) return;
  } catch (error) {
    console.error('Match email preference lookup failed', userId, error);
  }
  const to = await recipient(userId);
  if (!to) return;
  await sendTransactionalEmail(to.email, renderMatchEmail(to.name, matchName));
};
