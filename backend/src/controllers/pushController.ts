import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { registerPushToken, unregisterPushToken } from '../services/push.service';

/**
 * Register push notification token for a user
 * POST /api/push/register
 */
export const registerToken = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({ error: 'pushToken is required' });
    }

    const success = await registerPushToken(userId, pushToken);

    if (!success) {
      return res.status(400).json({ error: 'Invalid push token' });
    }

    res.json({ message: 'Push token registered successfully' });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
};

/**
 * Unregister push notification token (e.g., on logout)
 * POST /api/push/unregister
 */
export const unregisterToken = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const success = await unregisterPushToken(userId);

    if (!success) {
      return res.status(500).json({ error: 'Failed to unregister token' });
    }

    res.json({ message: 'Push token unregistered successfully' });
  } catch (error) {
    console.error('Unregister push token error:', error);
    res.status(500).json({ error: 'Failed to unregister push token' });
  }
};
