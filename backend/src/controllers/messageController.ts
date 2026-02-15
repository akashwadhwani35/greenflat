import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { notifyNewMessage } from '../services/push.service';
import { DAILY_LIMITS, LIKE_RESET_HOURS } from '../utils/constants';
import { normalizeMediaMessageUrl, normalizeTextMessage } from '../services/media.service';
import { getIO } from '../socket';

const checkAndResetLimits = async (userId: number, client: any) => {
  const result = await client.query(
    'SELECT * FROM user_activity_limits WHERE user_id = $1 FOR UPDATE',
    [userId]
  );

  if (result.rows.length === 0) {
    await client.query(
      'INSERT INTO user_activity_limits (user_id) VALUES ($1)',
      [userId]
    );
    return { messages_started_count: 0 };
  }

  const limits = result.rows[0];
  const lastReset = new Date(limits.last_reset_at);
  const now = new Date();
  const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

  if (hoursSinceReset >= LIKE_RESET_HOURS) {
    await client.query(
      `UPDATE user_activity_limits
       SET on_grid_likes_count = 0,
           off_grid_likes_count = 0,
           messages_started_count = 0,
           last_reset_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );
    return { messages_started_count: 0 };
  }

  return limits;
};

/**
 * Send a message to a matched user
 */
export const sendMessage = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const userId = req.userId!;
    const { match_id, content, message_type = 'text' } = req.body as {
      match_id?: number;
      content?: unknown;
      message_type?: 'text' | 'image' | 'voice';
    };

    if (!match_id || !content) {
      return res.status(400).json({ error: 'Match ID and content are required' });
    }

    if (!['text', 'image', 'voice'].includes(message_type)) {
      return res.status(400).json({ error: 'Invalid message_type' });
    }

    let normalizedContent: string;
    try {
      normalizedContent =
        message_type === 'text'
          ? normalizeTextMessage(content)
          : normalizeMediaMessageUrl(content);
    } catch (validationError: any) {
      return res.status(400).json({ error: validationError?.message || 'Invalid message content' });
    }

    await client.query('BEGIN');

    const senderResult = await client.query(
      'SELECT gender, is_premium FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (senderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const sender = senderResult.rows[0];
    const limits = await checkAndResetLimits(userId, client);
    const dailyLimits = sender.gender === 'male' ? DAILY_LIMITS.male : DAILY_LIMITS.female;

    if (!sender.is_premium && limits.messages_started_count >= dailyLimits.messages_per_day) {
      await client.query('ROLLBACK');
      return res.status(429).json({
        error: 'Daily message limit reached',
        limit: dailyLimits.messages_per_day,
        reset_in_hours: LIKE_RESET_HOURS,
      });
    }

    // Verify the match exists and user is part of it
    const matchResult = await client.query(
      `SELECT m.*, u1.name as user1_name, u2.name as user2_name
       FROM matches m
       JOIN users u1 ON u1.id = m.user1_id
       JOIN users u2 ON u2.id = m.user2_id
       WHERE m.id = $1 AND (m.user1_id = $2 OR m.user2_id = $2)`,
      [match_id, userId]
    );

    if (matchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found or you are not part of this match' });
    }

    const match = matchResult.rows[0];
    const recipientId = match.user1_id === userId ? match.user2_id : match.user1_id;
    const senderName = match.user1_id === userId ? match.user1_name : match.user2_name;

    // Insert the message
    const messageResult = await client.query(
      `INSERT INTO messages (match_id, sender_id, recipient_id, content, message_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [match_id, userId, recipientId, normalizedContent, message_type]
    );

    const message = messageResult.rows[0];

    // Update match last_message_at
    await client.query(
      `UPDATE matches SET last_message_at = NOW() WHERE id = $1`,
      [match_id]
    );

    await client.query(
      `UPDATE user_activity_limits
       SET messages_started_count = messages_started_count + 1,
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );

    await client.query('COMMIT');

    // Send push notification to recipient
    const previewBase = message_type === 'text'
      ? normalizedContent
      : (message_type === 'image' ? 'Sent an image' : 'Sent a voice note');
    const preview = previewBase.length > 50 ? previewBase.substring(0, 47) + '...' : previewBase;
    notifyNewMessage(recipientId, senderName, preview).catch(err =>
      console.error('Failed to send message notification:', err)
    );

    // Emit real-time socket events
    const io = getIO();
    if (io) {
      io.to(`user:${recipientId}`).emit('message:new', {
        message,
        matchId: match_id,
      });

      // Also notify sender's other devices
      io.to(`user:${userId}`).emit('message:new', {
        message,
        matchId: match_id,
      });

      // Notify both users about conversation update
      const conversationUpdate = {
        matchId: match_id,
        lastMessage: preview,
        lastMessageTime: message.created_at,
      };
      io.to(`user:${recipientId}`).emit('conversation:updated', conversationUpdate);
      io.to(`user:${userId}`).emit('conversation:updated', conversationUpdate);
    }

    res.json({
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  } finally {
    client.release();
  }
};

/**
 * Get conversation messages for a match
 */
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { matchId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify user is part of the match
    const matchResult = await pool.query(
      `SELECT * FROM matches
       WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
      [matchId, userId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found or you are not part of this match' });
    }

    // Get messages
    const messagesResult = await pool.query(
      `SELECT
        m.*,
        sender.name as sender_name,
        sender_photo.photo_url as sender_photo
       FROM messages m
       JOIN users sender ON sender.id = m.sender_id
       LEFT JOIN photos sender_photo ON sender_photo.user_id = sender.id AND sender_photo.is_primary = TRUE
       WHERE m.match_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [matchId, limit, offset]
    );

    // Mark messages as read
    await pool.query(
      `UPDATE messages
       SET is_read = TRUE
       WHERE match_id = $1 AND recipient_id = $2 AND is_read = FALSE`,
      [matchId, userId]
    );

    res.json({
      messages: messagesResult.rows.reverse(), // Return in chronological order
      has_more: messagesResult.rows.length === Number(limit),
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

/**
 * Get all conversations (matches with messages)
 */
export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const result = await pool.query(
      `SELECT
        m.id as match_id,
        m.matched_at,
        m.last_message_at,
        other_user.id as user_id,
        other_user.name,
        other_user.is_verified,
        other_photo.photo_url as photo,
        last_msg.content as last_message,
        last_msg.created_at as last_message_time,
        last_msg.sender_id as last_message_sender_id,
        (SELECT COUNT(*) FROM messages WHERE match_id = m.id AND recipient_id = $1 AND is_read = FALSE) as unread_count
       FROM matches m
       JOIN users other_user ON (
         (m.user1_id = $1 AND other_user.id = m.user2_id) OR
         (m.user2_id = $1 AND other_user.id = m.user1_id)
       )
       LEFT JOIN photos other_photo ON other_photo.user_id = other_user.id AND other_photo.is_primary = TRUE
       LEFT JOIN LATERAL (
         SELECT content, created_at, sender_id
         FROM messages
         WHERE match_id = m.id
         ORDER BY created_at DESC
         LIMIT 1
       ) last_msg ON true
       WHERE m.user1_id = $1 OR m.user2_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = other_user.id)
              OR (b.blocker_id = other_user.id AND b.blocked_id = $1)
         )
       ORDER BY COALESCE(m.last_message_at, m.matched_at) DESC`,
      [userId]
    );

    res.json({
      conversations: result.rows,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

/**
 * Mark messages as read
 */
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { matchId } = req.params;

    // Find the sender(s) whose messages are being marked read
    const unreadResult = await pool.query(
      `SELECT DISTINCT sender_id FROM messages
       WHERE match_id = $1 AND recipient_id = $2 AND is_read = FALSE`,
      [matchId, userId]
    );

    await pool.query(
      `UPDATE messages
       SET is_read = TRUE
       WHERE match_id = $1 AND recipient_id = $2 AND is_read = FALSE`,
      [matchId, userId]
    );

    // Notify senders that their messages were read
    const io = getIO();
    if (io && unreadResult.rows.length > 0) {
      for (const row of unreadResult.rows) {
        io.to(`user:${row.sender_id}`).emit('messages:read', {
          matchId: Number(matchId),
          readBy: userId,
        });
      }
    }

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
};

/**
 * Delete a message (soft delete - only for sender, within time limit)
 */
export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { messageId } = req.params;

    // Check if message exists and user is the sender
    const messageResult = await pool.query(
      `SELECT * FROM messages WHERE id = $1 AND sender_id = $2`,
      [messageId, userId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or you are not the sender' });
    }

    const message = messageResult.rows[0];
    const messageAge = Date.now() - new Date(message.created_at).getTime();
    const fiveMinutes = 5 * 60 * 1000;

    // Only allow deletion within 5 minutes
    if (messageAge > fiveMinutes) {
      return res.status(400).json({ error: 'Messages can only be deleted within 5 minutes of sending' });
    }

    // Soft delete - mark as deleted
    await pool.query(
      `UPDATE messages SET content = '[Message deleted]', is_deleted = TRUE WHERE id = $1`,
      [messageId]
    );

    // Notify both participants via socket
    const io = getIO();
    if (io) {
      const matchId = message.match_id;
      const recipientId = message.recipient_id;
      io.to(`user:${recipientId}`).emit('message:deleted', {
        messageId: Number(messageId),
        matchId,
      });
      io.to(`user:${userId}`).emit('message:deleted', {
        messageId: Number(messageId),
        matchId,
      });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};
