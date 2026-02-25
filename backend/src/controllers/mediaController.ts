import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  createCloudinaryUploadSignature,
  getMediaUploadCapabilities,
  isCloudinaryConfigured,
  isLocalUploadConfigured,
  storeLocalMediaFromDataUrl,
} from '../services/media.service';

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

export const uploadLocalMedia = async (req: AuthRequest, res: Response) => {
  try {
    if (!isLocalUploadConfigured()) {
      return res.status(503).json({ error: 'Local media upload is disabled' });
    }

    const { data_url, media_type } = req.body as {
      data_url?: unknown;
      media_type?: 'image' | 'voice';
    };

    if (media_type !== 'image' && media_type !== 'voice') {
      return res.status(400).json({ error: 'Invalid media_type' });
    }

    const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
    const protocol = forwardedProto || req.protocol || 'https';
    const host = req.get('host');
    if (!host) {
      return res.status(400).json({ error: 'Unable to resolve upload host' });
    }
    const baseUrl = `${protocol}://${host}`;

    const url = await storeLocalMediaFromDataUrl(data_url, media_type, baseUrl);
    return res.json({ url });
  } catch (error: any) {
    console.error('Upload local media error:', error);
    return res.status(400).json({ error: error?.message || 'Failed to upload media' });
  }
};
