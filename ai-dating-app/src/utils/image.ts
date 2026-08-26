import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Downscales a picked photo before it becomes a base64 string.
 *
 * expo-image-picker's `quality` only sets JPEG compression, it does not change
 * the dimensions, so a modern phone camera still produces a multi-megabyte
 * image. Holding several of those as base64 in component state, then copying
 * each again through JSON.stringify on upload, is enough to exhaust the JS heap
 * and have Android kill the app mid-onboarding.
 *
 * 1080px on the long edge is more than a profile photo ever needs, and takes a
 * typical picture from several MB to a couple of hundred KB.
 */
const MAX_DIMENSION = 1080;
const JPEG_QUALITY = 0.7;

export const toUploadableDataUrl = async (uri: string): Promise<string> => {
  // Web hands back a usable URL already and has no manipulator support.
  if (Platform.OS === 'web') return uri;

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!result.base64) {
    throw new Error('Could not process that image. Try another one.');
  }

  return `data:image/jpeg;base64,${result.base64}`;
};

/** Rough decoded size of a base64 payload, for logging and guard rails. */
export const approximateBytes = (dataUrl: string): number => {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return 0;
  return Math.floor(((dataUrl.length - commaIndex - 1) * 3) / 4);
};
