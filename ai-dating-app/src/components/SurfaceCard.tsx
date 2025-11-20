import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type SurfaceCardProps = ViewProps & {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevation?: 'none' | 'sm' | 'md';
  corner?: 'sm' | 'md' | 'lg';
};

export const SurfaceCard: React.FC<SurfaceCardProps> = ({
  children,
  style,
  padding = 'md',
  elevation = 'sm',
  corner = 'md',
  ...props
}) => {
  const theme = useTheme();

  const paddingValue = {
    none: 0,
    sm: 16,
    md: 24,
    lg: 32,
  }[padding];

  const borderRadius = {
    sm: theme.radius.sm,
    md: theme.radius.md,
    lg: theme.radius.lg,
  }[corner];

  const elevationStyle = elevation === 'none'
    ? {}
    : elevation === 'sm'
        ? {
            shadowColor: '#000000',
            shadowOpacity: 0.05,
            shadowOffset: { width: 0, height: 1 },
            shadowRadius: 4,
            elevation: 1,
          }
        : {
            shadowColor: '#000000',
            shadowOpacity: 0.08,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            elevation: 3,
          };

  return (
    <View
      {...props}
      style={[
        styles.base,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          padding: paddingValue,
          borderRadius,
        },
        elevationStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
