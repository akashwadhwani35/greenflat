import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

type Props = { onBack: () => void };

export const PrivacySafetyScreen: React.FC<Props> = ({ onBack }) => {
  const theme = useTheme();

  const toggles = [
    { title: 'Hide distance', icon: 'map-pin' },
    { title: 'Hide city', icon: 'home' },
    { title: 'Incognito mode', icon: 'eye-off' },
    { title: 'Show online status', icon: 'wifi' },
  ];

  const blocked = ['ajay92', 'sophia_k', 'traveler89'];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconButton} accessibilityRole="button">
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h1">Privacy & safety</Typography>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="h2">Visibility</Typography>
          {toggles.map((item) => (
            <View key={item.title} style={styles.row}>
              <View style={[styles.iconPill, { backgroundColor: theme.colors.accentTint }]}>
                <Feather name={item.icon as any} size={16} color={theme.colors.brand} />
              </View>
              <Typography variant="body">{item.title}</Typography>
              <Feather name="toggle-right" size={32} color={theme.colors.brand} />
            </View>
          ))}
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="h2">Blocked profiles</Typography>
          {blocked.map((name) => (
            <View key={name} style={styles.row}>
              <Typography variant="body">{name}</Typography>
              <TouchableOpacity>
                <Typography variant="small" style={{ color: theme.colors.brand }}>
                  Unblock
                </Typography>
              </TouchableOpacity>
            </View>
          ))}
          <Typography variant="tiny" muted>
            Blocking removes chat and visibility both ways.
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="h2">Safety</Typography>
          <Typography variant="body" muted>
            If someone feels off, block or report. Keep conversations on Greenflag until you’re comfortable.
          </Typography>
          <TouchableOpacity style={styles.reportRow}>
            <Feather name="flag" size={16} color={theme.colors.error} />
            <Typography variant="small" style={{ color: theme.colors.error }}>
              Report a profile
            </Typography>
          </TouchableOpacity>
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
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
  },
  iconPill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

