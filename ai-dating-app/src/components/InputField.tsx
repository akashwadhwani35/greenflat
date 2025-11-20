import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Typography } from './Typography';

type Props = TextInputProps & {
  label?: string;
  helperText?: string;
  hintExample?: string;
  hintPlacement?: 'above' | 'below';
  errorText?: string;
  multiline?: boolean;
  variant?: 'underline' | 'filled';
};

export const InputField: React.FC<Props> = ({
  label,
  helperText,
  hintExample,
  hintPlacement = 'below',
  errorText,
  style,
  multiline,
  variant = 'underline',
  ...props
}) => {
  const theme = useTheme();
  const styles = createStyles(theme, variant);
  const hasError = Boolean(errorText);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Typography variant="small" muted style={styles.label}>
          {label}
        </Typography>
      ) : null}
      {hintExample && hintPlacement === 'above' ? (
        <Typography variant="small" muted>
          {hintExample}
        </Typography>
      ) : null}
      <TextInput
        style={[
          styles.input,
          variant === 'filled' && styles.filled,
          multiline && styles.multiline,
          focused && styles.focused,
          hasError && styles.errorBorder,
          style,
        ]}
        placeholderTextColor={theme.colors.mutedLight}
        multiline={multiline}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        {...props}
      />
      {hintExample && hintPlacement === 'below' ? (
        <Typography variant="small" muted>
          {hintExample}
        </Typography>
      ) : null}
      {helperText && !hasError ? (
        <Typography variant="small" muted>
          {helperText}
        </Typography>
      ) : null}
      {hasError ? (
        <Typography variant="small" tone="error">
          {errorText}
        </Typography>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>, variant: 'underline' | 'filled') =>
  StyleSheet.create({
    wrapper: {
      width: '100%',
      rowGap: 10,
    },
    label: {
      letterSpacing: 0.5,
    },
    input: {
      borderBottomWidth: variant === 'underline' ? 2 : 0,
      borderColor: theme.colors.border,
      paddingVertical: 18,
      paddingHorizontal: variant === 'filled' ? 20 : 0,
      fontFamily: theme.fonts.body.family,
      fontSize: 17,
      lineHeight: 24,
      color: theme.colors.text,
      minHeight: 48,
    },
    filled: {
      backgroundColor: '#F5F5F5',
      borderRadius: 16,
      borderBottomWidth: 0,
    },
    focused: {
      borderBottomWidth: variant === 'underline' ? 3 : 0,
      borderColor: variant === 'underline' ? theme.colors.primary : 'transparent',
      backgroundColor: variant === 'filled' ? '#EEEEEE' : 'transparent',
    },
    errorBorder: {
      borderBottomWidth: variant === 'underline' ? 3 : 0,
      borderColor: variant === 'underline' ? theme.colors.error : 'transparent',
      backgroundColor: variant === 'filled' ? '#FFE5E5' : 'transparent',
    },
    multiline: {
      minHeight: 120,
      textAlignVertical: 'top',
      paddingTop: 18,
    },
  });
