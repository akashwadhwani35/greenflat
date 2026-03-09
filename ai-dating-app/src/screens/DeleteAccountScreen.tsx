import React, { useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

const greenHand = require('../../assets/green-hand.png');

const reasons = [
  'I met someone',
  'I wanted to focus on other priorities',
  "I didn't like the way I felt while using Greenflag",
  'I have safety concerns about using Greenflag',
  'Using Greenflag is too expensive',
  'Using Greenflag was too much effort',
  "I wasn't satisfied with my experience using Greenflag",
  'Prefer not to say',
];

type Props = {
  onBack: () => void;
  onClose?: () => void;
  token: string;
  apiBaseUrl: string;
  onAccountDeleted?: () => void;
  onAccountPaused?: () => void;
};

export const DeleteAccountScreen: React.FC<Props> = ({
  onBack,
  onClose,
  token,
  apiBaseUrl,
  onAccountDeleted,
  onAccountPaused,
}) => {
  const theme = useTheme();
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pausing, setPausing] = useState(false);

  const handleReasonPress = (reason: string) => {
    setSelectedReason(reason);
    setShowConfirm(true);
  };

  const handlePause = async () => {
    setPausing(true);
    try {
      // Pause = enable incognito mode (hides profile from others)
      const response = await fetch(`${apiBaseUrl}/privacy/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ incognito_mode: true }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Unable to pause account');
      }
      setShowConfirm(false);
      Alert.alert('Account paused', 'Your profile is now hidden. You can still chat with your current matches.', [
        { text: 'OK', onPress: () => onAccountPaused?.() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Please try again.');
    } finally {
      setPausing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/profile/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Unable to delete account');
      }
      onAccountDeleted?.();
    } catch (error: any) {
      Alert.alert('Delete failed', error?.message || 'Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button">
          <Feather name="chevron-left" size={28} color={theme.colors.muted} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {onClose ? (
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Feather name="x" size={24} color={theme.colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Title */}
      <View style={styles.titleSection}>
        <Typography variant="display" style={{ color: theme.colors.text }}>
          Why are you leaving{'\n'}Greenflag?
        </Typography>
      </View>

      {/* Reasons list */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {reasons.map((reason, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.reasonRow, { borderBottomColor: theme.colors.border }]}
            onPress={() => handleReasonPress(reason)}
            activeOpacity={0.7}
          >
            <Typography variant="body" style={{ color: theme.colors.text, flex: 1 }}>
              {reason}
            </Typography>
            <Feather name="chevron-right" size={20} color={theme.colors.muted} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Confirmation popup */}
      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowConfirm(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: theme.colors.surface }]} onPress={() => {}}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowConfirm(false)}
              accessibilityRole="button"
            >
              <Feather name="x" size={22} color={theme.colors.muted} />
            </TouchableOpacity>

            {/* Green hand image */}
            <Image source={greenHand} style={styles.handImage} resizeMode="contain" />

            {/* Text */}
            <Typography variant="h1" style={{ color: theme.colors.text, textAlign: 'center' }}>
              We'll miss you.
            </Typography>
            <Typography variant="body" style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 8 }}>
              You can still chat with your current matches, but your profile won't be shown to any others.
            </Typography>

            {/* Buttons */}
            <View style={styles.modalButtons}>
              {/* Pause account - green pill */}
              <TouchableOpacity
                style={[styles.pauseButton, { backgroundColor: theme.colors.neonGreen }]}
                onPress={handlePause}
                disabled={pausing || deleting}
                activeOpacity={0.85}
              >
                {pausing ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Typography variant="bodyStrong" style={{ color: '#000', textAlign: 'center' }}>
                    Pause account
                  </Typography>
                )}
              </TouchableOpacity>

              {/* Delete account - outlined pill */}
              <TouchableOpacity
                style={[styles.deleteButton, { borderColor: theme.colors.muted }]}
                onPress={handleDelete}
                disabled={pausing || deleting}
                activeOpacity={0.85}
              >
                {deleting ? (
                  <ActivityIndicator color={theme.colors.text} size="small" />
                ) : (
                  <Typography variant="bodyStrong" style={{ color: theme.colors.text, textAlign: 'center' }}>
                    Delete account
                  </Typography>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 8,
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 28,
    alignItems: 'center',
  },
  modalClose: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  handImage: {
    width: 100,
    height: 100,
    marginTop: 4,
    marginBottom: 16,
  },
  modalButtons: {
    width: '100%',
    gap: 12,
    marginTop: 24,
  },
  pauseButton: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
