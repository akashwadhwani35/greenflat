import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Image, ActivityIndicator, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import * as Notifications from 'expo-notifications';

type Props = {
  onBack: () => void;
  token: string;
  apiBaseUrl: string;
  onViewProfile?: (user: {
    id: number;
    name: string;
    age?: number;
    city?: string;
    is_verified?: boolean;
    primary_photo?: string;
  }) => void;
};

export const LikesInboxScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl, onViewProfile }) => {
  const theme = useTheme();
  const [likes, setLikes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchLikes = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${apiBaseUrl}/likes/incoming`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Unable to load likes');
        }
        const data = await response.json();
        setLikes(data.likes || []);
      } catch (err: any) {
        setError(err.message || 'Unable to load likes');
      } finally {
        setLoading(false);
      }
    };

    fetchLikes().catch(() => {});
  }, [apiBaseUrl, token]);

  useEffect(() => {
    const refreshNotificationStatus = async () => {
      try {
        const status = await Notifications.getPermissionsAsync();
        setNotificationsEnabled(status.granted === true);
      } catch {
        setNotificationsEnabled(null);
      }
    };
    refreshNotificationStatus().catch(() => {});
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Likes inbox" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Typography variant="body" muted>
          People who liked you. Unlock more with premium.
        </Typography>

        {loading ? (
          <ActivityIndicator color={theme.colors.brand} />
        ) : null}
        {error ? (
          <Typography variant="small" tone="error">
            {error}
          </Typography>
        ) : null}

        {likes.map((item, index) => (
          <View
            key={index}
            style={[styles.card, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
          >
            <Image source={item.user.primary_photo ? { uri: item.user.primary_photo } : require('../../assets/icon.png')} style={styles.photo} />
            <View style={{ flex: 1, gap: 4 }}>
              <Typography variant="bodyStrong">{item.user.name}</Typography>
              <Typography variant="small" muted>
                {item.user.city}
              </Typography>
              {item.is_compliment && item.compliment_message ? (
                <Typography variant="tiny" style={{ color: theme.colors.textDark }}>
                  "{item.compliment_message}"
                </Typography>
              ) : null}
            </View>
            <Button
              label="View"
              onPress={() => {
                onViewProfile?.(item.user);
              }}
            />
          </View>
        ))}

        {notificationsEnabled === false ? (
          <View style={[styles.pill, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Feather name="bell-off" size={18} color={theme.colors.muted} />
              <View style={{ flex: 1 }}>
                <Typography variant="small" style={{ color: theme.colors.text }}>
                  You’re in quiet mode.
                </Typography>
                <Typography variant="tiny" style={{ color: theme.colors.muted, marginTop: 2 }}>
                  Turn on notifications to get instant pings for likes, matches, and messages.
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
                    setNotificationsEnabled(res.granted === true);
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  photo: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: '#E8E8E8',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pill: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
});
