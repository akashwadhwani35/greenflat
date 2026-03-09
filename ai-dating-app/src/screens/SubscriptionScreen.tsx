import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, Linking } from 'react-native';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PixelFlag } from '../components/PixelFlag';
import { Feather } from '@expo/vector-icons';

type PlanTier = 'pro' | 'premium';
type Duration = '1week' | '1month' | '3month' | '6month';

type PricingOption = {
  duration: Duration;
  label: string;
  price: string;
  perUnit: string;
};

const proPricing: PricingOption[] = [
  { duration: '1week', label: '1 week', price: '$6.99', perUnit: '$6.99/wk' },
  { duration: '1month', label: '1 month', price: '$14.99', perUnit: '$14.99/mo' },
  { duration: '3month', label: '3 months', price: '$29.99', perUnit: '$9.99/mo' },
  { duration: '6month', label: '6 months', price: '$44.99', perUnit: '$7.49/mo' },
];

const premiumPricing: PricingOption[] = [
  { duration: '1week', label: '1 week', price: '$11.99', perUnit: '$11.99/wk' },
  { duration: '1month', label: '1 month', price: '$24.99', perUnit: '$24.99/mo' },
  { duration: '3month', label: '3 months', price: '$49.99', perUnit: '$16.66/mo' },
  { duration: '6month', label: '6 months', price: '$74.99', perUnit: '$12.49/mo' },
];

const proBenefits = [
  'Send unlimited likes',
  'Unlimited rewinds',
  'Set more dating preferences',
  '30 GFT monthly',
];

const premiumBenefits = [
  'Everything in Pro',
  'Get seen first',
  '3x your matches',
  'Priority support',
  '60 GFT monthly',
];

type Props = {
  onClose: () => void;
  initialTab?: PlanTier;
  token: string;
  apiBaseUrl: string;
  onPurchased?: () => void;
};

export const SubscriptionScreen: React.FC<Props> = ({
  onClose,
  initialTab = 'pro',
  token,
  apiBaseUrl,
  onPurchased,
}) => {
  const theme = useTheme();
  const [selectedTab, setSelectedTab] = useState<PlanTier>(initialTab);
  const [selectedDuration, setSelectedDuration] = useState<Duration>('1week');
  const [loading, setLoading] = useState(false);

  const pricing = selectedTab === 'pro' ? proPricing : premiumPricing;
  const benefits = selectedTab === 'pro' ? proBenefits : premiumBenefits;
  const tagline =
    selectedTab === 'pro'
      ? 'Send unlimited likes\n& rewind anytime.'
      : 'Get seen first\n& 3x your dates.';

  const selected = pricing.find((p) => p.duration === selectedDuration) ?? pricing[0];

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/wallet/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: selectedTab, duration: selectedDuration }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Purchase failed');
      Alert.alert('Subscribed!', `You're now on ${selectedTab === 'pro' ? 'Pro' : 'Premium'}!`);
      onPurchased?.();
    } catch (error: any) {
      Alert.alert('Purchase failed', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with X */}
      <View style={styles.header}>
        <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
          <Feather name="x" size={24} color={theme.colors.muted} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable style={styles.tabItem} onPress={() => setSelectedTab('pro')}>
          <View style={styles.tabLabel}>
            <PixelFlag size={18} color={selectedTab === 'pro' ? theme.colors.neonGreen : theme.colors.muted} />
            <Typography
              variant="bodyStrong"
              style={{ color: selectedTab === 'pro' ? theme.colors.neonGreen : theme.colors.muted }}
            >
              Pro
            </Typography>
          </View>
          {selectedTab === 'pro' && <View style={[styles.tabIndicator, { backgroundColor: theme.colors.neonGreen }]} />}
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => setSelectedTab('premium')}>
          <View style={styles.tabLabel}>
            <PixelFlag size={18} color={selectedTab === 'premium' ? theme.colors.neonGreen : theme.colors.muted} />
            <Typography
              variant="bodyStrong"
              style={{ color: selectedTab === 'premium' ? theme.colors.neonGreen : theme.colors.muted }}
            >
              Premium
            </Typography>
          </View>
          {selectedTab === 'premium' && <View style={[styles.tabIndicator, { backgroundColor: theme.colors.neonGreen }]} />}
        </Pressable>
      </View>

      <View style={[styles.tabDivider, { backgroundColor: theme.colors.border }]} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tagline card */}
        <View style={[styles.taglineCard, { borderColor: theme.colors.neonGreen }]}>
          <Typography variant="h1" style={{ color: theme.colors.neonGreen, textAlign: 'center', lineHeight: 32 }}>
            {tagline}
          </Typography>
        </View>

        {/* Pricing grid */}
        <View style={styles.pricingGrid}>
          {pricing.map((option) => {
            const isSelected = selectedDuration === option.duration;
            return (
              <Pressable
                key={option.duration}
                style={[
                  styles.priceCard,
                  isSelected
                    ? { backgroundColor: theme.colors.neonGreen }
                    : { backgroundColor: theme.colors.charcoal },
                ]}
                onPress={() => setSelectedDuration(option.duration)}
              >
                <Typography
                  variant="small"
                  style={{
                    color: isSelected ? '#000' : theme.colors.neonGreen,
                    fontFamily: 'RedHatDisplay_600SemiBold',
                  }}
                >
                  {option.label}
                </Typography>
                <Typography
                  variant="h2"
                  style={{
                    color: isSelected ? '#000' : theme.colors.text,
                    fontFamily: 'RedHatDisplay_700Bold',
                  }}
                >
                  {option.perUnit}
                </Typography>
              </Pressable>
            );
          })}
        </View>

        {/* Benefits divider */}
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        {/* Benefits list */}
        <View style={styles.benefitsList}>
          {benefits.map((benefit) => (
            <Typography
              key={benefit}
              variant="body"
              style={{ color: theme.colors.text, textAlign: 'center', fontSize: 17 }}
            >
              {benefit}
            </Typography>
          ))}
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

        {/* Terms */}
        <Typography variant="small" style={styles.termsText}>
          By purchasing, you will be charged, your subscription will auto-renew for the same price and package length
          until you cancel anytime in Settings, and you agree to our{' '}
          <Typography
            variant="small"
            style={{ textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('https://gflag.app/terms')}
          >
            Terms.
          </Typography>
        </Typography>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            { backgroundColor: theme.colors.neonGreen },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            loading && { opacity: 0.6 },
          ]}
          onPress={handlePurchase}
          disabled={loading}
        >
          <Typography variant="h2" style={{ color: '#000', fontFamily: 'RedHatDisplay_700Bold', textAlign: 'center' }}>
            Get {selected.label} for {selected.price}
          </Typography>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 8,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
  },
  tabLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabIndicator: {
    height: 3,
    borderRadius: 2,
    width: '80%',
    marginTop: 8,
  },
  tabDivider: {
    height: StyleSheet.hairlineWidth,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    gap: 20,
    paddingTop: 20,
  },
  taglineCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  pricingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  priceCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  benefitsList: {
    gap: 10,
    alignItems: 'center',
  },
  termsText: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  ctaButton: {
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
