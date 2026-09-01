/**
 * Media storage on Google Cloud Storage.
 *
 * Replaces the Cloudinary path, which was never configured in production and
 * meant a second vendor for something the project's own cloud already does.
 *
 * The bucket is PRIVATE: an org policy blocks public objects, and for a dating
 * app that is the right default anyway. Photos are served back through
 * GET /api/media/:name so they are not publicly enumerable and can later be put
 * behind auth without changing any stored URL.
 *
 * Falls back to the local-disk path when no bucket is configured, so local
 * development keeps working with no GCP credentials.
 */
import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heic',
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/aac': 'aac',
  'audio/webm': 'weba',
  // expo-av records voice notes with a video/* container on both platforms.
  'video/mp4': 'm4a',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

const MAX_UPLOAD_BYTES = Number(process.env.MEDIA_MAX_UPLOAD_BYTES || 8 * 1024 * 1024);

const bucketName = () => (process.env.GCS_MEDIA_BUCKET || '').trim();

export const isGcsConfigured = () => Boolean(bucketName());

let storage: Storage | null = null;
const client = () => {
  if (!storage) storage = new Storage();
  return storage;
};

const DATA_URL_RE = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/;

export type StoredMedia = { objectName: string; contentType: string; bytes: number };

/**
 * Accepts the `data:` URL the app sends straight from the image picker, verifies
 * it is a real image or audio payload of sane size, and stores it.
 */
export const storeDataUrl = async (value: unknown): Promise<StoredMedia> => {
  if (typeof value !== 'string') {
    throw new Error('Media must be a data URL string');
  }

  const match = DATA_URL_RE.exec(value.trim());
  if (!match) {
    throw new Error('Media must be a base64 data URL');
  }

  const contentType = match[1].toLowerCase();
  const extension = MIME_EXTENSIONS[contentType];
  if (!extension) {
    throw new Error(`Unsupported media type: ${contentType}`);
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) {
    throw new Error('Media file is empty');
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`Media exceeds ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit`);
  }

  // Flat, unguessable name. No slashes, so the serving route stays a simple
  // single path segment.
  const objectName = `${crypto.randomUUID()}.${extension}`;

  await client()
    .bucket(bucketName())
    .file(objectName)
    .save(buffer, {
      contentType,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    });

  return { objectName, contentType, bytes: buffer.length };
};

export const getMediaStream = (objectName: string) =>
  client().bucket(bucketName()).file(objectName).createReadStream();

export const getMediaMetadata = async (objectName: string) => {
  const [metadata] = await client().bucket(bucketName()).file(objectName).getMetadata();
  return metadata;
};

/** Public URL for a stored object, served back through our own API. */
export const mediaUrlFor = (objectName: string, baseUrl: string) =>
  `${baseUrl.replace(/\/+$/, '')}/api/media/${objectName}`;
