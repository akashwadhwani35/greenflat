import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Theme } from '../theme/tokens';
import { Typography } from './Typography';

type Variant = 'primary' | 'secondary';

type Props = {
  label: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  fullWidth?: boolean;
};

export const Button: React.FC<Props> = ({ label, variant = 'primary', loading, disabled, onPress, fullWidth }) => {
  const theme = useTheme();
  const { styles, labelColor } = useMemo(() => createStyles(theme, variant, fullWidth), [theme, variant, fullWidth]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [styles.base, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={labelColor} size="small" />
        ) : (
          <Typography variant="bodyStrong" style={{ color: labelColor }}>
            {label}
          </Typography>
        )}
      </View>
    </Pressable>
  );
};

const createStyles = (theme: Theme, variant: Variant, fullWidth?: boolean) => {
  const isPrimary = variant === 'primary';
  const labelColor = isPrimary ? theme.colors.surface : theme.colors.primary;

  const styles = StyleSheet.create({
    base: {
      backgroundColor: isPrimary ? theme.colors.primary : 'transparent',
      borderRadius: theme.radius.pill,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: isPrimary ? 0 : 1,
      borderColor: isPrimary ? undefined : theme.colors.primary,
      width: fullWidth ? '100%' : undefined,
      shadowColor: isPrimary ? 'rgba(0,0,0,0.10)' : 'transparent',
      shadowOpacity: isPrimary ? 1 : 0,
      shadowOffset: isPrimary ? { width: 0, height: 4 } : { width: 0, height: 0 },
      shadowRadius: isPrimary ? 8 : 0,
      elevation: isPrimary ? 3 : 0,
    },
    content: {
      paddingHorizontal: 24,
    },
    pressed: {
      opacity: 0.92,
      transform: [{ scale: 0.97 }],
    },
    disabled: {
      opacity: 0.45,
    },
  });

  return { styles, labelColor };
};
