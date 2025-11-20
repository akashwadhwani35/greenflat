import React, { useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, StyleSheet, View, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

const { width, height } = Dimensions.get('screen'); // Use 'screen' instead of 'window' for full screen

type WelcomeScreenProps = {
  onStart: () => void;
};

// Background images
const backgroundImages = [
  require('../../assets/welcome-bg-1.jpg'),
  require('../../assets/welcome-bg-2.jpg'),
  require('../../assets/welcome-bg-3.jpg'),
  require('../../assets/welcome-bg-4.jpg'),
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  const theme = useTheme();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [nextImageIndex, setNextImageIndex] = useState(1);
  const imageOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Ultra smooth Ken Burns-style crossfade every 6 seconds
    const interval = setInterval(() => {
      // Smooth fade out current image
      Animated.timing(imageOpacity, {
        toValue: 0,
        duration: 2000, // Longer, smoother transition
        useNativeDriver: true,
        isInteraction: false,
      }).start(() => {
        // Switch images
        setCurrentImageIndex(nextImageIndex);
        setNextImageIndex((nextImageIndex + 1) % backgroundImages.length);

        // Smooth fade in new image
        Animated.timing(imageOpacity, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
          isInteraction: false,
        }).start();
      });
    }, 6000);

    return () => clearInterval(interval);
  }, [nextImageIndex]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Current image with animated opacity for smooth transitions */}
      <Animated.View style={[styles.imageContainer, { opacity: imageOpacity }]}>
        <ImageBackground
          source={backgroundImages[currentImageIndex]}
          style={styles.backgroundImage}
          resizeMode="cover"
          blurRadius={0}
        >
          <View style={styles.grayscaleOverlay} />
        </ImageBackground>
      </Animated.View>

      {/* Next image underneath for smooth crossfade */}
      <View style={styles.imageContainer}>
        <ImageBackground
          source={backgroundImages[nextImageIndex]}
          style={styles.backgroundImage}
          resizeMode="cover"
          blurRadius={0}
        >
          <View style={styles.grayscaleOverlay} />
        </ImageBackground>
      </View>

      {/* Gradient overlay for text legibility */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.75)']}
        style={styles.gradientOverlay}
      />

      <View style={styles.content}>
        {/* Header - Minimal */}
        <View style={styles.header}>
          <Typography variant="h2" style={styles.logo}>
            Greenflag
          </Typography>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Typography variant="display" style={styles.headline}>
            Find Someone Who Gets You
          </Typography>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onStart}
              activeOpacity={0.85}
            >
              <Typography variant="bodyStrong" style={styles.buttonText}>
                Start your journey
              </Typography>
            </TouchableOpacity>

            <Typography variant="tiny" style={styles.legal}>
              By continuing, you agree to our Terms & Privacy Policy
            </Typography>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  grayscaleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 50 : 70,
    paddingBottom: 55,
    paddingHorizontal: 28,
  },
  header: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 22,
    lineHeight: 28,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.95,
  },
  footer: {
    gap: 36,
  },
  headline: {
    fontSize: 44,
    lineHeight: 52,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 16,
    fontWeight: '300',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    letterSpacing: -1,
  },
  actions: {
    gap: 20,
  },
  primaryButton: {
    backgroundColor: '#3BB273',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 36,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  legal: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
