import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from './Typography';
import { useTheme } from '../theme/ThemeProvider';

/**
 * The three ways a person runs out.
 *
 * `incoming` is the one on the *receiving* end — you have answered as many
 * people as you allow yourself in a day. It never says "incoming" to the
 * reader; from where they sit it is simply their like limit.
 */
export type LimitKind = 'aiMatch' | 'explore' | 'incoming';

export type LimitNotice = {
  kind: LimitKind;
  /** ISO timestamp the limit lifts. Drives the countdown. */
  availableAt?: string | null;
};

type Props = {
  notice: LimitNotice | null;
  onClose: () => void;
  /** Opens the plans sheet. Green Flag has no limit popup, so this is always a like. */
  onSeePlans: () => void;
};

const COPY: Record<LimitKind, { title: string; body: string }> = {
  aiMatch: {
    title: 'AI Match limit reached',
    body: 'You have used today’s AI Match likes. New ones unlock when the timer runs out.',
  },
  explore: {
    title: 'Explore limit reached',
    body: 'You have used today’s Explore likes. New ones unlock when the timer runs out.',
  },
  incoming: {
    title: 'Like limit reached',
    body: 'You have used today’s likes, so you cannot like back just yet. Your likes return when the timer runs out.',
  },
};

/** "11h 59m" / "48m" / "Any moment now". */
const formatRemaining = (msLeft: number): string => {
  if (msLeft <= 0) return 'Any moment now';
  const totalMinutes = Math.ceil(msLeft / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
};

/**
 * Limit popup, per the board: description, then a countdown to when the limit
 * lifts, an Okay, and a green route to the plans sheet underneath it.
 */
export const LimitModal: React.FC<Props> = ({ notice, onClose, onSeePlans }) => {
  const theme = useTheme();
  const targetMs = notice?.availableAt ? new Date(notice.availableAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  // Ticks once a minute: the label has minute resolution, so a per-second
  // timer would re-render sixty times to change nothing.
  useEffect(() => {
    if (!notice || !targetMs) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [notice, targetMs]);

  if (!notice) return null;
  const copy = COPY[notice.kind];
  const remaining = targetMs ? formatRemaining(targetMs - now) : null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 107, 107, 0.14)' }]}>
            <Feather name="clock" size={26} color={theme.colors.error} />
          </View>

          <Typography variant="h2" style={[styles.title, { color: theme.colors.text }]}>
            {copy.title}
          </Typography>
          <Typography variant="body" style={[styles.body, { color: theme.colors.muted }]}>
            {copy.body}
          </Typography>

          {remaining ? (
            <View style={[styles.countdown, { borderColor: theme.colors.border }]}>
              <Feather name="clock" size={14} color={theme.colors.neonGreen} />
              <Typography variant="small" style={{ color: theme.colors.text, marginLeft: 8 }}>
                More likes in <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>{remaining}</Typography>
              </Typography>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.colors.secondaryHighlight },
              pressed && { opacity: 0.85 },
            ]}
            onPress={onClose}
          >
            <Typography variant="bodyStrong" style={{ color: theme.colors.text, fontSize: 16 }}>
              Okay
            </Typography>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: theme.colors.neonGreen },
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => {
              onClose();
              onSeePlans();
            }}
          >
            <Typography variant="bodyStrong" style={{ color: '#000', fontSize: 16 }}>
              Still Want to Like?
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
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  button: {
    marginTop: 20,
    borderRadius: 999,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  cta: {
    marginTop: 10,
    borderRadius: 999,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
});
