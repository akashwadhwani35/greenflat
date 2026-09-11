import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

/**
 * Native Google Sign-In (Credential Manager on Android, the Google SDK on
 * iOS). The browser-based flow through expo-auth-session kept ending in
 * Google's "Error 400: invalid_request" for the Android client, so the app
 * now asks the platform SDK, which returns an ID token minted for the web
 * client id. The server accepts that audience.
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

let configured = false;
const ensureConfigured = () => {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: Platform.OS === 'ios' && IOS_CLIENT_ID ? IOS_CLIENT_ID : undefined,
    scopes: ['profile', 'email'],
    offlineAccess: false,
  });
  configured = true;
};

export const isGoogleSignInConfigured = () => Boolean(WEB_CLIENT_ID);


/**
 * Opens the account chooser and returns the Google ID token, or null when the
 * person backed out. Throws with a readable message for real failures.
 */
export const signInWithGoogleNative = async (): Promise<string | null> => {
  if (!WEB_CLIENT_ID) throw new Error('Google sign-in is not configured in this build.');
  ensureConfigured();
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    // Always show the chooser rather than silently reusing the last account.
    await GoogleSignin.signOut().catch(() => {});
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    const idToken = response.data.idToken;
    if (!idToken) throw new Error('Google did not return an ID token.');
    return idToken;
  } catch (error: any) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return null;
      if (error.code === statusCodes.IN_PROGRESS) return null;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play services are not available on this phone.');
      }
    }
    throw new Error(error?.message || 'Google sign-in failed.');
  }
};
