import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/PageHeader';
import { PixelFlag } from '../components/PixelFlag';
import { Feather } from '@expo/vector-icons';

type PlanTier = 'pro' | 'premium';

type Transaction = {
  id: number;
  amount: number | string;
  direction: 'credit' | 'debit' | string;
  reason: string;
  created_at: string;
};

// Server reasons are snake_case identifiers; these are the words a person sees.
const REASON_LABELS: Record<string, string> = {
  signup_bonus: 'Welcome tokens',
  weekly_allowance: 'Weekly free tokens',
  daily_allowance: 'Free tokens',
  ai_search: 'AI Search',
  superlike: 'Green Flag',
  compliment: 'First Move',
  compliment_send: 'First Move',
  boost: 'Boost',
  boost_activation: 'Boost',
  purchase: 'Token pack',
  admin_grant: 'Added by GreenFlag',
  admin_remove: 'Adjusted by GreenFlag',
};

const reasonLabel = (reason: string) =>
  REASON_LABELS[reason] || reason.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const historyDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

type Props = {
  onBack: () => void;
  onOpenCheckout?: () => void;
  onOpenSubscription?: (tab: PlanTier) => void;
  token?: string;
  apiBaseUrl?: string;
};

export const WalletScreen: React.FC<Props> = ({ onBack, onOpenCheckout, onOpenSubscription, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [activePlan, setActivePlan] = useState<PlanTier | null>(null);
  const [selectedTab, setSelectedTab] = useState<PlanTier>('pro');
  const [boosting, setBoosting] = useState(false);
  // Server decides whether anything is on sale. While it is false the app must
  // not offer purchases, because every buy attempt would come back a 501.
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [freeAllowance, setFreeAllowance] = useState<number | null>(null);
  const [nextRefillAt, setNextRefillAt] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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
        if (data.active_plan) setActivePlan(data.active_plan);
        setPaymentsEnabled(Boolean(data.payments_enabled));
        setFreeAllowance(data.free_allowance ?? null);
        setNextRefillAt(data.next_refill_at ?? null);
        setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      } finally {
        setLoading(false);
      }
    };
    fetchWallet().catch((err) => console.warn('Failed to load wallet:', err));
  }, [token, apiBaseUrl]);

  // "in about 5 hours" reads better here than a timestamp, and avoids implying
  // a precision the top-up does not have.
  const refillCountdown = (() => {
    if (!nextRefillAt) return null;
    const ms = new Date(nextRefillAt).getTime() - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const hours = Math.round(ms / (1000 * 60 * 60));
    if (hours >= 1) return `in about ${hours} hour${hours === 1 ? '' : 's'}`;
    const minutes = Math.max(1, Math.round(ms / (1000 * 60)));
    return `in about ${minutes} minute${minutes === 1 ? '' : 's'}`;
  })();

  const refillMessage = freeAllowance
    ? `You get ${freeAllowance} free GFT every week` +
      (refillCountdown ? `, next ones ${refillCountdown}.` : '.')
    : 'Free tokens arrive weekly.';

  const handleUpgrade = (tier: PlanTier) => {
    if (!paymentsEnabled) return;
    if (onOpenSubscription) onOpenSubscription(tier);
    else if (onOpenCheckout) onOpenCheckout();
  };

  const handleBoost = async () => {
    if (!token || !apiBaseUrl) return;
    if (balance < 20) {
      Alert.alert(
        'Not enough tokens',
        paymentsEnabled
          ? 'You need 20 GFT to boost. Get more tokens first.'
          : `You need 20 GFT to boost. ${refillMessage}`,
        paymentsEnabled
          ? [
              { text: 'Get tokens', onPress: onOpenCheckout },
              { text: 'Cancel', style: 'cancel' },
            ]
          : [{ text: 'OK' }]
      );
      return;
    }
    setBoosting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/profile/boost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Boost failed');
      setBalance((prev) => Math.max(0, prev - 20));
      Alert.alert('Boosted!', 'Your profile will be shown to more people for the next 6 hours.');
    } catch (error: any) {
      Alert.alert('Boost failed', error?.message || 'Please try again.');
    } finally {
      setBoosting(false);
    }
  };

  const isProActive = activePlan === 'pro';
  const isPremiumActive = activePlan === 'premium';
  const isSelectedActive = selectedTab === 'pro' ? isProActive : isPremiumActive;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Wallet" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={theme.colors.brand} style={{ marginTop: 6 }} /> : null}

        {/* Balance pill */}
        <View style={styles.balanceRow}>
          <View style={[styles.balancePill, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Typography variant="small" style={{ color: theme.colors.muted }}>GF Tokens</Typography>
            <Typography variant="h1" style={{ color: theme.colors.neonGreen }}>{balance}</Typography>
          </View>
          <Pressable
            onPress={onOpenCheckout}
            style={[styles.addTokens, { backgroundColor: theme.colors.neonGreen }]}
            accessibilityRole="button"
          >
            <Feather name="plus" size={18} color="#000" />
            <Typography variant="small" style={{ color: '#000', fontFamily: 'RedHatDisplay_600SemiBold' }}>
              Get tokens
            </Typography>
          </Pressable>
        </View>

        {/* Where tokens come from while packs are not on sale. */}
        {!paymentsEnabled ? (
          <View style={[styles.refillNote, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Feather name="gift" size={16} color={theme.colors.neonGreen} />
            <Typography variant="small" style={{ color: theme.colors.mutedLight, flex: 1 }}>
              {refillMessage}
            </Typography>
          </View>
        ) : null}

        {/* Paid plans are hidden entirely while nothing is on sale. */}
        {paymentsEnabled ? (
          <>
          {/* Plan tabs */}
          <View style={[styles.tabBar, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Pressable
              onPress={() => setSelectedTab('pro')}
              style={[
                styles.tab,
                selectedTab === 'pro' && { backgroundColor: theme.colors.neonGreen },
              ]}
            >
              <PixelFlag size={16} color={selectedTab === 'pro' ? '#000' : theme.colors.text} />
              <Typography
                variant="bodyStrong"
                style={{ color: selectedTab === 'pro' ? '#000' : theme.colors.text }}
              >
                Pro
              </Typography>
            </Pressable>
            <Pressable
              onPress={() => setSelectedTab('premium')}
              style={[
                styles.tab,
                selectedTab === 'premium' && { backgroundColor: theme.colors.neonGreen },
              ]}
            >
              <PixelFlag size={16} color={selectedTab === 'premium' ? '#000' : theme.colors.text} />
              <Typography
                variant="bodyStrong"
                style={{ color: selectedTab === 'premium' ? '#000' : theme.colors.text }}
              >
                Premium
              </Typography>
            </Pressable>
          </View>

          {/* Plan card */}
          {selectedTab === 'pro' ? (
            <View
              style={[
                styles.planCard,
                isProActive
                  ? { borderColor: theme.colors.neonGreen, borderWidth: 2 }
                  : { borderColor: theme.colors.neonGreen, borderWidth: 1 },
              ]}
            >
              {isProActive && (
                <View style={[styles.activeBadge, { backgroundColor: theme.colors.neonGreen }]}>
                  <Typography variant="tiny" style={{ color: '#000', fontFamily: 'RedHatDisplay_700Bold', letterSpacing: 1 }}>
                    ACTIVE
                  </Typography>
                </View>
              )}
              <Typography variant="body" style={{ color: theme.colors.text, textAlign: 'center', marginTop: isProActive ? 8 : 0 }}>
                Send unlimited likes & rewind anytime.
              </Typography>
              {!isProActive && (
                <Pressable
                  style={[styles.upgradeButtonOutlined, { borderColor: theme.colors.neonGreen }]}
                  onPress={() => handleUpgrade('pro')}
                >
                  <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>
                    Upgrade
                  </Typography>
                </Pressable>
              )}
            </View>
          ) : (
            <View
              style={[
                styles.planCard,
                isPremiumActive
                  ? { borderColor: theme.colors.neonGreen, borderWidth: 2, backgroundColor: theme.colors.neonGreen }
                  : { borderColor: 'transparent', borderWidth: 0, backgroundColor: theme.colors.neonGreen },
              ]}
            >
              {isPremiumActive && (
                <View style={[styles.activeBadge, { backgroundColor: '#000' }]}>
                  <Typography variant="tiny" style={{ color: theme.colors.neonGreen, fontFamily: 'RedHatDisplay_700Bold', letterSpacing: 1 }}>
                    ACTIVE
                  </Typography>
                </View>
              )}
              <Typography variant="body" style={{ color: '#000', textAlign: 'center', marginTop: isPremiumActive ? 8 : 0 }}>
                Get seen first and 3x your dates.
              </Typography>
              {!isPremiumActive && (
                <Pressable
                  style={[styles.upgradeButtonDark]}
                  onPress={() => handleUpgrade('premium')}
                >
                  <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>
                    Upgrade
                  </Typography>
                </Pressable>
              )}
            </View>
          )}
          </>
        ) : null}

        {/* History */}
        <View style={[styles.historyCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>History</Typography>
          {transactions.length === 0 ? (
            <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 8 }}>
              Nothing yet. Tokens you earn and spend show up here.
            </Typography>
          ) : (
            <ScrollView
              style={styles.historyList}
              nestedScrollEnabled
              showsVerticalScrollIndicator
              persistentScrollbar
            >
              {transactions.map((tx) => {
                const credit = tx.direction === 'credit';
                return (
                  <View key={tx.id} style={[styles.historyRow, { borderTopColor: theme.colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Typography variant="small" style={{ color: theme.colors.text }}>{reasonLabel(tx.reason)}</Typography>
                      <Typography variant="tiny" style={{ color: theme.colors.muted, marginTop: 2 }}>{historyDate(tx.created_at)}</Typography>
                    </View>
                    <Typography variant="bodyStrong" style={{ color: credit ? theme.colors.neonGreen : theme.colors.text }}>
                      {credit ? '+' : '-'}{Math.abs(Number(tx.amount) || 0)}
                    </Typography>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Boost button */}
        <Pressable
          onPress={handleBoost}
          disabled={boosting}
          style={({ pressed }) => [
            styles.boostButton,
            { backgroundColor: theme.colors.neonGreen },
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            boosting && { opacity: 0.6 },
          ]}
        >
          {boosting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Typography variant="h1" style={styles.boostText}>
                BOOOOOOOOOST
              </Typography>
              <Typography variant="small" style={{ color: 'rgba(0,0,0,0.7)', textAlign: 'center' }}>
                Get seen by 10X more people
              </Typography>
            </>
          )}
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
    gap: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balancePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addTokens: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // Same size whether there are 5 transactions or 500: the rows scroll
  // inside the box instead of the box growing down the page.
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    height: 300,
  },
  historyList: {
    flex: 1,
    marginTop: 4,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    marginTop: 6,
  },
  refillNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 999,
  },
  planCard: {
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minHeight: 180,
  },
  activeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
  },
  upgradeButtonOutlined: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  upgradeButtonDark: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 999,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  boostButton: {
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  boostText: {
    color: '#000',
    fontFamily: 'RedHatDisplay_700Bold',
    fontSize: 24,
    letterSpacing: 1,
    textAlign: 'center',
  },
});
