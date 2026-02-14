import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';

type Props = {
  onBack: () => void;
  onOpenCheckout?: () => void;
  token?: string;
  apiBaseUrl?: string;
};

export const WalletScreen: React.FC<Props> = ({ onBack, onOpenCheckout, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);

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
        setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
      } finally {
        setLoading(false);
      }
    };
    fetchWallet().catch(() => {});
  }, [token, apiBaseUrl]);

  const ledgerRows = useMemo(() => transactions.map((tx) => {
    const isDebit = tx.direction === 'debit';
    return {
      id: tx.id,
      title: String(tx.reason || 'Activity').replace(/_/g, ' '),
      detail: tx.metadata?.search_query || tx.metadata?.preview || 'Wallet activity',
      amount: `${isDebit ? '-' : '+'}${Number(tx.amount || 0)} credit${Number(tx.amount || 0) === 1 ? '' : 's'}`,
      time: new Date(tx.created_at).toLocaleString(),
    };
  }), [transactions]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Wallet" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={theme.colors.brand} /> : null}
        <View style={[styles.balanceCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Typography variant="h2">Credits</Typography>
          <Typography variant="display" style={{ color: theme.colors.brand }}>
            {balance}
          </Typography>
          <Typography variant="small" muted>
            AI Search costs 1 credit. Compliments cost 5 credits.
          </Typography>
          <Button label="Refill credits" onPress={onOpenCheckout} fullWidth />
        </View>

        <View style={styles.sectionHeader}>
          <Typography variant="h2">Ledger</Typography>
          <Typography variant="small" muted>
            Recent activity
          </Typography>
        </View>

        {ledgerRows.map((item) => (
          <View key={item.id} style={[styles.ledgerRow, { borderColor: theme.colors.border }]}>
            <View style={{ flex: 1 }}>
              <Typography variant="bodyStrong">{item.title}</Typography>
              <Typography variant="small" muted>
                {item.detail}
              </Typography>
              <Typography variant="tiny" muted>
                {item.time}
              </Typography>
            </View>
            <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
              {item.amount}
            </Typography>
          </View>
        ))}

        {!loading && ledgerRows.length === 0 ? (
          <View style={[styles.ledgerRow, { borderColor: theme.colors.border }]}>
            <Typography variant="small" muted>
              No credit activity yet.
            </Typography>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Typography variant="h2">Plans</Typography>
          <Typography variant="small" muted>
            Get more AI plus premium perks
          </Typography>
        </View>

        <View style={[styles.planCard, { borderColor: theme.colors.border }]}>
          <View style={{ flex: 1 }}>
            <Typography variant="bodyStrong">Premium</Typography>
            <Typography variant="small" muted>
              Credits, boosts, rewind, read receipts
            </Typography>
          </View>
          <Button label="Choose" onPress={onOpenCheckout} />
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
    gap: 14,
  },
  balanceCard: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  sectionHeader: {
    gap: 4,
    marginTop: 6,
  },
  ledgerRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
});
