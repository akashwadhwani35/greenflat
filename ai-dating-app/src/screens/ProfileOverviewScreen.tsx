import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';

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

    fetchProfile().catch(() => {});
  }, [apiBaseUrl, token]);

  const checklist = [
    { label: 'Photo added', done: (profile?.photos || []).length > 0 },
    { label: 'Location verified', done: Boolean(profile?.user?.city) },
    { label: 'Contact secured', done: true },
  ];

  const primaryPhoto = profile?.photos?.find((p: any) => p.is_primary) || profile?.photos?.[0];
  const interests: string[] = profile?.profile?.interests || [];
  const topTraits: string[] = profile?.personality?.top_traits || profile?.personality?.personality_traits || [];
  const about = profile?.profile?.bio || profile?.ai_persona?.self_summary || null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={[styles.iconButton, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]} accessibilityRole="button">
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h1">Your profile</Typography>
        <View style={{ flex: 1 }} />
        {onEditProfile ? (
          <TouchableOpacity
            onPress={onEditProfile}
            style={[styles.iconButton, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}
            accessibilityRole="button"
          >
            <Feather name="edit-3" size={18} color={theme.colors.neonGreen} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={theme.colors.brand} /> : null}

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

          <View style={styles.heroActions}>
            <Button label="Edit profile" onPress={onEditProfile || onBack} />
            <Button label="Manage photos" variant="secondary" onPress={onManagePhotos || onBack} />
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
                <View key={i} style={[styles.chip, { backgroundColor: 'rgba(173, 255, 26, 0.10)', borderColor: 'rgba(173, 255, 26, 0.22)' }]}>
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
                  <View key={t} style={[styles.chip, { backgroundColor: 'rgba(253, 226, 201, 0.18)', borderColor: 'rgba(253, 226, 201, 0.30)' }]}>
                    <Typography variant="small" style={{ color: theme.colors.textDark }}>
                      {t}
                    </Typography>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
          <Typography variant="h2">Quick checklist</Typography>
          {checklist.map((item) => (
            <View key={item.label} style={styles.row}>
              <View style={[styles.badge, { backgroundColor: item.done ? theme.colors.successTint : theme.colors.accentTint }]}>
                <Feather name={item.done ? 'check' : 'clock'} size={14} color={item.done ? theme.colors.brand : theme.colors.muted} />
              </View>
              <Typography variant="body">{item.label}</Typography>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 140,
    gap: 12,
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
  heroActions: {
    padding: 14,
    gap: 10,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
