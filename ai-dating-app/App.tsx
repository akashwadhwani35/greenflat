import React, { useMemo, useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert, Text, TextInput, Modal, Image, Pressable, BackHandler, AppState,
} from 'react-native';
import { useFonts, RedHatDisplay_400Regular, RedHatDisplay_500Medium, RedHatDisplay_600SemiBold, RedHatDisplay_700Bold } from '@expo-google-fonts/red-hat-display';
import { GreenflagThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { useSocket } from './src/hooks/useSocket';
import { useViewerProfile } from './src/hooks/useViewerProfile';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SignUpFlowScreen } from './src/screens/SignUpFlowScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PostOnboardingScreen } from './src/screens/PostOnboardingScreen';
import { MatchboardScreen, MatchCandidate } from './src/screens/MatchboardScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { ProfileDetailScreen } from './src/screens/ProfileDetailScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { Typography } from './src/components/Typography';
import { BottomNav, TabId } from './src/components/BottomNav';
import { NoticeModal, type Notice } from './src/components/NoticeModal';
import { MatchModal } from './src/components/MatchModal';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { WalletScreen } from './src/screens/WalletScreen';
import { LikesInboxScreen } from './src/screens/LikesInboxScreen';
import { BookmarksScreen } from './src/screens/BookmarksScreen';
import { MatchesListScreen } from './src/screens/MatchesListScreen';
import { ConversationsScreen } from './src/screens/ConversationsScreen';
import { AdvancedSearchScreen, AdvancedFilters } from './src/screens/AdvancedSearchScreen';
import { ProfileEditScreen } from './src/screens/ProfileEditScreen';
import { PhotoManagerScreen } from './src/screens/PhotoManagerScreen';
import { VerificationScreen } from './src/screens/VerificationScreen';
import { PrivacySafetyScreen } from './src/screens/PrivacySafetyScreen';
import { HelpCenterScreen } from './src/screens/HelpCenterScreen';
import { TermsScreen } from './src/screens/TermsScreen';
import { AdminDashboardScreen } from './src/screens/AdminDashboardScreen';
import { CheckoutScreen } from './src/screens/CheckoutScreen';
import { ProfileOverviewScreen } from './src/screens/ProfileOverviewScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { AISearchScreen } from './src/screens/AISearchScreen';
import { DeleteAccountScreen } from './src/screens/DeleteAccountScreen';
import { SubscriptionScreen } from './src/screens/SubscriptionScreen';
import { PausedBanner } from './src/components/PausedBanner';
import { clearSession, loadFirstSearchDone, loadSession, saveFirstSearchDone, saveSession, hasWelcomeBeenShown, markWelcomeShown, loadPassedIds, savePassedIds, loadSubscriptionNudgeShownAt, markSubscriptionNudgeShown } from './src/utils/session';
import { configurePurchases, logOutPurchases } from './src/services/purchases';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://greenflag-api-480247350372.us-central1.run.app/api';

type Stage = 'welcome' | 'signup' | 'login' | 'forgotPassword' | 'onboarding' | 'postOnboarding' | 'matchboard';
type Overlay =
  | null
  | 'settings'
  | 'notifications'
  | 'wallet'
  | 'likes'
  | 'bookmarks'
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
  | 'profile'
  | 'admin'
  | 'deleteAccount'
  | 'subscription';

type OnboardingResult = {
  token: string;
  name: string;
};

/**
 * Whether to send someone into onboarding rather than the app.
 *
 * `is_new_user` alone is not enough: accounts are created before a profile
 * exists now, so anyone who abandoned onboarding halfway is a returning user
 * with a placeholder name and city. The server reports what it actually knows
 * via `onboarding_completed`; the isNewUser fallback covers older API builds
 * that do not send the field.
 */
