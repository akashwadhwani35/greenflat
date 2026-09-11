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
  align,
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
          fontSize: font.size,
          lineHeight: font.lineHeight,
          color,
          // Only set when asked for. Defaulting to 'left' meant a Typography
          // nested inside a centered one stamped left over its parent and
          // stranded that run of text; Text's own default already resolves to
          // left in a left-to-right layout.
          ...(align ? { textAlign: align } : null),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};
