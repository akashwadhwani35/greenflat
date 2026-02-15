import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/PageHeader';

type Props = { onBack: () => void };

export const TermsScreen: React.FC<Props> = ({ onBack }) => {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Terms & privacy" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ---------- TERMS OF SERVICE ---------- */}
        <Typography variant="h2">Terms of Service</Typography>
        <Typography variant="small" muted>Last updated: February 2026</Typography>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">1. Eligibility</Typography>
          <Typography variant="small" muted>
            You must be at least 18 years old to use GreenFlag. By creating an account you confirm you meet this requirement and that all information you provide is accurate.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">2. Account Rules</Typography>
          <Typography variant="small" muted>
            You are responsible for your account credentials and all activity under your account. Do not share your login details. One account per person; duplicate or fake accounts will be removed.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">3. Conduct</Typography>
          <Typography variant="small" muted>
            Treat others with respect. Harassment, hate speech, impersonation, spam, scams, and sexually explicit content are prohibited. Violations may result in immediate suspension or permanent ban.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">4. Content & Intellectual Property</Typography>
          <Typography variant="small" muted>
            You retain ownership of content you post but grant GreenFlag a worldwide, royalty-free license to display it within the app. Do not post content you do not have the right to share. GreenFlag trademarks, logos, and AI-generated match insights are our intellectual property.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">5. Safety</Typography>
          <Typography variant="small" muted>
            GreenFlag provides verification tools (phone OTP, selfie age check, location) to promote trust. We encourage you to verify your profile, but verification does not guarantee another user's identity. Always exercise caution when meeting in person.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">6. Premium & Credits</Typography>
          <Typography variant="small" muted>
            Certain features (AI Search, Compliments, Boosts) require credits or a premium subscription. All purchases are final unless required otherwise by applicable law. Credit balances have no cash value.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">7. Termination</Typography>
          <Typography variant="small" muted>
            You may delete your account at any time from Settings. We may suspend or terminate accounts that violate these terms. Upon termination, your profile, matches, and messages will be permanently deleted.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">8. Limitation of Liability</Typography>
          <Typography variant="small" muted>
            GreenFlag is provided "as is." We do not guarantee matches, relationship outcomes, or uninterrupted service. To the fullest extent permitted by law, our liability is limited to the amount you paid us in the 12 months preceding a claim.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">9. Contact</Typography>
          <Typography variant="small" muted>
            Questions about these terms? Email us at support@greenflag.app.
          </Typography>
        </View>

        {/* ---------- PRIVACY POLICY ---------- */}
        <View style={{ marginTop: 24 }}>
          <Typography variant="h2">Privacy Policy</Typography>
          <Typography variant="small" muted>Last updated: February 2026</Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">1. Data Collection</Typography>
          <Typography variant="small" muted>
            We collect information you provide (name, email, date of birth, photos, bio, preferences) and information generated through your use of the app (likes, messages, search queries, device info, approximate location).
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">2. How We Use Data</Typography>
          <Typography variant="small" muted>
            Your data is used to operate the app: creating your profile, generating AI-powered match suggestions, delivering messages, processing payments, providing customer support, and improving our services.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">3. Data Sharing</Typography>
          <Typography variant="small" muted>
            We do not sell your personal data. We share data only with service providers who help us run the app (hosting, SMS delivery, payment processing, AI services) and when required by law.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">4. Data Security</Typography>
          <Typography variant="small" muted>
            We use industry-standard measures including encrypted connections (TLS), hashed passwords, and access controls. No system is perfectly secure; we encourage you to use a strong, unique password.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">5. Your Rights</Typography>
          <Typography variant="small" muted>
            You can access, correct, or delete your personal data at any time through the app's Settings. You may also request a copy of your data or ask us to restrict processing by contacting support@greenflag.app.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">6. Children's Privacy</Typography>
          <Typography variant="small" muted>
            GreenFlag is not intended for anyone under 18. We do not knowingly collect information from minors. If we learn that a user is under 18, we will delete their account.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">7. Changes</Typography>
          <Typography variant="small" muted>
            We may update this policy from time to time. We will notify you of material changes via the app or email. Continued use after changes constitutes acceptance.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">8. Contact</Typography>
          <Typography variant="small" muted>
            Privacy questions? Email us at support@greenflag.app.
          </Typography>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
});
