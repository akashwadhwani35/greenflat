import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Typography } from '../components/Typography';
import { UnderlineInput } from '../components/UnderlineInput';
import { Button } from '../components/Button';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { useTheme } from '../theme/ThemeProvider';

WebBrowser.maybeCompleteAuthSession();

/**
 * Account creation, one thing per screen: phone → code → email → code → password.
 *
 * The steps are not a fixed list. GET /auth/capabilities says which verification
 * channels the server can actually deliver on, and any channel that is not live
 * is dropped from the funnel rather than shown as a screen that fails. Today SMS
 * is not configured, so a new user starts at the email step; when the SMS
 * credentials land the phone steps appear on their own, with no app release.
 */

type Step = 'phone' | 'phoneCode' | 'email' | 'emailCode' | 'password';

type AuthedUser = {
  id: number;
  name: string;
  is_admin?: boolean;
  onboarding_completed?: boolean;
};

type Props = {
  apiBaseUrl: string;
  onBack: () => void;
  onComplete: (payload: { token: string; user: AuthedUser; isNewUser: boolean }) => void;
};

type Capabilities = {
  sms: boolean;
  email: boolean;
  google: boolean;
  min_password_length: number;
};

const DEFAULT_CAPABILITIES: Capabilities = {
  sms: false,
  email: true,
  google: false,
  min_password_length: 8,
};

