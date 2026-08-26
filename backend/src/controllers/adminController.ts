import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(*)::int FROM users WHERE created_at >= CURRENT_DATE) AS users_today,
        (SELECT COUNT(*)::int FROM reports WHERE status = 'pending') AS pending_reports,
        (SELECT COUNT(*)::int FROM matches) AS total_matches,
        (SELECT COUNT(*)::int FROM messages) AS total_messages
    `);
    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Admin getStats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

export const getReports = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const status = req.query.status as string | undefined;
    const offset = (page - 1) * limit;

    let where = '';
    const params: any[] = [];
    if (status && ['pending', 'reviewed', 'resolved'].includes(status)) {
      params.push(status);
      where = `WHERE r.status = $${params.length}`;
    }

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT r.id, r.reason, r.status, r.admin_notes, r.created_at, r.updated_at,
              reporter.id AS reporter_id, reporter.name AS reporter_name,
              reported.id AS reported_id, reported.name AS reported_name
       FROM reports r
       JOIN users reporter ON reporter.id = r.reporter_id
       JOIN users reported ON reported.id = r.reported_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ page, limit, reports: result.rows });
  } catch (error) {
    console.error('Admin getReports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
};

export const updateReport = async (req: AuthRequest, res: Response) => {
  try {
    const reportId = Number(req.params.reportId);
    const { status, admin_notes } = req.body;

    if (!status || !['pending', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required (pending, reviewed, resolved)' });
    }

    const result = await pool.query(
      `UPDATE reports
       SET status = $1, admin_notes = COALESCE($2, admin_notes), reviewed_by = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, admin_notes || null, req.userId, reportId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Report updated', report: result.rows[0] });
  } catch (error) {
    console.error('Admin updateReport error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const search = (req.query.q as string || '').trim();
    const offset = (page - 1) * limit;

    let where = '';
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE u.name ILIKE $${params.length} OR u.email ILIKE $${params.length}`;
    }

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.gender, u.city, u.is_verified, u.is_premium, u.is_banned, u.is_admin, u.created_at,
              (SELECT COUNT(*)::int FROM reports WHERE reported_id = u.id) AS report_count
       FROM users u
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ page, limit, users: result.rows });
  } catch (error) {
    console.error('Admin getUsers error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const toggleBan = async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = Number(req.params.userId);

    const result = await pool.query(
      `UPDATE users SET is_banned = NOT is_banned, updated_at = NOW() WHERE id = $1 RETURNING id, name, is_banned`,
      [targetUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({ message: user.is_banned ? 'User banned' : 'User unbanned', user });
  } catch (error) {
    console.error('Admin toggleBan error:', error);
    res.status(500).json({ error: 'Failed to toggle ban' });
  }
};

// ─── ANALYTICS ENDPOINTS ────────────────────────────────────────────────────

export const getRevenueAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const data: any = {
      total_token_revenue: 0,
      revenue_today: 0,
      revenue_7d: 0,
      revenue_30d: 0,
      revenue_lifetime: 0,
      active_pro_users: 0,
      active_premium_users: 0,
      free_to_paid_conversion: 0,
      arpu: 0,
    };

    // Total token revenue & revenue by period
    try {
      // Stored in integer cents; reported in whole currency units.
      const revenue = await pool.query(
        `SELECT
           COALESCE(SUM(amount_cents), 0) AS lifetime,
           COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= CURRENT_DATE), 0) AS today,
           COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0) AS week,
           COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) AS month
         FROM token_purchases`
      );
      const row = revenue.rows[0];
      const toUnits = (cents: any) => Number((Number(cents) / 100).toFixed(2));

      data.total_token_revenue = toUnits(row.lifetime);
      data.revenue_lifetime = data.total_token_revenue;
      data.revenue_today = toUnits(row.today);
      data.revenue_7d = toUnits(row.week);
      data.revenue_30d = toUnits(row.month);
    } catch (e) {
      console.warn('Revenue query (token_purchases) failed, using defaults:', (e as Error).message);
    }

    // Active subscriptions
    try {
      const proRes = await pool.query(`SELECT COUNT(*)::int AS count FROM subscriptions WHERE plan = 'pro' AND status = 'active'`);
      data.active_pro_users = proRes.rows[0].count;

      const premRes = await pool.query(`SELECT COUNT(*)::int AS count FROM subscriptions WHERE plan = 'premium' AND status = 'active'`);
      data.active_premium_users = premRes.rows[0].count;
    } catch (e) {
      console.warn('Subscriptions query failed, using defaults:', (e as Error).message);
    }

    // Free to paid conversion rate
    try {
      const totalUsers = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
      const paidUsers = await pool.query(`SELECT COUNT(DISTINCT user_id)::int AS count FROM subscriptions WHERE status = 'active'`);
      if (totalUsers.rows[0].count > 0) {
        data.free_to_paid_conversion = parseFloat(((paidUsers.rows[0].count / totalUsers.rows[0].count) * 100).toFixed(2));
      }
    } catch (e) {
      console.warn('Conversion rate query failed, using defaults:', (e as Error).message);
    }

    // ARPU
    try {
      const totalUsers = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
      if (totalUsers.rows[0].count > 0) {
        data.arpu = parseFloat((data.revenue_lifetime / totalUsers.rows[0].count).toFixed(2));
      }
    } catch (e) {
      console.warn('ARPU query failed, using defaults:', (e as Error).message);
    }

    res.json(data);
  } catch (error) {
    console.error('Admin getRevenueAnalytics error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
};

export const getTokenAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const data: any = {
      total_tokens_purchased: 0,
      total_tokens_spent: 0,
      spend_by_feature: {
        ai_search: 0,
        super_like: 0,
        compliment: 0,
        boost: 0,
      },
      most_used_feature: null,
      most_profitable_feature: null,
    };

    // Total tokens purchased
    try {
      const purchased = await pool.query(`SELECT COALESCE(SUM(tokens), 0) AS total FROM token_purchases`);
      data.total_tokens_purchased = parseInt(purchased.rows[0].total, 10);
    } catch (e) {
      console.warn('Token purchases query failed:', (e as Error).message);
    }

    // Total tokens spent & spend by feature.
    // Debits are stored as a positive amount with direction='debit'; there is no
    // negative-amount row and no `feature` column, so spend is grouped by reason.
    try {
      const spent = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM credit_transactions WHERE direction = 'debit'`
      );
      data.total_tokens_spent = parseInt(spent.rows[0].total, 10);

      const byFeature = await pool.query(
        `SELECT reason, COALESCE(SUM(amount), 0)::int AS total_spent, COUNT(*)::int AS usage_count
         FROM credit_transactions
         WHERE direction = 'debit'
         GROUP BY reason
         ORDER BY total_spent DESC`
      );

      // Ledger reasons -> the feature buckets the dashboard renders.
      const REASON_TO_FEATURE: Record<string, string> = {
        ai_search: 'ai_search',
        superlike: 'super_like',
        compliment_send: 'compliment',
        boost_activation: 'boost',
      };

      for (const row of byFeature.rows) {
        const key = REASON_TO_FEATURE[row.reason as string];
        if (key && key in data.spend_by_feature) {
          data.spend_by_feature[key] = row.total_spent;
        }
      }

      const featureRows = byFeature.rows.filter((r: any) => REASON_TO_FEATURE[r.reason as string]);
      if (featureRows.length > 0) {
        // Most used = highest usage_count
        const mostUsed = featureRows.reduce((a: any, b: any) => (b.usage_count > a.usage_count ? b : a), featureRows[0]);
        data.most_used_feature = REASON_TO_FEATURE[mostUsed.reason as string];
        // Most profitable = highest total_spent (rows are already sorted)
        data.most_profitable_feature = REASON_TO_FEATURE[featureRows[0].reason as string];
      }
    } catch (e) {
      console.warn('Credit transactions query failed:', (e as Error).message);
    }

    res.json(data);
  } catch (error) {
    console.error('Admin getTokenAnalytics error:', error);
    res.status(500).json({ error: 'Failed to fetch token analytics' });
  }
};

