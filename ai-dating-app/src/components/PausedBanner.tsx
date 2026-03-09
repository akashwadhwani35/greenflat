import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from './Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PixelFlag } from './PixelFlag';

type Props = {
  onUnpause: () => void;
};

export const PausedBanner: React.FC<Props> = ({ onUnpause }) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
          <Feather name="pause-circle" size={48} color={theme.colors.neonGreen} />
        </View>

        <Typography variant="h1" align="center" style={{ marginTop: 24 }}>
          Your profile is paused
        </Typography>

        <Typography variant="body" muted align="center" style={{ marginTop: 8, paddingHorizontal: 32 }}>
          You won't appear in anyone's feed or receive new likes while paused. Your existing matches and chats are still active.
        </Typography>

        <Pressable
          style={[styles.unpauseButton, { backgroundColor: theme.colors.neonGreen }]}
          onPress={onUnpause}
        >
          <PixelFlag size={16} color="#000" />
          <Typography variant="bodyStrong" style={{ color: '#000' }}>
            Unpause my profile
          </Typography>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unpauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 28,
  },
});
