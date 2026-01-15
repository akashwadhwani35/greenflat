import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, StatusBar, ActivityIndicator, Dimensions, RefreshControl, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PixelFlag } from '../components/PixelFlag';
import { AdvancedFilters } from './AdvancedSearchScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 20; // padding on left and right
const CARD_GAP = 16; // gap between cards
const CARD_WIDTH = (SCREEN_WIDTH - (CARD_PADDING * 2) - CARD_GAP) / 2;

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
  is_verified?: boolean;
  is_active?: boolean;
  distance_km?: number;
  is_new?: boolean; // Added in last 24 hours
  created_at?: string;
};

type DiscoverScreenProps = {
  token: string;
  apiBaseUrl: string;
  onCardPress?: (match: MatchCandidate) => void;
  onOpenFilters?: () => void;
  onOpenWallet?: () => void;
  filters?: AdvancedFilters;
  preferredTab?: 'onGrid' | 'offGrid';
};

const fallbackPhotos = [
  require('../../assets/icon.png'),
  require('../../assets/splash-icon.png'),
  require('../../assets/adaptive-icon.png'),
];

// Skeleton Card Component
const SkeletonCard: React.FC<{ index: number }> = ({ index }) => {
  const theme = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.card}>
      <Animated.View
        style={[
          styles.skeletonShimmer,
          { opacity: shimmerOpacity, backgroundColor: theme.colors.charcoal },
        ]}
      />
    </View>
  );
};

const demoMatches: MatchCandidate[] = [
  {
    id: 1001,
    name: 'Mira',
    age: 29,
    city: 'Bengaluru',
    match_percentage: 92,
    match_reason: 'Shares your love for mindful adventures',
    primary_photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
    is_verified: true,
    is_active: true,
    distance_km: 3.2,
    is_new: true,
    suggested_openers: ['What is your favorite mindful practice?'],
  },
  {
    id: 1002,
    name: 'Rhea',
    age: 31,
    city: 'Pune',
    match_percentage: 88,
    match_reason: 'Emotionally fluent storyteller',
    primary_photo: 'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?auto=format&fit=crop&w=800&q=80',
    is_verified: true,
    is_active: false,
    distance_km: 8.5,
    suggested_openers: ['I would love to hear one of your stories'],
  },
  {
    id: 1003,
    name: 'Nadia',
    age: 28,
    city: 'Goa',
    match_percentage: 86,
    match_reason: 'Sparks deep conversations',
    primary_photo: 'https://images.unsplash.com/photo-1518057111178-44a106bad636?auto=format&fit=crop&w=800&q=80',
    is_verified: false,
    is_active: true,
    distance_km: 15.7,
    is_new: true,
  },
  {
    id: 1004,
    name: 'Sanaya',
    age: 30,
    city: 'Ahmedabad',
    match_percentage: 84,
    match_reason: 'Grounded and mindful',
    primary_photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    is_verified: true,
    is_active: false,
    distance_km: 5.3,
    suggested_openers: ['How do you stay grounded in daily life?'],
  },
  {
    id: 1005,
    name: 'Aditi',
    age: 27,
    city: 'Delhi',
    match_percentage: 82,
    match_reason: 'Values vulnerability',
    primary_photo: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?auto=format&fit=crop&w=800&q=80',
    is_verified: false,
    is_active: true,
    distance_km: 12.1,
  },
  {
    id: 1006,
    name: 'Ishaan',
    age: 33,
    city: 'Chennai',
    match_percentage: 80,
    match_reason: 'Slow-travel filmmaker',
    primary_photo: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?auto=format&fit=crop&w=800&q=80',
    is_verified: true,
    is_active: true,
    distance_km: 7.9,
    suggested_openers: ['What is your most memorable film project?'],
  },
];

