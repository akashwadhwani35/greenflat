# AI Dating App - Backend API

Backend server for the AI Dating App built with Node.js, Express, TypeScript, and PostgreSQL.

## Features

- JWT-based authentication
- User profile management with personality quiz
- AI-powered matching algorithm
- On-grid (high-precision) and off-grid (broader discovery) matches
- Daily like limits with cooldown mechanics
- Gender-specific quotas (male/female)
- Premium features support

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express
- **Language**: TypeScript
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up PostgreSQL Database

Create a PostgreSQL database and run the schema:

```bash
# Create database
createdb ai_dating_app

# Run schema
psql -d ai_dating_app -f src/database/schema.sql
```

### 3. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Update the `.env` file with your configuration:

```
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/ai_dating_app
JWT_SECRET=your_secure_secret_key_here
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

### 4. Run the Server

Development mode (with hot reload):

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

### 5. Seed Demo Profiles (Optional)

To load 25 AI-ready demo users with photos, quiz answers, and detailed profiles:

```bash
npm run seed:demo
```

> Requires a configured PostgreSQL database. If an `OPENAI_API_KEY` is present, personality summaries will be generated automatically; otherwise sensible defaults are stored.

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login user

### Profile Management (Protected)

- `POST /api/profile/complete` - Complete user profile with personality quiz
- `GET /api/profile/me` - Get current user's profile
- `POST /api/profile/photo` - Upload profile photo

### Matching (Protected)

- `POST /api/matches/search` - Search for matches (on-grid and off-grid)
- `POST /api/matches/refresh-off-grid` - Refresh off-grid matches
- `GET /api/matches/user/:targetUserId` - Get user details

### Likes & Matches (Protected)

- `POST /api/likes` - Like a profile
- `GET /api/likes/remaining` - Get remaining daily likes
- `GET /api/matches` - Get all matches

### Health Check

- `GET /health` - API health check
- `GET /api/db-test` - Database connection test

## Daily Limits

### Male Users
- On-grid likes: 1 per 12 hours
- Off-grid likes: 4 per 12 hours
- On-grid results: 3 profiles
- Off-grid results: 4 profiles
- Messages per day: 3
- Cooldown: Disabled by default

### Female Users
- On-grid likes: 3 per 12 hours
- Off-grid likes: 7 per 12 hours
- On-grid results: 6 profiles
- Off-grid results: 4 profiles
- Messages per day: 10
- Cooldown: Auto-enabled (8-12 hours)

## Database Schema

Key tables:
- `users` - User accounts and settings
- `user_profiles` - Detailed profile information
- `personality_responses` - Personality quiz responses
- `photos` - User photos
- `likes` - User likes (on-grid and off-grid)
- `matches` - Mutual likes
- `user_activity_limits` - Daily limit tracking
- `bookmarks` - Premium feature for bookmarking users

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts          # Database connection
│   ├── controllers/
│   │   ├── authController.ts    # Authentication logic
│   │   ├── profileController.ts # Profile management
│   │   ├── matchController.ts   # Matching algorithm
│   │   └── likeController.ts    # Like & match logic
│   ├── middleware/
│   │   └── auth.ts              # JWT authentication middleware
│   ├── routes/
│   │   └── index.ts             # API routes
│   ├── types/
│   │   └── index.ts             # TypeScript types
│   ├── utils/
│   │   └── constants.ts         # App constants
│   ├── database/
│   │   └── schema.sql           # Database schema
│   └── index.ts                 # Express app entry point
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Development Notes

- The matching algorithm currently uses database filtering for the demo
- Match percentages are calculated based on interests and personality trait overlap
- Premium features are defined but payment integration is not implemented yet
- All timestamps use UTC
