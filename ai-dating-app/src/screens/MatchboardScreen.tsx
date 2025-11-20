import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View, StatusBar, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

export type MatchCandidate = {
  id: number;
  name: string;
  age?: number;
  city: string;
  match_percentage: number;
  match_reason?: string;
  match_highlights?: string[];
  suggested_openers?: string[];
  primary_photo?: string;
};

type MatchboardScreenProps = {
  token: string;
  name: string;
  apiBaseUrl: string;
  onCardPress?: (match: MatchCandidate) => void;
};

const fallbackPhotos = [
  require('../../assets/icon.png'),
  require('../../assets/splash-icon.png'),
  require('../../assets/adaptive-icon.png'),
];

const demoOnGridMatches: MatchCandidate[] = [
  {
    id: 1001,
    name: 'Mira Kulkarni',
    age: 29,
    city: 'Bengaluru',
    match_percentage: 92,
    match_reason: 'Shares your love for mindful adventures and slow travel rituals.',
    match_highlights: ['Mindful travel', 'Community builder', 'Values-led'],
    suggested_openers: ["Ask Mira about her favourite sunrise hike around the city."],
    primary_photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 1002,
    name: 'Rhea Sen',
    age: 31,
    city: 'Pune',
    match_percentage: 88,
    match_reason: 'Emotionally fluent product storyteller who journals daily.',
    match_highlights: ['Calm communicator', 'Journaling buddy'],
    suggested_openers: ["What's the most meaningful entry in your journal this month?"],
    primary_photo: 'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 1003,
    name: 'Nadia Fernandes',
    age: 28,
    city: 'Goa',
    match_percentage: 86,
    match_reason: 'Marine conservationist who sparks deep conversations.',
    match_highlights: ['Ocean minded', 'Purpose driven'],
    suggested_openers: ["Ask about her latest reef restoration project."],
    primary_photo: 'https://images.unsplash.com/photo-1518057111178-44a106bad636?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 1004,
    name: 'Sanaya Patel',
    age: 30,
    city: 'Ahmedabad',
    match_percentage: 84,
    match_reason: 'Grounded entrepreneur blending mindfulness and empathy.',
    match_highlights: ['Wellness founder', 'Tea rituals'],
    suggested_openers: ["Share your favourite grounding ritual."],
    primary_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 1005,
    name: 'Aditi Rao',
    age: 27,
    city: 'Delhi',
    match_percentage: 82,
    match_reason: 'Creative psychotherapist helping couples communicate.',
    match_highlights: ['Psychotherapist', 'Values vulnerability'],
    suggested_openers: ["What's a question you wish people asked more often?"],
    primary_photo: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 1006,
    name: 'Ishaan Balakrishnan',
    age: 33,
    city: 'Chennai',
    match_percentage: 80,
    match_reason: 'Slow-travel filmmaker documenting mindful retreats.',
    match_highlights: ['Documentary maker', 'Hosts tea salons'],
    suggested_openers: ["What story are you crafting right now?"],
    primary_photo: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?auto=format&fit=crop&w=800&q=80',
  },
];

