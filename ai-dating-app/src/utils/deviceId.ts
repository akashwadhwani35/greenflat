import { Platform } from 'react-native';
import * as Application from 'expo-application';

/**
 * A stable, opaque id for this install, sent as `x-device-id` on signup and
 * face verification so the server can notice one phone creating many accounts.
 * Android ID on Android, the vendor id on iOS. Never used for anything else.
 */
let cached: string | null | undefined;

export const getDeviceId = async (): Promise<string | null> => {
  if (cached !== undefined) return cached;
  try {
    if (Platform.OS === 'android') {
      cached = Application.getAndroidId() || null;
    } else if (Platform.OS === 'ios') {
      cached = (await Application.getIosIdForVendorAsync()) || null;
    } else {
      cached = null;
    }
  } catch {
    cached = null;
  }
  return cached;
};
