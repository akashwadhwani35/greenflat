import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, TouchableOpacity, StatusBar, Platform, Image, Text, Dimensions, Modal, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Typography } from '../components/Typography';

const glassLogo = require('../../assets/glass-logo.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LOGO_SIZE = Math.min(SCREEN_WIDTH * 0.96, 420);

type WelcomeScreenProps = {
  onStart: () => void;
  onLogin?: () => void;
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onLogin }) => {
  const theme = useTheme();
  const logoAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const [legalModal, setLegalModal] = useState<null | 'terms' | 'privacy'>(null);

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
          <View style={styles.logoWrap}>
            <Image
              source={glassLogo}
              style={styles.logo3D}
              resizeMode="contain"
            />
          </View>
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
          <View style={styles.termsWrap}>
            <Text style={styles.termsText}>
              By registering, you accept our{' '}
              <Text style={styles.termsLink} onPress={() => setLegalModal('terms')}>
                Terms and Conditions of Use
              </Text>
              {' '}and our{' '}
              <Text style={styles.termsLink} onPress={() => setLegalModal('privacy')}>
                Privacy Policy.
              </Text>
            </Text>
          </View>
        </Animated.View>
      </View>

      <Modal
        visible={Boolean(legalModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setLegalModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <TouchableOpacity
              onPress={() => setLegalModal(null)}
              style={[styles.modalClose, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
              accessibilityRole="button"
            >
              <Feather name="x" size={20} color={theme.colors.text} />
            </TouchableOpacity>

            <Typography variant="h2" style={{ color: theme.colors.text }}>
              {legalModal === 'privacy' ? 'Privacy Policy' : 'Terms and Conditions of Use'}
            </Typography>

            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              {legalModal === 'privacy' ? (
                <>
                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>1. Data Collection</Text>
                  <Text style={styles.modalBodyText}>We collect information you provide (name, email, date of birth, photos, bio, preferences) and information generated through your use of the app (likes, messages, search queries, device info, approximate location).</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>2. How We Use Data</Text>
                  <Text style={styles.modalBodyText}>Your data is used to operate the app: creating your profile, generating AI-powered match suggestions, delivering messages, processing payments, providing customer support, and improving our services.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>3. Data Sharing</Text>
                  <Text style={styles.modalBodyText}>We do not sell your personal data. We share data only with service providers who help us run the app (hosting, SMS delivery, payment processing, AI services) and when required by law.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>4. Data Security</Text>
                  <Text style={styles.modalBodyText}>We use industry-standard measures including encrypted connections (TLS), hashed passwords, and access controls. No system is perfectly secure; we encourage you to use a strong, unique password.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>5. Your Rights</Text>
                  <Text style={styles.modalBodyText}>You can access, correct, or delete your personal data at any time through the app's Settings. You may also request a copy of your data or ask us to restrict processing by contacting support@greenflag.app.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>6. Children's Privacy</Text>
                  <Text style={styles.modalBodyText}>GreenFlag is not intended for anyone under 18. We do not knowingly collect information from minors. If we learn that a user is under 18, we will delete their account.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>7. Changes</Text>
                  <Text style={styles.modalBodyText}>We may update this policy from time to time. We will notify you of material changes via the app or email. Continued use after changes constitutes acceptance.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>8. Contact</Text>
                  <Text style={styles.modalBodyText}>Privacy questions? Email us at support@greenflag.app.</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>1. Eligibility</Text>
                  <Text style={styles.modalBodyText}>You must be at least 18 years old to use GreenFlag. By creating an account you confirm you meet this requirement and that all information you provide is accurate.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>2. Account Rules</Text>
                  <Text style={styles.modalBodyText}>You are responsible for your account credentials and all activity under your account. Do not share your login details. One account per person; duplicate or fake accounts will be removed.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>3. Conduct</Text>
                  <Text style={styles.modalBodyText}>Treat others with respect. Harassment, hate speech, impersonation, spam, scams, and sexually explicit content are prohibited. Violations may result in immediate suspension or permanent ban.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>4. Content & Intellectual Property</Text>
                  <Text style={styles.modalBodyText}>You retain ownership of content you post but grant GreenFlag a worldwide, royalty-free license to display it within the app. Do not post content you do not have the right to share.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>5. Safety</Text>
                  <Text style={styles.modalBodyText}>GreenFlag provides verification tools (phone OTP, selfie age check, location) to promote trust. Always exercise caution when meeting in person.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>6. Premium & Credits</Text>
                  <Text style={styles.modalBodyText}>Certain features (AI Search, Compliments, Boosts) require credits or a premium subscription. All purchases are final unless required otherwise by applicable law. Credit balances have no cash value.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>7. Termination</Text>
                  <Text style={styles.modalBodyText}>You may delete your account at any time from Settings. We may suspend or terminate accounts that violate these terms. Upon termination, your profile, matches, and messages will be permanently deleted.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>8. Limitation of Liability</Text>
                  <Text style={styles.modalBodyText}>GreenFlag is provided "as is." We do not guarantee matches, relationship outcomes, or uninterrupted service. To the fullest extent permitted by law, our liability is limited to the amount you paid us in the 12 months preceding a claim.</Text>

                  <Text style={[styles.modalSectionTitle, { color: theme.colors.text }]}>9. Contact</Text>
                  <Text style={styles.modalBodyText}>Questions about these terms? Email us at support@greenflag.app.</Text>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    fontFamily: 'RedHatDisplay_700Bold',
  },
  logoSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  logoWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo3D: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignSelf: 'center',
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
    fontFamily: 'RedHatDisplay_700Bold',
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
    fontFamily: 'RedHatDisplay_600SemiBold',
  },
  loginLink: {
    paddingVertical: 8,
  },
  loginText: {
    fontSize: 15,
    color: '#000000',
    fontFamily: 'RedHatDisplay_400Regular',
  },
  loginTextUnderline: {
    fontWeight: '600',
    textDecorationLine: 'underline',
    fontFamily: 'RedHatDisplay_600SemiBold',
  },
  termsText: {
    fontSize: 12,
    color: '#000000',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
    opacity: 0.8,
    fontFamily: 'RedHatDisplay_400Regular',
  },
  termsLink: {
    fontWeight: '600',
    fontFamily: 'RedHatDisplay_600SemiBold',
  },
  termsWrap: {
    width: '100%',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 16,
    maxHeight: '78%',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  modalClose: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  modalContent: {
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'RedHatDisplay_600SemiBold',
    marginTop: 6,
  },
  modalBodyText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'RedHatDisplay_400Regular',
  },
});
