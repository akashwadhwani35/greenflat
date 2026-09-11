import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * Sign in with Apple.
 *
 * Required by App Store guideline 4.8 because the app also offers Google, and
 * genuinely the option most iOS users reach for. iOS only — the button must
 * never appear on Android.
 *
 * The one trap: Apple returns the person's name exactly once, on the very first
 * authorisation for this app. Every later sign-in has `fullName` null, even
 * after a reinstall. So the name has to be forwarded on that first call and
 * stored, or it is gone for good.
 */
export type AppleCredential = {
  identityToken: string;
  /** Present only on the first authorisation, ever. */
  fullName: string | null;
};

export const isAppleSignInSupported = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
};

/** Returns null when the person backed out of the sheet. */
export const signInWithApple = async (): Promise<AppleCredential | null> => {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token.');
    }

    const name = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return { identityToken: credential.identityToken, fullName: name || null };
  } catch (error: any) {
    // The documented cancel code; treated as "no decision", not a failure.
    if (error?.code === 'ERR_REQUEST_CANCELED' || error?.code === 'ERR_CANCELED') return null;
    throw new Error(error?.message || 'Apple sign-in failed.');
  }
};
