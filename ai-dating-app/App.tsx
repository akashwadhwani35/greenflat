import React, { useMemo, useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert } from 'react-native';
import { useFonts, RedHatDisplay_400Regular, RedHatDisplay_500Medium, RedHatDisplay_600SemiBold, RedHatDisplay_700Bold } from '@expo-google-fonts/red-hat-display';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { GreenflagThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PostOnboardingScreen } from './src/screens/PostOnboardingScreen';
import { MatchboardScreen, MatchCandidate } from './src/screens/MatchboardScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { ProfileDetailScreen } from './src/screens/ProfileDetailScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { Typography } from './src/components/Typography';
import { BottomNav, TabId } from './src/components/BottomNav';
import { MatchModal } from './src/components/MatchModal';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { WalletScreen } from './src/screens/WalletScreen';
import { LikesInboxScreen } from './src/screens/LikesInboxScreen';
import { MatchesListScreen } from './src/screens/MatchesListScreen';
import { ConversationsScreen } from './src/screens/ConversationsScreen';
import { AdvancedSearchScreen, AdvancedFilters } from './src/screens/AdvancedSearchScreen';
import { ProfileEditScreen } from './src/screens/ProfileEditScreen';
import { PhotoManagerScreen } from './src/screens/PhotoManagerScreen';
import { VerificationScreen } from './src/screens/VerificationScreen';
import { PrivacySafetyScreen } from './src/screens/PrivacySafetyScreen';
import { HelpCenterScreen } from './src/screens/HelpCenterScreen';
import { TermsScreen } from './src/screens/TermsScreen';
import { CheckoutScreen } from './src/screens/CheckoutScreen';
import { ProfileOverviewScreen } from './src/screens/ProfileOverviewScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AISearchScreen } from './src/screens/AISearchScreen';
import { clearSession, loadSession, saveSession } from './src/utils/session';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://greenflag-api-480247350372.us-central1.run.app/api';
const DEMO_EMAIL = process.env.EXPO_PUBLIC_DEMO_EMAIL ?? 'emma.johnson@example.com';
const DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD ?? 'Passw0rd!';

type Stage = 'welcome' | 'login' | 'onboarding' | 'postOnboarding' | 'matchboard';
type Overlay =
  | null
  | 'settings'
  | 'notifications'
  | 'wallet'
  | 'likes'
  | 'matches'
  | 'conversations'
  | 'advancedSearch'
  | 'aiSearch'
  | 'profileEdit'
  | 'photos'
  | 'verification'
  | 'privacySafety'
  | 'helpCenter'
  | 'terms'
  | 'checkout'
  | 'profileOverview'
  | 'profile';

type OnboardingResult = {
  token: string;
  name: string;
};

