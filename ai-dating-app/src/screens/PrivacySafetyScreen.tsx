import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/PageHeader';

type Props = {
  onBack: () => void;
  token: string;
  apiBaseUrl: string;
};

type PrivacySettings = {
  hide_distance: boolean;
  hide_city: boolean;
  incognito_mode: boolean;
  show_online_status: boolean;
};

export const PrivacySafetyScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [settings, setSettings] = useState<PrivacySettings>({
    hide_distance: false,
    hide_city: false,
    incognito_mode: false,
    show_online_status: true,
  });
  const [blocked, setBlocked] = useState<Array<{ user_id: number; name: string; city?: string }>>([]);
  const [loading, setLoading] = useState(false);

  const toggles = [
    { key: 'hide_distance' as const, title: 'Hide distance', icon: 'map-pin' },
    { key: 'hide_city' as const, title: 'Hide city', icon: 'home' },
    { key: 'incognito_mode' as const, title: 'Incognito mode', icon: 'eye-off' },
    { key: 'show_online_status' as const, title: 'Show online status', icon: 'wifi' },
  ];

  const refresh = async () => {
    try {
      setLoading(true);
      const [settingsResponse, blockedResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/privacy/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBaseUrl}/privacy/blocked`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const settingsBody = await settingsResponse.json().catch(() => ({}));
      const blockedBody = await blockedResponse.json().catch(() => ({}));
      if (settingsResponse.ok && settingsBody.settings) {
        setSettings((prev) => ({ ...prev, ...settingsBody.settings }));
      }
      if (blockedResponse.ok && Array.isArray(blockedBody.blocked_users)) {
        setBlocked(blockedBody.blocked_users);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, [apiBaseUrl, token]);

  const updateSetting = async (key: keyof PrivacySettings, value: boolean) => {
    const previous = settings;
    setSettings((prev) => ({ ...prev, [key]: value }));
    try {
      const response = await fetch(`${apiBaseUrl}/privacy/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [key]: value }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Unable to update setting');
      }
    } catch (error: any) {
      setSettings(previous);
      Alert.alert('Update failed', error?.message || 'Please try again.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Privacy & safety" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={theme.colors.brand} /> : null}
        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="h2">Visibility</Typography>
          {toggles.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.row}
              activeOpacity={0.8}
              onPress={() => updateSetting(item.key, !settings[item.key])}
            >
              <View style={[styles.iconPill, { backgroundColor: theme.colors.accentTint }]}>
                <Feather name={item.icon as any} size={16} color={theme.colors.brand} />
              </View>
              <Typography variant="body">{item.title}</Typography>
              <Feather
                name={settings[item.key] ? 'toggle-right' : 'toggle-left'}
                size={32}
                color={settings[item.key] ? theme.colors.brand : theme.colors.muted}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="h2">Blocked profiles</Typography>
          {blocked.map((item) => (
            <View key={item.user_id} style={styles.row}>
              <Typography variant="body">{item.name}</Typography>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const response = await fetch(`${apiBaseUrl}/privacy/unblock`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ target_user_id: item.user_id }),
                    });
                    const body = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(body.error || 'Unable to unblock user');
                    setBlocked((prev) => prev.filter((entry) => entry.user_id !== item.user_id));
                  } catch (error: any) {
                    Alert.alert('Unblock failed', error?.message || 'Please try again.');
                  }
                }}
              >
                <Typography variant="small" style={{ color: theme.colors.brand }}>
                  Unblock
                </Typography>
              </TouchableOpacity>
            </View>
          ))}
          {blocked.length === 0 ? (
            <Typography variant="small" muted>
              No blocked profiles.
            </Typography>
          ) : null}
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
