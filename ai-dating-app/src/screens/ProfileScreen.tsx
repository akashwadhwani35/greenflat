import React, { useEffect, useState } from 'react';
import {
  Alert,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PixelFlag } from '../components/PixelFlag';

type ProfileScreenProps = {
  onBack: () => void;
  onOpenSettings: () => void;
  onEditProfile: () => void;
  onManagePhotos: () => void;
  onOpenCheckout: () => void;
  token: string;
  apiBaseUrl: string;
};

type PlanTab = 'plus' | 'premium';

const PLUS_FEATURES = [
  'Unlimited likes',
  'See who likes you',
  'Advanced filters',
];

const PREMIUM_FEATURES = [
  'Unlimited likes',
  'See who likes you',
  'Advanced filters',
  'Priority visibility',
  'Read receipts',
  'Profile boost monthly',
];

const normalizeLabel = (value: string) =>
  value
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onBack,
  onOpenSettings,
  onEditProfile,
  onManagePhotos,
  onOpenCheckout,
  token,
  apiBaseUrl,
}) => {
  const theme = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanTab>('plus');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok) {
          setProfile(data);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile().catch((err) => console.warn('Failed to load profile:', err));
  }, [apiBaseUrl, token]);

  const primaryPhoto = profile?.photos?.find((p: any) => p.is_primary) || profile?.photos?.[0];
  const isVerified = profile?.user?.is_verified || false;
  const userName = profile?.user?.name || 'New User';
  const userCity = profile?.user?.city || '';
  const profileData = profile?.profile || {};
  const personalityData = profile?.personality || {};

  const aboutText = (profileData.bio || profile?.ai_persona?.self_summary || '').trim();
  const interests: string[] = Array.isArray(profileData.interests) ? profileData.interests : [];
  const topTraits: string[] = Array.isArray(personalityData.top_traits)
    ? personalityData.top_traits
    : (Array.isArray(personalityData.personality_traits) ? personalityData.personality_traits : []);

  const smokingValue = (() => {
    if (typeof profileData.smoker === 'boolean') return profileData.smoker ? 'Smoker' : 'Non-smoker';
    if (profileData.smoking_habit) return normalizeLabel(String(profileData.smoking_habit));
    return null;
  })();
  const drinkingValue = profileData.drinker ? normalizeLabel(String(profileData.drinker)) : null;
  const relationshipGoal = profileData.relationship_goal ? normalizeLabel(String(profileData.relationship_goal)) : null;
  const heightValue = profileData.height ? `${profileData.height} cm` : null;

  const profileDetails = [
    { label: 'Work', value: profileData.occupation || null },
    { label: 'Education', value: profileData.education_level || profileData.education || null },
    { label: 'Hometown', value: profileData.hometown || null },
    { label: 'Height', value: heightValue },
    { label: 'Looking for', value: relationshipGoal },
    { label: 'Drinking', value: drinkingValue },
    { label: 'Smoking', value: smokingValue },
    { label: 'Religion', value: profileData.religion || null },
    { label: 'Politics', value: profileData.politics || null },
  ].filter((item) => Boolean(item.value));

  const completionSignals = [
    (profile?.photos || []).length > 0,
    Boolean(profile?.user?.city),
    Boolean(profile?.user?.date_of_birth),
    Boolean(profile?.user?.gender),
    Boolean(profileData.bio),
    interests.length > 0,
    Boolean(profileData.height),
    Boolean(profileData.relationship_goal),
    profileData.smoker !== null && profileData.smoker !== undefined,
    Boolean(profileData.drinker),
  ];
  const completionPercent = Math.round(
    (completionSignals.filter(Boolean).length / completionSignals.length) * 100
  );

  const profileTags = [
    profile?.user?.age ? `${profile.user.age}` : null,
    profile?.user?.gender ? normalizeLabel(String(profile.user.gender)) : null,
    userCity || null,
  ].filter(Boolean) as string[];

  const currentFeatures = selectedPlan === 'plus' ? PLUS_FEATURES : PREMIUM_FEATURES;
  const premiumExpiresAt = profile?.user?.premium_expires_at ? new Date(profile.user.premium_expires_at).getTime() : null;
  const hasPaidPlan = Boolean(profile?.user?.is_premium) && (premiumExpiresAt === null || premiumExpiresAt > Date.now());
  const creditBalance = Number(profile?.user?.credit_balance || 0);
  const canUseTokensForBoost = creditBalance >= 20;
  const canActivateBoost = hasPaidPlan || canUseTokensForBoost;
  const boostExpiresAtMs = profile?.user?.boost_expires_at ? new Date(profile.user.boost_expires_at).getTime() : null;
  const isBoostActive = Boolean(boostExpiresAtMs && boostExpiresAtMs > Date.now());

  const boostSubtitle = (() => {
    if (isBoostActive && boostExpiresAtMs) {
      const diffMs = Math.max(0, boostExpiresAtMs - Date.now());
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `Boost active • ${hours}h ${minutes}m left`;
    }
    if (hasPaidPlan) {
      return 'Get seen by 10X more people for 6 hours';
    }
    if (canUseTokensForBoost) {
      return 'Use 20 tokens for a 6-hour boost';
    }
    return 'Requires Premium or 20 tokens';
  })();

  const handleBoost = async () => {
    if (!canActivateBoost) {
      Alert.alert('Boost', 'Boost requires Premium or 20 tokens.');
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/profile/boost`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Unable to activate boost');
      }

      if (body.boost_expires_at) {
        setProfile((prev: any) => ({
          ...prev,
          user: {
            ...(prev?.user || {}),
            boost_expires_at: body.boost_expires_at,
          },
        }));
      }
      if (typeof body.credit_balance === 'number') {
        setProfile((prev: any) => ({
          ...prev,
          user: {
            ...(prev?.user || {}),
            credit_balance: body.credit_balance,
          },
        }));
      }

      const chargedTokens = Number(body?.charged_tokens || 0);
      const successMessage = chargedTokens > 0
        ? `Your profile is boosted for 6 hours. ${chargedTokens} tokens used.`
        : 'Your profile is boosted for 6 hours.';
      Alert.alert('Boost activated', successMessage);
    } catch (error: any) {
      Alert.alert('Boost failed', error?.message || 'Unable to activate boost');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.neonGreen} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.deepBlack }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { backgroundColor: theme.colors.deepBlack, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.headerButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
        >
          <Feather name="arrow-left" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h2" style={{ color: theme.colors.text, flex: 1 }}>
          Profile
        </Typography>
        <TouchableOpacity
          onPress={onOpenSettings}
          style={[styles.headerButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
        >
          <Feather name="settings" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        bounces
      >
        <View style={[styles.photoSectionCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onManagePhotos} activeOpacity={0.8}>
            <View style={[styles.photoContainer, { borderColor: isVerified ? theme.colors.neonGreen : theme.colors.border }]}>
              {primaryPhoto ? (
                <Image source={{ uri: primaryPhoto.photo_url }} style={styles.profilePhoto} />
              ) : (
                <View style={[styles.profilePhoto, { backgroundColor: theme.colors.surfaceLight, alignItems: 'center', justifyContent: 'center' }]}>
                  <Feather name="user" size={48} color={theme.colors.muted} />
                </View>
              )}
              <View style={[styles.editIconOverlay, { backgroundColor: theme.colors.neonGreen }]}>
                <Feather name="edit-2" size={14} color={theme.colors.deepBlack} />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.nameRow}>
            <Typography variant="h1" style={{ color: theme.colors.text }}>
              {userName}
            </Typography>
            <View style={styles.flagIcon}>
              <PixelFlag size={20} color={isVerified ? theme.colors.neonGreen : theme.colors.muted} />
            </View>
          </View>

          {profileTags.length > 0 ? (
            <View style={styles.tagsRow}>
              {profileTags.map((tag) => (
                <View key={tag} style={[styles.tagPill, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}>
                  <Typography variant="tiny" style={{ color: theme.colors.textDark }}>
                    {tag}
                  </Typography>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.quickActionRow}>
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
              onPress={onEditProfile}
              activeOpacity={0.8}
            >
              <Feather name="edit-3" size={16} color={theme.colors.text} />
              <Typography variant="small" style={{ color: theme.colors.text, marginLeft: 8 }}>
                Edit profile
              </Typography>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
              onPress={onManagePhotos}
              activeOpacity={0.8}
            >
              <Feather name="camera" size={16} color={theme.colors.text} />
              <Typography variant="small" style={{ color: theme.colors.text, marginLeft: 8 }}>
                Manage photos
              </Typography>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.completionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
          <View style={styles.completionHeaderRow}>
            <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
              Profile completion
            </Typography>
            <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>
              {completionPercent}%
            </Typography>
          </View>
          <View style={[styles.completionTrack, { backgroundColor: theme.colors.border }]}>
            <View style={[styles.completionFill, { width: `${completionPercent}%`, backgroundColor: theme.colors.neonGreen }]} />
          </View>
          <Typography variant="tiny" style={{ color: theme.colors.muted }}>
            Complete your profile to get better AI matches.
          </Typography>
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
            About me
          </Typography>
          <Typography variant="body" style={{ color: theme.colors.textDark, lineHeight: 24 }}>
            {aboutText || 'Add a short bio to help people understand who you are.'}
          </Typography>
        </View>

        {interests.length > 0 ? (
          <View style={[styles.infoCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
              Interests
            </Typography>
            <View style={styles.chipsWrap}>
              {interests.slice(0, 12).map((interest) => (
                <View key={interest} style={[styles.chip, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}>
                  <Typography variant="small" style={{ color: theme.colors.textDark }}>
                    {normalizeLabel(String(interest))}
                  </Typography>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {topTraits.length > 0 ? (
          <View style={[styles.infoCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
              Personality
            </Typography>
            <View style={styles.chipsWrap}>
              {topTraits.slice(0, 8).map((trait) => (
                <View key={trait} style={[styles.chip, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}>
                  <Typography variant="small" style={{ color: theme.colors.textDark }}>
                    {normalizeLabel(String(trait))}
                  </Typography>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {profileDetails.length > 0 ? (
          <View style={[styles.infoCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
              Profile details
            </Typography>
            <View style={styles.detailList}>
              {profileDetails.map((item, index) => (
                <View
                  key={item.label}
                  style={[
                    styles.detailRow,
                    index !== profileDetails.length - 1 ? { borderBottomColor: theme.colors.border } : null,
                  ]}
                >
                  <Typography variant="small" style={{ color: theme.colors.muted }}>
                    {item.label}
                  </Typography>
                  <Typography
                    variant="small"
                    style={[styles.detailValue, { color: theme.colors.textDark }]}
                    numberOfLines={1}
                  >
                    {normalizeLabel(String(item.value))}
                  </Typography>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.planSection}>
          <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
            GreenFlag plans
          </Typography>

          <View style={styles.planTabs}>
            <TouchableOpacity
              style={[
                styles.planTab,
                selectedPlan === 'plus'
                  ? { backgroundColor: theme.colors.neonGreen }
                  : { backgroundColor: 'transparent', borderWidth: 2, borderColor: theme.colors.neonGreen },
              ]}
              onPress={() => setSelectedPlan('plus')}
              activeOpacity={0.8}
            >
              <PixelFlag size={16} color={selectedPlan === 'plus' ? theme.colors.deepBlack : theme.colors.neonGreen} />
              <Typography
                variant="bodyStrong"
                style={{
                  color: selectedPlan === 'plus' ? theme.colors.deepBlack : theme.colors.neonGreen,
                  marginLeft: 6,
                }}
              >
                Plus
              </Typography>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.planTab,
                selectedPlan === 'premium'
                  ? { backgroundColor: theme.colors.neonGreen }
                  : { backgroundColor: 'transparent', borderWidth: 2, borderColor: theme.colors.neonGreen },
              ]}
              onPress={() => setSelectedPlan('premium')}
              activeOpacity={0.8}
            >
              <PixelFlag size={16} color={selectedPlan === 'premium' ? theme.colors.deepBlack : theme.colors.neonGreen} />
              <Typography
                variant="bodyStrong"
                style={{
                  color: selectedPlan === 'premium' ? theme.colors.deepBlack : theme.colors.neonGreen,
                  marginLeft: 6,
                }}
              >
                Premium
              </Typography>
            </TouchableOpacity>
          </View>

          <View style={[styles.featuresCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Typography variant="bodyStrong" style={{ color: theme.colors.text, marginBottom: 12 }}>
              What you get
            </Typography>
            {currentFeatures.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Typography variant="body" style={{ color: theme.colors.textDark, flex: 1 }}>
                  {feature}
                </Typography>
                <Feather name="check" size={18} color={theme.colors.neonGreen} />
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: theme.colors.neonGreen },
              !canActivateBoost ? styles.actionButtonDisabled : null,
            ]}
            onPress={handleBoost}
            activeOpacity={0.8}
          >
            <Typography
              variant="h2"
              style={styles.boostButtonTitle}
            >
              BOOOOOOOOOOST
            </Typography>
            <Typography variant="small" style={{ color: theme.colors.deepBlack, marginTop: 4 }}>
              {boostSubtitle}
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.checkoutButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
            onPress={onOpenCheckout}
            activeOpacity={0.85}
          >
            <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
              View plan options
            </Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 32,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 190 : 160,
    flexGrow: 1,
    gap: 12,
  },
  photoSectionCard: {
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 14,
    gap: 10,
  },
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    overflow: 'visible',
    position: 'relative',
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 58,
  },
  editIconOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  flagIcon: {
    marginLeft: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tagPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickActionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  quickActionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  infoCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  detailList: {
    gap: 0,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  detailValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  planSection: {
    gap: 12,
    marginTop: 4,
  },
  planTabs: {
    flexDirection: 'row',
    gap: 12,
  },
  planTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 30,
  },
  featuresCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionButton: {
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  boostButtonTitle: {
    color: '#101D13',
    letterSpacing: 2,
    fontFamily: 'RedHatDisplay_700Bold',
    includeFontPadding: false,
  },
  actionButtonDisabled: {
    opacity: 0.35,
  },
  checkoutButton: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
