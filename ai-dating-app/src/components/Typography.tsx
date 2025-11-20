import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

type Variant = 'display' | 'h1' | 'h2' | 'body' | 'bodyStrong' | 'small' | 'tiny';

type Props = TextProps & {
  variant?: Variant;
  muted?: boolean;
  tone?: 'default' | 'error' | 'success';
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
};

export const Typography: React.FC<Props> = ({
  variant = 'body',
  muted,
  tone = 'default',
  align = 'left',
  style,
  children,
  ...props
}) => {
  const theme = useTheme();
  const font = theme.fonts[variant];

  const color = tone === 'error'
    ? theme.colors.error
    : tone === 'success'
    ? theme.colors.success
    : muted
    ? theme.colors.muted
    : theme.colors.text;

  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: font.family,
          fontWeight: font.weight,
          fontSize: font.size,
          lineHeight: font.lineHeight,
          color,
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};
