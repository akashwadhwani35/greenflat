import React, { useEffect, useState } from 'react';
import {
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
  'Unlimited Likes',
  'See who likes you',
  'Advanced filters',
];

const PREMIUM_FEATURES = [
  'Unlimited Likes',
  'See who likes you',
  'Advanced filters',
  'Priority visibility',
  'Read receipts',
  'Profile boost monthly',
];

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

    fetchProfile();
  }, [apiBaseUrl, token]);

  const primaryPhoto = profile?.photos?.find((p: any) => p.is_primary) || profile?.photos?.[0];
  const isVerified = profile?.user?.is_verified || false;
  const userName = profile?.user?.name || 'New User';
  const userCity = profile?.user?.city || '';

  const checklist = [
    { label: 'Photo added', done: (profile?.photos || []).length > 0 },
    { label: 'Location verified', done: Boolean(profile?.user?.city) },
    { label: 'Contact secured', done: true },
  ];

  const currentFeatures = selectedPlan === 'plus' ? PLUS_FEATURES : PREMIUM_FEATURES;

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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.deepBlack }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          <Feather name="chevron-left" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h2" style={{ color: theme.colors.text, flex: 1 }}>
          Profile
        </Typography>
        <TouchableOpacity onPress={onOpenSettings} style={styles.headerButton}>
          <Feather name="settings" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Photo Section */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={onManagePhotos} activeOpacity={0.8}>
            <View style={[styles.photoContainer, { borderColor: isVerified ? theme.colors.neonGreen : theme.colors.border }]}>
              {primaryPhoto ? (
                <Image source={{ uri: primaryPhoto.photo_url }} style={styles.profilePhoto} />
              ) : (
                <View style={[styles.profilePhoto, { backgroundColor: theme.colors.charcoal, alignItems: 'center', justifyContent: 'center' }]}>
                  <Feather name="user" size={48} color={theme.colors.muted} />
                </View>
              )}
              {/* Edit icon overlay */}
              <View style={[styles.editIconOverlay, { backgroundColor: theme.colors.neonGreen }]}>
                <Feather name="edit-2" size={14} color={theme.colors.deepBlack} />
              </View>
            </View>
          </TouchableOpacity>

          {/* Name with GF Flag */}
          <View style={styles.nameRow}>
            <Typography variant="h1" style={{ color: theme.colors.text }}>
              {userName}
            </Typography>
            <View style={styles.flagIcon}>
              <PixelFlag size={20} color={isVerified ? theme.colors.neonGreen : theme.colors.muted} />
            </View>
          </View>

          {userCity ? (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={14} color={theme.colors.muted} />
              <Typography variant="small" style={{ color: theme.colors.muted, marginLeft: 4 }}>
                {userCity}
              </Typography>
            </View>
          ) : null}
        </View>

        {/* Plan Tabs */}
        <View style={styles.planSection}>
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

          {/* What you get */}
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

          {/* Boost Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.neonGreen }]}
            onPress={onOpenCheckout}
            activeOpacity={0.8}
          >
            <Typography variant="h2" style={{ color: theme.colors.deepBlack, letterSpacing: 2 }}>
              BOOOOOOOOOOST
            </Typography>
            <Typography variant="small" style={{ color: theme.colors.deepBlack, marginTop: 4 }}>
              Get seen by 10X more people
            </Typography>
          </TouchableOpacity>

          {/* Compliments Button */}
          <TouchableOpacity
            style={[styles.actionButtonOutline, { borderColor: theme.colors.neonGreen }]}
            onPress={onOpenCheckout}
            activeOpacity={0.8}
          >
            <Typography variant="h2" style={{ color: theme.colors.neonGreen, letterSpacing: 2 }}>
              COMPLIMENTS
            </Typography>
            <Typography variant="small" style={{ color: theme.colors.neonGreen, marginTop: 4 }}>
              Land directly in DMs
            </Typography>
          </TouchableOpacity>
        </View>

        {/* Quick Checklist */}
        <View style={[styles.checklistCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
          <Typography variant="h2" style={{ color: theme.colors.text, marginBottom: 16 }}>
            Quick checklist
          </Typography>
          {checklist.map((item) => (
            <View key={item.label} style={styles.checklistRow}>
              <View
                style={[
                  styles.checkCircle,
                  {
                    backgroundColor: item.done ? 'rgba(173, 255, 26, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    borderColor: item.done ? theme.colors.neonGreen : theme.colors.border,
                  },
                ]}
              >
                {item.done ? (
                  <Feather name="check" size={14} color={theme.colors.neonGreen} />
                ) : (
                  <Feather name="circle" size={14} color={theme.colors.muted} />
                )}
              </View>
              <Typography
                variant="body"
                style={{ color: item.done ? theme.colors.text : theme.colors.muted, marginLeft: 12 }}
              >
                {item.label}
              </Typography>
            </View>
          ))}
        </View>

        {/* Edit Profile and Manage Photos */}
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: theme.colors.neonGreen }]}
          onPress={onEditProfile}
          activeOpacity={0.8}
        >
          <Typography variant="bodyStrong" style={{ color: theme.colors.deepBlack }}>
            Edit profile
          </Typography>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.editButtonOutline, { borderColor: theme.colors.neonGreen }]}
          onPress={onManagePhotos}
          activeOpacity={0.8}
        >
          <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>
            Manage photos
          </Typography>
        </TouchableOpacity>
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
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  photoSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
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
    marginTop: 16,
    gap: 8,
  },
  flagIcon: {
    marginLeft: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  planSection: {
    gap: 16,
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
    padding: 20,
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
  actionButtonOutline: {
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  checklistCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 24,
  },
  editButtonOutline: {
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: 'transparent',
    marginTop: 12,
  },
});
