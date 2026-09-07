import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PixelFlag } from '../components/PixelFlag';
import { PageHeader } from '../components/PageHeader';
import { NoticeModal, type Notice } from '../components/NoticeModal';
import { hapticStrong } from '../utils/haptics';

/**
 * The Profile tab after round 8: photo with an edit badge, name and the
 * face-verification flag, Edit Profile, a completion bar that counts every
 * field, the plan box (bigger, and aware of the plan the person is on), and
 * Boost at the bottom, moved here from the wallet.
 */
type Props = {
  onBack: () => void;
  onOpenSettings: () => void;
  onEditProfile: () => void;
  onManagePhotos: () => void;
  onOpenSubscription: (tab: 'pro' | 'premium') => void;
  onOpenWallet?: () => void;
  token: string;
  apiBaseUrl: string;
};

type PlanTab = 'pro' | 'premium';

const BOOST_COST = 20;

const PLAN_COPY: Record<PlanTab, { title: string; blurb: string; perks: string[] }> = {
  pro: {
    title: 'Pro',
    blurb: 'Send unlimited likes & rewind anytime.',
    perks: ['Unlimited likes', 'Unlimited rewinds', 'More filters', '30 GFT every month'],
  },
  premium: {
    title: 'Premium',
    blurb: 'Everything in Pro, and you get seen first.',
    perks: ['Everything in Pro', 'Seen first in AI Match', '3x more matches', '60 GFT every month'],
  },
};

const filled = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return typeof value === 'string' && value.trim().length > 0;
};