const AppShell: React.FC = () => {
  const theme = useTheme();
  const [stage, setStage] = useState<Stage>('welcome');
  const [booting, setBooting] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<number | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchCandidate | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [currentConversation, setCurrentConversation] = useState<{ matchId: number; matchName: string; matchPhoto?: string } | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState<{ id: number; name: string; photo?: string } | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('aiSearch');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({});
  const [activeTab, setActiveTab] = useState<TabId>('ai');
  const [preferredDiscoverTab, setPreferredDiscoverTab] = useState<'onGrid' | 'offGrid'>('onGrid');

  // Register for push notifications
  usePushNotifications(authToken, API_BASE_URL);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const session = await loadSession();
        if (session?.token) {
          setAuthToken(session.token);
          setUserName(session.user.name || '');
          setUserId(session.user.id || null);
          setStage('matchboard');
        }
      } finally {
        setBooting(false);
      }
    };
    bootstrap().catch(() => setBooting(false));
  }, []);

  const persistAuth = async (token: string, user: { id: number; name: string }) => {
    setAuthToken(token);
    setUserName(user.name || 'friend');
    setUserId(user.id);
    await saveSession({ token, user });
  };

  const logout = async () => {
    await clearSession();
    setAuthToken(null);
    setUserId(null);
    setUserName('');
    setOverlay('aiSearch');
    setActiveTab('ai');
    setPreferredDiscoverTab('onGrid');
    setStage('welcome');
  };

  const handleOnboardingComplete = (payload: OnboardingResult & { userId?: number }) => {
    if (payload.userId) {
      void persistAuth(payload.token, { id: payload.userId, name: payload.name });
    } else {
      setAuthToken(payload.token);
      setUserName(payload.name);
    }
    setStage('postOnboarding');
  };

  const handlePostOnboardingComplete = () => {
    setStage('matchboard');
  };

  const handleDemoLogin = async () => {
    try {
      const login = async () => {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Demo login failed');
        }
        return data;
      };

      let data;

      try {
        data = await login();
      } catch (loginError: any) {
        // Attempt to create the demo user if it doesn't exist yet
        const signupResponse = await fetch(`${API_BASE_URL}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
            name: 'Emma Johnson',
            gender: 'female',
            interested_in: 'male',
            date_of_birth: '1995-01-01',
            city: 'New York',
          }),
        });

        if (!signupResponse.ok) {
          const signupBody = await signupResponse.json().catch(() => ({}));
          throw new Error(signupBody.error || loginError.message || 'Demo login failed');
        }

        data = await login();
      }

      if (data.user?.id) {
        await persistAuth(data.token, { id: data.user.id, name: data.user?.name || 'friend' });
      } else {
        setAuthToken(data.token);
        setUserName(data.user?.name || 'friend');
        setUserId(data.user?.id || null);
      }
      setStage('postOnboarding');
    } catch (error: any) {
      Alert.alert('Demo login failed', error.message || 'Please check demo credentials');
    }
  };

  const handleCardPress = (match: MatchCandidate) => {
    setSelectedMatch(match);
    setShowProfileModal(true);
  };

  const handleCloseProfile = (preserveSelection = false) => {
    setShowProfileModal(false);
    if (!preserveSelection) {
      setTimeout(() => setSelectedMatch(null), 300);
    }
  };

  const handleSwipeLeft = () => {
    console.log('Passed on:', selectedMatch?.name);
    handleCloseProfile();
  };

  const handleSwipeRight = async () => {
    if (!selectedMatch) return;
    if (!authToken) {
      Alert.alert('Sign in required', 'Please restart onboarding to continue.');
      setStage('welcome');
      return;
    }

    handleCloseProfile(true);

    try {
      const response = await fetch(`${API_BASE_URL}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ target_user_id: selectedMatch.id, is_on_grid: true }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Unable to like profile right now.');
      }

      const data = await response.json();
      if (data.is_match && data.match_id) {
        // Show match modal
        setMatchedUser({
          id: data.match_id,
          name: selectedMatch.name,
          photo: selectedMatch.primary_photo,
        });
        setShowMatchModal(true);
      } else {
        Alert.alert('Liked! 💚', `${selectedMatch.name} will be notified. We'll let you know if it's a match!`);
        setTimeout(() => setSelectedMatch(null), 300);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to process like.');
      setTimeout(() => setSelectedMatch(null), 300);
    }
  };

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    // Close any open overlays when switching tabs
    if (overlay) {
      setOverlay(null);
    }

    // Map tabs to appropriate actions
    switch (tab) {
      case 'explore':
        // Already on main matchboard, no action needed
        break;
      case 'likes':
        setOverlay('likes');
        break;
      case 'ai':
        setOverlay('aiSearch');
        break;
      case 'messages':
        setOverlay('conversations');
        break;
      case 'profile':
        setOverlay('profile');
        break;
    }
  };

  const renderOverlay = () => {
    if (!overlay) return null;

    const overlayProps = {
      onBack: () => {
        setOverlay(null);
        setActiveTab('explore');
      },
    };

    switch (overlay) {
      case 'settings':
        return (
          <SettingsScreen
            {...overlayProps}
            onOpenProfileEdit={() => setOverlay('profileEdit')}
            onOpenPhotos={() => setOverlay('photos')}
            onOpenVerification={() => setOverlay('verification')}
            onOpenPrivacy={() => setOverlay('privacySafety')}
            onOpenNotifications={() => setOverlay('notifications')}
            onOpenHelp={() => setOverlay('helpCenter')}
            onOpenTerms={() => setOverlay('terms')}
            onOpenCheckout={() => setOverlay('checkout')}
            onOpenProfile={() => setOverlay('profileOverview')}
            onOpenLikesInbox={() => setOverlay('likes')}
            onOpenMatches={() => setOverlay('matches')}
            onOpenConversations={() => setOverlay('conversations')}
            onOpenAISearch={() => setOverlay('aiSearch')}
            onOpenAdvancedSearch={() => setOverlay('advancedSearch')}
            onOpenWallet={() => setOverlay('wallet')}
            onLogout={logout}
          />
        );
      case 'notifications':
        return <NotificationsScreen {...overlayProps} />;
      case 'wallet':
        return <WalletScreen {...overlayProps} onOpenCheckout={() => setOverlay('checkout')} />;
      case 'likes':
        return <LikesInboxScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} />;
      case 'matches':
        return <MatchesListScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} />;
      case 'conversations':
        return (
          <ConversationsScreen
            {...overlayProps}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            currentUserId={userId!}
            onOpenConversation={(matchId, matchName) => {
              setCurrentConversation({ matchId, matchName });
              setShowMessages(true);
              setOverlay(null);
            }}
          />
        );
      case 'advancedSearch':
        return (
          <AdvancedSearchScreen
            {...overlayProps}
            initialFilters={advancedFilters}
            onApply={(filters) => {
              setAdvancedFilters(filters);
              setOverlay(null);
            }}
          />
        );
      case 'aiSearch':
        return (
          <AISearchScreen
            {...overlayProps}
            onApplySearchQuery={(query) => {
              setAdvancedFilters((prev) => ({ ...prev, keywords: query }));
              setPreferredDiscoverTab('onGrid');
              setOverlay(null);
              setActiveTab('explore');
            }}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            userName={userName}
            userProfile={{
              relationshipGoal: 'a long-term relationship',
            }}
          />
        );
      case 'profileEdit':
        return <ProfileEditScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} onOpenPhotos={() => setOverlay('photos')} />;
      case 'photos':
        return <PhotoManagerScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} />;
      case 'verification':
        return <VerificationScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} />;
      case 'privacySafety':
        return <PrivacySafetyScreen {...overlayProps} />;
      case 'helpCenter':
        return <HelpCenterScreen {...overlayProps} onOpenTerms={() => setOverlay('terms')} />;
      case 'terms':
        return <TermsScreen {...overlayProps} />;
      case 'checkout':
        return <CheckoutScreen {...overlayProps} />;
      case 'profileOverview':
        return (
          <ProfileOverviewScreen
            {...overlayProps}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            onEditProfile={() => setOverlay('profileEdit')}
            onManagePhotos={() => setOverlay('photos')}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            onBack={() => {
              setOverlay(null);
              setActiveTab('explore');
            }}
            onOpenSettings={() => setOverlay('settings')}
            onEditProfile={() => setOverlay('profileEdit')}
            onManagePhotos={() => setOverlay('photos')}
            onOpenCheckout={() => setOverlay('checkout')}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
          />
        );
      default:
        return null;
    }
  };

  const renderStage = () => {
    if (booting) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.neonGreen} />
        </View>
      );
    }
    switch (stage) {
      case 'welcome':
        return <WelcomeScreen onStart={() => setStage('onboarding')} onLogin={() => setStage('login')} onDemoLogin={handleDemoLogin} />;
      case 'login':
        return (
          <LoginScreen
            apiBaseUrl={API_BASE_URL}
            onBack={() => setStage('welcome')}
            onSuccess={async ({ token, user }) => {
              await persistAuth(token, user);
              setStage('matchboard');
            }}
          />
        );
      case 'onboarding':
        return <OnboardingScreen onComplete={handleOnboardingComplete} apiBaseUrl={API_BASE_URL} />;
      case 'postOnboarding':
        return <PostOnboardingScreen onComplete={handlePostOnboardingComplete} />;
      case 'matchboard':
        if (!authToken) {
          setStage('welcome');
          return null;
        }

        // Render main content based on overlay state
        const mainContent = overlay ? (
          renderOverlay()
        ) : (
          <>
            <ExploreScreen
              token={authToken}
              name={userName || 'friend'}
              apiBaseUrl={API_BASE_URL}
              onCardPress={handleCardPress}
              onOpenSettings={() => setOverlay('settings')}
              onOpenNotifications={() => setOverlay('notifications')}
              onOpenWallet={() => setOverlay('wallet')}
              onOpenLikesInbox={() => setOverlay('likes')}
              onOpenMatches={() => setOverlay('matches')}
              onOpenConversations={() => setOverlay('conversations')}
              onOpenAdvancedSearch={() => setOverlay('advancedSearch')}
              filters={advancedFilters}
              preferredTab={preferredDiscoverTab}
            />
            <ProfileDetailScreen
              match={selectedMatch}
              visible={showProfileModal}
              onClose={handleCloseProfile}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
            />

            {/* Match Modal */}
            {matchedUser && (
              <MatchModal
                visible={showMatchModal}
                matchName={matchedUser.name}
                matchPhoto={matchedUser.photo}
                onClose={() => {
                  setShowMatchModal(false);
                  setMatchedUser(null);
                  setSelectedMatch(null);
                }}
                onSendMessage={() => {
                  setShowMatchModal(false);
                  setCurrentConversation({
                    matchId: matchedUser.id,
                    matchName: matchedUser.name,
                    matchPhoto: matchedUser.photo,
                  });
                  setShowMessages(true);
                }}
                onKeepSwiping={() => {
                  setShowMatchModal(false);
                  setMatchedUser(null);
                  setSelectedMatch(null);
                }}
              />
            )}

          </>
        );

        return (
          <View style={{ flex: 1 }}>
            {mainContent}
            {/* Messages Screen - Full screen overlay */}
            {showMessages && currentConversation && userId && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
                <MessagesScreen
                  matchId={currentConversation.matchId}
                  matchName={currentConversation.matchName}
                  currentUserId={userId}
                  token={authToken}
                  apiBaseUrl={API_BASE_URL}
                  onBack={() => {
                    setShowMessages(false);
                    setCurrentConversation(null);
                  }}
                />
              </View>
            )}
            {!showMessages && (
              <BottomNav
                activeTab={activeTab}
                onTabChange={handleTabChange}
                likesCount={0}
                messagesCount={0}
              />
            )}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderStage()}
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
    backgroundColor: '#101D13',
  },
});
