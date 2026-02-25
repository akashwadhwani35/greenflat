import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/PageHeader';
import { Feather } from '@expo/vector-icons';

type Props = {
  onBack: () => void;
  onOpenCheckout?: () => void;
  token?: string;
  apiBaseUrl?: string;
};

const ACTION_COSTS = {
  aiSearch: 1,
  compliment: 6,
  greenFlag: 4,
  boost: 20,
} as const;

const PACKS = [
  { id: '15', amount: 15, centsEach: 26, price: '$3.99' },
  { id: '40', amount: 40, centsEach: 22, price: '$8.99' },
  { id: '95', amount: 95, centsEach: 18, price: '$16.99' },
  { id: '260', amount: 260, centsEach: 15, price: '$39.99' },
] as const;

export const WalletScreen: React.FC<Props> = ({ onBack, onOpenCheckout, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [selectedPackId, setSelectedPackId] = useState<(typeof PACKS)[number]['id']>('15');

  useEffect(() => {
    const fetchWallet = async () => {
      if (!token || !apiBaseUrl) return;
      try {
        setLoading(true);
        const response = await fetch(`${apiBaseUrl}/wallet/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        setBalance(Number(data.credit_balance || 0));
      } finally {
        setLoading(false);
      }
    };
    fetchWallet().catch((err) => console.warn('Failed to load wallet:', err));
  }, [token, apiBaseUrl]);

  const selectedPack = useMemo(
    () => PACKS.find((pack) => pack.id === selectedPackId) ?? PACKS[0],
    [selectedPackId]
  );

  const actionRows = useMemo(() => ([
    { label: 'AI Searches', value: Math.floor(balance / ACTION_COSTS.aiSearch) },
    { label: 'Compliments', value: Math.floor(balance / ACTION_COSTS.compliment) },
    { label: 'Super Likes', value: Math.floor(balance / ACTION_COSTS.greenFlag) },
    { label: 'Boost', value: Math.floor(balance / ACTION_COSTS.boost) },
  ]), [balance]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader
        title="Wallet"
        onBack={onBack}
        right={(
          <Pressable
            onPress={() => Alert.alert('Token info', 'Use tokens for AI searches, compliments, GreenFlags, and boost.')}
            style={[
              styles.infoButton,
              { borderColor: theme.colors.neonGreen, backgroundColor: theme.colors.secondaryHighlight },
            ]}
            accessibilityRole="button"
          >
            <Feather name="info" size={16} color={theme.colors.neonGreen} />
          </Pressable>
        )}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={theme.colors.brand} style={styles.loader} /> : null}

        <View style={[styles.balanceCard, { backgroundColor: theme.colors.neonGreen }]}>
          <Typography variant="tiny" style={[styles.balanceLabel, { color: theme.colors.deepBlack }]}>
            GF TOKENS
          </Typography>
          <Typography variant="display" style={[styles.balanceValue, { color: theme.colors.deepBlack }]}>
            {balance}
          </Typography>
        </View>

        <Typography variant="small" style={[styles.helperText, { color: theme.colors.textDark }]}>
          Use GFTs for any of these actions
        </Typography>

        <View style={styles.actionsBlock}>
          {actionRows.map((item) => (
            <View key={item.label} style={styles.actionRow}>
              <Typography variant="bodyStrong" style={[styles.actionValue, { color: theme.colors.neonGreen }]}>
                {item.value}
              </Typography>
              <Typography variant="bodyStrong" style={[styles.actionLabel, { color: theme.colors.text }]}>
                {item.label}
              </Typography>
            </View>
          ))}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.secondaryHairline }]} />

        <View style={styles.packsGrid}>
          {PACKS.map((pack) => {
            const selected = pack.id === selectedPackId;
            return (
              <Pressable
                key={pack.id}
                onPress={() => setSelectedPackId(pack.id)}
                style={[
                  styles.packCard,
                  selected
                    ? { backgroundColor: theme.colors.neonGreen, borderColor: theme.colors.neonGreen }
                    : { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline },
                ]}
                accessibilityRole="button"
              >
                <Typography
                  variant="tiny"
                  style={{ color: selected ? theme.colors.deepBlack : theme.colors.textDark, textAlign: 'center' }}
                >
                  {pack.centsEach} cents each
                </Typography>
                <Typography
                  variant="h1"
                  style={[styles.packAmount, { color: selected ? theme.colors.deepBlack : theme.colors.text }]}
                >
                  {pack.amount} GFT
                </Typography>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => {
            if (!onOpenCheckout) return;
            onOpenCheckout();
          }}
          style={[styles.ctaButton, { backgroundColor: theme.colors.neonGreen }]}
          accessibilityRole="button"
        >
          <Typography variant="bodyStrong" style={[styles.ctaText, { color: theme.colors.deepBlack }]}>
            {`Get ${selectedPack.amount} GFT for ${selectedPack.price}`}
          </Typography>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 150,
    gap: 14,
  },
  loader: {
    marginTop: 6,
  },
  infoButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  balanceCard: {
    borderRadius: 20,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  balanceLabel: {
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 68,
    lineHeight: 72,
    fontFamily: 'RedHatDisplay_700Bold',
  },
  helperText: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  actionsBlock: {
    alignSelf: 'center',
    gap: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  actionValue: {
    minWidth: 24,
    textAlign: 'right',
    fontFamily: 'RedHatDisplay_700Bold',
  },
  actionLabel: {
    minWidth: 150,
    fontFamily: 'RedHatDisplay_400Regular',
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
    opacity: 0.35,
  },
  packsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  packCard: {
    width: '48.5%',
    minHeight: 86,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    gap: 2,
  },
  packAmount: {
    fontFamily: 'RedHatDisplay_700Bold',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  ctaButton: {
    marginTop: 10,
    borderRadius: 26,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaText: {
    fontFamily: 'RedHatDisplay_700Bold',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});
