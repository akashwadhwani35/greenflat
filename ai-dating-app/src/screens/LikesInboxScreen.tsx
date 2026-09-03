import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Image, ActivityIndicator, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { PixelFlag } from '../components/PixelFlag';
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
  onOpenConversation?: (matchId: number, matchName: string, targetUserId: number) => void;
};

export const LikesInboxScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl, onViewProfile, onOpenConversation }) => {
  const theme = useTheme();
  const [likes, setLikes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [accepted, setAccepted] = useState<any[]>([]);
  useEffect(() => {
    fetch(`${apiBaseUrl}/likes/accepted`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { accepted: [] }))
      .then((d) => setAccepted(Array.isArray(d.accepted) ? d.accepted : []))
      .catch(() => {});
  }, [apiBaseUrl, token]);
  const greenFlags = likes.filter((item) => Boolean(item?.is_superlike));
  const regularLikes = likes.filter((item) => !item?.is_superlike);

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
        const incomingLikes = Array.isArray(data.likes) ? data.likes : [];
        const sortedLikes = [...incomingLikes].sort((a, b) => {
          const superlikeDiff = Number(Boolean(b?.is_superlike)) - Number(Boolean(a?.is_superlike));
          if (superlikeDiff !== 0) return superlikeDiff;
          const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });
        setLikes(sortedLikes);
      } catch (err: any) {
        setError(err.message || 'Unable to load likes');
      } finally {
        setLoading(false);
      }
    };

    fetchLikes().catch((err) => console.warn('Failed to load likes:', err));
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
    refreshNotificationStatus().catch((err) => console.warn('Failed to refresh notification status:', err));
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Likes inbox" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={theme.colors.brand} />
        ) : null}
        {error ? (
          <Typography variant="small" tone="error">
            {error}
          </Typography>
        ) : null}

        {/* What you sent and they said yes to */}
        {accepted.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: theme.colors.secondaryHighlight, borderWidth: 1, borderColor: theme.colors.secondaryHairline }]}>
                <Feather name="check" size={13} color={theme.colors.neonGreen} />
              </View>
              <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>Accepted</Typography>
            </View>
            {accepted.map((item) => (
              <View key={`acc-${item.match_id}`} style={[styles.card, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}>
                <Image source={item.user?.primary_photo ? { uri: item.user.primary_photo } : require('../../assets/icon.png')} style={styles.photo} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Typography variant="bodyStrong">{item.user?.name}</Typography>
                  <Typography variant="small" style={{ color: theme.colors.neonGreen }}>
                    {item.kind === 'green_flag' ? 'accepted your Green Flag' : 'accepted your First Move'}
                  </Typography>
                </View>
                <Button
                  label="Message"
                  onPress={() => onOpenConversation?.(item.match_id, item.user?.name || 'Chat', item.user?.id)}
                />
              </View>
            ))}
          </View>
        ) : null}

        {!loading && !error && likes.length === 0 && accepted.length === 0 ? (
          <Typography variant="body" muted>
            Nobody yet. Likes and Green Flags you receive show up here.
          </Typography>
        ) : null}

        {/* Green Flags: their own section, and a different object from a like. */}
        {greenFlags.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: theme.colors.neonGreen }]}>
                <PixelFlag size={14} color={theme.colors.deepBlack} />
              </View>
              <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>Green Flags</Typography>
              <Typography variant="small" muted style={{ marginLeft: 'auto' }}>
                {greenFlags.length}
              </Typography>
            </View>
            <Typography variant="small" muted style={{ marginBottom: 4 }}>
              They spent a Green Flag on you. That is not a casual like.
            </Typography>
            {greenFlags.map((item, index) => (
              <View
                key={item?.id ?? `flag-${index}`}
                style={[styles.card, styles.flagCard, { backgroundColor: '#15301B', borderColor: theme.colors.neonGreen }]}
              >
                <View style={[styles.flagPhotoRing, { borderColor: theme.colors.neonGreen }]}>
                  <Image source={item.user.primary_photo ? { uri: item.user.primary_photo } : require('../../assets/icon.png')} style={styles.photo} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>{item.user.name}</Typography>
                    <View style={[styles.flagChip, { backgroundColor: theme.colors.neonGreen }]}>
                      <PixelFlag size={10} color={theme.colors.deepBlack} />
                      <Typography variant="tiny" style={{ color: theme.colors.deepBlack, fontSize: 10, fontFamily: theme.fonts.bodyStrong.family }}>
                        GREEN FLAG
                      </Typography>
                    </View>
                  </View>
                  <Typography variant="small" style={{ color: theme.colors.neonGreen }}>
                    {item.user.city}
                  </Typography>
                </View>
                <Button
                  label="View"
                  onPress={() => {
                    onViewProfile?.(item.user);
                  }}
                />
              </View>
            ))}
          </View>
        ) : null}

        {regularLikes.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: theme.colors.secondaryHighlight, borderWidth: 1, borderColor: theme.colors.secondaryHairline }]}>
                <Feather name="heart" size={13} color={theme.colors.neonGreen} />
              </View>
              <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>Likes</Typography>
              <Typography variant="small" muted style={{ marginLeft: 'auto' }}>
                {regularLikes.length}
              </Typography>
            </View>
            {regularLikes.map((item, index) => (
              <View
                key={item?.id ?? `like-${index}`}
                style={[styles.card, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
              >
                <Image source={item.user.primary_photo ? { uri: item.user.primary_photo } : require('../../assets/icon.png')} style={styles.photo} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Typography variant="bodyStrong">{item.user.name}</Typography>
                  <Typography variant="small" muted>
                    {item.user.city}
                  </Typography>
                </View>
                <Button
                  label="View"
                  onPress={() => {
                    onViewProfile?.(item.user);
                  }}
                />
              </View>
            ))}
          </View>
        ) : null}

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
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The glow is the point: a Green Flag should never be mistaken for a like.
  flagCard: {
    borderWidth: 1.5,
    shadowColor: '#ADFF1A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 10,
  },
  flagPhotoRing: {
    borderWidth: 2,
    borderRadius: 18,
    padding: 2,
  },
  flagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pill: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
});
