import React, { useState } from 'react';
import { Animated, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { Typography } from './Typography';
import { useTheme } from '../theme/ThemeProvider';

type UnderlineInputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export const UnderlineInput: React.FC<UnderlineInputProps> = ({
  label,
  error,
  style,
  ...props
}) => {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [underlineAnim] = useState(new Animated.Value(0));

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.timing(underlineAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    props.onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    Animated.timing(underlineAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    props.onBlur?.(e);
  };

  const underlineColor = underlineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.border, theme.colors.brand],
  });

  return (
    <View style={styles.container}>
      {label && (
        <Typography
          variant="small"
          muted={!isFocused}
          style={[styles.label, isFocused && { color: theme.colors.brand }]}
        >
          {label}
        </Typography>
      )}
      <TextInput
        {...props}
        style={[
          styles.input,
          {
            color: theme.colors.text,
            fontFamily: 'RedHatDisplay_400Regular',
            fontSize: 17,
          },
          style,
        ]}
        placeholderTextColor={theme.colors.mutedLight}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <Animated.View
        style={[
          styles.underline,
          {
            backgroundColor: underlineColor,
            height: isFocused ? 2 : 1,
          }
        ]}
      />
      {error && (
        <Typography variant="tiny" style={[styles.error, { color: theme.colors.error }]}>
          {error}
        </Typography>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
  },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    fontSize: 17,
    lineHeight: 24,
  },
  underline: {
    width: '100%',
    marginTop: 2,
  },
  error: {
    marginTop: 6,
  },
});
