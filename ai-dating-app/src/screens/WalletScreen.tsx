import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';

type Props = {
  onBack: () => void;
  onOpenCheckout?: () => void;
};

const ledger = [
  { title: 'AI search', detail: '“Mindful, Bangalore, outdoorsy”', amount: '-1 token', time: '2m ago' },
  { title: 'AI search', detail: '“Kind, plant-based, cinema”', amount: '-1 token', time: '1h ago' },
  { title: 'Refill', detail: 'Starter pack', amount: '+10 tokens', time: '1d ago' },
];

export const WalletScreen: React.FC<Props> = ({ onBack, onOpenCheckout }) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconButton} accessibilityRole="button">
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h1">Wallet</Typography>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.balanceCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Typography variant="h2">AI search tokens</Typography>
          <Typography variant="display" style={{ color: theme.colors.brand }}>
            8
          </Typography>
          <Typography variant="small" muted>
            Each AI search uses 1 token. Failed searches auto-refund.
          </Typography>
          <Button label="Refill tokens" onPress={onOpenCheckout} fullWidth />
        </View>

        <View style={styles.sectionHeader}>
          <Typography variant="h2">Ledger</Typography>
          <Typography variant="small" muted>
            Recent activity
          </Typography>
        </View>

        {ledger.map((item, index) => (
          <View key={index} style={[styles.ledgerRow, { borderColor: theme.colors.border }]}>
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
              30 tokens / month, likes boost, rewind, read receipts
            </Typography>
          </View>
          <Button label="Choose" onPress={() => {}} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F2',
  },
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
