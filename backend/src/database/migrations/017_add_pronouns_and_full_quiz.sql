-- Pronouns, the twelve-question quiz, and the staged signup funnel.

-- Pronouns were already collected by the onboarding and profile-edit screens but
-- had nowhere to land, so every value a user picked was silently discarded.
-- Stored as an array because "She/Her" and "They/Them" together is a real answer.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pronouns TEXT[];

-- Whether the user has finished onboarding.
--
-- Accounts can now exist before a profile does: Google sign-in already created
-- users with a placeholder name, city and date of birth, and the staged signup
-- funnel does the same. Those accounts were still eligible to appear in other
-- people's discovery results, showing a stand-in date of birth of 1995-01-01.
-- Discovery now requires this stamp, which is only set once real profile values
-- have replaced the placeholders.
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Backfill for accounts that predate the funnel.
--
-- This deliberately fails OPEN: anyone showing any sign of having really used
-- the app keeps their place in discovery. Getting this wrong in the strict
-- direction silently removes real people from everyone's results, which is far
-- worse than briefly showing one thin profile, so the bar is low on purpose.
--
-- Only accounts with a placeholder city AND nothing filled in AND no photo are
-- left unstamped, which is exactly the shape of an abandoned Google signup.
UPDATE users u
   SET onboarding_completed_at = u.created_at
 WHERE u.onboarding_completed_at IS NULL
   AND (
        u.city IS DISTINCT FROM 'Unknown'
     OR EXISTS (
          SELECT 1 FROM user_profiles p
           WHERE p.user_id = u.id
             AND (
                  (p.bio IS NOT NULL AND length(trim(p.bio)) > 0)
               OR array_length(p.interests, 1) > 0
               OR p.height IS NOT NULL
             )
        )
     OR EXISTS (SELECT 1 FROM photos ph WHERE ph.user_id = u.id)
     OR EXISTS (SELECT 1 FROM personality_responses pr WHERE pr.user_id = u.id)
   );

-- The quiz goes from 8 questions to 12. Existing rows keep their first eight
-- answers and simply have nothing in the new columns until the user retakes it.
ALTER TABLE personality_responses ADD COLUMN IF NOT EXISTS question9_answer CHAR(1);
ALTER TABLE personality_responses ADD COLUMN IF NOT EXISTS question10_answer CHAR(1);
ALTER TABLE personality_responses ADD COLUMN IF NOT EXISTS question11_answer CHAR(1);
ALTER TABLE personality_responses ADD COLUMN IF NOT EXISTS question12_answer CHAR(1);

-- Signup is now a funnel (phone → OTP → email → OTP → password) rather than one
-- form post, so the half-finished account has to live somewhere until the last
-- step. It cannot live in `users`: that table's NOT NULL columns and its unique
-- email are what make a real account real, and a partial row there would be
-- indistinguishable from a signed-up user to every query in the codebase.
--
-- Rows are disposable. Nothing here grants access; only the final step writes to
-- `users`. Anything older than a day is swept on the next registration start.
CREATE TABLE IF NOT EXISTS pending_registrations (
    id SERIAL PRIMARY KEY,
    -- Opaque handle held by the client for the length of the funnel. Not a JWT:
    -- it authorises nothing except finishing this one signup.
    token VARCHAR(64) UNIQUE NOT NULL,
    phone TEXT,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    -- Set when the funnel was satisfied by Google instead of an email OTP.
    google_sub VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires_at
  ON pending_registrations(expires_at);
