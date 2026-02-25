import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const DEFAULT_ALLOWED_MEDIA_HOSTS = ['res.cloudinary.com'];
const BLOCKED_SCHEMES = ['data:', 'file:', 'content:', 'ph:'];

type MediaConfig = {
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  mediaFolder: string;
  localMediaRelativeDir: string;
  localMediaMaxBytes: number;
  localMediaEnabled: boolean;
  maxTextMessageLength: number;
  allowedMediaHosts: string[];
};

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const getMediaConfig = (): MediaConfig => {
  const configuredHosts = (process.env.MEDIA_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return {
    cloudinaryCloudName: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
    cloudinaryApiKey: (process.env.CLOUDINARY_API_KEY || '').trim(),
    cloudinaryApiSecret: (process.env.CLOUDINARY_API_SECRET || '').trim(),
    mediaFolder: (process.env.MEDIA_UPLOAD_FOLDER || 'greenflag/messages').trim(),
    localMediaRelativeDir: (process.env.MEDIA_LOCAL_DIR || 'uploads/messages').replace(/^\/+/, ''),
    localMediaMaxBytes: parsePositiveInt(process.env.MEDIA_LOCAL_MAX_BYTES, 8 * 1024 * 1024),
    localMediaEnabled: process.env.MEDIA_LOCAL_UPLOADS !== 'false',
    maxTextMessageLength: parsePositiveInt(process.env.MAX_TEXT_MESSAGE_LENGTH, 2000),
    allowedMediaHosts: configuredHosts.length > 0 ? configuredHosts : DEFAULT_ALLOWED_MEDIA_HOSTS,
  };
};

export const isCloudinaryConfigured = () => {
  const config = getMediaConfig();
  return Boolean(config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret);
};

export const isLocalUploadConfigured = () => {
  const config = getMediaConfig();
  return config.localMediaEnabled;
};

export const getMediaUploadCapabilities = () => {
  const config = getMediaConfig();
  const cloudinaryConfigured = Boolean(
    config.cloudinaryCloudName &&
    config.cloudinaryApiKey &&
    config.cloudinaryApiSecret
  );
  return {
    upload_provider: cloudinaryConfigured ? 'cloudinary' : (config.localMediaEnabled ? 'local' : 'none'),
    cloud_name: cloudinaryConfigured ? config.cloudinaryCloudName : null,
    allowed_media_hosts: config.allowedMediaHosts,
    max_text_message_length: config.maxTextMessageLength,
    max_upload_bytes: config.localMediaMaxBytes,
  };
};

export const createCloudinaryUploadSignature = () => {
  const config = getMediaConfig();
  const cloudinaryConfigured = Boolean(
    config.cloudinaryCloudName &&
    config.cloudinaryApiKey &&
    config.cloudinaryApiSecret
  );
  if (!cloudinaryConfigured) {
    throw new Error('Media upload is not configured');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${config.mediaFolder}&timestamp=${timestamp}${config.cloudinaryApiSecret}`;
  const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

  return {
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    folder: config.mediaFolder,
    timestamp,
    signature,
    upload_url: `https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/auto/upload`,
  };
};

export const normalizeTextMessage = (value: unknown): string => {
  const { maxTextMessageLength } = getMediaConfig();
  if (typeof value !== 'string') {
    throw new Error('Text message content must be a string');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Message cannot be empty');
  }
  if (trimmed.length > maxTextMessageLength) {
    throw new Error(`Message exceeds ${maxTextMessageLength} characters`);
  }
  return trimmed;
};

const isAllowedMediaHost = (url: URL, requestHost?: string): boolean => {
  const { allowedMediaHosts } = getMediaConfig();
  const hostname = url.hostname.toLowerCase();
  const hostAllowed = allowedMediaHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  if (hostAllowed) return true;
  if (!requestHost) return false;
  return url.host.toLowerCase() === requestHost.toLowerCase();
};

export const normalizeMediaMessageUrl = (
  value: unknown,
  options?: { requestHost?: string; allowHttpForRequestHost?: boolean }
): string => {
  if (typeof value !== 'string') {
    throw new Error('Media content must be a URL string');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Media URL cannot be empty');
  }

  const lower = trimmed.toLowerCase();
  if (BLOCKED_SCHEMES.some((scheme) => lower.startsWith(scheme))) {
    throw new Error('Local or inline media payloads are not allowed');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid media URL');
  }

  const isHttps = parsed.protocol === 'https:';
  const isAllowedHttpForRequestHost = Boolean(
    options?.allowHttpForRequestHost &&
    parsed.protocol === 'http:' &&
    options?.requestHost &&
    parsed.host.toLowerCase() === options.requestHost.toLowerCase()
  );

  if (!isHttps && !isAllowedHttpForRequestHost) {
    throw new Error('Media URL must use HTTPS');
  }

  if (!isAllowedMediaHost(parsed, options?.requestHost)) {
    throw new Error('Media URL host is not allowed');
  }

  return parsed.toString();
};

const DATA_URL_REGEX = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const ALLOWED_VOICE_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/aac',
  'audio/webm',
]);

const extensionByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/aac': 'aac',
  'audio/webm': 'webm',
};

const parseBase64DataUrl = (dataUrl: string) => {
  const { localMediaMaxBytes } = getMediaConfig();
  const match = dataUrl.match(DATA_URL_REGEX);
  if (!match) {
    throw new Error('Invalid media payload');
  }

  const mimeType = match[1].toLowerCase();
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    throw new Error('Media file is empty');
  }
  if (buffer.length > localMediaMaxBytes) {
    throw new Error(`Media file exceeds ${Math.round(localMediaMaxBytes / (1024 * 1024))}MB limit`);
  }

  return { mimeType, buffer };
};

export const storeLocalMediaFromDataUrl = async (
  dataUrl: unknown,
  mediaType: 'image' | 'voice',
  baseUrl: string
): Promise<string> => {
  const { localMediaEnabled, localMediaRelativeDir } = getMediaConfig();
  if (!localMediaEnabled) {
    throw new Error('Local media upload is disabled');
  }

  if (typeof dataUrl !== 'string' || !dataUrl.trim()) {
    throw new Error('Media payload is required');
  }

  const { mimeType, buffer } = parseBase64DataUrl(dataUrl.trim());

  if (mediaType === 'image' && !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error('Unsupported image format');
  }
  if (mediaType === 'voice' && !ALLOWED_VOICE_MIME_TYPES.has(mimeType)) {
    throw new Error('Unsupported voice/video format');
  }

  const fileExtension = extensionByMime[mimeType] || (mediaType === 'image' ? 'jpg' : 'mp4');
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${fileExtension}`;
  const targetDirectory = path.join(process.cwd(), localMediaRelativeDir);
  const targetPath = path.join(targetDirectory, fileName);

  await fs.mkdir(targetDirectory, { recursive: true });
  await fs.writeFile(targetPath, buffer);

  const relativeUrlPath = `${localMediaRelativeDir}/${fileName}`.replace(/\\/g, '/');
  return `${baseUrl.replace(/\/+$/, '')}/${relativeUrlPath}`;
};
