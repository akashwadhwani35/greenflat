import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceiptId } from 'expo-server-sdk';
import pool from '../config/database';

// Create Expo SDK client
const expo = new Expo();

/**
 * Send push notification to a single user
 */
export const sendPushNotification = async (
  userId: number,
  title: string,
  body: string,
  data?: { [key: string]: any }
): Promise<boolean> => {
  try {
    // Get user's push token from database
    const result = await pool.query(
      'SELECT push_token FROM users WHERE id = $1 AND push_token IS NOT NULL',
      [userId]
    );

    if (result.rows.length === 0) {
      console.log(`No push token found for user ${userId}`);
      return false;
    }

    const pushToken = result.rows[0].push_token;

    // Check that the token is valid
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      return false;
    }

    // Create message
    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: data || {},
    };

    // Send notification
    const chunks = expo.chunkPushNotifications([message]);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    // Check for errors
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        console.error(`Error sending notification: ${ticket.message}`);
        if (ticket.details?.error === 'DeviceNotRegistered') {
          // Remove invalid token
          await pool.query('UPDATE users SET push_token = NULL WHERE id = $1', [userId]);
        }
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Send push notification error:', error);
    return false;
  }
};

/**
 * Send push notifications to multiple users
 */
export const sendBulkPushNotifications = async (
  userIds: number[],
  title: string,
  body: string,
  data?: { [key: string]: any }
): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;

  // Get push tokens for all users
  const result = await pool.query(
    'SELECT id, push_token FROM users WHERE id = ANY($1) AND push_token IS NOT NULL',
    [userIds]
  );

  const messages: ExpoPushMessage[] = result.rows
    .filter((row: { push_token: string }) => Expo.isExpoPushToken(row.push_token))
    .map((row: { push_token: string }) => ({
      to: row.push_token,
      sound: 'default',
      title,
      body,
      data: data || {},
    }));

  if (messages.length === 0) {
    return { success: 0, failed: userIds.length };
  }

  // Send in chunks
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('Error sending bulk push notifications:', error);
      failed += chunk.length;
    }
  }

  // Check results
  for (const ticket of tickets) {
    if (ticket.status === 'ok') {
      success++;
    } else {
      failed++;
      if (ticket.details?.error === 'DeviceNotRegistered') {
        // Could batch cleanup invalid tokens here
      }
    }
  }

  return { success, failed };
};

/**
 * Send notification when someone likes you
 */
export const notifyLikeReceived = async (likedUserId: number, likerName: string): Promise<void> => {
  await sendPushNotification(
    likedUserId,
    'Someone likes you! 💚',
    `${likerName} liked your profile`,
    { type: 'like_received', screen: 'LikesInbox' }
  );
};

/**
 * Send notification when you have a mutual match
 */
export const notifyMatch = async (userId: number, matchName: string): Promise<void> => {
  await sendPushNotification(
    userId,
    "It's a match! 🎉",
    `You and ${matchName} both liked each other`,
    { type: 'match', screen: 'Matches' }
  );
};

/**
 * Send notification when someone sends you a message
 */
export const notifyNewMessage = async (
  recipientId: number,
  senderName: string,
  messagePreview: string
): Promise<void> => {
  await sendPushNotification(
    recipientId,
    `${senderName} sent you a message`,
    messagePreview.substring(0, 100),
    { type: 'message', screen: 'Conversations' }
  );
};

/**
 * Register/update user's push token
 */
export const registerPushToken = async (userId: number, pushToken: string): Promise<boolean> => {
  try {
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Invalid Expo push token: ${pushToken}`);
      return false;
    }

    await pool.query(
      'UPDATE users SET push_token = $1 WHERE id = $2',
      [pushToken, userId]
    );

    return true;
  } catch (error) {
    console.error('Register push token error:', error);
    return false;
  }
};

/**
 * Unregister user's push token (on logout)
 */
export const unregisterPushToken = async (userId: number): Promise<boolean> => {
  try {
    await pool.query('UPDATE users SET push_token = NULL WHERE id = $1', [userId]);
    return true;
  } catch (error) {
    console.error('Unregister push token error:', error);
    return false;
  }
};
