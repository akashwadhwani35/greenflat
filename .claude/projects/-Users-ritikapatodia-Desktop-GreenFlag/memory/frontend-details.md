# Frontend Details

## Screens (29 total)

### Auth (4)
- WelcomeScreen - Logo animation, Get Started / Sign In
- LoginScreen - Email+password, Google OAuth
- ForgotPasswordScreen - OTP-based password reset
- OnboardingScreen (1200+ lines) - 9-step wizard: basic → intentions → location → physical → lifestyle → personality → prompts → photos → contact

### Main (5)
- PostOnboardingScreen - Feature carousel for new users
- ExploreScreen - Wrapper for DiscoverScreen
- DiscoverScreen (600+ lines) - Card grid, on-grid/off-grid tabs, skeleton loaders
- MatchboardScreen - Search + filter interface
- ProfileDetailScreen (600+ lines) - Gallery, swipe actions, like/superlike/compliment/block

### Search (2)
- AISearchScreen (800+ lines) - Conversational AI, chat bubbles, keyword suggestions, off-topic detection
- AdvancedSearchScreen (700+ lines) - 15+ filters (age, distance, religion, ethnicity, habits, etc.)

### Matches & Messaging (4)
- LikesInboxScreen - Received likes list
- MatchesListScreen - Matched connections
- ConversationsScreen - Active chats with previews, unread counts
- MessagesScreen (1000+ lines) - Real-time chat, Socket.IO, image upload, typing indicator, read status

### Profile (5)
- ProfileOverviewScreen - Own profile view
- ProfileEditScreen (1400+ lines) - Edit all fields
- PhotoManagerScreen - Upload, reorder, delete photos
- ProfileScreen - Full profile variant
- VerificationScreen - Selfie + ID verification

### Settings (4)
- SettingsScreen - Hub for all settings
- PrivacySafetyScreen - Block/report, privacy toggles
- NotificationsScreen - Notification preferences
- WalletScreen - Credit balance, purchase history

### Other (5)
- CheckoutScreen - In-app purchases
- HelpCenterScreen - FAQ & support
- TermsScreen - T&C, privacy policy
- AdminDashboardScreen - Admin-only controls

## Components (10)
Typography, Button, Chip, InputField, UnderlineInput, PageHeader, SurfaceCard, BottomNav, PixelFlag, MatchModal

## Hooks (3)
- useSocket: Socket.IO connection with auth + reconnection
- usePushNotifications: Expo push registration + routing
- useLike: Like/superlike logic

## Theme (tokens.ts)
- Font: Red Hat Display (400-700)
- Colors: neon green #ADFF1A, deep black #101D13, surface #1A1A1A, peach #FDE2C9, pink #FF4D8A
- Spacing: xs(8) sm(12) md(20) lg(28) xl(36) xxl(48)
- Radii: pill(999) lg(32) md(24) sm(16)

## State Management
- No Redux - local useState per screen
- App.tsx global: auth stage, token, userId, overlay, selectedMatch, filters
- AsyncStorage: session, search history, first-search flag
- Socket.IO: real-time message events

## Dependencies
react@19.1.0, react-native@0.81.5, expo~54.0.29
axios, socket.io-client, expo-notifications, expo-image-picker, expo-location
react-native-gesture-handler, react-native-svg, @expo-google-fonts/*
