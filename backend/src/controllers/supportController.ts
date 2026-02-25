import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

const SUPPORT_EMAIL = (process.env.SUPPORT_EMAIL || 'support@greenflag.app').trim();
const SUPPORT_FROM_EMAIL = (process.env.SUPPORT_FROM_EMAIL || 'GreenFlag <no-reply@greenflag.app>').trim();
const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();

const MAX_MESSAGE_LENGTH = 2000;

const sendSupportEmail = async (params: {
  ticketId: number;
  userId: number;
  userName: string;
  userEmail: string;
  message: string;
}) => {
  if (!RESEND_API_KEY) {
    return { sent: false as const, reason: 'RESEND_NOT_CONFIGURED' };
  }

  const subject = `GreenFlag Support #${params.ticketId} - ${params.userName || params.userEmail}`;
  const textBody = [
    `Support ticket #${params.ticketId}`,
    `User ID: ${params.userId}`,
    `Name: ${params.userName || 'Unknown'}`,
    `Email: ${params.userEmail || 'Unknown'}`,
    '',
    'Message:',
    params.message,
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: SUPPORT_FROM_EMAIL,
      to: [SUPPORT_EMAIL],
      subject,
      text: textBody,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Email provider error (${response.status})`);
  }

  return { sent: true as const };
};

export const submitSupportMessage = async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const rawMessage = typeof req.body?.message === 'string' ? req.body.message : '';
  const message = rawMessage.trim();
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `message exceeds ${MAX_MESSAGE_LENGTH} characters` });
  }

  try {
    const userResult = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const insertResult = await pool.query(
      `INSERT INTO support_messages (user_id, user_email, user_name, message, email_delivery_status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [userId, user.email || null, user.name || null, message]
    );

    const ticketId = Number(insertResult.rows[0].id);
    let emailSent = false;

    try {
      const emailResult = await sendSupportEmail({
        ticketId,
        userId,
        userName: user.name || '',
        userEmail: user.email || '',
        message,
      });

      emailSent = emailResult.sent;
      await pool.query(
        `UPDATE support_messages
         SET email_delivery_status = $2, email_delivery_error = NULL, updated_at = NOW()
         WHERE id = $1`,
        [ticketId, emailSent ? 'sent' : 'pending']
      );
    } catch (emailError: any) {
      await pool.query(
        `UPDATE support_messages
         SET email_delivery_status = 'failed', email_delivery_error = $2, updated_at = NOW()
         WHERE id = $1`,
        [ticketId, String(emailError?.message || 'Email delivery failed').slice(0, 1000)]
      );
    }

    return res.json({
      message: 'Support request submitted',
      ticket_id: ticketId,
      email_sent: emailSent,
    });
  } catch (error) {
    console.error('Submit support message error:', error);
    return res.status(500).json({ error: 'Failed to submit support message' });
  }
};