export const SignUpFlowScreen: React.FC<Props> = ({ apiBaseUrl, onBack, onComplete }) => {
  const theme = useTheme();

  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('email');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [destinationHint, setDestinationHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const caps = capabilities || DEFAULT_CAPABILITIES;
  const minPasswordLength = caps.min_password_length || 8;

  // --- Google ---------------------------------------------------------------

  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const googleClientId =
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID;
  const googleClientConfigured = Boolean(
    googleWebClientId || googleAndroidClientId || googleIosClientId || googleClientId
  );

  const [googleRequest, googleResponse, promptGoogleAuth] = Google.useAuthRequest(
    googleClientConfigured
      ? {
          clientId: googleClientId,
          webClientId: googleWebClientId,
          androidClientId: googleAndroidClientId,
          iosClientId: googleIosClientId,
          responseType: 'id_token',
          selectAccount: true,
          scopes: ['openid', 'profile', 'email'],
        }
      : { clientId: '_disabled_' }
  );

  // Held in a ref so the response effect below always sees the current token
  // without needing it in its dependency list.
  const registrationTokenRef = useRef<string | null>(null);
  registrationTokenRef.current = registrationToken;

  const signInWithGoogleToken = useCallback(
    async (idToken: string) => {
      setGoogleLoading(true);
      try {
        const response = await fetch(`${apiBaseUrl}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_token: idToken,
            // Carries across any phone number already verified in this funnel.
            registration_token: registrationTokenRef.current,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Google sign-in failed');
        if (!data.token || !data.user?.id) throw new Error('Google sign-in response missing token');

        onComplete({
          token: data.token,
          user: {
            id: data.user.id,
            name: data.user.name || 'friend',
            is_admin: data.user.is_admin,
            onboarding_completed: data.user.onboarding_completed,
          },
          isNewUser: data.is_new_user === true,
        });
      } catch (error: any) {
        Alert.alert('Google sign-in failed', error.message || 'Please try again.');
      } finally {
        setGoogleLoading(false);
      }
    },
    [apiBaseUrl, onComplete]
  );

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type !== 'success') {
      if (googleResponse.type === 'error') {
        Alert.alert('Google sign-in failed', 'Unable to authorize with Google. Please try again.');
      }
      return;
    }
    const params = googleResponse.params as Record<string, string> | undefined;
    const idToken = googleResponse.authentication?.idToken || params?.id_token;
    if (!idToken) {
      Alert.alert('Google sign-in failed', 'Google did not return an ID token.');
      return;
    }
    void signInWithGoogleToken(idToken);
  }, [googleResponse, signInWithGoogleToken]);

  const startGoogleAuth = async () => {
    if (googleLoading) return;
    if (!googleClientConfigured) {
      Alert.alert('Google sign-in unavailable', 'Google client IDs are not configured.');
      return;
    }
    if (!googleRequest) {
      Alert.alert('Google sign-in unavailable', 'Not ready yet. Please try again.');
      return;
    }
    try {
      await promptGoogleAuth();
    } catch (error: any) {
      Alert.alert('Google sign-in failed', error?.message || 'Please try again.');
    }
  };

  // --- Session bootstrap ----------------------------------------------------

  const beginRegistration = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      const [capabilitiesResponse, startResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/auth/capabilities`),
        fetch(`${apiBaseUrl}/auth/register/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      ]);

      const capabilitiesData = await capabilitiesResponse.json().catch(() => ({}));
      const startData = await startResponse.json().catch(() => ({}));

      if (!startResponse.ok || !startData.registration_token) {
        throw new Error(startData.error || 'Could not start sign up');
      }

      const resolved: Capabilities = {
        sms: Boolean(capabilitiesData?.sms ?? startData.phone_required),
        email: capabilitiesData?.email !== false,
        google: Boolean(capabilitiesData?.google) && googleClientConfigured,
        min_password_length: Number(capabilitiesData?.min_password_length) || 8,
      };

      setCapabilities(resolved);
      setRegistrationToken(startData.registration_token);
      setStep(resolved.sms ? 'phone' : 'email');
    } catch (error: any) {
      setStartError(error.message || 'Could not reach the server. Please try again.');
    } finally {
      setStarting(false);
    }
  }, [apiBaseUrl, googleClientConfigured]);

  useEffect(() => {
    void beginRegistration();
  }, [beginRegistration]);

  // --- Step actions ---------------------------------------------------------

  const post = async (path: string, body: Record<string, unknown>) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registration_token: registrationToken, ...body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  };

  const run = async (action: () => Promise<void>) => {
    if (loading) return;
    setLoading(true);
    try {
      await action();
    } catch (error: any) {
      Alert.alert('Sign up', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitPhone = () =>
    run(async () => {
      const data = await post('/auth/register/phone', { phone: phone.trim() });
      setDestinationHint(data.destination_hint || phone.trim());
      setCode('');
      setStep('phoneCode');
    });

  const submitPhoneCode = () =>
    run(async () => {
      await post('/auth/register/phone/verify', { code: code.trim() });
      setCode('');
      setStep('email');
    });

  const submitEmail = () =>
    run(async () => {
      const data = await post('/auth/register/email', { email: email.trim() });
      setDestinationHint(data.destination_hint || email.trim());
      setCode('');
      setStep('emailCode');
    });

  const submitEmailCode = () =>
    run(async () => {
      await post('/auth/register/email/verify', { code: code.trim() });
      setStep('password');
    });

  const submitPassword = () =>
    run(async () => {
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }
      if (password.length < minPasswordLength) {
        throw new Error(`Password must be at least ${minPasswordLength} characters.`);
      }
      const data = await post('/auth/register/complete', { password });
      onComplete({
        token: data.token,
        user: {
          id: data.user.id,
          name: data.user.name || 'friend',
          is_admin: data.user.is_admin,
          onboarding_completed: data.user.onboarding_completed,
        },
        isNewUser: true,
      });
    });

  const resend = () =>
    run(async () => {
      if (step === 'phoneCode') {
        await post('/auth/register/phone', { phone: phone.trim() });
      } else {
        await post('/auth/register/email', { email: email.trim() });
      }
      Alert.alert('Code sent', `A new code is on its way to ${destinationHint}.`);
    });

  const goBack = () => {
    if (step === 'phone' || (step === 'email' && !caps.sms)) return onBack();
    if (step === 'phoneCode') return setStep('phone');
    if (step === 'email') return setStep('phoneCode');
    if (step === 'emailCode') return setStep('email');
    if (step === 'password') return setStep('emailCode');
    return onBack();
  };

  // --- Render ---------------------------------------------------------------

  const stepMeta: Record<Step, { title: string; blurb: string }> = {
    phone: {
      title: 'Your number',
      blurb: 'We text you a code to check it is really you. Nobody on GreenFlag sees it.',
    },
    phoneCode: {
      title: 'Check your phone',
      blurb: `We sent a 6-digit code to ${destinationHint}.`,
    },
    email: {
      title: 'Your email',
      blurb: 'This is how you sign in and how we reach you if you lose access.',
    },
    emailCode: {
      title: 'Check your email',
      blurb: `We sent a 6-digit code to ${destinationHint}.`,
    },
    password: {
      title: 'Set a password',
      blurb: `At least ${minPasswordLength} characters.`,
    },
  };

  const orderedSteps: Step[] = caps.sms
    ? ['phone', 'phoneCode', 'email', 'emailCode', 'password']
    : ['email', 'emailCode', 'password'];
  const stepIndex = Math.max(0, orderedSteps.indexOf(step));

  if (starting) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (startError) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <Typography variant="h2" style={{ textAlign: 'center', marginBottom: 12 }}>
          Can't start sign up
        </Typography>
        <Typography variant="body" muted style={{ textAlign: 'center', marginBottom: 24 }}>
          {startError}
        </Typography>
        <Button label="Try again" onPress={beginRegistration} />
        <TouchableOpacity onPress={onBack} style={{ marginTop: 16 }}>
          <Typography variant="small" muted>
            Go back
          </Typography>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          style={[
            styles.iconButton,
            {
              backgroundColor: theme.colors.secondaryHighlight,
              borderColor: theme.colors.secondaryHairline,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.progressRow}>
          {orderedSteps.map((s, i) => (
            <View
              key={s}
              style={[
                styles.progressPip,
                {
                  backgroundColor:
                    i <= stepIndex ? theme.colors.primary : theme.colors.secondaryHairline,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Typography variant="h1" style={{ marginBottom: 8 }}>
            {stepMeta[step].title}
          </Typography>
          <Typography variant="body" muted style={{ marginBottom: 28 }}>
            {stepMeta[step].blurb}
          </Typography>

          {step === 'phone' && (
            <>
              <UnderlineInput
                placeholder="Phone number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <Button
                label="Send code"
                onPress={submitPhone}
                fullWidth
                disabled={!phone.trim() || loading}
                loading={loading}
              />
            </>
          )}

          {(step === 'phoneCode' || step === 'emailCode') && (
            <>
              <UnderlineInput
                placeholder="6-digit code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
              />
              <Button
                label="Verify"
                onPress={step === 'phoneCode' ? submitPhoneCode : submitEmailCode}
                fullWidth
                disabled={code.trim().length < 6 || loading}
                loading={loading}
              />
              <TouchableOpacity onPress={resend} disabled={loading} style={styles.textLink}>
                <Typography variant="small" muted>
                  Didn't get it? Send another
                </Typography>
              </TouchableOpacity>
            </>
          )}

          {step === 'email' && (
            <>
              <UnderlineInput
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <Button
                label="Send code"
                onPress={submitEmail}
                fullWidth
                disabled={!email.trim() || loading}
                loading={loading}
              />

              {caps.google && (
                <View style={styles.googleBlock}>
                  <View style={styles.dividerRow}>
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                    <Typography variant="small" muted style={{ marginHorizontal: 12 }}>
                      or
                    </Typography>
                    <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                  </View>
                  <GoogleSignInButton
                    onPress={startGoogleAuth}
                    loading={googleLoading}
                    disabled={loading}
                    fullWidth
                  />
                </View>
              )}
            </>
          )}

          {step === 'password' && (
            <>
              <UnderlineInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
              />
              <UnderlineInput
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
              />
              <Button
                label="Create account"
                onPress={submitPassword}
                fullWidth
                disabled={!password || !confirmPassword || loading}
                loading={loading}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 64 : 44,
    paddingBottom: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  progressRow: { flexDirection: 'row', gap: 6, flex: 1 },
  progressPip: { height: 3, borderRadius: 2, flex: 1 },
  content: { padding: 24, paddingTop: 24, gap: 16 },
  textLink: { alignSelf: 'center', paddingVertical: 12 },
  googleBlock: { marginTop: 8 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  divider: { flex: 1, height: 1 },
});
