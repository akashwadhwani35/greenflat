import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { createCloudinaryUploadSignature, getMediaUploadCapabilities, isCloudinaryConfigured } from '../services/media.service';

export const getMediaCapabilities = async (_req: AuthRequest, res: Response) => {
  try {
    return res.json({ capabilities: getMediaUploadCapabilities() });
  } catch (error) {
    console.error('Get media capabilities error:', error);
    return res.status(500).json({ error: 'Failed to fetch media capabilities' });
  }
};

export const getUploadSignature = async (_req: AuthRequest, res: Response) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ error: 'Media upload is not configured' });
    }
    return res.json({ upload: createCloudinaryUploadSignature() });
  } catch (error) {
    console.error('Get upload signature error:', error);
    return res.status(500).json({ error: 'Failed to create upload signature' });
  }
};
