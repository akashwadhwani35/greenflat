import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Profiles saved while they were in cooldown.
 *
 * The list is sorted by when it was saved, but the thing it is really for is
 * `is_available`: the moment someone's cooldown lapses, their card becomes
 * actionable and can be liked. Nothing here notifies the saved person, and
 * nothing here bypasses their cooldown.
 */

type Bookmark = {
  id: number;
  name: string;
  age: number | null;
  city: string | null;
  pronouns: string[];
  bio: string | null;
  interests: string[];
  primary_photo: string | null;
  already_liked: boolean;
  in_cooldown: boolean;
  is_available: boolean;
  available_at: string | null;
};

type Props = {
  token: string;
  apiBaseUrl: string;
  onBack: () => void;
  onLike?: (targetUserId: number) => Promise<void> | void;
  onOpenProfile?: (targetUserId: number) => void;
};

const fallbackPhoto = require('../../assets/icon.png');

const availabilityLabel = (bookmark: Bookmark) => {
  if (bookmark.already_liked) return 'Already liked';
  if (!bookmark.in_cooldown) return 'Ready to like';
  if (!bookmark.available_at) return 'In cooldown';

  const msLeft = new Date(bookmark.available_at).getTime() - Date.now();
  if (msLeft <= 0) return 'Ready to like';

  const hours = Math.ceil(msLeft / (1000 * 60 * 60));
  return hours <= 1 ? 'Back within the hour' : `Back in about ${hours} hours`;
};

export const BookmarksScreen: React.FC<Props> = ({
  token,
  apiBaseUrl,
  onBack,
  onLike,
  onOpenProfile,
}) => {
  const theme = useTheme();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/bookmarks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load saved profiles');
      setBookmarks(Array.isArray(data.bookmarks) ? data.bookmarks : []);
    } catch (error: any) {
      Alert.alert('Saved profiles', error.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (targetUserId: number) => {
    setBusyId(targetUserId);
    try {
      const response = await fetch(`${apiBaseUrl}/bookmarks/${targetUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Could not remove');
      setBookmarks((prev) => prev.filter((b) => b.id !== targetUserId));
    } catch (error: any) {
      Alert.alert('Saved profiles', error.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const like = async (bookmark: Bookmark) => {
    if (!onLike) return;
    setBusyId(bookmark.id);
    try {
      await onLike(bookmark.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const availableCount = bookmarks.filter((b) => b.is_available).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={[
            styles.iconButton,
            {
              backgroundColor: theme.colors.secondaryHighlight,
              borderColor: theme.colors.secondaryHairline,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Typography variant="h1">Saved</Typography>
          {availableCount > 0 ? (
            <Typography variant="small" style={{ color: theme.colors.neonGreen }}>
              {availableCount} ready to like
            </Typography>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : bookmarks.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="bookmark" size={40} color={theme.colors.muted} />
          <Typography variant="h2" style={{ marginTop: 16, textAlign: 'center' }}>
            Nothing saved yet
          </Typography>
          <Typography
            variant="body"
            muted
            style={{ marginTop: 8, textAlign: 'center', maxWidth: 280 }}
          >
            When someone has hit their daily limit you can save them here, and like them as soon as
            they are back.
          </Typography>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={theme.colors.primary}
            />
          }
        >
          {bookmarks.map((bookmark) => (
            <View
              key={bookmark.id}
              style={[
                styles.card,
                { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border },
              ]}
            >
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => onOpenProfile?.(bookmark.id)}
                accessibilityRole="button"
              >
                <Image
                  source={
                    bookmark.primary_photo ? { uri: bookmark.primary_photo } : fallbackPhoto
                  }
                  style={styles.avatar}
                />
                <View style={{ flex: 1 }}>
                  <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
                    {bookmark.age ? `${bookmark.name}, ${bookmark.age}` : bookmark.name}
                  </Typography>
                  {bookmark.city ? (
                    <Typography variant="small" muted>
                      {bookmark.city}
                    </Typography>
                  ) : null}
                  <Typography
                    variant="small"
                    style={{
                      marginTop: 4,
                      color: bookmark.is_available ? theme.colors.neonGreen : theme.colors.muted,
                    }}
                  >
                    {availabilityLabel(bookmark)}
                  </Typography>
                </View>
              </TouchableOpacity>

              <View style={styles.cardActions}>
                {bookmark.is_available && onLike ? (
                  <TouchableOpacity
                    onPress={() => void like(bookmark)}
                    disabled={busyId === bookmark.id}
                    style={[styles.likeButton, { backgroundColor: theme.colors.neonGreen }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Like ${bookmark.name}`}
                  >
                    {busyId === bookmark.id ? (
                      <ActivityIndicator color="#000" size="small" />
                    ) : (
                      <Feather name="heart" size={18} color="#000" />
                    )}
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  onPress={() => void remove(bookmark.id)}
                  disabled={busyId === bookmark.id}
                  style={[styles.removeButton, { borderColor: theme.colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${bookmark.name}`}
                >
                  <Feather name="x" size={18} color={theme.colors.muted} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 64 : 44,
    paddingBottom: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  list: { padding: 20, gap: 12, paddingBottom: 48 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
    gap: 12,
  },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  likeButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