export const getEngagementAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const data: any = {
      compliment_reply_rate: 0,
      green_flag_match_rate: 0,
      boost_effectiveness: 0,
      like_to_match_conversion: 0,
      avg_time_to_first_reply_minutes: 0,
    };

    // Compliment reply rate. Compliments are likes with is_compliment set; a
    // "reply" is the recipient having liked back (which is what creates a match).
    try {
      const compliments = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM likes back
               WHERE back.liker_id = l.liked_id AND back.liked_id = l.liker_id
             )
           )::int AS replied
         FROM likes l
         WHERE l.is_compliment = TRUE`
      );
      const { total, replied } = compliments.rows[0];
      if (total > 0) {
        data.compliment_reply_rate = parseFloat(((replied / total) * 100).toFixed(2));
      }
    } catch (e) {
      console.warn('Compliment reply rate query failed:', (e as Error).message);
    }

    // Green Flag match rate. A Green Flag like is a superlike.
    try {
      const greenFlags = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM likes back
               WHERE back.liker_id = l.liked_id AND back.liked_id = l.liker_id
             )
           )::int AS matched
         FROM likes l
         WHERE l.is_superlike = TRUE`
      );
      const { total, matched } = greenFlags.rows[0];
      if (total > 0) {
        data.green_flag_match_rate = parseFloat(((matched / total) * 100).toFixed(2));
      }
    } catch (e) {
      console.warn('Green flag match rate query failed:', (e as Error).message);
    }

    // Boost effectiveness: average profile views earned per boost purchased.
    // Boosts are ledgered as credit_transactions; views come from profile_views.
    try {
      const boosts = await pool.query(
        `SELECT COUNT(*)::int AS count FROM credit_transactions WHERE reason = 'boost_activation'`
      );
      if (boosts.rows[0].count > 0) {
        const views = await pool.query(
          `SELECT COUNT(*)::int AS total
           FROM profile_views pv
           JOIN users u ON u.id = pv.viewed_id
           WHERE u.boost_expires_at IS NOT NULL AND pv.created_at <= u.boost_expires_at`
        );
        data.boost_effectiveness = parseFloat((views.rows[0].total / boosts.rows[0].count).toFixed(2));
      }
    } catch (e) {
      console.warn('Boost effectiveness query failed:', (e as Error).message);
    }

    // Like-to-match conversion
    try {
      const totalLikes = await pool.query(`SELECT COUNT(*)::int AS count FROM likes`);
      const totalMatches = await pool.query(`SELECT COUNT(*)::int AS count FROM matches`);
      if (totalLikes.rows[0].count > 0) {
        data.like_to_match_conversion = parseFloat(((totalMatches.rows[0].count / totalLikes.rows[0].count) * 100).toFixed(2));
      }
    } catch (e) {
      console.warn('Like-to-match conversion query failed:', (e as Error).message);
    }

    // Average time to first reply
    try {
      const avgReply = await pool.query(
        `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (reply.created_at - orig.created_at)) / 60), 0) AS avg_minutes
         FROM messages orig
         JOIN messages reply ON reply.match_id = orig.match_id AND reply.sender_id != orig.sender_id
         WHERE orig.id = (
           SELECT MIN(id) FROM messages m2 WHERE m2.match_id = orig.match_id
         )
         AND reply.id = (
           SELECT MIN(id) FROM messages m3
           WHERE m3.match_id = orig.match_id AND m3.sender_id != orig.sender_id
         )`
      );
      data.avg_time_to_first_reply_minutes = parseFloat(parseFloat(avgReply.rows[0].avg_minutes).toFixed(2));
    } catch (e) {
      console.warn('Avg time to first reply query failed:', (e as Error).message);
    }

    res.json(data);
  } catch (error) {
    console.error('Admin getEngagementAnalytics error:', error);
    res.status(500).json({ error: 'Failed to fetch engagement analytics' });
  }
};

