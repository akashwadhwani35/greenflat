-- AI Dating App Database Schema

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    gender VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
    interested_in VARCHAR(20) NOT NULL CHECK (interested_in IN ('male', 'female', 'both')),
    date_of_birth DATE NOT NULL,
    city VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    distance_radius INTEGER DEFAULT 50,
    is_verified BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    premium_expires_at TIMESTAMP,
    boost_expires_at TIMESTAMP,
    credit_balance INTEGER NOT NULL DEFAULT 50,
    cooldown_enabled BOOLEAN DEFAULT FALSE,
    cooldown_until TIMESTAMP,
    push_token TEXT,
    -- DEPRECATED: privacy settings moved to user_privacy_settings table.
    -- These columns are kept for backwards compatibility but no longer written to.
    hide_distance BOOLEAN DEFAULT FALSE,
    hide_city BOOLEAN DEFAULT FALSE,
    incognito_mode BOOLEAN DEFAULT FALSE,
    show_online_status BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    height INTEGER, -- in cm
    body_type VARCHAR(50),
    interests TEXT[], -- Array of interests
    bio TEXT,
    prompt1 TEXT,
    prompt2 TEXT,
    prompt3 TEXT,
    smoker BOOLEAN,
    smoking_habit VARCHAR(50),
    drinker VARCHAR(50),
    diet VARCHAR(50),
    fitness_level VARCHAR(50),
    education VARCHAR(100),
    education_level VARCHAR(100),
    occupation VARCHAR(100),
    hometown VARCHAR(100),
    relationship_goal VARCHAR(50),
    have_kids VARCHAR(50),
    star_sign VARCHAR(50),
    politics VARCHAR(50),
    religion VARCHAR(100),
    family_oriented BOOLEAN,
    spiritual BOOLEAN,
    open_minded BOOLEAN,
    career_focused BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Personality Quiz Responses Table
CREATE TABLE IF NOT EXISTS personality_responses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question1_answer CHAR(1),
    question2_answer CHAR(1),
    question3_answer CHAR(1),
    question4_answer CHAR(1),
    question5_answer CHAR(1),
    question6_answer CHAR(1),
    question7_answer CHAR(1),
    question8_answer CHAR(1),
    personality_traits TEXT[], -- Derived traits: funny, caring, serious, etc.
    personality_summary TEXT,
    compatibility_tips TEXT,
    top_traits TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Photos Table
CREATE TABLE IF NOT EXISTS photos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Likes Table
CREATE TABLE IF NOT EXISTS likes (
    id SERIAL PRIMARY KEY,
    liker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    liked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_on_grid BOOLEAN DEFAULT TRUE,
    is_superlike BOOLEAN DEFAULT FALSE,
    is_compliment BOOLEAN DEFAULT FALSE,
    compliment_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(liker_id, liked_id)
);

-- Matches Table (mutual likes)
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP,
    UNIQUE(user1_id, user2_id),
    CHECK (user1_id < user2_id) -- Ensure consistent ordering
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'voice')),
    is_read BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Activity Limits Table
CREATE TABLE IF NOT EXISTS user_activity_limits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    on_grid_likes_count INTEGER DEFAULT 0,
    off_grid_likes_count INTEGER DEFAULT 0,
    messages_started_count INTEGER DEFAULT 0,
    last_reset_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Persona Table
CREATE TABLE IF NOT EXISTS user_ai_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    self_summary TEXT,
    ideal_partner_prompt TEXT,
    connection_preferences TEXT,
    dealbreakers TEXT,
    growth_journey TEXT,
    persona_embedding JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sidekick Memory (persisted AI preference learning)
CREATE TABLE IF NOT EXISTS user_sidekick_memory (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    memory JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookmarks Table (Premium feature)
CREATE TABLE IF NOT EXISTS bookmarks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bookmarked_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, bookmarked_user_id)
);

-- Search History Table
CREATE TABLE IF NOT EXISTS search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    filters JSONB, -- Store filters as JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('debit', 'credit')),
    reason VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profile Views Table
CREATE TABLE IF NOT EXISTS profile_views (
    id SERIAL PRIMARY KEY,
    viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    admin_notes TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Privacy Settings
CREATE TABLE IF NOT EXISTS user_privacy_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    hide_distance BOOLEAN DEFAULT FALSE,
    hide_city BOOLEAN DEFAULT FALSE,
    incognito_mode BOOLEAN DEFAULT FALSE,
    show_online_status BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    likes BOOLEAN DEFAULT TRUE,
    matches BOOLEAN DEFAULT TRUE,
    messages BOOLEAN DEFAULT TRUE,
    daily_picks BOOLEAN DEFAULT TRUE,
    product_updates BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Block relationships
CREATE TABLE IF NOT EXISTS blocks (
    id SERIAL PRIMARY KEY,
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

-- OTP Codes (for phone verification)
CREATE TABLE IF NOT EXISTS otp_codes (
    id SERIAL PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    code CHAR(6) NOT NULL,
    verify_attempts INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otp_request_audit (
    id SERIAL PRIMARY KEY,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Verification Status (phone/otp, face/age, location)
CREATE TABLE IF NOT EXISTS verification_status (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT,
    otp_verified BOOLEAN DEFAULT FALSE,
    face_status VARCHAR(12) DEFAULT 'unverified' CHECK (face_status IN ('unverified', 'pending', 'verified', 'failed')),
    age_verified BOOLEAN DEFAULT FALSE,
    location_verified BOOLEAN DEFAULT FALSE,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    location_city TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_gender ON users(gender);
CREATE INDEX idx_users_city ON users(city);
CREATE INDEX idx_users_boost_expires_at ON users(boost_expires_at);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_likes_liker_id ON likes(liker_id);
CREATE INDEX idx_likes_liked_id ON likes(liked_id);
CREATE INDEX idx_likes_created_at ON likes(created_at);
CREATE INDEX idx_matches_user1_id ON matches(user1_id);
CREATE INDEX idx_matches_user2_id ON matches(user2_id);
CREATE INDEX idx_messages_match_id ON messages(match_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_profile_views_viewed_id ON profile_views(viewed_id);
CREATE INDEX idx_photos_user_id ON photos(user_id);
CREATE INDEX idx_blocks_blocker_id ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked_id ON blocks(blocked_id);
CREATE INDEX idx_otp_request_audit_phone_created_at ON otp_request_audit(phone, created_at DESC);
