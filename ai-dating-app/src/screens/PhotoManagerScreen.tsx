import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';

type Props = { onBack: () => void; token: string; apiBaseUrl: string };

export const PhotoManagerScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [photos, setPhotos] = useState<{ photo_url: string; is_primary: boolean; id: number; order_index?: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Unable to load photos');
      }
      const data = await response.json();
      setPhotos(data.photos || []);
    } catch (err: any) {
      setError(err.message || 'Unable to load photos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos().catch((err) => console.warn('Failed to load photos:', err));
  }, [apiBaseUrl, token]);

  const uploadPhoto = async (is_primary = false, urlInput?: string) => {
    const urlToUse = (urlInput || '').trim();
    if (!urlToUse) return;
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/profile/photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ photo_url: urlToUse, is_primary }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Unable to upload photo');
      }
      await fetchPhotos();
    } catch (err: any) {
      setError(err.message || 'Unable to upload photo');
    } finally {
      setLoading(false);
    }
  };

  const pickAndUploadPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to add your photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.7,
        base64: Platform.OS !== 'web',
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const photoPayload = Platform.OS === 'web'
        ? asset.uri
        : (asset.base64 ? `data:${asset.type || 'image/jpeg'};base64,${asset.base64}` : asset.uri);

      await uploadPhoto(false, photoPayload);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not pick a photo.');
    }
  };

  const handleDelete = async (photoId: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/profile/photo/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to delete photo');
      await fetchPhotos();
    } catch (err: any) {
      setError(err.message || 'Unable to delete photo');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrimary = async (photoId: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/profile/photo/primary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ photo_id: photoId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to set primary');
      await fetchPhotos();
    } catch (err: any) {
      setError(err.message || 'Unable to set primary');
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (photoId: number, direction: 'up' | 'down') => {
    const currentIndex = photos.find((p) => p.id === photoId)?.order_index ?? 0;
    const nextIndex = direction === 'up' ? Math.max(0, currentIndex - 1) : currentIndex + 1;

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/profile/photo/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ photo_id: photoId, order_index: nextIndex }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to reorder');
      await fetchPhotos();
    } catch (err: any) {
      setError(err.message || 'Unable to reorder photo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Photos" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Typography variant="body" muted>
          Add, reorder, and choose your primary photo.
        </Typography>

        {loading ? <ActivityIndicator color={theme.colors.brand} /> : null}
        {error ? (
          <Typography variant="small" tone="error">
            {error}
          </Typography>
        ) : null}

        <View style={styles.grid}>
          {photos
            .slice()
            .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
            .map((item) => (
              <View key={item.id} style={[styles.photoCard, { borderColor: theme.colors.border }]}>
                <Image source={{ uri: item.photo_url }} style={styles.photo} />
                <View style={styles.photoActions}>
                  <View style={{ gap: 8, flex: 1 }}>
                    <Button
                      label={item.is_primary ? 'Primary' : 'Make primary'}
                      variant="secondary"
                      onPress={() => handleSetPrimary(item.id)}
                    />
                    <View style={styles.row}>
                      <TouchableOpacity style={styles.iconButtonSmall} onPress={() => handleReorder(item.id, 'up')} accessibilityRole="button">
                        <Feather name="arrow-up" size={16} color={theme.colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconButtonSmall} onPress={() => handleReorder(item.id, 'down')} accessibilityRole="button">
                        <Feather name="arrow-down" size={16} color={theme.colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconButtonSmall} onPress={() => handleDelete(item.id)} accessibilityRole="button">
                        <Feather name="trash" size={16} color={theme.colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))}

          <TouchableOpacity
            style={[styles.addCard, { borderColor: theme.colors.neonGreen }]}
            onPress={pickAndUploadPhoto}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={34} color={theme.colors.neonGreen} />
            <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen, marginTop: 8 }}>
              Add Photo
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
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 160,
    backgroundColor: '#E8E8E8',
  },
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    gap: 8,
  },
  iconButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F7',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addCard: {
    width: '48%',
    minHeight: 160,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
