import React, { useState } from 'react';
import { Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { MatchCandidate } from './MatchboardScreen';

type ProfileDetailScreenProps = {
  match: MatchCandidate | null;
  visible: boolean;
  onClose: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
};

const fallbackPhoto = require('../../assets/icon.png');

export const ProfileDetailScreen: React.FC<ProfileDetailScreenProps> = ({
  match,
  visible,
  onClose,
  onSwipeLeft,
  onSwipeRight,
}) => {
  const theme = useTheme();
  const [photoIndex, setPhotoIndex] = useState(0);

  if (!match) return null;

  const photoSource = match.primary_photo ? { uri: match.primary_photo } : fallbackPhoto;
  const pickupLine = match.suggested_openers?.[0] || 'Start a conversation!';
  const isVerified = Boolean((match as any).is_verified);

  const handleSwipeLeft = () => {
    setPhotoIndex(0);
    onSwipeLeft();
  };

  const handleSwipeRight = () => {
    setPhotoIndex(0);
    onSwipeRight();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle="light-content" />

        {/* Scrollable Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Photo hero - full width, no header above */}
          <View style={styles.photoContainer}>
            <Image source={photoSource} style={styles.photo} />
            <LinearGradient
              colors={['rgba(16,29,19,0)', 'rgba(16,29,19,0.4)', 'rgba(16,29,19,0.95)']}
              style={styles.photoGradient}
            />

            {/* Close button overlaid on photo */}
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButtonOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
              activeOpacity={0.7}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Badges on photo */}
            <View style={styles.heroTopRow}>
              <View style={[styles.matchBadgeOverlay, { backgroundColor: theme.colors.neonGreen }]}>
                <Typography variant="small" style={{ color: theme.colors.deepBlack, fontWeight: '600' }}>
                  {match.match_percentage}% match
                </Typography>
              </View>

              {isVerified && (
                <View style={[styles.verifiedBadgeOverlay, { backgroundColor: 'rgba(173, 255, 26, 0.9)' }]}>
                  <Feather name="check" size={14} color={theme.colors.deepBlack} />
                  <Typography variant="small" style={{ color: theme.colors.deepBlack, marginLeft: 4, fontWeight: '600' }}>
                    Verified
                  </Typography>
                </View>
              )}
            </View>

            {/* Name and location on photo */}
            <View style={styles.heroBottom}>
              <View style={styles.nameRow}>
                <Typography variant="display" style={styles.name}>
                  {match.name}
                </Typography>
                {match.age ? (
                  <Typography variant="display" style={{ color: theme.colors.textDark }}>
                    , {match.age}
                  </Typography>
                ) : null}
              </View>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={14} color={theme.colors.mutedLight} />
                <Typography variant="small" style={{ color: theme.colors.mutedLight, marginLeft: 6 }}>
                  {match.city}
                </Typography>
              </View>
            </View>
          </View>

          {/* Profile Info Cards */}
          <View style={styles.profileInfo}>
            {/* Why you match */}
            {match.match_reason && (
              <View style={[styles.section, { backgroundColor: 'rgba(45, 80, 45, 0.6)', borderColor: 'rgba(173, 255, 26, 0.3)' }]}>
                <View style={styles.sectionHeader}>
                  <Feather name="heart" size={16} color={theme.colors.neonGreen} />
                  <Typography variant="bodyStrong" style={{ marginLeft: 8, color: theme.colors.text }}>
                    Why you match
                  </Typography>
                </View>
                <Typography variant="body" style={styles.sectionText}>
                  {match.match_reason}
                </Typography>
              </View>
            )}

            {/* AI conversation starter */}
            <View style={[styles.section, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
              <View style={styles.sectionHeader}>
                <Feather name="message-circle" size={16} color={theme.colors.muted} />
                <Typography variant="bodyStrong" style={{ marginLeft: 8, color: theme.colors.text }}>
                  AI conversation starter
                </Typography>
              </View>
              <Typography variant="body" style={styles.sectionText}>
                {pickupLine}
              </Typography>
            </View>
          </View>
        </ScrollView>

        {/* Fixed Swipe Buttons at Bottom */}
        <View style={[styles.footer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
          <View style={styles.swipeButtons}>
            {/* Pass Button */}
            <TouchableOpacity
              onPress={handleSwipeLeft}
              style={[styles.swipeButton, styles.passButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}
              activeOpacity={0.8}
            >
              <Feather name="x" size={32} color={theme.colors.muted} />
            </TouchableOpacity>

            {/* Like Button */}
            <TouchableOpacity
              onPress={handleSwipeRight}
              style={[styles.swipeButton, styles.likeButton, { backgroundColor: theme.colors.neonGreen }]}
              activeOpacity={0.8}
            >
              <Feather name="heart" size={32} color={theme.colors.deepBlack} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  photoContainer: {
    width: '100%',
    height: 500,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E8E8E8',
  },
  photoGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  closeButtonOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 0) + 12,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heroTopRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : (StatusBar.currentHeight || 0) + 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  matchBadgeOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  verifiedBadgeOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroBottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  profileInfo: {
    padding: 16,
    gap: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 34,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  section: {
    padding: 16,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionText: {
    lineHeight: 22,
    color: '#E0E0E0',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 20,
    borderTopWidth: 1,
  },
  swipeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  swipeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passButton: {
    borderWidth: 2,
  },
  likeButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
});
