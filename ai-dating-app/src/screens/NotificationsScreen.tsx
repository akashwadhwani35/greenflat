import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, TouchableOpacity, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';

type Props = {
  onBack: () => void;
  token: string;
  apiBaseUrl: string;
};

type PrefKey = 'matches' | 'likes' | 'messages' | 'daily_picks' | 'product_updates';

const toggleRows: Array<{ key: PrefKey; title: string; subtitle: string; icon: string }> = [
  { key: 'matches', title: 'Matches', subtitle: 'When you get a new match', icon: 'heart' },
  { key: 'likes', title: 'Likes', subtitle: 'When someone likes you', icon: 'thumbs-up' },
  { key: 'messages', title: 'Messages', subtitle: 'New message, reminders', icon: 'message-circle' },
  { key: 'daily_picks', title: 'Daily picks', subtitle: 'Curated profiles and search ideas', icon: 'star' },
  { key: 'product_updates', title: 'Product updates', subtitle: 'New features and offers', icon: 'bell' },
];

export const NotificationsScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    matches: true,
    likes: true,
    messages: true,
    daily_picks: true,
    product_updates: true,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const status = await Notifications.getPermissionsAsync();
        setPermissionGranted(status.granted === true);
      } catch {
        setPermissionGranted(null);
      }

      const response = await fetch(`${apiBaseUrl}/notifications/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body.preferences) {
        setPrefs((prev) => ({ ...prev, ...body.preferences }));
      }
    };
    load().catch((err) => console.warn('Failed to load notification preferences:', err));
  }, [apiBaseUrl, token]);

  const allDisabled = useMemo(() => Object.values(prefs).every((v) => !v), [prefs]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Notifications" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {permissionGranted === false ? (
          <View style={[styles.banner, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Feather name="bell-off" size={18} color={theme.colors.muted} />
              <View style={{ flex: 1 }}>
                <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
                  Notifications are off
                </Typography>
                <Typography variant="tiny" style={{ color: theme.colors.muted, marginTop: 4 }}>
                  Turn on notifications in device settings to get likes, matches, and message alerts.
                </Typography>
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              <Button
                label="Enable notifications"
                onPress={async () => {
                  try {
                    const res = await Notifications.requestPermissionsAsync({
                      ios: { allowAlert: true, allowBadge: true, allowSound: true },
                    });
                    setPermissionGranted(res.granted === true);
                    if (!res.granted) {
                      await Linking.openSettings();
                    }
                  } catch {
                    Linking.openSettings().catch(() => {});
                  }
                }}
                fullWidth
              />
            </View>
          </View>
        ) : null}

        {allDisabled ? (
          <View style={[styles.banner, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Feather name="moon" size={18} color={theme.colors.muted} />
              <View style={{ flex: 1 }}>
                <Typography variant="bodyStrong">Quiet mode enabled</Typography>
                <Typography variant="tiny" style={{ color: theme.colors.muted, marginTop: 4 }}>
                  Turn at least one toggle on to receive in-app notification alerts.
                </Typography>
              </View>
            </View>
          </View>
        ) : null}

        {toggleRows.map((item) => {
          const enabled = prefs[item.key];
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.row, { borderColor: theme.colors.secondaryHairline, backgroundColor: theme.colors.secondaryHighlight }]}
              onPress={async () => {
                const next = { ...prefs, [item.key]: !enabled };
                setPrefs(next);
                try {
                  const response = await fetch(`${apiBaseUrl}/notifications/preferences`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ [item.key]: next[item.key] }),
                  });
                  const body = await response.json().catch(() => ({}));
                  if (!response.ok) {
                    throw new Error(body.error || 'Failed to update preferences');
                  }
                } catch (error: any) {
                  setPrefs((prev) => ({ ...prev, [item.key]: enabled }));
                  Alert.alert('Update failed', error?.message || 'Please try again.');
                }
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <View style={[styles.iconPill, { backgroundColor: theme.colors.successTint }]}>
                <Feather name={item.icon as any} size={18} color={theme.colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="bodyStrong">{item.title}</Typography>
                <Typography variant="small" muted>
                  {item.subtitle}
                </Typography>
              </View>
              <Feather name={enabled ? 'toggle-right' : 'toggle-left'} size={34} color={enabled ? theme.colors.brand : theme.colors.muted} />
            </TouchableOpacity>
          );
        })}
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
  banner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
