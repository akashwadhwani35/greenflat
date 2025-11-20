import React, { useMemo, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View, ActivityIndicator } from 'react-native';
import { useFonts, RedHatDisplay_400Regular, RedHatDisplay_500Medium, RedHatDisplay_600SemiBold, RedHatDisplay_700Bold } from '@expo-google-fonts/red-hat-display';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { GreenflagThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PostOnboardingScreen } from './src/screens/PostOnboardingScreen';
import { MatchboardScreen, MatchCandidate } from './src/screens/MatchboardScreen';
import { ProfileDetailScreen } from './src/screens/ProfileDetailScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { Typography } from './src/components/Typography';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:9000/api';

type Stage = 'welcome' | 'onboarding' | 'postOnboarding' | 'matchboard';

type OnboardingResult = {
  token: string;
  name: string;
};

const AppShell: React.FC = () => {
  const theme = useTheme();
  const [stage, setStage] = useState<Stage>('welcome');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [selectedMatch, setSelectedMatch] = useState<MatchCandidate | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  const handleOnboardingComplete = (payload: OnboardingResult) => {
    setAuthToken(payload.token);
    setUserName(payload.name);
    setStage('postOnboarding');
  };

  const handlePostOnboardingComplete = () => {
    setStage('matchboard');
  };

  const handleCardPress = (match: MatchCandidate) => {
    setSelectedMatch(match);
    setShowProfileModal(true);
  };

  const handleCloseProfile = () => {
    setShowProfileModal(false);
    setTimeout(() => setSelectedMatch(null), 300);
  };

  const handleSwipeLeft = () => {
    console.log('Passed on:', selectedMatch?.name);
    handleCloseProfile();
  };

  const handleSwipeRight = () => {
    console.log('Liked:', selectedMatch?.name);
    // For now, just close. In future: check if mutual match, then show messages
    handleCloseProfile();
    // Simulate mutual match for demo
    setTimeout(() => {
      setShowMessages(true);
    }, 500);
  };

  const renderStage = () => {
    switch (stage) {
      case 'welcome':
        return <WelcomeScreen onStart={() => setStage('onboarding')} />;
      case 'onboarding':
        return <OnboardingScreen onComplete={handleOnboardingComplete} apiBaseUrl={API_BASE_URL} />;
      case 'postOnboarding':
        return <PostOnboardingScreen onComplete={handlePostOnboardingComplete} />;
      case 'matchboard':
        if (!authToken) {
          setStage('welcome');
          return null;
        }
        return (
          <>
            <MatchboardScreen
              token={authToken}
              name={userName || 'friend'}
              apiBaseUrl={API_BASE_URL}
              onCardPress={handleCardPress}
            />
            <ProfileDetailScreen
              match={selectedMatch}
              visible={showProfileModal}
              onClose={handleCloseProfile}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {showMessages && selectedMatch ? (
        <MessagesScreen
          matchName={selectedMatch.name}
          onBack={() => setShowMessages(false)}
        />
      ) : (
        renderStage()
      )}
    </View>
  );
};

export default function App() {
  const [fontsLoaded] = useFonts({
    RedHatDisplay_400Regular,
    RedHatDisplay_500Medium,
    RedHatDisplay_600SemiBold,
    RedHatDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3BB273" />
      </View>
    );
  }

  return (
    <GreenflagThemeProvider>
      <AppShell />
    </GreenflagThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
});
