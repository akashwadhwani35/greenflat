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
        <Typography variant="body">
          By using GreenFlag, you agree to our Terms of Service and Privacy Policy, including account safety,
          respectful conduct, and data use to provide matching, verification, and support features.
        </Typography>
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
});