export const MatchboardScreen: React.FC<MatchboardScreenProps> = ({ token, name, apiBaseUrl, onCardPress }) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [onGridMatches, setOnGridMatches] = useState<MatchCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${apiBaseUrl}/matches/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ search_query: searchQuery || 'mindful, emotionally intelligent' }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Unable to fetch matches');
      }

      const data = await response.json();
      const hasOnGrid = Array.isArray(data.on_grid_matches) && data.on_grid_matches.length > 0;

      setOnGridMatches(hasOnGrid ? data.on_grid_matches : demoOnGridMatches);
      if (!hasOnGrid) {
        setError('Showing curated matches while we gather live results.');
      }
    } catch (fetchError: any) {
      setError(fetchError.message || 'Something went wrong');
      setOnGridMatches(demoOnGridMatches);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, searchQuery, token]);

  useEffect(() => {
    fetchMatches();
  }, []);

  const columns = useMemo(() => {
    const left: MatchCandidate[] = [];
    const right: MatchCandidate[] = [];
    onGridMatches.forEach((match, index) => {
      (index % 2 === 0 ? left : right).push(match);
    });
    return [left, right];
  }, [onGridMatches]);

  const handleCardPress = (match: MatchCandidate) => {
    if (onCardPress) {
      onCardPress(match);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      fetchMatches();
    }
  };

  const renderMatchCard = (match: MatchCandidate, index: number) => {
    const fallback = fallbackPhotos[index % fallbackPhotos.length];
    const photoSource = match.primary_photo ? { uri: match.primary_photo } : fallback;
    const bio = match.match_highlights?.[0] || 'Great connection';
    const pickupLine = match.suggested_openers?.[0] || 'Start a conversation!';

    return (
      <TouchableOpacity
        key={`${match.id}-${index}`}
        style={[styles.matchCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => handleCardPress(match)}
        activeOpacity={0.9}
      >
        {/* Photo */}
        <Image source={photoSource} style={styles.photo} />

        {/* Info Card - Law of Common Region: white background groups related info */}
        <View style={styles.infoSection}>
          {/* Name & Age Row */}
          <View style={styles.nameRow}>
            <Typography variant="h2" style={styles.matchName}>
              {match.name}
            </Typography>
            {match.age && (
              <Typography variant="body" muted>, {match.age}</Typography>
            )}
          </View>

          {/* Match Percentage Badge */}
          <View style={[styles.matchBadge, { backgroundColor: theme.colors.successTint }]}>
            <Typography variant="small" style={{ color: theme.colors.brand, fontWeight: '600' }}>
              {match.match_percentage}% match
            </Typography>
          </View>

          {/* One-line Bio */}
          <Typography variant="small" muted style={styles.bio} numberOfLines={2}>
            {bio}
          </Typography>

          {/* Learn More Link */}
          <TouchableOpacity onPress={() => handleCardPress(match)} style={styles.learnMore}>
            <Typography variant="small" style={{ color: theme.colors.brand }}>
              Learn more
            </Typography>
            <Feather name="chevron-right" size={16} color={theme.colors.brand} />
          </TouchableOpacity>

          {/* AI Pickup Line Box */}
          <View style={[styles.pickupLineBox, { backgroundColor: theme.colors.accentTint }]}>
            <Feather name="message-circle" size={14} color={theme.colors.muted} style={{ marginRight: 6 }} />
            <Typography variant="tiny" style={styles.pickupLine} numberOfLines={2}>
              {pickupLine}
            </Typography>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Typography variant="h1" style={styles.greeting}>
            Hey {name.split(' ')[0] || 'there'}
          </Typography>
        </View>

        {/* Search Bar - Law of Common Region: white background container */}
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.searchInputWrapper}>
            <Feather name="search" size={20} color={theme.colors.muted} style={styles.searchIcon} />
            <Typography variant="body" style={styles.searchInput} onPress={() => {}}>
              {searchQuery || 'Search by personality or values...'}
            </Typography>
          </View>
          {searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Feather name="x" size={18} color={theme.colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {loading && onGridMatches.length === 0 ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.colors.brand} />
            <Typography variant="small" muted style={{ marginTop: 12 }}>
              Finding your matches...
            </Typography>
          </View>
        ) : null}

        {/* Pinterest-style Masonry Grid */}
        <View style={styles.masonry}>
          {columns.map((column, columnIndex) => (
            <View key={columnIndex} style={styles.masonryColumn}>
              {column.map(renderMatchCard)}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 60 : 60,
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  greeting: {
    marginBottom: 4,
  },
  searchContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#999',
  },
  clearButton: {
    padding: 4,
  },
  masonry: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  masonryColumn: {
    flex: 1,
    gap: 12,
  },
  matchCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  photo: {
    width: '100%',
    height: 240,
    backgroundColor: '#E8E8E8',
  },
  infoSection: {
    padding: 16,
    gap: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  matchName: {
    fontSize: 20,
  },
  matchBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bio: {
    lineHeight: 20,
  },
  learnMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  pickupLineBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  pickupLine: {
    flex: 1,
    lineHeight: 18,
    color: '#666',
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
});
