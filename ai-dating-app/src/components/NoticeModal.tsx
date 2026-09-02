import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from './Typography';
import { useTheme } from '../theme/ThemeProvider';

export type Notice = {
  title: string;
  message?: string;
  /** success: green icon; error: muted red icon. */
  tone?: 'success' | 'error';
  icon?: React.ComponentProps<typeof Feather>['name'];
  buttonLabel?: string;
};

type Props = {
  notice: Notice | null;
  onClose: () => void;
};

/**
 * The app's own confirmation popup, in place of the OS alert. Android's grey
 * dialog and iOS's white one both looked like a different product; this one
 * is the welcome-card shape, so every confirmation in the app matches.
 */
export const NoticeModal: React.FC<Props> = ({ notice, onClose }) => {
  const theme = useTheme();
  if (!notice) return null;
  const isError = notice.tone === 'error';
  const iconName = notice.icon || (isError ? 'alert-circle' : 'check');

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isError ? 'rgba(255, 107, 107, 0.14)' : theme.colors.neonGreen },
            ]}
          >
            <Feather name={iconName} size={26} color={isError ? theme.colors.error : theme.colors.deepBlack} />
          </View>
          <Typography variant="h2" style={[styles.title, { color: theme.colors.text }]}>
            {notice.title}
          </Typography>
          {notice.message ? (
            <Typography variant="body" style={[styles.body, { color: theme.colors.muted }]}>
              {notice.message}
            </Typography>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: isError ? theme.colors.secondaryHighlight : theme.colors.neonGreen },
              pressed && { opacity: 0.85 },
            ]}
            onPress={onClose}
          >
            <Typography variant="bodyStrong" style={{ color: isError ? theme.colors.text : '#000', fontSize: 16 }}>
              {notice.buttonLabel || 'Okay'}
            </Typography>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    textAlign: 'center',
    marginBottom: 6,
  },
  body: {
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    marginTop: 20,
    borderRadius: 999,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
});
