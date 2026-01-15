import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';

type Props = {
  onBack: () => void;
  onOpenTerms?: () => void;
};

const faqs = [
  { q: 'How do AI searches work?', a: 'Each search uses 1 token and returns curated on-grid matches with reasons.' },
  { q: 'How do I stay safe?', a: 'Keep chats on the app until you trust the person. Block/report anything off.' },
  { q: 'How do I boost visibility?', a: 'Complete your profile, verify, and run AI searches with clear intent.' },
];

export const HelpCenterScreen: React.FC<Props> = ({ onBack, onOpenTerms }) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconButton} accessibilityRole="button">
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h1">Help Center</Typography>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchBox}>
          <Feather name="search" size={18} color={theme.colors.muted} />
          <TextInput
            placeholder="Search help"
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholderTextColor={theme.colors.muted}
          />
        </View>

        {faqs.map((item) => (
          <View key={item.q} style={[styles.card, { borderColor: theme.colors.border }]}>
            <Typography variant="bodyStrong">{item.q}</Typography>
            <Typography variant="small" muted>
              {item.a}
            </Typography>
          </View>
        ))}

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="h2">Contact support</Typography>
          <Typography variant="small" muted>
            Tell us what you need help with.
          </Typography>
          <TextInput
            placeholder="Share more details..."
            style={[styles.textArea, { borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholderTextColor={theme.colors.muted}
            multiline
          />
          <Button label="Send" onPress={() => {}} fullWidth />
        </View>

        <TouchableOpacity style={styles.linkRow} onPress={onOpenTerms}>
          <Typography variant="small" style={{ color: theme.colors.brand }}>
            Terms & Privacy
          </Typography>
          <Feather name="chevron-right" size={16} color={theme.colors.brand} />
        </TouchableOpacity>
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
});

