import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography } from './Typography';
import { Button } from './Button';
import { useTheme } from '../theme/ThemeProvider';

const { width, height } = Dimensions.get('window');

type MatchModalProps = {
  visible: boolean;
  matchName: string;
  matchPhoto?: string;
  onClose: () => void;
  onSendMessage: () => void;
  onKeepSwiping: () => void;
};

export const MatchModal: React.FC<MatchModalProps> = ({
  visible,
  matchName,
  matchPhoto,
  onClose,
  onSendMessage,
  onKeepSwiping,
}) => {
  const theme = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      confettiAnim.setValue(0);

      // Trigger animations
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(confettiAnim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(confettiAnim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={['rgba(16, 29, 19, 0.8)', 'rgba(16, 29, 19, 0.95)', '#101D13']}
          style={styles.gradientBackground}
        />

        {/* Confetti Effect */}
        <Animated.View
          style={[
            styles.confettiContainer,
            {
              opacity: confettiAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 0.5, 0],
              }),
              transform: [
                {
                  translateY: confettiAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, height * 0.6],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Simple confetti-like dots */}
          {[...Array(20)].map((_, index) => (
            <View
              key={index}
              style={[
                styles.confettiDot,
                {
                  left: `${(index * 5) % 100}%`,
                  backgroundColor:
                    index % 3 === 0
                      ? theme.colors.neonGreen
                      : index % 3 === 1
                      ? '#ADFF1A'
                      : '#FDE2C9',
                },
              ]}
            />
          ))}
        </Animated.View>

        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          {/* Match Animation Circle */}
          <View style={styles.matchCircle}>
            <View style={[styles.matchCircleInner, { backgroundColor: theme.colors.neonGreen }]}>
              <Feather name="heart" size={60} color={theme.colors.deepBlack} />
            </View>
          </View>

          {/* Match Photo */}
          {matchPhoto && (
            <View style={styles.photoContainer}>
              <Image source={{ uri: matchPhoto }} style={styles.photo} />
              <View style={[styles.photoGlow, { backgroundColor: theme.colors.neonGreen }]} />
            </View>
          )}

          {/* Match Text */}
          <View style={styles.textContainer}>
            <Typography
              variant="display"
              style={[styles.matchTitle, { color: theme.colors.neonGreen }]}
            >
              It's a Match!
            </Typography>
            <Typography
              variant="h2"
              style={[styles.matchSubtitle, { color: theme.colors.text }]}
            >
              You and {matchName} like each other
            </Typography>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              label={`Message ${matchName}`}
              onPress={onSendMessage}
              fullWidth
            />
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
              onPress={onKeepSwiping}
            >
              <Typography
                variant="bodyStrong"
                style={{ color: theme.colors.text }}
              >
                Keep Swiping
              </Typography>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
    zIndex: 1,
  },
  confettiDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  container: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: 'rgba(26, 26, 26, 0.98)',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(173, 255, 26, 0.2)',
    zIndex: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  matchCircle: {
    width: 140,
    height: 140,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchCircleInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ADFF1A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  photo: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 4,
    borderColor: '#ADFF1A',
  },
  photoGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.3,
    shadowColor: '#ADFF1A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
    elevation: 20,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  matchTitle: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1,
    textShadowColor: 'rgba(173, 255, 26, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  matchSubtitle: {
    textAlign: 'center',
    lineHeight: 28,
    paddingHorizontal: 20,
  },
  actions: {
    width: '100%',
    gap: 16,
  },
  secondaryButton: {
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 2,
  },
});
