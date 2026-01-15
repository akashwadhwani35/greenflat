import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeProvider';

type Props = { onBack: () => void };

const plans = [
  { title: 'Starter', price: '$4.99', detail: '10 AI searches + likes boost' },
  { title: 'Premium', price: '$14.99', detail: '30 AI searches, rewinds, read receipts' },
  { title: 'Boost', price: '$2.99', detail: 'Highlight your profile for 30 minutes' },
];

export const CheckoutScreen: React.FC<Props> = ({ onBack }) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconButton} accessibilityRole="button">
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h1">Get more</Typography>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {plans.map((plan) => (
          <View key={plan.title} style={[styles.card, { borderColor: theme.colors.border }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Typography variant="bodyStrong">{plan.title}</Typography>
              <Typography variant="small" muted>
                {plan.detail}
              </Typography>
            </View>
            <Typography variant="h2">{plan.price}</Typography>
            <Button label="Select" onPress={() => {}} />
          </View>
        ))}

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">Order summary</Typography>
          <Typography variant="small" muted>
            Taxes calculated at checkout. Purchases are final per policy.
          </Typography>
          <Button label="Confirm purchase" onPress={onBack} fullWidth />
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

