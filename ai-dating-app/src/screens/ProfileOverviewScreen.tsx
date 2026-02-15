import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/PageHeader';

type Props = {
  onBack: () => void;
  token: string;
  apiBaseUrl: string;
  onEditProfile?: () => void;
  onManagePhotos?: () => void;
};

export const ProfileOverviewScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl, onEditProfile, onManagePhotos }) => {
  const theme = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${apiBaseUrl}/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok) {
          setProfile(data);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile().catch((err) => console.warn('Failed to load profile:', err));
  }, [apiBaseUrl, token]);

  const primaryPhoto = profile?.photos?.find((p: any) => p.is_primary) || profile?.photos?.[0];
  const interests: string[] = profile?.profile?.interests || [];
  const topTraits: string[] = profile?.personality?.top_traits || profile?.personality?.personality_traits || [];
  const about = profile?.profile?.bio || profile?.ai_persona?.self_summary || null;
  const completionSignals = [
    (profile?.photos || []).length > 0,
    Boolean(profile?.user?.city),
    Boolean(profile?.user?.date_of_birth),
    Boolean(profile?.user?.gender),
    Boolean(profile?.profile?.bio),
    Array.isArray(profile?.profile?.interests) && profile.profile.interests.length > 0,
    Boolean(profile?.profile?.height),
    Boolean(profile?.profile?.relationship_goal),
    profile?.profile?.smoker !== null && profile?.profile?.smoker !== undefined,
    Boolean(profile?.profile?.drinker),
  ];
  const completionPercent = Math.round(
    (completionSignals.filter(Boolean).length / completionSignals.length) * 100
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader
        title="Profile"
        onBack={onBack}
        right={onEditProfile ? (
          <TouchableOpacity
            onPress={onEditProfile}
            style={[styles.editButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
            accessibilityRole="button"
          >
            <Feather name="edit-3" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        ) : undefined}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={theme.colors.brand} /> : null}

        <View style={[styles.completionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <View style={styles.completionHeaderRow}>
            <Typography variant="bodyStrong">Profile completion</Typography>
            <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>
              {completionPercent}%
            </Typography>
          </View>
          <View style={[styles.completionTrack, { backgroundColor: theme.colors.border }]}>
            <View style={[styles.completionFill, { width: `${completionPercent}%`, backgroundColor: theme.colors.neonGreen }]} />
          </View>
          <Typography variant="tiny" style={{ color: theme.colors.muted }}>
            Complete your profile to improve match quality.
          </Typography>
        </View>

        <View style={[styles.hero, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
          <View style={styles.heroPhotoWrap}>
            {primaryPhoto ? (
              <Image source={{ uri: primaryPhoto.photo_url }} style={styles.heroPhoto} />
            ) : (
              <View style={[styles.heroPhoto, { backgroundColor: theme.colors.surfaceLight, alignItems: 'center', justifyContent: 'center' }]}>
                <Feather name="image" size={32} color={theme.colors.muted} />
              </View>
            )}
            <LinearGradient
              colors={['rgba(16,29,19,0)', 'rgba(16,29,19,0.55)', 'rgba(16,29,19,0.92)']}
              style={styles.heroGradient}
            />
            <View style={styles.heroBadges}>
              {profile?.user?.is_verified ? (
                <View style={[styles.badgePill, { backgroundColor: 'rgba(188, 246, 65, 0.14)', borderColor: 'rgba(188, 246, 65, 0.28)' }]}>
                  <Feather name="check-circle" size={14} color={theme.colors.neonGreen} />
                  <Typography variant="small" style={{ color: theme.colors.neonGreen, marginLeft: 8 }}>
                    Verified
                  </Typography>
                </View>
              ) : null}
              {profile?.user?.is_premium ? (
                <View style={[styles.badgePill, { backgroundColor: 'rgba(255, 215, 0, 0.14)', borderColor: 'rgba(255, 215, 0, 0.28)' }]}>
                  <Feather name="star" size={14} color="#FFD700" />
                  <Typography variant="small" style={{ color: '#FFD700', marginLeft: 8 }}>
                    Premium
                  </Typography>
                </View>
              ) : null}
            </View>
            <View style={styles.heroBottom}>
              <Typography variant="display" style={{ color: theme.colors.text }}>
                {profile?.user?.name || 'New member'}
              </Typography>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={16} color={theme.colors.mutedLight} />
                <Typography variant="small" style={{ color: theme.colors.mutedLight, marginLeft: 6 }}>
                  {profile?.user?.city || 'City not set'}
                </Typography>
              </View>
            </View>
          </View>

        </View>

        {about ? (
          <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Feather name="user" size={18} color={theme.colors.neonGreen} />
              <Typography variant="bodyStrong" style={{ marginLeft: 10 }}>
                About you
              </Typography>
            </View>
            <Typography variant="body" style={{ color: theme.colors.textDark, lineHeight: 24 }}>
              {about}
            </Typography>
          </View>
        ) : null}

        {interests.length > 0 ? (
          <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
            <View style={styles.sectionHeader}>
              <Feather name="heart" size={18} color={theme.colors.neonGreen} />
              <Typography variant="bodyStrong" style={{ marginLeft: 10 }}>
                Interests
              </Typography>
            </View>
            <View style={styles.chips}>
              {interests.slice(0, 10).map((i: string) => (
                <View key={i} style={[styles.chip, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}>
                  <Typography variant="small" style={{ color: theme.colors.textDark }}>
                    {i}
                  </Typography>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {profile?.personality?.personality_summary ? (
          <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Feather name="sparkles" size={18} color={theme.colors.neonGreen} />
              <Typography variant="bodyStrong" style={{ marginLeft: 10 }}>
                Personality snapshot
              </Typography>
            </View>
            <Typography variant="body" style={{ color: theme.colors.textDark, lineHeight: 24 }}>
              {profile.personality.personality_summary}
            </Typography>
            {topTraits.length > 0 ? (
              <View style={[styles.chips, { marginTop: 12 }]}>
                {topTraits.slice(0, 6).map((t: string) => (
                  <View key={t} style={[styles.chip, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}>
                    <Typography variant="small" style={{ color: theme.colors.textDark }}>
                      {t}
                    </Typography>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 140,
    gap: 12,
  },
  completionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  completionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completionTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  completionFill: {
    height: '100%',
    borderRadius: 999,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  heroPhotoWrap: {
    height: 320,
  },
  heroPhoto: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  heroBadges: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    gap: 10,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroBottom: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    gap: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
});
