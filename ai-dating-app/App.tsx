import React, { useMemo, useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert, Text, TextInput } from 'react-native';
import { useFonts, RedHatDisplay_400Regular, RedHatDisplay_500Medium, RedHatDisplay_600SemiBold, RedHatDisplay_700Bold } from '@expo-google-fonts/red-hat-display';
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
import { clearSession, loadFirstSearchDone, loadSession, saveFirstSearchDone, saveSession } from './src/utils/session';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://greenflag-api-480247350372.us-central1.run.app/api';

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
  const [currentConversation, setCurrentConversation] = useState<{ matchId: number; matchName: string; matchPhoto?: string; targetUserId?: number } | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState<{ matchId: number; userId: number; name: string; photo?: string } | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('aiSearch');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({});
  const [activeTab, setActiveTab] = useState<TabId>('ai');
  const [preferredDiscoverTab, setPreferredDiscoverTab] = useState<'onGrid' | 'offGrid'>('onGrid');
  const [hasCompletedFirstSearch, setHasCompletedFirstSearch] = useState(false);
  const [pendingAISearchCharge, setPendingAISearchCharge] = useState(false);

  const applyEntryPointForUser = async (id: number) => {
    const firstSearchDone = await loadFirstSearchDone(id);
    setHasCompletedFirstSearch(firstSearchDone);
    if (firstSearchDone) {
      setOverlay(null);
      setActiveTab('explore');
      return;
    }
    setOverlay('aiSearch');
    setActiveTab('ai');
  };

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
          if (session.user.id) {
            await applyEntryPointForUser(session.user.id);
          }
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
    await applyEntryPointForUser(user.id);
  };

  const logout = async () => {
    if (authToken) {
      try {
        await fetch(`${API_BASE_URL}/push/unregister`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch {
        // Best-effort only.
      }
    }
    await clearSession();
    setAuthToken(null);
    setUserId(null);
    setUserName('');
    setHasCompletedFirstSearch(false);
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
        body: JSON.stringify({ target_user_id: selectedMatch.id, is_on_grid: selectedMatch.is_on_grid ?? true }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Unable to like profile right now.');
      }

      const data = await response.json();
      if (data.is_match && data.match_id) {
        // Show match modal
        setMatchedUser({
          matchId: data.match_id,
          userId: selectedMatch.id,
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

  const handleSendCompliment = async (targetUserId: number, content: string) => {
    if (!authToken) {
      Alert.alert('Sign in required', 'Please restart onboarding to continue.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/likes/compliment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          target_user_id: targetUserId,
          content,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || 'Unable to send compliment.');
      }

      Alert.alert('Compliment sent', 'Delivered to their Likes inbox. 5 credits used.');
    } catch (error: any) {
      Alert.alert('Could not send compliment', error.message || 'Please try again.');
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
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            onAccountDeleted={logout}
          />
        );
      case 'notifications':
        return <NotificationsScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} />;
      case 'wallet':
        return <WalletScreen {...overlayProps} onOpenCheckout={() => setOverlay('checkout')} token={authToken!} apiBaseUrl={API_BASE_URL} />;
      case 'likes':
        return (
          <LikesInboxScreen
            {...overlayProps}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            onViewProfile={(user) => {
              setSelectedMatch({
                id: user.id,
                name: user.name,
                age: user.age || undefined,
                city: user.city || '',
                match_percentage: 0,
                primary_photo: user.primary_photo,
                is_verified: user.is_verified,
                is_on_grid: true,
              });
              setOverlay(null);
              setShowProfileModal(true);
            }}
          />
        );
      case 'matches':
        return (
          <MatchesListScreen
            {...overlayProps}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            onOpenConversation={(matchId, matchName, targetUserId) => {
              setCurrentConversation({ matchId, matchName, targetUserId });
              setShowMessages(true);
              setOverlay(null);
            }}
          />
        );
      case 'conversations':
        return (
          <ConversationsScreen
            {...overlayProps}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            currentUserId={userId!}
            onOpenConversation={(matchId, matchName, targetUserId) => {
              setCurrentConversation({ matchId, matchName, targetUserId });
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
        // AISearchScreen is rendered separately to persist state - return null here
        return null;
      case 'profileEdit':
        return <ProfileEditScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} onOpenPhotos={() => setOverlay('photos')} />;
      case 'photos':
        return <PhotoManagerScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} />;
      case 'verification':
        return <VerificationScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} />;
      case 'privacySafety':
        return <PrivacySafetyScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} />;
      case 'helpCenter':
        return <HelpCenterScreen {...overlayProps} onOpenTerms={() => setOverlay('terms')} />;
      case 'terms':
        return <TermsScreen {...overlayProps} />;
      case 'checkout':
        return <CheckoutScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} onPurchased={() => setOverlay('wallet')} />;
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
        return <WelcomeScreen onStart={() => setStage('onboarding')} onLogin={() => setStage('login')} />;
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
        return <OnboardingScreen onComplete={handleOnboardingComplete} onBack={() => setStage('welcome')} apiBaseUrl={API_BASE_URL} />;
      case 'postOnboarding':
        return <PostOnboardingScreen onComplete={handlePostOnboardingComplete} />;
      case 'matchboard':
        if (!authToken) return null;

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
              pendingAISearchCharge={pendingAISearchCharge}
              onConsumeAISearchCharge={() => setPendingAISearchCharge(false)}
            />
            <ProfileDetailScreen
              match={selectedMatch}
              visible={showProfileModal}
              onClose={handleCloseProfile}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              onSendCompliment={handleSendCompliment}
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
                    matchId: matchedUser.matchId,
                    matchName: matchedUser.name,
                    matchPhoto: matchedUser.photo,
                    targetUserId: matchedUser.userId,
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
            {/* AISearchScreen - Always mounted to preserve chat state */}
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: overlay === 'aiSearch' ? 50 : -1,
              opacity: overlay === 'aiSearch' ? 1 : 0,
              pointerEvents: overlay === 'aiSearch' ? 'auto' : 'none',
            }}>
              <AISearchScreen
                onBack={() => {
                  setOverlay(null);
                  setActiveTab('explore');
                }}
                onApplySearchQuery={(query) => {
                  setAdvancedFilters((prev) => ({ ...prev, keywords: query }));
                  setPendingAISearchCharge(true);
                  setPreferredDiscoverTab('onGrid');
                  if (userId && !hasCompletedFirstSearch) {
                    setHasCompletedFirstSearch(true);
                    void saveFirstSearchDone(userId);
                  }
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
            </View>
            {/* Messages Screen - Full screen overlay */}
            {showMessages && currentConversation && userId && (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
                <MessagesScreen
                  matchId={currentConversation.matchId}
                  matchName={currentConversation.matchName}
                  targetUserId={currentConversation.targetUserId}
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
  });

  useEffect(() => {
    const TextAny = Text as any;
    const TextInputAny = TextInput as any;
    const textDefaults = (TextAny.defaultProps || {}) as any;
    const inputDefaults = (TextInputAny.defaultProps || {}) as any;

    TextAny.defaultProps = {
      ...textDefaults,
      style: [{ fontFamily: 'RedHatDisplay_400Regular' }, textDefaults.style].filter(Boolean),
    };
    TextInputAny.defaultProps = {
      ...inputDefaults,
      style: [{ fontFamily: 'RedHatDisplay_400Regular' }, inputDefaults.style].filter(Boolean),
    };
  }, []);

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
