import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/PageHeader';

type Props = {
  onBack: () => void;
  token: string;
  apiBaseUrl: string;
  onPurchased?: () => void;
};

const plans = [
  { id: 'starter' as const, title: 'Starter', price: '$4.99', detail: '10 AI searches + likes boost' },
  { id: 'premium' as const, title: 'Premium', price: '$14.99', detail: '30 AI searches, rewinds, read receipts' },
  { id: 'boost' as const, title: 'Boost', price: '$2.99', detail: 'Highlight your profile for 24 hours' },
];

export const CheckoutScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl, onPurchased }) => {
  const theme = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<typeof plans[number]['id'] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const applyPurchase = async (plan: typeof plans[number]['id']) => {
    try {
      setLoadingPlan(plan);
      const response = await fetch(`${apiBaseUrl}/wallet/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Purchase failed');
      }
      Alert.alert('Success', 'Your plan is now active.');
      onPurchased?.();
    } catch (error: any) {
      Alert.alert('Purchase failed', error?.message || 'Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Get more" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {plans.map((plan) => (
          <View
            key={plan.title}
            style={[
              styles.card,
              {
                borderColor: selectedPlan === plan.id ? theme.colors.neonGreen : theme.colors.border,
                backgroundColor: selectedPlan === plan.id ? theme.colors.secondaryHighlight : 'transparent',
              },
            ]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Typography variant="bodyStrong">{plan.title}</Typography>
              <Typography variant="small" muted>
                {plan.detail}
              </Typography>
            </View>
            <Typography variant="h2">{plan.price}</Typography>
            <Button label="Select" onPress={() => setSelectedPlan(plan.id)} />
          </View>
        ))}

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">Order summary</Typography>
          <Typography variant="small" muted>
            Taxes calculated at checkout. Purchases are final per policy.
          </Typography>
          <Button
            label="Confirm purchase"
            onPress={() => {
              if (!selectedPlan) {
                Alert.alert('Pick a plan', 'Please select a plan first.');
                return;
              }
              void applyPurchase(selectedPlan);
            }}
            loading={Boolean(loadingPlan)}
            fullWidth
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 140,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
