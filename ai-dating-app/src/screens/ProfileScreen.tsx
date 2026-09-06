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

/**
 * The Profile tab, laid out per the "Greenflag edits" board: photo with an edit
 * badge, name and flag, Edit Profile, a completion bar, the three action tiles
 * (Boost, First Moves, Green Flags), then the plan picker with Upgrade.
 *
 * Settings is behind the gear; previewing your own card is under Settings →
 * Your profile.
 */
type Props = {
  onBack: () => void;
  onOpenSettings: () => void;
  onEditProfile: () => void;
  onManagePhotos: () => void;
  onOpenSubscription: (tab: 'pro' | 'premium') => void;
  onOpenLikes: () => void;
  onOpenConversations: () => void;
  onOpenWallet?: () => void;
  token: string;
  apiBaseUrl: string;
};

type PlanTab = 'pro' | 'premium';

const BOOST_COST = 20;

const PLAN_COPY: Record<PlanTab, { title: string; blurb: string }> = {
  pro: { title: 'Pro', blurb: 'Send unlimited likes & rewind anytime.' },
  premium: { title: 'Premium', blurb: 'Everything in Pro, and you get seen first.' },
};

export const ProfileScreen: React.FC<Props> = ({
  onBack,
  onOpenSettings,
  onEditProfile,
  onManagePhotos,
  onOpenSubscription,
  onOpenLikes,
  onOpenConversations,
  onOpenWallet,
  token,
  apiBaseUrl,
}) => {
  const theme = useTheme();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanTab>('pro');
  const [boosting, setBoosting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) setProfile(data);
    } catch (error) {
      console.warn('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const user = profile?.user || {};
  const profileData = profile?.profile || {};
  const photos: any[] = Array.isArray(profile?.photos) ? profile.photos : [];
  const primaryPhoto = photos.find((p) => p?.is_primary) || photos[0];
  const isVerified = Boolean(user.is_verified);
  const userName = user.name || 'You';
  const interests: string[] = Array.isArray(profileData.interests) ? profileData.interests : [];

  const completionSignals = [
    photos.length > 0,
    photos.length >= 3,
    Boolean(user.city),
    Boolean(user.date_of_birth),
    Boolean(user.gender),
    Boolean(profileData.bio),
    interests.length >= 3,
    Boolean(profileData.height),
    Boolean(profileData.relationship_goal),
    Boolean(profileData.drinker),
    Boolean(profileData.smoking_habit || typeof profileData.smoker === 'boolean'),
    Boolean(profile?.personality?.personality_traits?.length),
  ];
  const completionPercent = Math.round(
    (completionSignals.filter(Boolean).length / completionSignals.length) * 100
  );

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

  const tiles: Array<{
    key: string;
    label: string;
    caption: string;
    onPress: () => void;
    icon: React.ReactNode;
    highlighted?: boolean;
  }> = [
    {
      key: 'boost',
      label: 'Boost',
      caption: isBoostActive ? boostTimeLeft() : hasPaidPlan ? 'Included' : `${BOOST_COST} GFT`,
      onPress: handleBoost,
      icon: <MaterialCommunityIcons name="rocket-launch-outline" size={26} color={theme.colors.neonGreen} />,
      highlighted: isBoostActive,
    },
    {
      key: 'first-moves',
      label: 'First Moves',
      caption: 'In your chats',
      onPress: onOpenConversations,
      icon: <Feather name="send" size={24} color={theme.colors.neonGreen} />,
    },
    {
      key: 'green-flags',
      label: 'Green Flags',
      caption: 'In your inbox',
      onPress: onOpenLikes,
      icon: <PixelFlag size={26} color={theme.colors.neonGreen} />,
    },
  ];

  const plan = PLAN_COPY[selectedPlan];

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
              <PixelFlag size={20} color={isVerified ? theme.colors.neonGreen : theme.colors.muted} />
            </View>

            <TouchableOpacity
              onPress={onEditProfile}
              style={[styles.editButton, { borderColor: theme.colors.text }]}
              activeOpacity={0.8}
            >
              <Typography variant="small" style={{ color: theme.colors.text }}>
                Edit Profile
              </Typography>
            </TouchableOpacity>
          </View>

          {/* Completion */}
          <View style={styles.progressBlock}>
            <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
              <View style={[styles.progressFill, { width: `${completionPercent}%`, backgroundColor: theme.colors.neonGreen }]} />
              <View style={[styles.progressBubble, { left: `${completionPercent}%`, backgroundColor: theme.colors.neonGreen }]}>
                <Typography variant="tiny" style={{ color: theme.colors.deepBlack, fontFamily: 'RedHatDisplay_700Bold' }}>
                  {completionPercent}%
                </Typography>
              </View>
            </View>
            <Typography variant="tiny" style={{ color: theme.colors.muted, textAlign: 'center' }}>
              {completionPercent >= 100 ? 'Your profile is complete.' : 'Complete your profile to get better AI matches.'}
            </Typography>
          </View>

          {/* Boost / First Moves / Green Flags */}
          <View style={styles.tileRow}>
            {tiles.map((tile) => (
              <TouchableOpacity
                key={tile.key}
                style={[
                  styles.tile,
                  { backgroundColor: theme.colors.charcoal, borderColor: tile.highlighted ? theme.colors.neonGreen : theme.colors.border },
                ]}
                onPress={tile.onPress}
                activeOpacity={0.8}
                disabled={tile.key === 'boost' && boosting}
              >
                <View style={styles.tileIcon}>{tile.icon}</View>
                <Typography variant="small" style={{ color: theme.colors.text }} numberOfLines={1}>
                  {tile.label}
                </Typography>
                <Typography variant="tiny" style={{ color: theme.colors.muted }} numberOfLines={1}>
                  {tile.caption}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>

          {/* Plan picker */}
          <View style={[styles.segment, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            {(['pro', 'premium'] as PlanTab[]).map((tab) => {
              const active = selectedPlan === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.segmentHalf, active && { backgroundColor: theme.colors.neonGreen }]}
                  onPress={() => setSelectedPlan(tab)}
                  activeOpacity={0.85}
                >
                  <Typography
                    variant="bodyStrong"
                    style={{ color: active ? theme.colors.deepBlack : theme.colors.text }}
                  >
                    {PLAN_COPY[tab].title}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.planCard, { borderColor: theme.colors.neonGreen, backgroundColor: theme.colors.charcoal }]}>
            <Typography variant="body" style={{ color: theme.colors.text, textAlign: 'center' }}>
              {hasPaidPlan ? `You are on ${plan.title}.` : plan.blurb}
            </Typography>
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: theme.colors.neonGreen }]}
              onPress={() => onOpenSubscription(selectedPlan)}
              activeOpacity={0.85}
            >
              <Typography variant="bodyStrong" style={{ color: theme.colors.deepBlack }}>
                {hasPaidPlan ? 'Manage plan' : 'Upgrade'}
              </Typography>
            </TouchableOpacity>
          </View>
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
    gap: 22,
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
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 22,
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
  tileRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  tileIcon: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
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
    borderRadius: 18,
    padding: 18,
    gap: 14,
    alignItems: 'center',
  },
  upgradeButton: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 36,
  },
});