const needsOnboarding = (
  user: { onboarding_completed?: boolean },
  isNewUser?: boolean
): boolean => {
  if (typeof user.onboarding_completed === 'boolean') return !user.onboarding_completed;
  return Boolean(isNewUser);
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
  const [currentConversation, setCurrentConversation] = useState<{ matchId: number; matchName: string; matchPhoto?: string; targetUserId?: number; status?: 'active' | 'pending'; requestedBy?: number | null } | null>(null);
  // Numbers on the Likes and Chat tabs.
  const [badgeCounts, setBadgeCounts] = useState<{ likes: number; messages: number }>({ likes: 0, messages: 0 });
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState<{ matchId: number; userId: number; name: string; photo?: string } | null>(null);
  const [overlay, setOverlayState] = useState<Overlay>(null);
  // Overlay screens stack: Settings → Verification → Back should land on
  // Settings, not Home. Every open pushes the screen it covers; Back pops.
  // Setting null (tab change, apply, logout) clears the stack.
  const overlayRef = useRef<Overlay>(null);
  const overlayHistoryRef = useRef<Overlay[]>([]);
  const setOverlay = (next: Overlay) => {
    const current = overlayRef.current;
    if (next === null) {
      overlayHistoryRef.current = [];
    } else if (current && current !== next) {
      overlayHistoryRef.current.push(current);
    }
    overlayRef.current = next;
    setOverlayState(next);
  };
  // Swap the current screen without adding a Back step (e.g. checkout → wallet
  // after a purchase, where returning to checkout would make no sense).
  const replaceOverlay = (next: Overlay) => {
    overlayRef.current = next;
    setOverlayState(next);
  };
  const goBackOverlay = () => {
    const previous = overlayHistoryRef.current.pop() ?? null;
    overlayRef.current = previous;
    setOverlayState(previous);
    if (!previous) setActiveTab('explore');
  };
  // Remounts the Likes inbox after a like / reject from a card opened there,
  // so the answered card is gone when the person lands back on the list.
  const [likesRefreshKey, setLikesRefreshKey] = useState(0);
  const [subscriptionTab, setSubscriptionTab] = useState<'pro' | 'premium'>('pro');
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({});
  const [activeTab, setActiveTab] = useState<TabId>('explore');
  const [preferredDiscoverTab, setPreferredDiscoverTab] = useState<'onGrid' | 'offGrid'>('onGrid');
  const [hasCompletedFirstSearch, setHasCompletedFirstSearch] = useState(false);
  const [pendingAISearchCharge, setPendingAISearchCharge] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [aiSearchKey, setAiSearchKey] = useState(0);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  // Confirmation popup in the app's own style, replacing the OS alert for actions.
  const [notice, setNotice] = useState<Notice | null>(null);
  const [likedProfileIds, setLikedProfileIds] = useState<Set<number>>(new Set());
  // Rejected profiles disappear from the feed for this account (persisted per user id).
  const [passedProfileIds, setPassedProfileIds] = useState<Set<number>>(new Set());
  const [complimentedProfileIds, setComplimentedProfileIds] = useState<Set<number>>(new Set());
  // Opened from the Likes inbox: only Reject / Like are offered.
  const [profileRespondMode, setProfileRespondMode] = useState(false);
  // One like / Green Flag / compliment request at a time, whatever gets tapped.
  const actionInFlightRef = useRef(false);
  const [isProfilePaused, setIsProfilePaused] = useState(false);

  // Everything remembered about the previous account goes when the account
  // changes. Liked hearts from one login used to show up on the next.
  const resetPerAccountState = async (id: number | null) => {
    setLikedProfileIds(new Set());
    setComplimentedProfileIds(new Set());
    setPassedProfileIds(new Set(id ? await loadPassedIds(id) : []));
  };

  // The welcome popup is shown once, after the intro slides that follow
  // onboarding, not on top of the first onboarding step.
  const maybeShowWelcome = async (id: number) => {
    const welcomeShown = await hasWelcomeBeenShown(id);
    if (!welcomeShown) {
      setShowWelcomePopup(true);
      void markWelcomeShown(id);
    }
  };

  // The subscription page comes up on its own every six hours (board note:
  // "this specific page will pop up every 6 hour"), for accounts that are not
  // paying and have already done their first search. Never over another
  // screen, and never during the first session.
  const SUBSCRIPTION_NUDGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
  const nudgeInFlightRef = useRef(false);
  const maybeShowSubscriptionNudge = async (id: number, token: string) => {
    if (nudgeInFlightRef.current) return;
    nudgeInFlightRef.current = true;
    try {
      const lastShown = await loadSubscriptionNudgeShownAt(id);
      if (Date.now() - lastShown < SUBSCRIPTION_NUDGE_INTERVAL_MS) return;
      if (overlayRef.current || backStateRef.current.showMessages || backStateRef.current.showProfileModal) return;
      const response = await fetch(`${API_BASE_URL}/profile/me`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const expiresAt = body?.user?.premium_expires_at ? new Date(body.user.premium_expires_at).getTime() : null;
      const paying = Boolean(body?.user?.is_premium) && (expiresAt === null || expiresAt > Date.now());
      if (paying) return;
      if (overlayRef.current || backStateRef.current.stage !== 'matchboard') return;
      setSubscriptionTab('pro');
      setOverlay('subscription');
      void markSubscriptionNudgeShown(id);
    } catch {
      // Best-effort only.
    } finally {
      nudgeInFlightRef.current = false;
    }
  };

  const applyEntryPointForUser = async (id: number) => {
    const firstSearchDone = await loadFirstSearchDone(id);
    setHasCompletedFirstSearch(firstSearchDone);
    await resetPerAccountState(id);

    if (firstSearchDone) {
      setOverlay(null);
      setActiveTab('explore');
      const sessionToken = authRef.current.token;
      if (sessionToken) setTimeout(() => { void maybeShowSubscriptionNudge(id, sessionToken); }, 800);
      return;
    }
    setAiSearchKey((k) => k + 1);
    setOverlay('aiSearch');
    setActiveTab('ai');
  };

  // Register for push notifications
  const handlePushNavigate = useMemo(() => (screen: string | null) => {
    if (!screen || stage !== 'matchboard') return;
    if (screen === 'likes') setOverlay('likes');
    else if (screen === 'matches') setOverlay('matches');
    else if (screen === 'conversations') setOverlay('conversations');
  }, [stage]);
  usePushNotifications(authToken, API_BASE_URL, handlePushNavigate);

  // Socket.io connection for real-time messaging
  const { socket } = useSocket({ token: authToken, apiBaseUrl: API_BASE_URL });

  // Badge counts: fetched on login, whenever a screen changes, and whenever
  // the server says something arrived or was read.
  const fetchBadgeCounts = async () => {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/counts`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      setBadgeCounts({ likes: Number(data.likes || 0), messages: Number(data.messages || 0) });
    } catch {
      // Keep the last numbers.
    }
  };
  useEffect(() => {
    if (!authToken) { setBadgeCounts({ likes: 0, messages: 0 }); return; }
    void fetchBadgeCounts();
  }, [authToken, overlay, showMessages]);
  useEffect(() => {
    if (!socket) return;
    const refresh = () => { void fetchBadgeCounts(); };
    const events = ['counts:changed', 'message:new', 'conversation:updated', 'messages:read', 'conversation:removed'];
    events.forEach((e) => socket.on(e, refresh));
    return () => { events.forEach((e) => socket.off(e, refresh)); };
  }, [socket, authToken]);
  // Drives the green "you both said this" highlighting on profile cards.
  const viewerProfile = useViewerProfile(authToken, API_BASE_URL);

  // The bottom nav highlight follows what is actually on screen. Likes and
  // Chats can be opened from places other than the nav (profile menu, a match
  // modal), and the highlight was left on whatever tab was pressed last.
  useEffect(() => {
    if (showMessages || overlay === 'conversations') setActiveTab('messages');
    else if (overlay === 'likes' || overlay === 'matches') setActiveTab('likes');
    else if (overlay === 'aiSearch') setActiveTab('ai');
    else if (overlay === 'profile' || overlay === 'profileOverview') setActiveTab('profile');
    else if (!overlay) setActiveTab('explore');
  }, [overlay, showMessages]);

  // Android's hardware back button. There is no navigation library, so without
  // this the OS default applies and back leaves the app for the launcher from
  // every screen. Handled in the order a person expects: the thing on top
  // closes first. Returning true swallows the event; false lets the OS act.
  const backStateRef = useRef({ stage, overlay, showMessages, showProfileModal });
  backStateRef.current = { stage, overlay, showMessages, showProfileModal };
  const authRef = useRef<{ token: string | null; userId: number | null }>({ token: authToken, userId });
  authRef.current = { token: authToken, userId };

  // Coming back to the app counts as a fresh visit for the six-hour nudge.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const { token, userId: id } = authRef.current;
      if (!token || !id || backStateRef.current.stage !== 'matchboard') return;
      void maybeShowSubscriptionNudge(id, token);
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const onBack = () => {
      const st = backStateRef.current;
      if (st.showProfileModal) { handleCloseProfile(); return true; }
      if (st.showMessages) {
        setShowMessages(false);
        setCurrentConversation(null);
        setOverlay('conversations');
        return true;
      }
      if (st.overlay) { goBackOverlay(); return true; }
      if (st.stage === 'login' || st.stage === 'signup' || st.stage === 'forgotPassword') { setStage('welcome'); return true; }
      // Onboarding handles its own back inside the screen; welcome and the main
      // screen fall through to the OS, which is the one place leaving is right.
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const session = await loadSession();
        if (session?.token) {
          setAuthToken(session.token);
          setUserName(session.user.name || '');
          setUserId(session.user.id || null);
          if (session.user.is_admin) setIsAdmin(true);
          if (session.user.id) {
            // RevenueCat is keyed by our user id so the backend can verify purchases.
            await configurePurchases(session.user.id);
            await applyEntryPointForUser(session.user.id);
            void maybeShowWelcome(session.user.id);
          }
          setStage('matchboard');
        }
      } finally {
        setBooting(false);
      }
    };
    bootstrap().catch(() => setBooting(false));
  }, []);

  // Fetch paused (incognito) state
  useEffect(() => {
    if (!authToken) return;
    fetch(`${API_BASE_URL}/privacy/settings`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.incognito_mode) setIsProfilePaused(true);
        else setIsProfilePaused(false);
      })
      .catch(() => {});
  }, [authToken]);

  const persistAuth = async (token: string, user: { id: number; name: string; is_admin?: boolean }) => {
    setAuthToken(token);
    setUserName(user.name || 'friend');
    setUserId(user.id);
    if (user.is_admin) setIsAdmin(true);
    await saveSession({ token, user });
    await configurePurchases(user.id);
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
    await logOutPurchases();
    await clearSession();
    await resetPerAccountState(null);
    setAuthToken(null);
    setUserId(null);
    setUserName('');
    setIsAdmin(false);
    setHasCompletedFirstSearch(false);
    setOverlay(null);
    setActiveTab('explore');
    setPreferredDiscoverTab('onGrid');
    setStage('welcome');
  };

  const handleUnpause = async () => {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/privacy/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ incognito_mode: false }),
      });
      if (!response.ok) throw new Error('Failed to unpause');
      setIsProfilePaused(false);
      Alert.alert('Profile active', 'Your profile is now visible again.');
    } catch {
      Alert.alert('Error', 'Could not unpause your profile. Please try again.');
    }
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
    if (userId) void maybeShowWelcome(userId);
  };

  const handleCardPress = (match: MatchCandidate) => {
    setSelectedMatch(match);
    setShowProfileModal(true);
  };

  const handleCloseProfile = (preserveSelection = false) => {
    setShowProfileModal(false);
    setProfileRespondMode(false);
    if (!preserveSelection) {
      setTimeout(() => setSelectedMatch(null), 300);
    }
  };

  const handleSwipeLeft = () => {
    if (selectedMatch && profileRespondMode && authToken) {
      // Rejecting from the Likes inbox: their like goes away on the server too.
      void fetch(`${API_BASE_URL}/likes/incoming/${selectedMatch.id}/dismiss`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      }).then(() => { void fetchBadgeCounts(); setLikesRefreshKey((k) => k + 1); }).catch(() => {});
    }
    if (selectedMatch) {
      const id = selectedMatch.id;
      setPassedProfileIds((prev) => {
        const next = new Set(prev).add(id);
        if (userId) void savePassedIds(userId, Array.from(next));
        return next;
      });
    }
    handleCloseProfile();
  };

  /**
   * Likes someone from a list rather than from the card stack.
   *
   * When the target is in cooldown the server refuses and answers can_bookmark,
   * which is the cue to offer saving them instead. Cooldown blocks everyone,
   * paid or not; a bookmark is what paying buys.
   */
  const likeFromList = async (targetUserId: number, isOnGrid = false) => {
    if (!authToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ target_user_id: targetUserId, is_on_grid: isOnGrid }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.can_bookmark) {
          Alert.alert(
            'Not available right now',
            'They have hit their daily limit. Save them and you can like them as soon as they are back.',
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Save',
                onPress: () => {
                  void fetch(`${API_BASE_URL}/bookmarks`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authToken}`,
                    },
                    body: JSON.stringify({ target_user_id: targetUserId }),
                  }).then(async (bookmarkResponse) => {
                    const body = await bookmarkResponse.json().catch(() => ({}));
                    if (bookmarkResponse.ok) {
                      Alert.alert('Saved', 'You will find them under Saved.');
                    } else if (body.upgrade_required) {
                      Alert.alert('Paid feature', 'Saving profiles is available on paid plans.');
                    } else {
                      Alert.alert('Could not save', body.error || 'Please try again.');
                    }
                  });
                },
              },
            ]
          );
          return;
        }
        throw new Error(data.error || 'Unable to like profile right now.');
      }

      if (data.is_match && data.match_id) {
        setMatchedUser({
          matchId: data.match_id,
          userId: targetUserId,
          name: data.matched_user?.name || 'your match',
          photo: data.matched_user?.primary_photo,
        });
        setShowMatchModal(true);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Please try again.');
    }
  };

  const handleSwipeRight = async () => {
    if (!selectedMatch) return;
    if (!authToken) {
      Alert.alert('Sign in required', 'Please restart onboarding to continue.');
      setStage('welcome');
      return;
    }
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;

    const answeredFromInbox = profileRespondMode;
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
      setLikedProfileIds((prev) => new Set(prev).add(selectedMatch.id));
      if (answeredFromInbox) { setLikesRefreshKey((k) => k + 1); void fetchBadgeCounts(); }
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
        setNotice({ title: 'Liked', message: `${selectedMatch.name} will be notified. We'll let you know if it's a match.`, icon: 'heart' });
        setTimeout(() => setSelectedMatch(null), 300);
      }
    } catch (error: any) {
      setNotice({ title: "Couldn't like", message: error.message || 'Please try again.', tone: 'error' });
      setTimeout(() => setSelectedMatch(null), 300);
    } finally {
      actionInFlightRef.current = false;
    }
  };

  const handleSuperlike = async () => {
    if (!selectedMatch) return;
    if (!authToken) {
      Alert.alert('Sign in required', 'Please restart onboarding to continue.');
      setStage('welcome');
      return;
    }
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;

    const answeredFromInbox = profileRespondMode;
    handleCloseProfile(true);

    try {
      const response = await fetch(`${API_BASE_URL}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          target_user_id: selectedMatch.id,
          is_on_grid: selectedMatch.is_on_grid ?? true,
          is_superlike: true,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        if (errorBody.already_liked) setLikedProfileIds((prev) => new Set(prev).add(selectedMatch.id));
        throw new Error(errorBody.error || 'Unable to send a Green Flag right now.');
      }

      const data = await response.json();
      setLikedProfileIds((prev) => new Set(prev).add(selectedMatch.id));
      if (answeredFromInbox) { setLikesRefreshKey((k) => k + 1); void fetchBadgeCounts(); }
      if (data.is_match && data.match_id) {
        setMatchedUser({
          matchId: data.match_id,
          userId: selectedMatch.id,
          name: selectedMatch.name,
          photo: selectedMatch.primary_photo,
        });
        setShowMatchModal(true);
      } else {
        setNotice({ title: 'Green Flag sent', message: `${selectedMatch.name} will see it at the top of their inbox.`, icon: 'flag' });
        setTimeout(() => setSelectedMatch(null), 300);
      }
    } catch (error: any) {
      setNotice({ title: "Couldn't send Green Flag", message: error.message || 'Please try again.', tone: 'error' });
      setTimeout(() => setSelectedMatch(null), 300);
    } finally {
      actionInFlightRef.current = false;
    }
  };

  const handleSendCompliment = async (targetUserId: number, content: string, photoUrl?: string | null): Promise<boolean> => {
    if (!authToken) {
      Alert.alert('Sign in required', 'Please restart onboarding to continue.');
      return false;
    }
    if (actionInFlightRef.current) return false;
    actionInFlightRef.current = true;

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
          photo_url: photoUrl || undefined,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body.already_complimented) setComplimentedProfileIds((prev) => new Set(prev).add(targetUserId));
        throw new Error(body.error || 'Unable to send your First Move.');
      }

      setComplimentedProfileIds((prev) => new Set(prev).add(targetUserId));
      // A compliment is a like too: the tile dims and the buttons go quiet,
      // the same as after Like or Green Flag.
      setLikedProfileIds((prev) => new Set(prev).add(targetUserId));
      setNotice({ title: 'First Move sent', message: 'They will find it in their messages.', icon: 'message-circle' });
      return true;
    } catch (error: any) {
      setNotice({ title: "Couldn't send your First Move", message: error.message || 'Please try again.', tone: 'error' });
      return false;
    } finally {
      actionInFlightRef.current = false;
    }
  };

  const handleBlockFromProfile = (targetUserId: number, name: string) => {
    Alert.alert(
      'Block user',
      `Block ${name}? They won't be able to see your profile or contact you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/privacy/block`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ target_user_id: targetUserId }),
              });
              const body = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(body.error || 'Unable to block user.');
              }
              Alert.alert('Blocked', `${name} has been blocked.`);
              handleCloseProfile();
            } catch (error: any) {
              Alert.alert('Block failed', error.message || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleReportFromProfile = (targetUserId: number, name: string) => {
    Alert.alert(
      'Report user',
      `Why are you reporting ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Inappropriate behavior',
          onPress: () => submitProfileReport(targetUserId, name, 'inappropriate_behavior'),
        },
        {
          text: 'Fake profile',
          onPress: () => submitProfileReport(targetUserId, name, 'fake_profile'),
        },
        {
          text: 'Harassment',
          style: 'destructive',
          onPress: () => submitProfileReport(targetUserId, name, 'harassment'),
        },
      ]
    );
  };

  const submitProfileReport = async (targetUserId: number, name: string, reason: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/privacy/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Unable to report user.');
      }
      Alert.alert('Reported', `Thank you for reporting ${name}. We will review it shortly.`);
      handleCloseProfile();
    } catch (error: any) {
      Alert.alert('Report failed', error.message || 'Please try again.');
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
        setAiSearchKey((k) => k + 1);
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
      onBack: goBackOverlay,
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
            onOpenAdmin={() => setOverlay('admin')}
            isAdmin={isAdmin}
            onLogout={logout}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            onAccountDeleted={logout}
                      onOpenBookmarks={() => setOverlay('bookmarks')}
          />
        );
      case 'notifications':
        return <NotificationsScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} />;
      case 'wallet':
        return (
          <WalletScreen
            {...overlayProps}
            key={walletRefreshKey}
            onOpenCheckout={() => setOverlay('checkout')}
            onOpenSubscription={(tab) => { setSubscriptionTab(tab); setOverlay('subscription'); }}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
          />
        );
      case 'likes':
        return isProfilePaused ? (
          <PausedBanner onUnpause={handleUnpause} />
        ) : (
          <LikesInboxScreen
            {...overlayProps}
            key={`likes-${likesRefreshKey}`}
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
              // The inbox stays underneath; closing the card returns to it.
              setProfileRespondMode(true);
              setShowProfileModal(true);
            }}
            onOpenConversation={(matchId, matchName, targetUserId) => {
              setCurrentConversation({ matchId, matchName, targetUserId, status: 'active', requestedBy: null });
              setShowMessages(true);
              setOverlay(null);
            }}
          />
        );
      case 'bookmarks':
        return (
          <BookmarksScreen
            {...overlayProps}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            onLike={async (targetUserId) => {
              await likeFromList(targetUserId, false);
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
            socket={socket}
            onOpenConversation={(matchId, matchName, targetUserId, meta) => {
              setCurrentConversation({ matchId, matchName, targetUserId, status: meta?.status, requestedBy: meta?.requestedBy });
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
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            onOpenCheckout={() => setOverlay('checkout')}
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
        return <PrivacySafetyScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} onAccountDeleted={logout} onOpenDeleteAccount={() => setOverlay('deleteAccount')} />;
      case 'deleteAccount':
        return (
          <DeleteAccountScreen
            onBack={goBackOverlay}
            onClose={() => setOverlay(null)}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            onAccountDeleted={logout}
            onAccountPaused={() => { setIsProfilePaused(true); setOverlay(null); }}
          />
        );
      case 'helpCenter':
        return <HelpCenterScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} />;
      case 'terms':
        return <TermsScreen {...overlayProps} />;
      case 'checkout':
        return <CheckoutScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} onPurchased={() => { setWalletRefreshKey((k) => k + 1); replaceOverlay('wallet'); }} />;
      case 'subscription':
        return (
          <SubscriptionScreen
            onClose={goBackOverlay}
            initialTab={subscriptionTab}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            onPurchased={() => { setWalletRefreshKey((k) => k + 1); replaceOverlay('wallet'); }}
                      onOpenTerms={() => setOverlay('terms')}
          />
        );
      case 'profileOverview':
        return (
          <ProfileOverviewScreen
            {...overlayProps}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            onOpenSettings={() => setOverlay('settings')}
            onEditProfile={() => setOverlay('profileEdit')}
            onManagePhotos={() => setOverlay('photos')}
            onSessionExpired={logout}
          />
        );
      case 'admin':
        return <AdminDashboardScreen {...overlayProps} token={authToken!} apiBaseUrl={API_BASE_URL} />;
      case 'profile':
        return (
          <ProfileScreen
            {...overlayProps}
            token={authToken!}
            apiBaseUrl={API_BASE_URL}
            onOpenSettings={() => setOverlay('settings')}
            onEditProfile={() => setOverlay('profileEdit')}
            onManagePhotos={() => setOverlay('photos')}
            onOpenSubscription={(tab) => { setSubscriptionTab(tab); setOverlay('subscription'); }}
            onOpenLikes={() => setOverlay('likes')}
            onOpenConversations={() => setOverlay('conversations')}
            onOpenWallet={() => setOverlay('wallet')}
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
        return (
          <WelcomeScreen
            onStart={() => setStage('signup')}
            onLogin={() => setStage('login')}
            apiBaseUrl={API_BASE_URL}
            onGoogleAuth={async ({ token, user, isNewUser }) => {
              if (user.is_admin) setIsAdmin(true);
              await persistAuth(token, user);
              const toOnboarding = needsOnboarding(user, isNewUser);
              setStage(toOnboarding ? 'onboarding' : 'matchboard');
              if (!toOnboarding) void maybeShowWelcome(user.id);
            }}
          />
        );
      case 'signup':
        return (
          <SignUpFlowScreen
            apiBaseUrl={API_BASE_URL}
            onBack={() => setStage('welcome')}
            onComplete={async ({ token, user, isNewUser }) => {
              if (user.is_admin) setIsAdmin(true);
              await persistAuth(token, user);
              // The account exists but has no profile yet: name, date of birth
              // and the rest are collected in onboarding, which is next.
              setStage(needsOnboarding(user, isNewUser) ? 'onboarding' : 'matchboard');
            }}
          />
        );
      case 'login':
        return (
          <LoginScreen
            apiBaseUrl={API_BASE_URL}
            onBack={() => setStage('welcome')}
            onForgotPassword={() => setStage('forgotPassword')}
            onSuccess={async ({ token, user, isNewUser }) => {
              if (user.is_admin) setIsAdmin(true);
              await persistAuth(token, user);
              const toOnboarding = needsOnboarding(user, isNewUser);
              setStage(toOnboarding ? 'onboarding' : 'matchboard');
              if (!toOnboarding) void maybeShowWelcome(user.id);
            }}
          />
        );
      case 'forgotPassword':
        return (
          <ForgotPasswordScreen
            apiBaseUrl={API_BASE_URL}
            onBack={() => setStage('login')}
          />
        );
      case 'onboarding':
        return <OnboardingScreen onComplete={handleOnboardingComplete} onBack={() => setStage('welcome')} apiBaseUrl={API_BASE_URL} existingToken={authToken} existingUserId={userId} />;
      case 'postOnboarding':
        return <PostOnboardingScreen onComplete={handlePostOnboardingComplete} />;
      case 'matchboard':
        if (!authToken) return null;

        // Render main content based on overlay state
        // The profile card and match popup live outside the overlay switch so
        // a card opened from the Likes inbox sits on top of the inbox rather
        // than replacing it.
        const mainContent = (
          <>
            {overlay ? renderOverlay() : isProfilePaused ? (
              <PausedBanner onUnpause={handleUnpause} />
            ) : (
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
                onOpenAISearch={() => {
                  setAiSearchKey((k) => k + 1);
                  setOverlay('aiSearch');
                  setActiveTab('ai');
                }}
                filters={advancedFilters}
                preferredTab={preferredDiscoverTab}
                pendingAISearchCharge={pendingAISearchCharge}
                onConsumeAISearchCharge={() => setPendingAISearchCharge(false)}
                likedIds={likedProfileIds}
                passedIds={passedProfileIds}
              />
            )}
            <ProfileDetailScreen
              match={selectedMatch}
              visible={showProfileModal}
              onClose={handleCloseProfile}
              onSwipeLeft={handleSwipeLeft}
              onSwipeRight={handleSwipeRight}
              onSuperlike={handleSuperlike}
              onSendCompliment={handleSendCompliment}
              onBlock={handleBlockFromProfile}
              onReport={handleReportFromProfile}
              viewer={viewerProfile}
              alreadyLiked={selectedMatch ? likedProfileIds.has(selectedMatch.id) : false}
              alreadyComplimented={selectedMatch ? complimentedProfileIds.has(selectedMatch.id) : false}
              token={authToken}
              apiBaseUrl={API_BASE_URL}
              actionMode={profileRespondMode ? 'respond' : 'full'}
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
            {/* AISearchScreen - Fresh instance each time */}
            {overlay === 'aiSearch' && (
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 60,
                zIndex: 10,
              }}>
                {isProfilePaused ? (
                  <PausedBanner onUnpause={handleUnpause} />
                ) : (
                <AISearchScreen
                  key={aiSearchKey}
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
                )}
              </View>
            )}
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
                  socket={socket}
                  status={currentConversation.status}
                  requestedBy={currentConversation.requestedBy}
                  onRequestResolved={(matchId, outcome) => {
                    void fetchBadgeCounts();
                    if (outcome === 'declined') {
                      setShowMessages(false);
                      setCurrentConversation(null);
                      setOverlay('conversations');
                      setActiveTab('messages');
                      return;
                    }
                    setCurrentConversation((prev) => (prev && prev.matchId === matchId ? { ...prev, status: 'active', requestedBy: null } : prev));
                  }}
                  onBack={() => {
                    // Back means the conversation list, one screen up. It used
                    // to drop the user on Home.
                    setShowMessages(false);
                    setCurrentConversation(null);
                    setOverlay('conversations');
                    setActiveTab('messages');
                  }}
                />
              </View>
            )}
            {!showMessages && !showProfileModal && (
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 }}>
                <BottomNav
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                  likesCount={badgeCounts.likes}
                  messagesCount={badgeCounts.messages}
                />
              </View>
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
      <NoticeModal notice={notice} onClose={() => setNotice(null)} />
      <Modal visible={showWelcomePopup} transparent animationType="fade" onRequestClose={() => setShowWelcomePopup(false)}>
        <View style={styles.welcomeBackdrop}>
          <View style={[styles.welcomeCard, { backgroundColor: theme.colors.surface }]}>
            <Pressable style={styles.welcomeClose} onPress={() => setShowWelcomePopup(false)}>
              <Text style={{ color: theme.colors.muted, fontSize: 22 }}>✕</Text>
            </Pressable>
            <Image source={require('./assets/green-hand.png')} style={styles.welcomeHand} resizeMode="contain" />
            <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>Welcome to GreenFlag.</Text>
            <Text style={[styles.welcomeBody, { color: theme.colors.muted }]}>
              We're new, growing fast, and getting better daily. Hang tight, your Greenflag is on the way.
            </Text>
            <Pressable
              style={[styles.welcomeButton, { backgroundColor: theme.colors.neonGreen }]}
              onPress={() => setShowWelcomePopup(false)}
            >
              <Text style={styles.welcomeButtonText}>Let's gooo</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101D13',
  },
  welcomeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  welcomeCard: {
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 28,
    alignItems: 'center',
  },
  welcomeClose: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  welcomeHand: {
    width: 100,
    height: 100,
    marginTop: 4,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontFamily: 'RedHatDisplay_700Bold',
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 10,
  },
  welcomeBody: {
    fontFamily: 'RedHatDisplay_400Regular',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  welcomeButton: {
    marginTop: 24,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  welcomeButtonText: {
    fontFamily: 'RedHatDisplay_700Bold',
    fontSize: 18,
    color: '#000',
  },
});
