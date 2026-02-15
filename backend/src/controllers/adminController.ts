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
