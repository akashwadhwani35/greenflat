import React, { useState } from 'react';
import { Animated, StyleSheet, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
  // Password fields get an eye icon; tapping it shows the text in the clear.
  const isSecret = Boolean(props.secureTextEntry);
  const [secretVisible, setSecretVisible] = useState(false);

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
      <View style={styles.inputRow}>
        <TextInput
          {...props}
          secureTextEntry={isSecret && !secretVisible}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              fontFamily: 'RedHatDisplay_400Regular',
              fontSize: 17,
            },
            isSecret && styles.inputWithIcon,
            style,
          ]}
          placeholderTextColor={theme.colors.mutedLight}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {isSecret ? (
          <TouchableOpacity
            onPress={() => setSecretVisible((v) => !v)}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={secretVisible ? 'Hide password' : 'Show password'}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name={secretVisible ? 'eye-off' : 'eye'} size={20} color={isFocused ? theme.colors.brand : theme.colors.mutedLight} />
          </TouchableOpacity>
        ) : null}
      </View>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 0,
    fontSize: 17,
    lineHeight: 24,
  },
  inputWithIcon: {
    paddingRight: 40,
  },
  eyeButton: {
    position: 'absolute',
    right: 0,
    paddingVertical: 8,
    paddingLeft: 8,
  },
  underline: {
    width: '100%',
    marginTop: 2,
  },
  error: {
    marginTop: 6,
  },
});
