import { Alert, Linking } from 'react-native';

const SUPPORT_EMAIL = 'support@gflag.app';

/**
 * A refusal that is not a sign-in failure.
 *
 * One account per phone is deliberate, but it arrives on the same code path as a
 * genuine auth error and was being reported under "Google sign-in failed" — which
 * is wrong twice over: Google succeeded, and the reader is told to retry
 * something no retry will fix.
 *
 * The lock is meant to be recoverable. Shared and second-hand phones are real,
 * and there is no SMS recovery yet, so the dead end has to lead somewhere.
 */
export const isDeviceLimit = (body: any): boolean => Boolean(body?.device_limit);

export const showDeviceLimitAlert = () => {
  Alert.alert(
    'One account per phone',
    'This phone already has a GreenFlag account. Sign in to that account instead.\n\n' +
      'Sharing the phone, or bought it second hand? Contact us and we will sort it out.',
    [
      { text: 'OK', style: 'cancel' },
      {
        text: 'Contact support',
        onPress: () => {
          const subject = encodeURIComponent('One account per phone');
          const body = encodeURIComponent(
            'Hi GreenFlag team,\n\nI am being told this phone already has an account, but it is not mine / I need a second account because:\n\n',
          );
          void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
        },
      },
    ]
  );
};

/**
 * Reports a failed auth response. Returns true when it handled the body itself,
 * so the caller can skip its own generic alert.
 */
export const handleAuthErrorBody = (body: any): boolean => {
  if (isDeviceLimit(body)) {
    showDeviceLimitAlert();
    return true;
  }
  return false;
};
