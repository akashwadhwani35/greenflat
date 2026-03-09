import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Typography } from '../components/Typography';
import { UnderlineInput } from '../components/UnderlineInput';
import { Button } from '../components/Button';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { useTheme } from '../theme/ThemeProvider';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  apiBaseUrl: string;
  onBack: () => void;
  onSuccess: (payload: { token: string; user: { id: number; name: string; is_admin?: boolean }; isNewUser?: boolean }) => void;
  onForgotPassword?: () => void;
};

export const LoginScreen: React.FC<Props> = ({ apiBaseUrl, onBack, onSuccess, onForgotPassword }) => {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID;
  const googleClientConfigured = Boolean(
    googleWebClientId || googleAndroidClientId || googleIosClientId || googleClientId
  );

  const [googleRequest, googleResponse, promptGoogleAuth] = Google.useAuthRequest({
    clientId: googleClientId,
    webClientId: googleWebClientId,
    androidClientId: googleAndroidClientId,
    iosClientId: googleIosClientId,
    responseType: 'id_token',
    selectAccount: true,
    scopes: ['openid', 'profile', 'email'],
  });

  const canSubmit = useMemo(() => email.trim().length > 3 && password.length >= 3, [email, password]);

  const signInWithGoogleToken = async (idToken: string) => {
    setGoogleLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Google sign-in failed');
      if (!data.token || !data.user?.id) throw new Error('Google login response missing token');
      onSuccess({
        token: data.token,
        user: { id: data.user.id, name: data.user.name || 'friend', is_admin: data.user.is_admin },
        isNewUser: data.is_new_user === true,
      });
    } catch (error: any) {
      Alert.alert('Google sign-in failed', error.message || 'Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type !== 'success') {
      if (googleResponse.type === 'error') {
        Alert.alert('Google sign-in failed', 'Unable to authorize with Google. Please try again.');
      }
      return;
    }

    const responseParams = googleResponse.params as Record<string, string> | undefined;
    const idToken = googleResponse.authentication?.idToken || responseParams?.id_token;
    if (!idToken) {
      Alert.alert('Google sign-in failed', 'Google did not return an ID token.');
      return;
    }

    void signInWithGoogleToken(idToken);
  }, [googleResponse]);

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Login failed');
      if (!data.token || !data.user?.id) throw new Error('Login response missing token');
      onSuccess({ token: data.token, user: { id: data.user.id, name: data.user.name || 'friend', is_admin: data.user.is_admin } });
    } catch (error: any) {
      Alert.alert('Login failed', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startGoogleAuth = async () => {
    if (googleLoading || loading) return;
    if (!googleClientConfigured) {
      Alert.alert('Google sign-in unavailable', 'Google client IDs are not configured in this app build.');
      return;
    }
    if (!googleRequest) {
      Alert.alert('Google sign-in unavailable', 'Google auth request is not ready yet. Please try again.');
      return;
    }

    try {
      await promptGoogleAuth();
    } catch (error: any) {
      Alert.alert('Google sign-in failed', error?.message || 'Please try again.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.iconButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
          accessibilityRole="button"
        >
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h1">Sign in</Typography>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <UnderlineInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <UnderlineInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <Button label="Sign in" onPress={submit} fullWidth disabled={!canSubmit || loading} loading={loading} />
          </View>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            <Typography variant="small" muted>or</Typography>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          </View>

          <GoogleSignInButton
            label="Continue with Google"
            onPress={startGoogleAuth}
            fullWidth
            disabled={loading || googleLoading}
            loading={googleLoading}
          />

          {onForgotPassword ? (
            <TouchableOpacity onPress={onForgotPassword} style={{ alignSelf: 'center', marginTop: 14 }}>
              <Typography variant="small" style={{ color: theme.colors.brand }}>
                Forgot password?
              </Typography>
            </TouchableOpacity>
          ) : null}

          <Typography variant="tiny" muted align="center" style={{ marginTop: 14 }}>
            Use your registered account credentials to sign in.
          </Typography>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
});
