import React, { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Theme } from '../theme/tokens';
import { Typography } from './Typography';

type ChipTone = 'default' | 'accent' | 'success';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: ChipTone;
  compact?: boolean;
}

export const Chip: React.FC<Props> = ({ label, selected, onPress, tone = 'default', compact }) => {
  const theme = useTheme();
  const { styles, labelColor } = useMemo(
    () => createStyles(theme, selected, tone, compact),
    [theme, selected, tone, compact]
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.base, pressed && styles.pressed]}
    >
      <Typography variant="small" style={{ color: labelColor }}>
        {label}
      </Typography>
    </Pressable>
  );
};

const createStyles = (theme: Theme, selected?: boolean, tone: ChipTone = 'default', compact?: boolean) => {
  const isSelected = Boolean(selected);
  const backgroundColor = isSelected
    ? theme.colors.secondaryHighlight
    : tone === 'accent'
    ? theme.colors.accentTint
    : tone === 'success'
    ? theme.colors.successTint
    : 'transparent';

  const borderColor = isSelected
    ? theme.colors.secondaryHairline
    : tone === 'accent'
    ? theme.colors.accent
    : tone === 'success'
    ? theme.colors.success
    : theme.colors.border;

  const labelColor = isSelected
    ? theme.colors.text
    : tone === 'success'
    ? theme.colors.success
    : theme.colors.text;

  const styles = StyleSheet.create({
    base: {
      paddingVertical: compact ? 6 : 10,
      paddingHorizontal: compact ? 14 : 18,
      borderRadius: theme.radius.pill,
      backgroundColor,
      borderWidth: 1,
      borderColor,
      marginRight: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    pressed: {
      opacity: 0.85,
    },
  });

  return { styles, labelColor };
};
