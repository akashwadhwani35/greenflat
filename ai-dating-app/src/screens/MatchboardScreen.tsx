import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View, StatusBar, Platform, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { AdvancedFilters } from './AdvancedSearchScreen';

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
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  onOpenWallet?: () => void;
  onOpenLikesInbox?: () => void;
  onOpenMatches?: () => void;
  onOpenConversations?: () => void;
  onOpenAdvancedSearch?: () => void;
  onOpenProfile?: () => void;
  filters?: AdvancedFilters;
};

const fallbackPhotos = [
  require('../../assets/icon.png'),
  require('../../assets/splash-icon.png'),
  require('../../assets/adaptive-icon.png'),
];

const baseDemo: MatchCandidate[] = [
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

const demoOnGridMatches: MatchCandidate[] = (() => {
  const cities = ['Bengaluru', 'Mumbai', 'Delhi', 'Pune', 'Hyderabad', 'Chennai', 'Goa', 'Kochi', 'Jaipur', 'Ahmedabad'];
  const variants: MatchCandidate[] = [];
  let idx = 0;
  while (variants.length < 80) {
    const src = baseDemo[idx % baseDemo.length];
    const city = cities[variants.length % cities.length];
    variants.push({
      ...src,
      id: src.id + variants.length + 1,
      city,
      match_percentage: Math.max(70, src.match_percentage - (variants.length % 15)),
      name: `${src.name.split(' ')[0]} ${city}`,
    });
    idx++;
  }
  return [...baseDemo, ...variants];
})();

export const MatchboardScreen: React.FC<MatchboardScreenProps> = ({
  token,
  name,
  apiBaseUrl,
  onCardPress,
  onOpenSettings,
  onOpenNotifications,
  onOpenWallet,
  onOpenLikesInbox,
  onOpenMatches,
  onOpenConversations,
  onOpenAdvancedSearch,
  onOpenProfile,
  filters = {},
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [onGridMatches, setOnGridMatches] = useState<MatchCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'onGrid' | 'offGrid'>('onGrid');

  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const payloadFilters = {
        ...filters,
        minAge: filters?.minAge ? Number(filters.minAge) : undefined,
        maxAge: filters?.maxAge ? Number(filters.maxAge) : undefined,
        minHeight: filters?.minHeight ? Number(filters.minHeight) : undefined,
        distance_km: filters?.distance_km ? Number(filters.distance_km) : undefined,
      };

      const effectiveQuery = searchQuery || filters.keywords || 'mindful, emotionally intelligent';

      const response = await fetch(`${apiBaseUrl}/matches/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ search_query: effectiveQuery, filters: payloadFilters }),
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
      setError(fetchError.message || 'Using curated matches for now.');
      setOnGridMatches(demoOnGridMatches);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, searchQuery, token, filters]);

  useEffect(() => {
    fetchMatches();
  }, [activeTab]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        setProfile(data);
      } catch {
        // ignore
      }
    };
    fetchProfile().catch(() => {});
  }, [apiBaseUrl, token]);

  const completion = useMemo(() => {
    const photos = profile?.photos || [];
    const user = profile?.user || {};
    const prof = profile?.profile || {};
    let total = 4;
    let score = 0;
    if (photos.length > 0) score++;
    if (user.city) score++;
    if (prof.bio || prof.prompt1 || prof.prompt2) score++;
    if (user.is_verified) score++;
    return Math.round((score / total) * 100);
  }, [profile]);

  const columns = useMemo(() => {
    const pool = activeTab === 'onGrid'
      ? onGridMatches.slice(0, Math.ceil(onGridMatches.length / 2))
      : onGridMatches.slice(Math.ceil(onGridMatches.length / 2));
    const left: MatchCandidate[] = [];
    const right: MatchCandidate[] = [];
    pool.forEach((match, index) => {
      (index % 2 === 0 ? left : right).push(match);
    });
    return [left, right];
  }, [onGridMatches, activeTab]);

  const handleCardPress = (match: MatchCandidate) => {
    if (onCardPress) {
      onCardPress(match);
    }
  };

  const handleSearch = () => {
    fetchMatches();
  };

  const renderMatchCard = (match: MatchCandidate, index: number) => {
    const fallback = fallbackPhotos[index % fallbackPhotos.length];
    const photoSource = match.primary_photo ? { uri: match.primary_photo } : fallback;
    const bio = match.match_highlights?.[0] || 'Great connection';
    const pickupLine = match.suggested_openers?.[0] || 'Start a conversation!';

    return (
      <TouchableOpacity
        key={`${match.id}-${index}`}
        style={styles.matchCard}
        onPress={() => handleCardPress(match)}
        activeOpacity={0.92}
      >
        <View style={styles.cardInner}>
          <Image source={photoSource} style={styles.photo} />
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.05)']}
            style={styles.photoOverlay}
          />
          <View style={styles.badgeRow}>
            <View style={[styles.matchBadge, { backgroundColor: 'rgba(59,178,115,0.9)' }]}>
              <Typography variant="tiny" style={{ color: '#fff' }}>
                {match.match_percentage}% match
              </Typography>
            </View>
            <View style={styles.cityPill}>
              <Feather name="map-pin" size={12} color="#fff" />
              <Typography variant="tiny" style={{ color: '#fff' }} numberOfLines={1}>
                {match.city}
              </Typography>
            </View>
          </View>
          <View style={styles.cardInfo}>
            <Typography variant="h2" style={[styles.matchName, { color: '#fff' }]}>
              {match.name}
            </Typography>
            {match.age ? (
              <Typography variant="small" style={{ color: '#fff' }}>
                {match.age}
              </Typography>
            ) : null}
          </View>
          <View style={styles.bottomPill}>
            <Feather name="message-circle" size={14} color="#121614" />
            <Typography variant="tiny" style={{ color: '#121614' }} numberOfLines={1}>
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
          <View style={styles.logoRow}>
            <View style={styles.logoMarkOuter}>
              <View style={styles.logoMarkInner}>
                <View style={styles.logoDiamond} />
              </View>
            </View>
            <Typography variant="h1" style={styles.logoText}>
              GreenFlag
            </Typography>
          </View>
          <View>
            <Typography variant="h1" style={styles.greeting}>
              Hey {name.split(' ')[0] || 'there'}
            </Typography>
            <Typography variant="small" muted>
              Tune your AI search or browse new green flags.
            </Typography>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={onOpenProfile} accessibilityRole="button">
              <Feather name="user" size={18} color={theme.colors.text} />
              <View style={styles.progressPill}>
                <Typography variant="tiny" style={{ color: '#fff' }}>{completion}%</Typography>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={onOpenNotifications} accessibilityRole="button">
              <Feather name="bell" size={18} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={onOpenSettings} accessibilityRole="button">
              <Feather name="settings" size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <LinearGradient colors={['#e8f5e9', '#ffffff']} style={styles.heroCard}>
          <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.searchInputWrapper}>
              <Feather name="search" size={20} color={theme.colors.muted} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search by personality or values..."
                placeholderTextColor={theme.colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Feather name="x" size={18} color={theme.colors.muted} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={handleSearch} style={[styles.searchButton, { backgroundColor: theme.colors.brand }]}>
              <Typography variant="small" style={{ color: '#FFFFFF' }}>
                Search
              </Typography>
            </TouchableOpacity>
          </View>
        </LinearGradient>
        {error ? (
          <Typography variant="small" tone="error" style={styles.errorText}>
            {error}
          </Typography>
        ) : null}

        {loading && onGridMatches.length === 0 ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.colors.brand} />
            <Typography variant="small" muted style={{ marginTop: 12 }}>
              Finding your matches...
            </Typography>
          </View>
        ) : null}

        <View style={styles.quickLinks}>
          <TouchableOpacity style={[styles.quickLinkCard, { backgroundColor: theme.colors.surface }]} onPress={onOpenProfile} activeOpacity={0.9}>
            <Feather name="check-circle" size={18} color={theme.colors.brand} />
            <View style={{ flex: 1 }}>
              <Typography variant="small" style={styles.quickLinkText}>
                Complete profile
              </Typography>
              <Typography variant="tiny" muted>{completion}% ready</Typography>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickLinkCard, { backgroundColor: theme.colors.surface }]} onPress={onOpenAdvancedSearch} activeOpacity={0.9}>
            <Feather name="sliders" size={18} color={theme.colors.brand} />
            <Typography variant="small" style={styles.quickLinkText}>
              Advanced search
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickLinkCard, { backgroundColor: theme.colors.surface }]} onPress={onOpenLikesInbox} activeOpacity={0.9}>
            <Feather name="heart" size={18} color={theme.colors.brand} />
            <Typography variant="small" style={styles.quickLinkText}>
              Likes inbox
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickLinkCard, { backgroundColor: theme.colors.surface }]} onPress={onOpenMatches} activeOpacity={0.9}>
            <Feather name="users" size={18} color={theme.colors.brand} />
            <Typography variant="small" style={styles.quickLinkText}>
              Matches
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickLinkCard, { backgroundColor: theme.colors.surface }]} onPress={onOpenConversations} activeOpacity={0.9}>
            <Feather name="message-circle" size={18} color={theme.colors.brand} />
            <Typography variant="small" style={styles.quickLinkText}>
              Conversations
            </Typography>
          </TouchableOpacity>
        </View>

        {/* Card grid */}
        <View style={styles.masonry}>
          {columns.map((column, columnIndex) => (
            <View key={columnIndex} style={styles.masonryColumn}>
              {column.map(renderMatchCard)}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom On/Off-grid switcher bar */}
      <View style={styles.switcherWrapper}>
        <LinearGradient
          colors={['#2A1B43', '#3A275C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.switcher}
        >
          <TouchableOpacity
            style={[
              styles.switchButton,
              activeTab === 'onGrid' && styles.switchButtonActive,
            ]}
            activeOpacity={0.85}
            onPress={() => setActiveTab('onGrid')}
          >
            <Typography
              variant="small"
              style={[
                styles.switchLabel,
                activeTab === 'onGrid' && styles.switchLabelActive,
              ]}
            >
              On-grid
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.switchButton,
              activeTab === 'offGrid' && styles.switchButtonActive,
            ]}
            activeOpacity={0.85}
            onPress={() => setActiveTab('offGrid')}
          >
            <Typography
              variant="small"
              style={[
                styles.switchLabel,
                activeTab === 'offGrid' && styles.switchLabelActive,
              ]}
            >
              Off-grid
            </Typography>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  scroll: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 60 : 60,
    paddingBottom: 180,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMarkOuter: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1F1B2E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ADFF1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  logoMarkInner: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#ADFF1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoDiamond: {
    width: 14,
    height: 14,
    backgroundColor: '#0A0A0A',
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
  },
  logoText: {
    color: '#fff',
    fontSize: 18,
    letterSpacing: 1,
  },
  greeting: {
    marginBottom: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F2F2F2',
  },
  progressPill: {
    backgroundColor: '#3BB273',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  heroCard: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  searchContainer: {
    marginHorizontal: 0,
    marginBottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontSize: 16,
    paddingVertical: 6,
  },
  clearButton: {
    padding: 4,
  },
  searchButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  errorText: {
    marginHorizontal: 24,
    marginBottom: 8,
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
  cardInner: {
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#121614',
  },
  photo: {
    width: '100%',
    height: 240,
    backgroundColor: '#E8E8E8',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  badgeRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cardInfo: {
    position: 'absolute',
    bottom: 24,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  matchName: {
    fontSize: 20,
  },
  bottomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#F6D6D1',
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  quickLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  quickLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    flexBasis: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  quickLinkText: {
    flex: 1,
  },
  switcherWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 78,
  },
  switcher: {
    flexDirection: 'row',
    borderRadius: 22,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  switchButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchButtonActive: {
    backgroundColor: '#ADFF1A',
  },
  switchLabel: {
    color: '#D8D2E8',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  switchLabelActive: {
    color: '#0A0A0A',
  },
});
