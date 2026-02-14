import crypto from 'crypto';

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
const MEDIA_FOLDER = process.env.MEDIA_UPLOAD_FOLDER || 'greenflag/messages';

const MAX_TEXT_MESSAGE_LENGTH = Number(process.env.MAX_TEXT_MESSAGE_LENGTH || 2000);
const DEFAULT_ALLOWED_MEDIA_HOSTS = ['res.cloudinary.com'];
const configuredHosts = (process.env.MEDIA_ALLOWED_HOSTS || '')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);
const ALLOWED_MEDIA_HOSTS = configuredHosts.length > 0 ? configuredHosts : DEFAULT_ALLOWED_MEDIA_HOSTS;

const BLOCKED_SCHEMES = ['data:', 'file:', 'content:', 'ph:'];

export const isCloudinaryConfigured = () =>
  Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);

export const getMediaUploadCapabilities = () => ({
  upload_provider: isCloudinaryConfigured() ? 'cloudinary' : 'none',
  cloud_name: isCloudinaryConfigured() ? CLOUDINARY_CLOUD_NAME : null,
  allowed_media_hosts: ALLOWED_MEDIA_HOSTS,
  max_text_message_length: MAX_TEXT_MESSAGE_LENGTH,
});

export const createCloudinaryUploadSignature = () => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Media upload is not configured');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${MEDIA_FOLDER}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

  return {
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    folder: MEDIA_FOLDER,
    timestamp,
    signature,
    upload_url: `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
  };
};

export const normalizeTextMessage = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new Error('Text message content must be a string');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Message cannot be empty');
  }
  if (trimmed.length > MAX_TEXT_MESSAGE_LENGTH) {
    throw new Error(`Message exceeds ${MAX_TEXT_MESSAGE_LENGTH} characters`);
  }
  return trimmed;
};

const isAllowedMediaHost = (url: URL): boolean => {
  const hostname = url.hostname.toLowerCase();
  return ALLOWED_MEDIA_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
};

export const normalizeMediaMessageUrl = (value: unknown): string => {
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

  if (parsed.protocol !== 'https:') {
    throw new Error('Media URL must use HTTPS');
  }

  if (!isAllowedMediaHost(parsed)) {
    throw new Error('Media URL host is not allowed');
  }

  return parsed.toString();
};