export const getGrowthAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const data: any = {
      dau: 0,
      mau: 0,
      new_users_by_day: [],
      retention_day_1: 0,
      retention_day_7: 0,
      retention_day_30: 0,
    };

    // DAU
    try {
      const dauRes = await pool.query(
        `SELECT COUNT(DISTINCT id)::int AS count FROM users
         WHERE last_active >= CURRENT_DATE
            OR id IN (SELECT DISTINCT sender_id FROM messages WHERE created_at >= CURRENT_DATE)`
      );
      data.dau = dauRes.rows[0].count;
    } catch (e) {
      console.warn('DAU query failed:', (e as Error).message);
    }

    // MAU
    try {
      const mauRes = await pool.query(
        `SELECT COUNT(DISTINCT id)::int AS count FROM users
         WHERE last_active >= NOW() - INTERVAL '30 days'
            OR id IN (SELECT DISTINCT sender_id FROM messages WHERE created_at >= NOW() - INTERVAL '30 days')`
      );
      data.mau = mauRes.rows[0].count;
    } catch (e) {
      console.warn('MAU query failed:', (e as Error).message);
    }

    // New users by day (last 30 days)
    try {
      const growth = await pool.query(
        `SELECT DATE(created_at) AS date, COUNT(*)::int AS count
         FROM users
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY date ASC`
      );
      data.new_users_by_day = growth.rows;
    } catch (e) {
      console.warn('New users by day query failed:', (e as Error).message);
    }

    // Retention rates
    try {
      // Day 1 retention: users who signed up 1+ days ago and were active the day after signup
      const d1 = await pool.query(
        `WITH cohort AS (
           SELECT id, DATE(created_at) AS signup_date FROM users WHERE created_at < CURRENT_DATE
         )
         SELECT
           COUNT(DISTINCT c.id) FILTER (WHERE u.last_active >= c.signup_date + INTERVAL '1 day' AND u.last_active < c.signup_date + INTERVAL '2 days') * 100.0
           / NULLIF(COUNT(DISTINCT c.id), 0) AS rate
         FROM cohort c
         JOIN users u ON u.id = c.id`
      );
      data.retention_day_1 = parseFloat(parseFloat(d1.rows[0].rate || '0').toFixed(2));

      const d7 = await pool.query(
        `WITH cohort AS (
           SELECT id, DATE(created_at) AS signup_date FROM users WHERE created_at <= NOW() - INTERVAL '7 days'
         )
         SELECT
           COUNT(DISTINCT c.id) FILTER (WHERE u.last_active >= c.signup_date + INTERVAL '7 days') * 100.0
           / NULLIF(COUNT(DISTINCT c.id), 0) AS rate
         FROM cohort c
         JOIN users u ON u.id = c.id`
      );
      data.retention_day_7 = parseFloat(parseFloat(d7.rows[0].rate || '0').toFixed(2));

      const d30 = await pool.query(
        `WITH cohort AS (
           SELECT id, DATE(created_at) AS signup_date FROM users WHERE created_at <= NOW() - INTERVAL '30 days'
         )
         SELECT
           COUNT(DISTINCT c.id) FILTER (WHERE u.last_active >= c.signup_date + INTERVAL '30 days') * 100.0
           / NULLIF(COUNT(DISTINCT c.id), 0) AS rate
         FROM cohort c
         JOIN users u ON u.id = c.id`
      );
      data.retention_day_30 = parseFloat(parseFloat(d30.rows[0].rate || '0').toFixed(2));
    } catch (e) {
      console.warn('Retention query failed:', (e as Error).message);
    }

    res.json(data);
  } catch (error) {
    console.error('Admin getGrowthAnalytics error:', error);
    res.status(500).json({ error: 'Failed to fetch growth analytics' });
  }
};

