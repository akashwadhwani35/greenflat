# Backend Details

## API Endpoints (40+)

### Public (no auth)
- POST /api/auth/signup, /api/auth/login, /api/auth/google
- POST /api/auth/forgot-password, /api/auth/reset-password
- POST /api/geocode

### Profile (protected)
- POST /api/profile/complete, GET /api/profile/me
- POST /api/profile/photo, DELETE /api/profile/photo/:id
- POST /api/profile/photo/primary, /api/profile/photo/reorder
- POST /api/profile/basic, /api/profile/boost
- GET /api/profile/bio-suggestions, DELETE /api/profile/me

### Matching
- POST /api/matches/search (AI-powered)
- POST /api/matches/refresh-off-grid
- GET /api/matches/user/:id, GET /api/matches
- POST /api/matches/:matchId/unmatch

### Likes
- POST /api/likes, POST /api/likes/compliment
- GET /api/likes/remaining, GET /api/likes/incoming

### Messaging
- POST /api/messages, GET /api/messages/:matchId
- GET /api/conversations, POST /api/messages/:matchId/read
- DELETE /api/messages/:messageId

### Verification
- POST /api/verification/otp/request, /otp/verify
- POST /api/verification/selfie, /location
- GET /api/verification/status

### Privacy & Safety
- GET/POST /api/privacy/settings, GET /api/privacy/blocked
- POST /api/privacy/block, /api/privacy/unblock, /api/report

### Wallet
- GET /api/wallet/summary, POST /api/wallet/purchase

### Notifications & Push
- GET/POST /api/notifications/preferences
- POST /api/push/register, /api/push/unregister

### Media
- GET /api/media/capabilities, POST /api/media/upload-signature, /api/media/upload-local

### AI
- POST /api/ai/sidekick (dating coach chat)

### Support
- POST /api/support/contact

### Admin (admin role required)
- GET /api/admin/stats, /api/admin/reports, /api/admin/users
- PATCH /api/admin/reports/:id, POST /api/admin/users/:id/ban

## Database Tables (19)
users, user_profiles, personality_responses, user_ai_profiles, photos,
likes, matches, messages, user_activity_limits, verification_status,
otp_codes, user_privacy_settings, user_notification_preferences,
credit_transactions, reports, support_messages, blocks, bookmarks,
search_history, profile_views, otp_request_audit

## Rate Limits (in-memory, IP-based)
- Login: 10/15min, Signup: 5/1hr, Forgot/Reset password: 5-10/15min

## Daily Limits (12h reset)
- Males: 1 on-grid like, 4 off-grid, 3 messages
- Females: 3 on-grid, 7 off-grid, 10 messages
- Premium: +2 on-grid, +10 off-grid, more features

## AI Services (openai.service.ts)
- parseSearchQuery: NL → structured filters
- generateProfileEmbedding: text → vector
- cosineSimilarity: match scoring
- generateMatchNarrative: personalized summaries
- generateMatchReason: one-sentence match explanation
- analyzePersonality: quiz → traits + summary
- generateBioSuggestions: 3 creative bios

## Environment Variables
PORT, DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, NODE_ENV,
OPENAI_API_KEY, OPENAI_MODEL, OPENAI_EMBEDDING_MODEL,
GOOGLE_OAUTH_CLIENT_IDS, GOOGLE_MAPS_API_KEY,
TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER,
CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET,
RESEND_API_KEY, SUPPORT_EMAIL, CORS_ALLOWED_ORIGINS
