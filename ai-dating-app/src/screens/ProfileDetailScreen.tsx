import React, { useState } from 'react';
import { Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
        <StatusBar barStyle="dark-content" />

        {/* Header with close button */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: theme.colors.surface }]}
            activeOpacity={0.7}
          >
            <Feather name="x" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Photo */}
          <View style={styles.photoContainer}>
            <Image source={photoSource} style={styles.photo} />

            {/* Match percentage badge overlay */}
            <View style={[styles.matchBadgeOverlay, { backgroundColor: theme.colors.brand }]}>
              <Typography variant="bodyStrong" style={{ color: '#FFF' }}>
                {match.match_percentage}% match
              </Typography>
            </View>
          </View>

          {/* Profile Info */}
          <View style={styles.profileInfo}>
            {/* Name, Age, City */}
            <View style={styles.nameSection}>
              <View style={styles.nameRow}>
                <Typography variant="display" style={styles.name}>
                  {match.name}
                </Typography>
                {match.age && (
                  <Typography variant="h1" muted>, {match.age}</Typography>
                )}
              </View>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={16} color={theme.colors.muted} />
                <Typography variant="body" muted style={{ marginLeft: 6 }}>
                  {match.city}
                </Typography>
              </View>
            </View>

            {/* Match Reason */}
            {match.match_reason && (
              <View style={[styles.section, { backgroundColor: theme.colors.successTint }]}>
                <View style={styles.sectionHeader}>
                  <Feather name="heart" size={18} color={theme.colors.brand} />
                  <Typography variant="bodyStrong" style={{ marginLeft: 8 }}>
                    Why you match
                  </Typography>
                </View>
                <Typography variant="body" style={styles.sectionText}>
                  {match.match_reason}
                </Typography>
              </View>
            )}

            {/* Match Highlights / Green Flags */}
            {match.match_highlights && match.match_highlights.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="check-circle" size={18} color={theme.colors.brand} />
                  <Typography variant="bodyStrong" style={{ marginLeft: 8 }}>
                    Green flags
                  </Typography>
                </View>
                <View style={styles.chipsContainer}>
                  {match.match_highlights.map((highlight, index) => (
                    <View
                      key={index}
                      style={[styles.chip, { backgroundColor: theme.colors.accentTint, borderColor: theme.colors.accent }]}
                    >
                      <Typography variant="small" style={{ color: theme.colors.text }}>
                        {highlight}
                      </Typography>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* AI Pickup Line */}
            <View style={[styles.section, { backgroundColor: theme.colors.accentTint }]}>
              <View style={styles.sectionHeader}>
                <Feather name="message-circle" size={18} color={theme.colors.primary} />
                <Typography variant="bodyStrong" style={{ marginLeft: 8 }}>
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
        <View style={[styles.footer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.swipeButtons}>
            {/* Pass Button */}
            <TouchableOpacity
              onPress={handleSwipeLeft}
              style={[styles.swipeButton, styles.passButton, { borderColor: theme.colors.border }]}
              activeOpacity={0.8}
            >
              <Feather name="x" size={32} color={theme.colors.muted} />
            </TouchableOpacity>

            {/* Like Button */}
            <TouchableOpacity
              onPress={handleSwipeRight}
              style={[styles.swipeButton, styles.likeButton, { backgroundColor: theme.colors.brand }]}
              activeOpacity={0.8}
            >
              <Feather name="heart" size={32} color="#FFFFFF" />
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
  header: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  photoContainer: {
    width: '100%',
    height: 450,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E8E8E8',
  },
  matchBadgeOverlay: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  profileInfo: {
    padding: 24,
    gap: 20,
  },
  nameSection: {
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 32,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionText: {
    lineHeight: 24,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
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
    borderTopColor: 'rgba(0,0,0,0.05)',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  passButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  likeButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
});
