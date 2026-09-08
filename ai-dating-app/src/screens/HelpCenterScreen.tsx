import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, TextInput } from 'react-native';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { Feather } from '@expo/vector-icons';

type Props = {
  onBack: () => void;
  token: string;
  apiBaseUrl: string;
};

export const HelpCenterScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const submitSupportMessage = async () => {
    const message = details.trim();
    if (!message) {
      Alert.alert('Message required', 'Please write your support query.');
      return;
    }

    try {
      setSending(true);
      const response = await fetch(`${apiBaseUrl}/support/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Unable to send your message');
      }

      setDetails('');
      Alert.alert('Sent', 'Your message has been sent to support.');
    } catch (error: any) {
      Alert.alert('Could not send', error?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const remaining = 1000 - details.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Support" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(173, 255, 26, 0.12)' }]}>
            <Feather name="life-buoy" size={26} color={theme.colors.neonGreen} />
          </View>
          <Typography variant="h1" style={{ marginTop: 16 }}>How can we help?</Typography>
          <Typography variant="body" muted style={{ marginTop: 8, lineHeight: 22 }}>
            Found a bug, hit a problem, or have an idea? Write it below. A real person reads every
            message, and we reply to the email on your account.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
          <Typography variant="bodyStrong">Your message</Typography>
          <TextInput
            placeholder="What happened, and where in the app? The more detail, the faster we can fix it."
            style={[styles.textArea, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.background }]}
            placeholderTextColor={theme.colors.muted}
            multiline
            maxLength={1000}
            value={details}
            onChangeText={setDetails}
          />
          <Typography variant="tiny" muted style={{ textAlign: 'right' }}>
            {remaining} characters left
          </Typography>
          <Button
            label={sending ? 'Sending…' : 'Send to support'}
            onPress={submitSupportMessage}
            loading={sending}
            disabled={sending || !details.trim()}
            fullWidth
          />
        </View>

        <View style={styles.footerNote}>
          <Feather name="mail" size={16} color={theme.colors.muted} />
          <Typography variant="small" muted style={{ flex: 1, marginLeft: 10, lineHeight: 20 }}>
            Prefer email? Write to support@gflag.app from the address on your account.
          </Typography>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 140,
    gap: 24,
  },
  intro: {
    paddingTop: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 160,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'RedHatDisplay_400Regular',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
});
