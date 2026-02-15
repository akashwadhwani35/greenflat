import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/PageHeader';

type Props = {
  onBack: () => void;
  token: string;
  apiBaseUrl: string;
  onOpenConversation?: (matchId: number, matchName: string, targetUserId: number) => void;
};

export const MatchesListScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl, onOpenConversation }) => {
  const theme = useTheme();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${apiBaseUrl}/matches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Unable to load matches');
        }
        const data = await response.json();
        setMatches(data.matches || []);
      } catch (err: any) {
        setError(err.message || 'Unable to load matches.');
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches().catch((err) => console.warn('Failed to load matches:', err));
  }, [apiBaseUrl, token]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Matches" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={theme.colors.brand} /> : null}
        {error ? (
          <Typography variant="small" tone="error">
            {error}
          </Typography>
        ) : null}
        {matches.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.row, { borderColor: theme.colors.secondaryHairline, backgroundColor: theme.colors.secondaryHighlight }]}
            onPress={() => onOpenConversation?.(item.match_id, item.name, item.user_id)}
            activeOpacity={0.8}
          >
            <Image source={item.primary_photo ? { uri: item.primary_photo } : require('../../assets/icon.png')} style={styles.photo} />
            <View style={{ flex: 1, gap: 4 }}>
              <Typography variant="bodyStrong">{item.name}</Typography>
              <Typography variant="small" muted numberOfLines={1}>
                {item.bio || 'Great match available'}
              </Typography>
              <Typography variant="tiny" muted>
                matched {new Date(item.matched_at).toLocaleDateString()}
              </Typography>
            </View>
            <Feather name="message-circle" size={18} color={theme.colors.brand} />
          </TouchableOpacity>
        ))}
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
  row: {
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
});
