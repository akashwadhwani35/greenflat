import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, TextInput } from 'react-native';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Support" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="h2">Write to support</Typography>
          <Typography variant="small" muted>
            Tell us your issue, bug, or feedback.
          </Typography>
          <TextInput
            placeholder="Share more details..."
            style={[styles.textArea, { borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholderTextColor={theme.colors.muted}
            multiline
            value={details}
            onChangeText={setDetails}
          />
          <Button
            label="Send"
            onPress={submitSupportMessage}
            loading={sending}
            disabled={sending || !details.trim()}
            fullWidth
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 140,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
    fontSize: 16,
  },
});