export const DiscoverScreen: React.FC<DiscoverScreenProps> = ({
  token,
  apiBaseUrl,
  onCardPress,
  onOpenFilters,
  onOpenWallet,
  filters,
  preferredTab,
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<'onGrid' | 'offGrid'>('onGrid');
  const [matches, setMatches] = useState<MatchCandidate[]>(demoMatches);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(50); // Demo balance
  const [viewedProfileIds, setViewedProfileIds] = useState<number[]>([]); // Track viewed profiles
  const [showRewindButton, setShowRewindButton] = useState(false); // Show rewind for premium

  const fetchNewOffGridProfiles = useCallback(async () => {
    setRefreshing(true);
    try {
      // Fetch new off-grid profiles excluding already viewed ones
      const response = await fetch(`${apiBaseUrl}/matches/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_on_grid: false,
          exclude_ids: viewedProfileIds, // Exclude already seen profiles
          limit: 10,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newProfiles = data.matches || [];
        setMatches(newProfiles);
        // Track the new profile IDs
        setViewedProfileIds(prev => [...prev, ...newProfiles.map((m: MatchCandidate) => m.id)]);
      }
    } catch (error) {
      console.error('Failed to fetch new off-grid profiles:', error);
    } finally {
      setRefreshing(false);
    }
  }, [apiBaseUrl, token, viewedProfileIds]);

  const buildBackendFilters = useCallback(() => {
    const parsed: Record<string, any> = {};
    if (!filters) return parsed;

    const minAge = filters.minAge ? Number(filters.minAge) : null;
    const maxAge = filters.maxAge ? Number(filters.maxAge) : null;
    const minHeight = filters.minHeight ? Number(filters.minHeight) : null;
    const distance_km = filters.distance_km ? Number(filters.distance_km) : null;

    if (Number.isFinite(minAge)) parsed.minAge = minAge;
    if (Number.isFinite(maxAge)) parsed.maxAge = maxAge;
    if (Number.isFinite(minHeight)) parsed.minHeight = minHeight;
    if (filters.city && filters.city.trim()) parsed.city = filters.city.trim();
    if (filters.relationship_goal && filters.relationship_goal.trim()) parsed.relationship_goal = filters.relationship_goal.trim();
    if (typeof filters.smoker === 'boolean') parsed.smoker = filters.smoker;
    if (filters.drinker && filters.drinker.trim()) parsed.drinker = filters.drinker.trim();
    if (Number.isFinite(distance_km)) parsed.distance_km = distance_km;

    return parsed;
  }, [filters]);

  const fetchOnGridMatches = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${apiBaseUrl}/matches/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_on_grid: true,
          search_query: filters?.keywords?.trim() || '',
          filters: buildBackendFilters(),
          limit: 12,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const newProfiles = data.matches || [];
        setMatches(newProfiles);
      }
    } catch (error) {
      console.error('Failed to fetch on-grid profiles:', error);
    } finally {
      setRefreshing(false);
    }
  }, [apiBaseUrl, token, filters?.keywords, buildBackendFilters]);

  const onRefresh = useCallback(() => {
    if (activeTab === 'offGrid') {
      // For off-grid: fetch NEW profiles
      fetchNewOffGridProfiles();
    } else {
      // For on-grid: just reload current matches
      fetchOnGridMatches();
    }
  }, [activeTab, fetchNewOffGridProfiles, fetchOnGridMatches]);

  useEffect(() => {
    if (preferredTab && preferredTab !== activeTab) {
      setActiveTab(preferredTab);
    }
  }, [preferredTab]);

  useEffect(() => {
    if (activeTab === 'onGrid') {
      fetchOnGridMatches();
    }
  }, [activeTab, fetchOnGridMatches]);

  const handleRewind = useCallback(() => {
    // Premium feature: go back to previous profile
    // TODO: Check if user has premium subscription
    // TODO: Implement rewind logic
    alert('🔄 Rewind Feature\n\nThis is a premium feature. Upgrade to rewind and see profiles you passed!');
  }, []);

  const getMatchColor = (percentage: number) => {
    if (percentage >= 90) return theme.colors.neonGreen;
    if (percentage >= 85) return '#8FD14F';
    if (percentage >= 80) return '#A8E063';
    return theme.colors.muted;
  };

  const MatchCardItem: React.FC<{ match: MatchCandidate; index: number }> = ({ match, index }) => {
    const fallback = fallbackPhotos[index % fallbackPhotos.length];
    const photoSource = match.primary_photo ? { uri: match.primary_photo } : fallback;
    const matchColor = getMatchColor(match.match_percentage);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          delay: index * 100,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          delay: index * 100,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }, [fadeAnim, scaleAnim, index]);

    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }}
      >
        <TouchableOpacity
          style={styles.card}
          onPress={() => onCardPress?.(match)}
          activeOpacity={0.9}
        >
          <Image source={photoSource} style={styles.cardImage} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={styles.cardGradient}
          />

          {/* Top badges row */}
          <View style={styles.topBadgesRow}>
            {/* Match percentage badge */}
            <View style={[styles.matchBadge, { backgroundColor: matchColor }]}>
              <Typography variant="tiny" style={[styles.matchBadgeText, { color: theme.colors.deepBlack }]}>
                {match.match_percentage}%
              </Typography>
            </View>

            {/* Verified badge */}
            {match.is_verified && (
              <View style={[styles.verifiedBadge, { backgroundColor: 'rgba(59, 130, 246, 0.95)' }]}>
                <Feather name="check-circle" size={12} color="#FFF" />
              </View>
            )}

            {/* Active status indicator */}
            {match.is_active && (
              <View style={styles.activeIndicator}>
                <View style={[styles.activeDot, { backgroundColor: '#10B981' }]} />
              </View>
            )}
          </View>

          {/* Card info at bottom */}
          <View style={styles.cardInfo}>
            <View style={styles.cardNameRow}>
              <Typography variant="h2" style={[styles.cardName, { color: theme.colors.text }]}>
                {match.name}
              </Typography>
              {match.age && (
                <Typography variant="body" style={[styles.cardAge, { color: theme.colors.text }]}>
                  , {match.age}
                </Typography>
              )}
            </View>

            <View style={styles.cardLocationRow}>
              <Feather name="map-pin" size={13} color={theme.colors.muted} />
              <Typography variant="small" style={[styles.metaText, { color: theme.colors.muted }]}>
                {match.city}
              </Typography>
            </View>

            {/* AI Match Reason */}
            {activeTab === 'onGrid' && match.match_reason && (
              <View style={styles.matchReasonContainer}>
                <View style={styles.matchReasonDot}>
                  <Feather name="zap" size={9} color={theme.colors.neonGreen} />
                </View>
                <Typography
                  variant="tiny"
                  style={[styles.matchReasonText, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {match.match_reason}
                </Typography>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header Row 1: Logo + Wallet + Filter */}
      <View style={styles.headerTop}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <PixelFlag size={28} color={theme.colors.neonGreen} />
          <Typography variant="h1" style={styles.logoText}>
            GreenFlag
          </Typography>
        </View>

        {/* Right side: Wallet + Filter */}
        <View style={styles.headerRight}>
          {/* Wallet Badge */}
          <TouchableOpacity
            style={[styles.walletBadge, { backgroundColor: theme.colors.charcoal }]}
            onPress={onOpenWallet}
            activeOpacity={0.8}
          >
            <View style={[styles.walletIcon, { backgroundColor: theme.colors.neonGreen }]}>
              <PixelFlag size={14} color={theme.colors.deepBlack} />
            </View>
            <Typography variant="bodyStrong" style={{ color: theme.colors.text, fontSize: 15 }}>
              {walletBalance}
            </Typography>
          </TouchableOpacity>

          {/* Rewind (Premium) - only off-grid */}
          {activeTab === 'offGrid' && (
            <TouchableOpacity
              style={styles.rewindIconButton}
              onPress={handleRewind}
              activeOpacity={0.8}
            >
              <Feather name="rotate-ccw" size={20} color="#FFD700" />
              <View style={styles.rewindPremiumBadge}>
                <Feather name="star" size={10} color={theme.colors.deepBlack} />
              </View>
            </TouchableOpacity>
          )}

          {/* Filter icon */}
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: theme.colors.charcoal }]}
            onPress={onOpenFilters}
            activeOpacity={0.8}
          >
            <Feather name="sliders" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Header Row 2: AI Match / Explore Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'onGrid' && [styles.tabActive, { backgroundColor: theme.colors.neonGreen }],
          ]}
          onPress={() => setActiveTab('onGrid')}
          activeOpacity={0.8}
        >
          <Typography
            variant="bodyStrong"
            style={{
              color: activeTab === 'onGrid' ? theme.colors.deepBlack : theme.colors.text,
            }}
          >
            AI Match
          </Typography>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'offGrid' && [styles.tabActive, { backgroundColor: theme.colors.neonGreen }],
          ]}
          onPress={() => setActiveTab('offGrid')}
          activeOpacity={0.8}
        >
          <Typography
            variant="bodyStrong"
            style={{
              color: activeTab === 'offGrid' ? theme.colors.deepBlack : theme.colors.text,
            }}
          >
            Explore
          </Typography>
        </TouchableOpacity>
      </View>

      {/* Grid */}
      {loading ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {[1, 2, 3, 4, 5, 6].map((_, index) => (
              <SkeletonCard key={`skeleton-${index}`} index={index} />
            ))}
          </View>
        </ScrollView>
      ) : matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: 'rgba(188, 246, 65, 0.1)' }]}>
            <Feather name="search" size={40} color={theme.colors.neonGreen} />
          </View>
          <Typography variant="h2" style={{ color: theme.colors.text, marginTop: 24, marginBottom: 12 }}>
            No matches yet
          </Typography>
          <Typography variant="body" style={{ color: theme.colors.muted, textAlign: 'center', paddingHorizontal: 40 }}>
            {activeTab === 'onGrid'
              ? 'Complete your profile to get personalized AI matches'
              : 'Try adjusting your filters to find more profiles'}
          </Typography>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.neonGreen}
              colors={[theme.colors.neonGreen]}
            />
          }
        >
          <View style={styles.grid}>
            {matches.map((match, index) => (
              <MatchCardItem key={`${match.id}-${index}`} match={match} index={index} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
  },
  walletIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: {
    shadowColor: '#ADFF1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    borderColor: 'transparent',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewindIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  rewindPremiumBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.5,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
    position: 'relative',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
  },
  topBadgesRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  matchBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  verifiedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  activeIndicator: {
    marginLeft: 'auto',
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  cardInfo: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  cardName: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardAge: {
    fontSize: 17,
    fontWeight: '500',
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 16,
  },
  matchReasonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  matchReasonDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(188, 246, 65, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchReasonText: {
    fontSize: 11,
    lineHeight: 13,
    flex: 1,
    fontWeight: '500',
    fontStyle: 'italic',
    opacity: 0.85,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonShimmer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
});
