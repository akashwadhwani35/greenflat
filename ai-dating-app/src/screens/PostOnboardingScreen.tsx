import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, StatusBar, StyleSheet, TouchableOpacity, View, Animated, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../components/Button';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PixelFlag } from '../components/PixelFlag';

const { width, height } = Dimensions.get('window');

type PostOnboardingScreenProps = {
  onComplete: () => void;
};

// AI-powered flag component with animations
const AIFlagIcon: React.FC<{ color: string; animate?: boolean }> = ({ color, animate = true }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animate) {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [animate]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <Animated.View
      style={[
        styles.flagContainer,
        {
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      {/* Glow effect */}
      <Animated.View
        style={[
          styles.flagGlow,
          {
            backgroundColor: color,
            opacity: glowOpacity,
          },
        ]}
      />

      {/* Flag icon using SVG */}
      <View style={[styles.flagIcon, { backgroundColor: color }]}>
        <PixelFlag size={55} color="#000000" />
        {/* AI spark indicator */}
        <View style={styles.aiSparkContainer}>
          <Feather name="zap" size={24} color="#000" />
        </View>
      </View>
    </Animated.View>
  );
};

const slides = [
  {
    key: 'ai-matching',
    title: 'AI That Actually Understands You',
    description: 'Our AI analyzes personality, values, and communication style—not just photos. We find people who truly get you.',
    highlight: 'Real compatibility, not just attraction',
  },
  {
    key: 'smart-search',
    title: 'Search Like You Think',
    description: 'Type "emotionally intelligent" or "loves deep conversations". Our AI finds matches based on what actually matters.',
    highlight: 'No more endless swiping',
  },
  {
    key: 'green-flags',
    title: 'We Spot the Green Flags',
    description: 'Our AI identifies positive traits and healthy relationship patterns. We help you find someone who\'s genuinely good for you.',
    highlight: 'AI-powered red flag detection',
  },
  {
    key: 'smarter-matching',
    title: 'Gets Smarter Over Time',
    description: 'The more you interact, the better we understand your preferences. Our AI learns what makes a great match for you.',
    highlight: 'Personalized just for you',
  },
];

export const PostOnboardingScreen: React.FC<PostOnboardingScreenProps> = ({ onComplete }) => {
  const theme = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollViewRef.current?.scrollTo({ x: width * nextIndex, animated: true });
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    if (index !== currentIndex && index >= 0 && index < slides.length) {
      setCurrentIndex(index);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.deepBlack }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background gradient */}
      <LinearGradient
        colors={[theme.colors.deepBlack, theme.colors.darkBlack, theme.colors.charcoal]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Skip button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
        <Typography variant="body" style={{ color: theme.colors.muted }}>
          Skip
        </Typography>
      </TouchableOpacity>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {slides.map((slide, index) => (
          <View key={slide.key} style={[styles.slide, { width }]}>
            <View style={styles.slideContent}>
              {/* AI Flag Icon */}
              <View style={styles.iconSection}>
                <AIFlagIcon color={theme.colors.neonGreen} />
              </View>

              {/* Title */}
              <Typography variant="display" style={[styles.title, { color: theme.colors.text }]}>
                {slide.title}
              </Typography>

              {/* Description */}
              <Typography variant="body" style={[styles.description, { color: theme.colors.muted }]}>
                {slide.description}
              </Typography>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Progress dots */}
      <View style={styles.progressDots}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index === currentIndex ? theme.colors.neonGreen : theme.colors.border,
                width: index === currentIndex ? 32 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Continue button */}
      <View style={styles.footer}>
        <Button
          label={currentIndex === slides.length - 1 ? "Let's find your match" : 'Continue'}
          onPress={handleNext}
          fullWidth
        />
      </View>
    </View>
  );
};

const FeatureBullet: React.FC<{ text: string; theme: any }> = ({ text, theme }) => (
  <View style={styles.featureBullet}>
    <Feather name="check" size={16} color={theme.colors.neonGreen} />
    <Typography variant="small" style={{ color: theme.colors.textDark, marginLeft: 12 }}>
      {text}
    </Typography>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 60,
    right: 24,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  slideContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  flagContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  flagGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -30,
    left: -30,
    shadowColor: '#ADFF1A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  },
  flagIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ADFF1A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  aiSparkContainer: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#ADFF1A',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ADFF1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 44,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 16,
  },
  highlightBox: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    marginBottom: 32,
  },
  highlightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  highlightDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowColor: '#ADFF1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  featuresContainer: {
    gap: 16,
  },
  featureBullet: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
});
