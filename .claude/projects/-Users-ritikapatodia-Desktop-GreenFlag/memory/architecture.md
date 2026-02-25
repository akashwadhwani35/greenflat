# GreenFlag Architecture

## Directory Structure
```
GreenFlag/
├── ai-dating-app/          # React Native / Expo frontend
│   ├── App.tsx             # Main entry - navigation, auth, overlays (812 lines)
│   ├── src/
│   │   ├── screens/        # 29 screens
│   │   ├── components/     # 10 reusable components
│   │   ├── hooks/          # useLike, usePushNotifications, useSocket
│   │   ├── theme/          # ThemeProvider + design tokens
│   │   └── utils/          # session.ts (AsyncStorage)
│   ├── app.json            # Expo config (app.gflag.greenflag)
│   └── assets/             # Images, icons
├── backend/
│   ├── src/
│   │   ├── index.ts        # Express server (port 5000)
│   │   ├── controllers/    # 15 controllers
│   │   ├── services/       # openai, push, media, credits, sms
│   │   ├── middleware/      # auth (JWT), rateLimit, adminAuth
│   │   ├── routes/         # index.ts + admin.ts
│   │   ├── database/       # schema.sql + 13 migrations
│   │   ├── socket.ts       # Socket.IO setup
│   │   ├── utils/          # constants.ts (limits, traits)
│   │   └── __tests__/      # Jest integration tests
│   └── package.json
├── .github/workflows/      # CI/CD (backend-deploy.yml, frontend-build.yml)
├── scripts/                # setup-gcp-cicd.sh
├── gf/                     # Brand assets (SVG logos)
└── docs/                   # ai-search-pricing-model.md
```

## Authentication Flow
1. WelcomeScreen → LoginScreen (email+password or Google OAuth) OR OnboardingScreen (9 steps)
2. JWT token stored in AsyncStorage, sent as Bearer header
3. Session auto-restored on app launch
4. PostOnboardingScreen shown for new users before main app

## Navigation
- Stage-based: welcome → login → onboarding → postOnboarding → matchboard
- Overlay system in App.tsx for 17+ modal screens
- BottomNav: Discover | Likes | AI Search (center) | Chats | Profile

## Deployment
- Backend: GCP Cloud Run (Docker, via GitHub Actions)
- Frontend: EAS builds (Expo Application Services)
- GCP Project: greenflag-app
- Service Account: github-actions@greenflag-app.iam.gserviceaccount.com
