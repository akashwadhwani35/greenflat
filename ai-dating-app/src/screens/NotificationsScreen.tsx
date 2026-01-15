import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';

type Props = {
  onBack: () => void;
};

type PrefKey = 'matches' | 'likes' | 'messages' | 'dailyPicks' | 'productUpdates';

const PREFS_STORAGE_KEY = 'greenflag.notificationPrefs.v1';

const toggleRows: Array<{ key: PrefKey; title: string; subtitle: string; icon: string }> = [
  { key: 'matches', title: 'Matches', subtitle: 'When you get a new match', icon: 'heart' },
  { key: 'likes', title: 'Likes', subtitle: 'When someone likes you', icon: 'thumbs-up' },
  { key: 'messages', title: 'Messages', subtitle: 'New message, reminders', icon: 'message-circle' },
  { key: 'dailyPicks', title: 'Daily picks', subtitle: 'Curated profiles and search ideas', icon: 'star' },
  { key: 'productUpdates', title: 'Product updates', subtitle: 'New features and offers', icon: 'bell' },
];

export const NotificationsScreen: React.FC<Props> = ({ onBack }) => {
  const theme = useTheme();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    matches: true,
    likes: true,
    messages: true,
    dailyPicks: true,
    productUpdates: true,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const status = await Notifications.getPermissionsAsync();
        setPermissionGranted(status.granted === true);
      } catch {
        setPermissionGranted(null);
      }

      try {
        const raw = await AsyncStorage.getItem(PREFS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Record<PrefKey, boolean>>;
          setPrefs((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // ignore
      }
    };
    load().catch(() => {});
  }, []);

  const allDisabled = useMemo(() => Object.values(prefs).every((v) => !v), [prefs]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={[styles.iconButton, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]} accessibilityRole="button">
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h1">Notifications</Typography>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {permissionGranted === false ? (
          <View style={[styles.banner, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
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
          <View style={[styles.banner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
              style={[styles.row, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
              onPress={async () => {
                const next = { ...prefs, [item.key]: !enabled };
                setPrefs(next);
                try {
                  await AsyncStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
                } catch {
                  // ignore
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
    borderWidth: 1,
  },
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
