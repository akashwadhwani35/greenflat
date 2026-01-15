import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, TouchableOpacity, StatusBar, Platform, Image, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

const glassLogo = require('../../assets/glass-logo.png');

type WelcomeScreenProps = {
  onStart: () => void;
  onLogin?: () => void;
  onDemoLogin?: () => void;
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onLogin, onDemoLogin }) => {
  const theme = useTheme();
  const logoAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.neonGreen }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={styles.content}>
        {/* Header - GreenFlag text */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: logoAnim,
              transform: [{
                translateY: logoAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              }],
            }
          ]}
        >
          <Text style={styles.brandName}>GreenFlag</Text>
        </Animated.View>

        {/* Center - 3D Logo */}
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: logoAnim,
              transform: [{
                scale: logoAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              }],
            }
          ]}
        >
          <Image
            source={glassLogo}
            style={styles.logo3D}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Bottom Content */}
        <Animated.View
          style={[
            styles.bottomSection,
            {
              opacity: contentAnim,
              transform: [{
                translateY: contentAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              }],
            }
          ]}
        >
          <View style={styles.headlineContainer}>
            <Text style={styles.headline}>AI Found</Text>
            <Text style={styles.headline}>Your match.</Text>
          </View>

          {/* Create Account Button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onStart}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Create account</Text>
          </TouchableOpacity>

          {/* Login Link */}
          {onLogin ? (
            <TouchableOpacity onPress={onLogin} style={styles.loginLink}>
              <Text style={styles.loginText}>
                Already a member? <Text style={styles.loginTextUnderline}>Log In</Text>
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Terms */}
          <Text style={styles.termsText}>
            By registering, you accept our{' '}
            <Text style={styles.termsLink}>Terms and Conditions of Use</Text>
            {' '}and our{' '}
            <Text style={styles.termsLink}>Privacy Policy.</Text>
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 20,
    paddingBottom: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  logoSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo3D: {
    width: 280,
    height: 280,
  },
  bottomSection: {
    gap: 20,
    alignItems: 'center',
  },
  headlineContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  headline: {
    fontSize: 36,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  primaryButton: {
    backgroundColor: '#000000',
    borderRadius: 999,
    paddingVertical: 18,
    paddingHorizontal: 60,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  loginLink: {
    paddingVertical: 8,
  },
  loginText: {
    fontSize: 15,
    color: '#000000',
  },
  loginTextUnderline: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  termsText: {
    fontSize: 12,
    color: '#000000',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
    opacity: 0.8,
  },
  termsLink: {
    fontWeight: '600',
  },
});
