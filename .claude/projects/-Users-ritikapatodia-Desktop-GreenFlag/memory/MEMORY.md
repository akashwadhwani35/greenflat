# GreenFlag - AI Dating App

## Project Overview
Full-stack AI-powered dating app. React Native (Expo) frontend + Node.js/Express backend + PostgreSQL + OpenAI.
Status: 100% complete, production-ready. Deployed on GCP Cloud Run.

## Key Files
- See [architecture.md](architecture.md) for full structure
- See [backend-details.md](backend-details.md) for API endpoints & DB schema
- See [frontend-details.md](frontend-details.md) for screens & components

## Tech Stack
- **Frontend**: React Native 0.81.5, Expo 54, TypeScript, React Navigation
- **Backend**: Express 5.1.0, TypeScript, PostgreSQL, Socket.IO
- **AI**: OpenAI GPT-4o-mini (chat), text-embedding-3-small (embeddings)
- **Auth**: JWT (7-day expiry), bcryptjs, Google OAuth
- **Notifications**: Expo push notifications
- **Media**: Cloudinary (prod) / local storage (dev)
- **CI/CD**: GitHub Actions → GCP Cloud Run + EAS builds

## API Base URL
Production: `https://greenflag-api-480247350372.us-central1.run.app/api`

## Brand Colors
- Primary: #ADFF1A (neon green), Background: #101D13 (deep black)
- Surface: #1A1A1A, Accent: #FDE2C9 (peach), Hearts: #FF4D8A

## Key Patterns
- Stage-based navigation in App.tsx: welcome → login → onboarding → postOnboarding → matchboard
- Overlay system for modals (17+ types)
- No Redux - useState + prop drilling, AsyncStorage for persistence
- Gender-based daily limits (males: 1 on-grid/4 off-grid likes per 12h; females: 3/7)
- Match % = 40% interests + 40% personality + 20% keywords + bonuses
- Socket.IO for real-time messaging
