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
      const totalRes = await pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM token_purchases`);
      data.total_token_revenue = parseFloat(totalRes.rows[0].total);
      data.revenue_lifetime = data.total_token_revenue;

      const todayRes = await pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM token_purchases WHERE created_at >= CURRENT_DATE`);
      data.revenue_today = parseFloat(todayRes.rows[0].total);

      const week = await pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM token_purchases WHERE created_at >= NOW() - INTERVAL '7 days'`);
      data.revenue_7d = parseFloat(week.rows[0].total);

      const month = await pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM token_purchases WHERE created_at >= NOW() - INTERVAL '30 days'`);
      data.revenue_30d = parseFloat(month.rows[0].total);
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

    // Total tokens spent & spend by feature
    try {
      const spent = await pool.query(`SELECT COALESCE(SUM(ABS(amount)), 0) AS total FROM credit_transactions WHERE amount < 0`);
      data.total_tokens_spent = parseInt(spent.rows[0].total, 10);

      const byFeature = await pool.query(
        `SELECT feature, COALESCE(SUM(ABS(amount)), 0)::int AS total_spent, COUNT(*)::int AS usage_count
         FROM credit_transactions
         WHERE amount < 0 AND feature IS NOT NULL
         GROUP BY feature
         ORDER BY total_spent DESC`
      );

      for (const row of byFeature.rows) {
        const key = row.feature as string;
        if (key in data.spend_by_feature) {
          data.spend_by_feature[key] = row.total_spent;
        }
      }

      if (byFeature.rows.length > 0) {
        // Most used = highest usage_count
        const mostUsed = byFeature.rows.reduce((a: any, b: any) => (b.usage_count > a.usage_count ? b : a), byFeature.rows[0]);
        data.most_used_feature = mostUsed.feature;
        // Most profitable = highest total_spent
        data.most_profitable_feature = byFeature.rows[0].feature;
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

    // Compliment reply rate
    try {
      const total = await pool.query(`SELECT COUNT(*)::int AS count FROM compliments`);
      const replied = await pool.query(`SELECT COUNT(*)::int AS count FROM compliments WHERE replied = true`);
      if (total.rows[0].count > 0) {
        data.compliment_reply_rate = parseFloat(((replied.rows[0].count / total.rows[0].count) * 100).toFixed(2));
      }
    } catch (e) {
      console.warn('Compliment reply rate query failed:', (e as Error).message);
    }

    // Green Flag match rate
    try {
      const totalGF = await pool.query(`SELECT COUNT(*)::int AS count FROM green_flags`);
      const matchedGF = await pool.query(`SELECT COUNT(*)::int AS count FROM green_flags WHERE matched = true`);
      if (totalGF.rows[0].count > 0) {
        data.green_flag_match_rate = parseFloat(((matchedGF.rows[0].count / totalGF.rows[0].count) * 100).toFixed(2));
      }
    } catch (e) {
      console.warn('Green flag match rate query failed:', (e as Error).message);
    }

    // Boost effectiveness (profiles viewed during boost / total boosts)
    try {
      const boosts = await pool.query(`SELECT COUNT(*)::int AS count FROM boosts`);
      const boostViews = await pool.query(`SELECT COALESCE(SUM(views_gained), 0)::int AS total FROM boosts`);
      if (boosts.rows[0].count > 0) {
        data.boost_effectiveness = parseFloat((boostViews.rows[0].total / boosts.rows[0].count).toFixed(2));
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

    // Update wallet balance
    const result = await pool.query(
      `UPDATE wallet
       SET credit_balance = GREATEST(credit_balance + $1, 0), updated_at = NOW()
       WHERE user_id = $2
       RETURNING credit_balance`,
      [delta, userId]
    );

    if (result.rows.length === 0) {
      // Wallet row may not exist; create it
      if (action === 'grant') {
        const ins = await pool.query(
          `INSERT INTO wallet (user_id, credit_balance, created_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())
           RETURNING credit_balance`,
          [userId, amount]
        );
        return res.json({ message: `Granted ${amount} tokens`, credit_balance: ins.rows[0].credit_balance });
      }
      return res.status(400).json({ error: 'User has no wallet to remove tokens from' });
    }

    res.json({
      message: action === 'grant' ? `Granted ${amount} tokens` : `Removed ${amount} tokens`,
      credit_balance: result.rows[0].credit_balance,
    });
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