// ─── USER MANAGEMENT ENDPOINTS ──────────────────────────────────────────────

export const grantRemoveTokens = async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const { amount, action } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    if (!action || !['grant', 'remove'].includes(action)) {
      return res.status(400).json({ error: "action must be 'grant' or 'remove'" });
    }

    // Check user exists
    const userCheck = await pool.query(`SELECT id FROM users WHERE id = $1`, [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const delta = action === 'grant' ? amount : -amount;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Balances live on users.credit_balance. There is no separate wallet table.
      const result = await client.query(
        `UPDATE users
         SET credit_balance = GREATEST(credit_balance + $1::int, 0), updated_at = NOW()
         WHERE id = $2
         RETURNING credit_balance`,
        [delta, userId]
      );

      // Every balance change is ledgered so the wallet history stays truthful.
      await client.query(
        `INSERT INTO credit_transactions (user_id, amount, direction, reason, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          amount,
          action === 'grant' ? 'credit' : 'debit',
          action === 'grant' ? 'admin_grant' : 'admin_remove',
          JSON.stringify({ granted_by: req.userId }),
        ]
      );

      await client.query('COMMIT');

      res.json({
        message: action === 'grant' ? `Granted ${amount} tokens` : `Removed ${amount} tokens`,
        credit_balance: Number(result.rows[0].credit_balance),
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Admin grantRemoveTokens error:', error);
    res.status(500).json({ error: 'Failed to update tokens' });
  }
};

export const grantSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const { plan, duration_days } = req.body;

    if (!plan || !['pro', 'premium'].includes(plan)) {
      return res.status(400).json({ error: "plan must be 'pro' or 'premium'" });
    }
    if (!duration_days || typeof duration_days !== 'number' || duration_days <= 0) {
      return res.status(400).json({ error: 'duration_days must be a positive number' });
    }

    // Check user exists
    const userCheck = await pool.query(`SELECT id FROM users WHERE id = $1`, [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Deactivate any existing active subscription
    await pool.query(
      `UPDATE subscriptions SET status = 'expired', updated_at = NOW() WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    // Create new subscription
    const result = await pool.query(
      `INSERT INTO subscriptions (user_id, plan, status, starts_at, expires_at, granted_by, created_at, updated_at)
       VALUES ($1, $2, 'active', NOW(), NOW() + ($3 || ' days')::INTERVAL, $4, NOW(), NOW())
       RETURNING *`,
      [userId, plan, String(duration_days), req.userId]
    );

    // Update user's premium flag
    await pool.query(
      `UPDATE users SET is_premium = true, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    res.json({ message: `Granted ${plan} subscription for ${duration_days} days`, subscription: result.rows[0] });
  } catch (error) {
    console.error('Admin grantSubscription error:', error);
    res.status(500).json({ error: 'Failed to grant subscription' });
  }
};

export const toggleShadowBan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.userId);

    const result = await pool.query(
      `UPDATE users SET is_shadow_banned = NOT COALESCE(is_shadow_banned, false), updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, is_shadow_banned`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      message: user.is_shadow_banned ? 'User shadow banned' : 'User shadow ban removed',
      user,
    });
  } catch (error) {
    console.error('Admin toggleShadowBan error:', error);
    res.status(500).json({ error: 'Failed to toggle shadow ban' });
  }
};
