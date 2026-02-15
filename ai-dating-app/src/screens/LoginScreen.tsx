import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { UnderlineInput } from '../components/UnderlineInput';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  apiBaseUrl: string;
  onBack: () => void;
  onSuccess: (payload: { token: string; user: { id: number; name: string; is_admin?: boolean } }) => void;
  onForgotPassword?: () => void;
};

export const LoginScreen: React.FC<Props> = ({ apiBaseUrl, onBack, onSuccess, onForgotPassword }) => {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => email.trim().length > 3 && password.length >= 3, [email, password]);

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.iconButton, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}
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
});
