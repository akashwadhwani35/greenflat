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

const packs = [
  { id: '15' as const, amount: 15, price: '$3.99', centsEach: 26 },
  { id: '40' as const, amount: 40, price: '$8.99', centsEach: 22 },
  { id: '95' as const, amount: 95, price: '$16.99', centsEach: 18 },
  { id: '260' as const, amount: 260, price: '$39.99', centsEach: 15 },
];

export const CheckoutScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl, onPurchased }) => {
  const theme = useTheme();
  const [selectedPackId, setSelectedPackId] = useState<typeof packs[number]['id'] | null>(null);
  const [loading, setLoading] = useState(false);

  const applyPurchase = async (packId: typeof packs[number]['id']) => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/wallet/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pack_id: packId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Purchase failed');
      }
      Alert.alert('Success', 'Tokens added to your wallet.');
      onPurchased?.();
    } catch (error: any) {
      Alert.alert('Purchase failed', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Get Tokens" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {packs.map((pack) => (
          <View
            key={pack.id}
            style={[
              styles.card,
              {
                borderColor: selectedPackId === pack.id ? theme.colors.neonGreen : theme.colors.border,
                backgroundColor: selectedPackId === pack.id ? theme.colors.secondaryHighlight : 'transparent',
              },
            ]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Typography variant="bodyStrong">{pack.amount} GFT</Typography>
              <Typography variant="small" muted>
                {pack.centsEach}¢ each
              </Typography>
            </View>
            <Typography variant="h2">{pack.price}</Typography>
            <Button label="Select" onPress={() => setSelectedPackId(pack.id)} />
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
              if (!selectedPackId) {
                Alert.alert('Select a pack', 'Please select a token pack first.');
                return;
              }
              void applyPurchase(selectedPackId);
            }}
            loading={loading}
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
