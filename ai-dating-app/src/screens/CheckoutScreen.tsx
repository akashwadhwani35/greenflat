import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/PageHeader';

type Props = {
  onBack: () => void;
  token: string;
  apiBaseUrl: string;
  onPurchased?: () => void;
};

const packs = [
  { id: '15', amount: 15, price: '$3.99', centsEach: 26 },
  { id: '40', amount: 40, price: '$8.99', centsEach: 22 },
  { id: '95', amount: 95, price: '$16.99', centsEach: 17 },
  { id: '260', amount: 260, price: '$39.99', centsEach: 15 },
];

const TOKEN_COSTS = { AI_SEARCH: 1, COMPLIMENT: 6, SUPER_LIKE: 4, BOOST: 20 };

export const CheckoutScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl, onPurchased }) => {
  const theme = useTheme();
  const [selectedPackId, setSelectedPackId] = useState<string>(packs[0].id);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [showTokenInfo, setShowTokenInfo] = useState(false);

  const fetchBalance = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/wallet/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setBalance(Number(data.credit_balance || 0));
      }
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchBalance().catch(() => setFetching(false));
  }, []);

  const selectedPack = packs.find((p) => p.id === selectedPackId) ?? packs[0];
  const previewBalance = balance + selectedPack.amount;

  const actions = [
    { label: 'AI Searches', count: Math.floor(previewBalance / TOKEN_COSTS.AI_SEARCH) },
    { label: 'Compliments', count: Math.floor(previewBalance / TOKEN_COSTS.COMPLIMENT) },
    { label: 'GreenFlags', count: Math.floor(previewBalance / TOKEN_COSTS.SUPER_LIKE) },
    { label: 'Boost', count: Math.floor(previewBalance / TOKEN_COSTS.BOOST) },
  ];

  const applyPurchase = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/wallet/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pack_id: selectedPackId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Purchase failed');
      }
      // Update balance from response or re-fetch
      if (body.wallet?.credit_balance != null) {
        setBalance(Number(body.wallet.credit_balance));
      } else {
        setBalance((prev) => prev + selectedPack.amount);
      }
      Alert.alert('Success', `${selectedPack.amount} GFT added to your wallet.`);
      onPurchased?.();
    } catch (error: any) {
      Alert.alert('Purchase failed', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader
        title="Wallet"
        onBack={onBack}
        right={
          <TouchableOpacity
            onPress={() => setShowTokenInfo(true)}
            style={[styles.infoButton, { borderColor: theme.colors.neonGreen }]}
            activeOpacity={0.7}
          >
            <Feather name="info" size={18} color={theme.colors.neonGreen} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Balance card */}
        <View style={[styles.balanceCard, { backgroundColor: theme.colors.neonGreen }]}>
          <Typography variant="small" style={styles.balanceLabel}>GF TOKENS</Typography>
          {fetching ? (
            <ActivityIndicator color="#000" style={{ marginVertical: 12 }} />
          ) : (
            <Typography variant="display" style={styles.balanceNumber}>{balance}</Typography>
          )}
        </View>

        {/* Actions breakdown */}
        <Typography variant="small" style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 4 }}>
          Use GFTs for any of these actions
        </Typography>
        <View style={styles.actionsBlock}>
          {actions.map((action) => (
            <View key={action.label} style={styles.actionRow}>
              <Typography variant="h2" style={{ color: theme.colors.neonGreen, minWidth: 28 }}>
                {action.count}
              </Typography>
              <Typography variant="body" style={{ color: theme.colors.text }}>
                {action.label}
              </Typography>
            </View>
          ))}
        </View>

        {/* Packs grid */}
        <View style={styles.packsGrid}>
          {packs.map((pack) => {
            const isSelected = selectedPackId === pack.id;
            return (
              <Pressable
                key={pack.id}
                style={[
                  styles.packCard,
                  isSelected
                    ? { backgroundColor: theme.colors.neonGreen }
                    : { backgroundColor: theme.colors.charcoal },
                ]}
                onPress={() => setSelectedPackId(pack.id)}
              >
                <Typography
                  variant="small"
                  style={{
                    color: isSelected ? 'rgba(0,0,0,0.6)' : theme.colors.neonGreen,
                    fontFamily: 'RedHatDisplay_600SemiBold',
                  }}
                >
                  {pack.centsEach} cents each
                </Typography>
                <Typography
                  variant="h1"
                  style={{
                    color: isSelected ? '#000' : theme.colors.text,
                    fontFamily: 'RedHatDisplay_700Bold',
                  }}
                >
                  {pack.amount} GFT
                </Typography>
              </Pressable>
            );
          })}
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            { backgroundColor: theme.colors.neonGreen },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            loading && { opacity: 0.6 },
          ]}
          onPress={applyPurchase}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Typography variant="h2" style={{ color: '#000', fontFamily: 'RedHatDisplay_700Bold' }}>
              Get {selectedPack.amount} GFT for {selectedPack.price}
            </Typography>
          )}
        </Pressable>
      </ScrollView>

      <Modal visible={showTokenInfo} transparent animationType="fade" onRequestClose={() => setShowTokenInfo(false)}>
        <View style={styles.infoOverlay}>
          <View style={[styles.infoCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Typography variant="h1" style={{ color: theme.colors.text, marginBottom: 8 }}>
              How GF Tokens Work
            </Typography>
            <Typography variant="body" muted style={{ textAlign: 'center', marginBottom: 20 }}>
              GF Tokens power your actions in the app. Use them whenever you want to stand out or move faster.
            </Typography>

            <View style={styles.infoItemBlock}>
              <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
                AI Search – <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>1 Token</Typography>
              </Typography>
              <Typography variant="small" muted style={{ fontStyle: 'italic' }}>Find more refined matches instantly.</Typography>
            </View>

            <View style={styles.infoItemBlock}>
              <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
                Green Flag – <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>4 Tokens</Typography>
              </Typography>
              <Typography variant="small" muted style={{ fontStyle: 'italic' }}>Puts you at the top of their Likes.</Typography>
            </View>

            <View style={styles.infoItemBlock}>
              <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
                Compliment – <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>6 Tokens</Typography>
              </Typography>
              <Typography variant="small" muted style={{ fontStyle: 'italic' }}>Delivers your message directly to their inbox.</Typography>
            </View>

            <View style={styles.infoItemBlock}>
              <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
                Boost – <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>20 Tokens</Typography>
              </Typography>
              <Typography variant="small" muted style={{ fontStyle: 'italic' }}>Increases your profile visibility for more exposure.</Typography>
            </View>

            <Pressable
              style={[styles.infoCloseButton, { backgroundColor: theme.colors.neonGreen }]}
              onPress={() => setShowTokenInfo(false)}
            >
              <Typography variant="bodyStrong" style={{ color: '#000' }}>Let's gooo</Typography>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  balanceCard: {
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    color: 'rgba(0,0,0,0.5)',
    fontFamily: 'RedHatDisplay_600SemiBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  balanceNumber: {
    color: '#000',
    fontFamily: 'RedHatDisplay_700Bold',
    fontSize: 56,
    lineHeight: 64,
  },
  actionsBlock: {
    paddingHorizontal: 20,
    gap: 6,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  packsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  packCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 4,
  },
  ctaButton: {
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  infoCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
  },
  infoItemBlock: {
    alignItems: 'center',
    marginBottom: 18,
  },
  infoCloseButton: {
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
});
