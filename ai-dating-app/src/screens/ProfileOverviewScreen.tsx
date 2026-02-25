import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { MatchCandidate } from './MatchboardScreen';
import { ProfileDetailScreen } from './ProfileDetailScreen';
import { Typography } from '../components/Typography';

type Props = {
  onBack: () => void;
  token: string;
  apiBaseUrl: string;
  onOpenSettings?: () => void;
  onEditProfile?: () => void;
  onManagePhotos?: () => void;
  onSessionExpired?: () => void;
};

type ProfileDetailCandidate = MatchCandidate & {
  bio?: string;
  relationship_goal?: string;
  interests?: string[];
  photos?: string[];
  personality_summary?: string;
  top_traits?: string[];
};

const calculateAge = (dateOfBirth?: string): number | undefined => {
  if (!dateOfBirth) return undefined;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age > 0 ? age : undefined;
};

const parseProfileData = (data: any): ProfileDetailCandidate => {
  const user = data?.user || {};
  const profile = data?.profile || {};
  const personality = data?.personality || {};
  const photos = Array.isArray(data?.photos) ? data.photos : [];
  const primaryPhoto = photos.find((photo: any) => photo?.is_primary) || photos[0];
  const interests = Array.isArray(profile?.interests) ? profile.interests : [];
  const topTraits = Array.isArray(personality?.top_traits)
    ? personality.top_traits
    : (Array.isArray(personality?.personality_traits) ? personality.personality_traits : []);

  return {
    id: Number(user?.id || 0),
    name: typeof user?.name === 'string' ? user.name : 'Profile',
    age: calculateAge(typeof user?.date_of_birth === 'string' ? user.date_of_birth : undefined),
    city: typeof user?.city === 'string' && user.city.trim().length > 0 ? user.city : 'City not set',
    match_percentage: 0,
    match_reason: typeof profile?.bio === 'string' ? profile.bio : '',
    match_highlights: interests.slice(0, 3),
    suggested_openers: [],
    primary_photo: typeof primaryPhoto?.photo_url === 'string' ? primaryPhoto.photo_url : undefined,
    is_verified: Boolean(user?.is_verified),
    is_on_grid: true,
    bio: typeof profile?.bio === 'string' ? profile.bio : '',
    relationship_goal: typeof profile?.relationship_goal === 'string' ? profile.relationship_goal : undefined,
    interests,
    personality_summary: typeof personality?.personality_summary === 'string'
      ? personality.personality_summary
      : '',
    top_traits: topTraits,
    photos: photos
      .map((photo: any) => photo?.photo_url)
      .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0),
  };
};

export const ProfileOverviewScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl, onOpenSettings, onSessionExpired }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [profileMatch, setProfileMatch] = useState<ProfileDetailCandidate | null>(null);
  const [errorKind, setErrorKind] = useState<'session' | 'network' | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setErrorKind(null);
      const response = await fetch(`${apiBaseUrl}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorKind(response.status === 401 ? 'session' : 'network');
        setProfileMatch(null);
        return;
      }
      setProfileMatch(parseProfileData(data));
    } catch {
      setErrorKind('network');
      setProfileMatch(null);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading && !profileMatch) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.neonGreen} />
      </View>
    );
  }

  if (!profileMatch) {
    const isSessionError = errorKind === 'session';
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <Typography variant="body" style={{ color: theme.colors.muted, textAlign: 'center', paddingHorizontal: 32 }}>
          {isSessionError
            ? 'Your session has expired. Please log in again.'
            : 'Unable to load profile preview right now.'}
        </Typography>
        {isSessionError && onSessionExpired ? (
          <Pressable
            onPress={onSessionExpired}
            style={[styles.retryButton, { backgroundColor: theme.colors.neonGreen }]}
            accessibilityRole="button"
          >
            <Typography variant="bodyStrong" style={{ color: theme.colors.deepBlack }}>
              Log in
            </Typography>
          </Pressable>
        ) : !isSessionError ? (
          <Pressable
            onPress={fetchProfile}
            style={[styles.retryButton, { backgroundColor: theme.colors.neonGreen }]}
            accessibilityRole="button"
          >
            <Typography variant="bodyStrong" style={{ color: theme.colors.deepBlack }}>
              Retry
            </Typography>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <ProfileDetailScreen
      match={profileMatch}
      visible
      embedded
      hideActionButtons
      onHeaderRightPress={onOpenSettings}
      headerRightIcon={onOpenSettings ? 'settings' : undefined}
      headerRightAccessibilityLabel="Open settings"
      onClose={onBack}
      onSwipeLeft={onBack}
      onSwipeRight={onBack}
    />
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 22,
  },
});
