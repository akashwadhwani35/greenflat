import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { notifyNewMessage } from '../services/push.service';

/**
 * Send a message to a matched user
 */
export const sendMessage = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const userId = req.userId!;
    const { match_id, content, message_type = 'text' } = req.body;

    if (!match_id || !content) {
      return res.status(400).json({ error: 'Match ID and content are required' });
    }

    await client.query('BEGIN');

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
      [match_id, userId, recipientId, content, message_type]
    );

    const message = messageResult.rows[0];

    // Update match last_message_at
    await client.query(
      `UPDATE matches SET last_message_at = NOW() WHERE id = $1`,
      [match_id]
    );

    await client.query('COMMIT');

    // Send push notification to recipient
    const preview = content.length > 50 ? content.substring(0, 47) + '...' : content;
    notifyNewMessage(recipientId, senderName, preview).catch(err =>
      console.error('Failed to send message notification:', err)
    );

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

    await pool.query(
      `UPDATE messages
       SET is_read = TRUE
       WHERE match_id = $1 AND recipient_id = $2 AND is_read = FALSE`,
      [matchId, userId]
    );

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

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};