export const ProfileScreen: React.FC<Props> = ({
  onBack,
  onOpenSettings,
  onEditProfile,
  onManagePhotos,
  onOpenSubscription,
  onOpenWallet,
  token,
  apiBaseUrl,
}) => {
  const theme = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [activePlan, setActivePlan] = useState<PlanTab | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanTab>('pro');
  const [boosting, setBoosting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [profileResponse, walletResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/profile/me`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBaseUrl}/wallet/summary`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const profileBody = await profileResponse.json().catch(() => ({}));
      if (profileResponse.ok) setProfile(profileBody);
      const walletBody = await walletResponse.json().catch(() => ({}));
      if (walletResponse.ok) {
        const plan = walletBody?.active_plan;
        setActivePlan(plan === 'pro' || plan === 'premium' ? plan : null);
        if (plan === 'pro') setSelectedPlan('premium');
      }
    } catch (error) {
      console.warn('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const user = profile?.user || {};
  const profileData = profile?.profile || {};
  const personality = profile?.personality || {};
  const photos: any[] = Array.isArray(profile?.photos) ? profile.photos : [];
  const primaryPhoto = photos.find((p) => p?.is_primary) || photos[0];
  // Board 17: green only after face verification. The server now sets
  // is_verified from the selfie check alone.
  const isFaceVerified = Boolean(user.is_verified);
  const userName = user.name || 'You';

  // Board 21: every field the person can fill counts, so 100% means 100%.
  const completionFields: unknown[] = [
    photos.length > 0,
    photos.length >= 3 ? true : '',
    user.name,
    user.date_of_birth,
    user.gender,
    user.city,
    user.pronouns,
    profileData.bio,
    profileData.prompt1,
    profileData.interests,
    profileData.languages,
    profileData.occupation,
    profileData.education,
    profileData.hometown,
    profileData.height,
    profileData.fitness_level,
    profileData.education_level,
    profileData.drinker,
    profileData.smoking_habit || (typeof profileData.smoker === 'boolean' ? 'set' : ''),
    profileData.relationship_goal,
    profileData.have_kids,
    profileData.star_sign,
    profileData.politics,
    profileData.religion,
    personality.personality_traits,
  ];
  const completionPercent = Math.round(
    (completionFields.filter(filled).length / completionFields.length) * 100
  );
  // Board 26: keep the bubble inside the track at the ends.
  const bubbleLeft = Math.min(Math.max(completionPercent, 6), 94);

  const premiumExpiresAt = user.premium_expires_at ? new Date(user.premium_expires_at).getTime() : null;
  const hasPaidPlan = Boolean(user.is_premium) && (premiumExpiresAt === null || premiumExpiresAt > Date.now());
  const creditBalance = Number(user.credit_balance || 0);
  const boostExpiresAtMs = user.boost_expires_at ? new Date(user.boost_expires_at).getTime() : null;
  const isBoostActive = Boolean(boostExpiresAtMs && boostExpiresAtMs > Date.now());

  const boostTimeLeft = () => {
    if (!boostExpiresAtMs) return '';
    const diffMs = Math.max(0, boostExpiresAtMs - Date.now());
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m left`;
  };

  const activateBoost = async () => {
    if (boosting) return;
    setBoosting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/profile/boost`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to activate boost');
      setProfile((prev: any) => ({
        ...prev,
        user: {
          ...(prev?.user || {}),
          ...(body.boost_expires_at ? { boost_expires_at: body.boost_expires_at } : {}),
          ...(typeof body.credit_balance === 'number' ? { credit_balance: body.credit_balance } : {}),
        },
      }));
      const charged = Number(body?.charged_tokens || 0);
      setNotice({
        title: 'Boooost activated',
        message: charged > 0
          ? `You are at the front of the line for the next 6 hours. ${charged} GFT used.`
          : 'You are at the front of the line for the next 6 hours.',
        icon: 'zap',
        buttonLabel: "Let's gooo",
      });
    } catch (error: any) {
      setNotice({ title: 'Boost failed', message: error?.message || 'Please try again.', tone: 'error' });
    } finally {
      setBoosting(false);
    }
  };

  const handleBoost = () => {
    hapticStrong();
    if (isBoostActive) {
      setNotice({ title: 'Boost is on', message: `Your profile is boosted. ${boostTimeLeft()}.`, icon: 'zap' });
      return;
    }
    if (hasPaidPlan) {
      void activateBoost();
      return;
    }
    if (creditBalance < BOOST_COST) {
      Alert.alert(
        'Not enough GFT',
        `A boost costs ${BOOST_COST} GFT. You have ${creditBalance}.`,
        onOpenWallet
          ? [{ text: 'Not now', style: 'cancel' }, { text: 'Get tokens', onPress: onOpenWallet }]
          : [{ text: 'OK' }]
      );
      return;
    }
    Alert.alert(
      'Boost your profile?',
      `Get seen by more people for 6 hours. Costs ${BOOST_COST} GFT.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Boost', onPress: () => { void activateBoost(); } },
      ]
    );
  };

  // Board 25: on Pro you are offered Premium only; on Premium nothing to buy.
  const planTabs: PlanTab[] = activePlan === 'pro' ? ['premium'] : activePlan === 'premium' ? [] : ['pro', 'premium'];
  const shownPlan: PlanTab = activePlan === 'premium' ? 'premium' : activePlan === 'pro' ? 'premium' : selectedPlan;
  const plan = PLAN_COPY[shownPlan];
  const planHeadline = activePlan === 'premium'
    ? 'You are on Premium.'
    : activePlan === 'pro'
      ? 'You are on Pro. Premium gets you seen first.'
      : plan.blurb;
  const planCta = activePlan === 'premium' ? null : activePlan === 'pro' ? 'Upgrade to Premium' : 'Upgrade';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader
        title="Profile"
        onBack={onBack}
        right={
          <TouchableOpacity
            onPress={onOpenSettings}
            style={[styles.gearButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            activeOpacity={0.8}
          >
            <Feather name="settings" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.neonGreen} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Photo, name, edit */}
          <View style={styles.hero}>
            <TouchableOpacity onPress={onManagePhotos} activeOpacity={0.85} accessibilityLabel="Change photos">
              <View style={[styles.avatarRing, { borderColor: theme.colors.neonGreen }]}>
                {primaryPhoto?.photo_url ? (
                  <Image source={{ uri: primaryPhoto.photo_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceLight, alignItems: 'center', justifyContent: 'center' }]}>
                    <Feather name="user" size={44} color={theme.colors.muted} />
                  </View>
                )}
              </View>
              <View style={[styles.editBadge, { backgroundColor: theme.colors.neonGreen, borderColor: theme.colors.background }]}>
                <Feather name="edit-2" size={13} color={theme.colors.deepBlack} />
              </View>
            </TouchableOpacity>

            <View style={styles.nameRow}>
              <Typography variant="h1" style={{ color: theme.colors.text }} numberOfLines={1}>
                {userName}
              </Typography>
              <PixelFlag size={20} color={isFaceVerified ? theme.colors.neonGreen : theme.colors.muted} />
            </View>

            <TouchableOpacity
              onPress={onEditProfile}
              style={[styles.editButton, { backgroundColor: '#FFFFFF' }]}
              activeOpacity={0.85}
            >
              <Typography variant="small" style={{ color: '#000000', fontFamily: theme.fonts.bodyStrong.family }}>
                Edit Profile
              </Typography>
            </TouchableOpacity>
          </View>

          {/* Completion */}
          <View style={styles.progressBlock}>
            <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
              <View style={[styles.progressFill, { width: `${completionPercent}%`, backgroundColor: theme.colors.neonGreen }]} />
              <View style={[styles.progressBubble, { left: `${bubbleLeft}%`, backgroundColor: theme.colors.neonGreen }]}>
                <Typography variant="tiny" style={{ color: theme.colors.deepBlack, fontFamily: 'RedHatDisplay_700Bold' }}>
                  {completionPercent}%
                </Typography>
              </View>
            </View>
            <Typography variant="tiny" style={{ color: theme.colors.muted, textAlign: 'center' }}>
              {completionPercent >= 100 ? 'Your profile is complete.' : 'Complete your profile to get better AI matches.'}
            </Typography>
          </View>

          {/* Plan picker (only the plans that are still an upgrade) */}
          {planTabs.length > 1 ? (
            <View style={[styles.segment, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
              {planTabs.map((tab) => {
                const active = shownPlan === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.segmentHalf, active && { backgroundColor: theme.colors.neonGreen }]}
                    onPress={() => setSelectedPlan(tab)}
                    activeOpacity={0.85}
                  >
                    <Typography variant="bodyStrong" style={{ color: active ? theme.colors.deepBlack : theme.colors.text }}>
                      {PLAN_COPY[tab].title}
                    </Typography>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <View style={[styles.planCard, { borderColor: theme.colors.neonGreen, backgroundColor: theme.colors.charcoal }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <PixelFlag size={16} color={theme.colors.neonGreen} />
              <Typography variant="h2" style={{ color: theme.colors.text }}>
                {plan.title}
              </Typography>
            </View>
            <Typography variant="body" style={{ color: theme.colors.text, textAlign: 'center' }}>
              {planHeadline}
            </Typography>
            <View style={styles.perkList}>
              {plan.perks.map((perk) => (
                <View key={perk} style={styles.perkRow}>
                  <Feather name="check" size={16} color={theme.colors.neonGreen} />
                  <Typography variant="small" style={{ color: theme.colors.textDark }}>
                    {perk}
                  </Typography>
                </View>
              ))}
            </View>
            {planCta ? (
              <TouchableOpacity
                style={[styles.upgradeButton, { backgroundColor: theme.colors.neonGreen }]}
                onPress={() => onOpenSubscription(shownPlan)}
                activeOpacity={0.85}
              >
                <Typography variant="bodyStrong" style={{ color: theme.colors.deepBlack }}>
                  {planCta}
                </Typography>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Boost, moved here from the wallet (board 15.1) */}
          <TouchableOpacity
            style={[
              styles.boostButton,
              { backgroundColor: isBoostActive ? theme.colors.charcoal : theme.colors.neonGreen, borderColor: theme.colors.neonGreen },
            ]}
            onPress={handleBoost}
            disabled={boosting}
            activeOpacity={0.85}
          >
            {boosting ? (
              <ActivityIndicator color={theme.colors.deepBlack} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="rocket-launch-outline"
                  size={24}
                  color={isBoostActive ? theme.colors.neonGreen : theme.colors.deepBlack}
                />
                <View style={{ alignItems: 'center' }}>
                  <Typography
                    variant="bodyStrong"
                    style={{ color: isBoostActive ? theme.colors.neonGreen : theme.colors.deepBlack, letterSpacing: 1 }}
                  >
                    {isBoostActive ? 'BOOST ON' : 'BOOOOOOOST'}
                  </Typography>
                  <Typography
                    variant="tiny"
                    style={{ color: isBoostActive ? theme.colors.muted : 'rgba(16,29,19,0.7)' }}
                  >
                    {isBoostActive ? boostTimeLeft() : hasPaidPlan ? 'Included in your plan · 6 hours' : `Get seen by more people · ${BOOST_COST} GFT`}
                  </Typography>
                </View>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      <NoticeModal notice={notice} onClose={() => setNotice(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gearButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 140,
    gap: 20,
  },
  hero: {
    alignItems: 'center',
    gap: 10,
  },
  avatarRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    padding: 3,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  editBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    maxWidth: '85%',
  },
  editButton: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 24,
  },
  progressBlock: {
    gap: 10,
    paddingTop: 14,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    marginHorizontal: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressBubble: {
    position: 'absolute',
    top: -12,
    marginLeft: -22,
    minWidth: 44,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
  },
  segmentHalf: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  planCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 16,
    alignItems: 'center',
    minHeight: 260,
  },
  perkList: {
    alignSelf: 'stretch',
    gap: 8,
    paddingHorizontal: 8,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  upgradeButton: {
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 40,
    marginTop: 4,
  },
  boostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
});
