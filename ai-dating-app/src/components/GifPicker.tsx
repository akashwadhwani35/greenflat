import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, StyleSheet, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from './Typography';
import { useTheme } from '../theme/ThemeProvider';

/**
 * GIF search for the chat composer (board item 6). Keyboard GIF buttons
 * (Gboard, iOS) hand the image to the text field through a native channel
 * React Native does not implement, so the app offers its own picker instead.
 * Backed by GIPHY (Google shut the Tenor API down on 30 June 2026); needs
 * EXPO_PUBLIC_GIPHY_API_KEY. Without a key the composer hides the GIF button.
 */
export const GIPHY_API_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY || '';
export const isGifPickerAvailable = () => GIPHY_API_KEY.length > 0;

type Gif = { id: string; preview: string; url: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (gifUrl: string) => void;
};

const parseResults = (body: any): Gif[] => {
  const results = Array.isArray(body?.data) ? body.data : [];
  return results
    .map((item: any) => {
      const images = item?.images || {};
      // "downsized" keeps sent GIFs under ~2 MB; the tiny preview fills the grid.
      const full = images.downsized?.url || images.original?.url;
      const preview = images.fixed_width_small?.url || images.preview_gif?.url || full;
      if (!full) return null;
      return { id: String(item.id), preview: String(preview), url: String(full) };
    })
    .filter(Boolean) as Gif[];
};

export const GifPicker: React.FC<Props> = ({ visible, onClose, onPick }) => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = async (term: string) => {
    if (!GIPHY_API_KEY) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = term.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(term.trim())}&limit=30&rating=pg-13&lang=en`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=30&rating=pg-13`;
      const response = await fetch(endpoint);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.meta?.msg || body?.message || 'GIF search failed');
      setGifs(parseResults(body));
    } catch (err: any) {
      setError(err?.message || 'GIF search failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    void search('');
  }, [visible]);

  const onChange = (text: string) => {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void search(text); }, 350);
  };

  const tile = Math.floor((width - 16 * 2 - 8 * 2) / 3);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close GIF picker">
            <Feather name="x" size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={[styles.searchBox, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Feather name="search" size={16} color={theme.colors.muted} />
            <TextInput
              value={query}
              onChangeText={onChange}
              placeholder="Search GIFs"
              placeholderTextColor={theme.colors.muted}
              style={[styles.searchInput, { color: theme.colors.text }]}
              autoFocus
              returnKeyType="search"
            />
          </View>
        </View>

        {loading && gifs.length === 0 ? (
          <View style={styles.center}><ActivityIndicator color={theme.colors.neonGreen} /></View>
        ) : error ? (
          <View style={styles.center}>
            <Typography variant="body" style={{ color: theme.colors.muted, textAlign: 'center' }}>{error}</Typography>
          </View>
        ) : (
          <FlatList
            data={gifs}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={{ gap: 8 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => onPick(item.url)} activeOpacity={0.85}>
                <Image source={{ uri: item.preview }} style={{ width: tile, height: tile, borderRadius: 12, backgroundColor: theme.colors.charcoal }} />
              </TouchableOpacity>
            )}
            ListFooterComponent={
              <Typography variant="tiny" style={{ color: theme.colors.muted, textAlign: 'center', paddingVertical: 14 }}>
                Powered by GIPHY
              </Typography>
            }
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 52 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 16, fontFamily: 'RedHatDisplay_400Regular' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  grid: { paddingHorizontal: 16, gap: 8, paddingBottom: 40 },
});
