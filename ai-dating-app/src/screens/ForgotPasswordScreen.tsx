import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { UnderlineInput } from '../components/UnderlineInput';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  apiBaseUrl: string;
  onBack: () => void;
};

export const ForgotPasswordScreen: React.FC<Props> = ({ apiBaseUrl, onBack }) => {
  const theme = useTheme();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [phoneHint, setPhoneHint] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const requestOtp = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Request failed');

      if (data.phone_hint) {
        setPhoneHint(data.phone_hint);
        setStep(2);
      } else {
        Alert.alert('Info', data.message || 'Check your phone for a code.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyAndReset = async () => {
    if (!code.trim() || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), new_password: newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Reset failed');

      Alert.alert('Success', data.message || 'Password reset. You can now log in.', [
        { text: 'OK', onPress: onBack },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Please try again.');
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
        <Typography variant="h1">Reset password</Typography>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <View style={[styles.card, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
              <Typography variant="body" muted>
                Enter your email and we'll send a verification code to your registered phone number.
              </Typography>
              <UnderlineInput
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Button label="Send code" onPress={requestOtp} fullWidth disabled={!email.trim() || loading} loading={loading} />
            </View>
          )}

          {step === 2 && (
            <View style={[styles.card, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
              <Typography variant="body" muted>
                A 6-digit code was sent to {phoneHint}. Enter it below.
              </Typography>
              <UnderlineInput
                placeholder="6-digit code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Button label="Next" onPress={() => setStep(3)} fullWidth disabled={code.trim().length < 6} />
            </View>
          )}

          {step === 3 && (
            <View style={[styles.card, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
              <Typography variant="body" muted>
                Choose a new password.
              </Typography>
              <UnderlineInput
                placeholder="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <UnderlineInput
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <Button
                label="Reset password"
                onPress={verifyAndReset}
                fullWidth
                disabled={!newPassword || !confirmPassword || loading}
                loading={loading}
              />
            </View>
          )}
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
