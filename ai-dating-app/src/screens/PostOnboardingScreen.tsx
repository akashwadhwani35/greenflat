import React, { useRef, useState } from 'react';
import { Dimensions, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

const { width } = Dimensions.get('window');

type PostOnboardingScreenProps = {
  onComplete: () => void;
};

const slides = [
  {
    icon: 'heart',
    title: 'Find Matches That Actually Get You',
    description: 'Our AI analyzes personality, values, and communication style to find people who truly align with you — not just swipe-worthy photos.',
  },
  {
    icon: 'search',
    title: 'Search How You Actually Think',
    description: 'Type traits and values like "loves deep conversations" or "values emotional intelligence". GreenFlag finds matches based on what really matters.',
    example: 'Try: "mindful", "adventurous", "kind"',
  },
  {
    icon: 'arrow-right-circle',
    title: 'See Someone You Like?',
    description: 'Swipe right if you\'re interested, left to pass. When it\'s mutual, start a conversation with our AI-suggested openers.',
  },
  {
    icon: 'star',
    title: 'The More You Share, The Better',
    description: 'Add details to your profile so our AI can find more compatible matches. Better profile = Better connections.',
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="dark-content" />

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
        contentContainerStyle={styles.scrollContent}
      >
        {slides.map((slide, index) => (
          <View key={index} style={[styles.slide, { width }]}>
            <View style={styles.slideContent}>
              {/* Icon */}
              <View style={[styles.iconCircle, { backgroundColor: theme.colors.successTint }]}>
                <Feather name={slide.icon as any} size={48} color={theme.colors.brand} />
              </View>

              {/* Title */}
              <Typography variant="display" align="center" style={styles.title}>
                {slide.title}
              </Typography>

              {/* Description */}
              <Typography variant="body" align="center" muted style={styles.description}>
                {slide.description}
              </Typography>

              {/* Example (if exists) */}
              {slide.example && (
                <View style={[styles.exampleBox, { backgroundColor: theme.colors.accentTint, borderColor: theme.colors.accent }]}>
                  <Typography variant="small" style={{ color: theme.colors.text }}>
                    {slide.example}
                  </Typography>
                </View>
              )}
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
                backgroundColor: index === currentIndex ? theme.colors.brand : theme.colors.border,
                width: index === currentIndex ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Continue button */}
      <View style={styles.footer}>
        <Button
          label={currentIndex === slides.length - 1 ? "Start exploring" : "Continue"}
          onPress={handleNext}
          fullWidth
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 50,
    right: 24,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  slideContent: {
    alignItems: 'center',
    gap: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    paddingHorizontal: 16,
  },
  description: {
    paddingHorizontal: 8,
    lineHeight: 26,
  },
  exampleBox: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    transition: 'all 0.3s ease',
  },
  footer: {
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
});
