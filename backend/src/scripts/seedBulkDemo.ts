/**
 * Bulk demo population, for making the admin dashboard show something real.
 *
 * Writes straight to the database rather than going through the API, unlike
 * seedDemoProfiles.ts which creates a small handful of hand-written people. At a
 * thousand profiles the API route is the wrong tool twice over: every
 * /profile/complete triggers a personality analysis and an embedding, so it
 * would be two thousand OpenAI calls and a real bill, and the signup limiter
 * would refuse the traffic anyway.
 *
 * The trade is that these profiles have no persona embedding. Matching falls
 * back to interest and personality overlap, which is the same path used for
 * anyone the AI has not analysed yet, so discovery still behaves sensibly.
 *
 * Everything is shaped to light up the admin dashboard: signups spread over
 * three months so the growth chart has a curve, a slice of paying accounts with
 * subscriptions and token purchases for revenue, credit spend for token
 * analytics, likes and matches and messages for engagement, plus a handful of
 * reports, bans and shadow-bans for the moderation queue.
 *
 * Every account uses demo_bulk_*@example.com, which the existing
 * cleanup:demo-profiles script already matches, so the whole set removes in one
 * command.
 *
 *   COUNT=1000 DATABASE_URL=postgres://... npm run seed:bulk
 *
 * NOTE: no photographs. The small seeder pulls portraits of real people from
 * randomuser.me; doing that a thousand times over would be both rude to that
 * service and worse on the same consent grounds. These profiles carry no photo,
 * which is honest about what they are.
 */
import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { PERSONALITY_QUESTIONS, traitsForAnswers, type QuizOptionKey } from '../utils/personalityQuestions';

dotenv.config();

const COUNT = Number(process.env.COUNT || 1000);
const BATCH = 50;

// --- source material ---------------------------------------------------------

const FIRST_NAMES_F = ['Ananya', 'Meera', 'Ishita', 'Ritika', 'Sana', 'Tara', 'Priya', 'Diya', 'Aisha', 'Kavya', 'Nisha', 'Riya', 'Anjali', 'Shreya', 'Pooja', 'Neha', 'Simran', 'Lakshmi', 'Divya', 'Sneha', 'Emma', 'Olivia', 'Sofia', 'Chloe', 'Maya', 'Zara', 'Leila', 'Hannah', 'Grace', 'Amara'];
const FIRST_NAMES_M = ['Arjun', 'Kabir', 'Rohan', 'Dev', 'Vikram', 'Aditya', 'Rahul', 'Karan', 'Nikhil', 'Siddharth', 'Aryan', 'Manish', 'Varun', 'Ishaan', 'Yash', 'Raj', 'Sameer', 'Anil', 'Tarun', 'Gaurav', 'Liam', 'Noah', 'Ethan', 'Marcus', 'Daniel', 'Omar', 'Adam', 'Leo', 'Julian', 'Kai'];
const FIRST_NAMES_NB = ['Alex', 'Sam', 'Jordan', 'Riley', 'Avery', 'Rowan', 'Sky', 'Charlie', 'Quinn', 'Nour'];
const LAST_NAMES = ['Sharma', 'Verma', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Kapoor', 'Mehta', 'Singh', 'Gupta', 'Bose', 'Rao', 'Desai', 'Chopra', 'Khan', 'Joshi', 'Sinha', 'Malhotra', 'Bhat', 'Pillai'];

const CITIES = [
  { city: 'Delhi', lat: 28.6139, lng: 77.209, weight: 22 },
  { city: 'Mumbai', lat: 19.076, lng: 72.8777, weight: 20 },
  { city: 'Bangalore', lat: 12.9716, lng: 77.5946, weight: 18 },
  { city: 'Hyderabad', lat: 17.385, lng: 78.4867, weight: 10 },
  { city: 'Pune', lat: 18.5204, lng: 73.8567, weight: 9 },
  { city: 'Chennai', lat: 13.0827, lng: 80.2707, weight: 8 },
  { city: 'Kolkata', lat: 22.5726, lng: 88.3639, weight: 6 },
  { city: 'Jaipur', lat: 26.9124, lng: 75.7873, weight: 4 },
  { city: 'Ahmedabad', lat: 23.0225, lng: 72.5714, weight: 3 },
];

const INTERESTS = ['Travel', 'Fitness', 'Music', 'Art', 'Cooking', 'Gaming', 'Reading', 'Sports', 'Movies', 'Technology', 'Photography', 'Dancing', 'Hiking', 'Coffee', 'Yoga', 'Cycling', 'Live music', 'Board games', 'Running', 'Theatre'];
const OCCUPATIONS = ['Product Designer', 'Software Engineer', 'Teacher', 'Doctor', 'Architect', 'Chef', 'Journalist', 'Photographer', 'Consultant', 'Founder', 'Nurse', 'Lawyer', 'Data Analyst', 'Musician', 'Physiotherapist', 'Accountant', 'Illustrator', 'Researcher'];
const EDUCATION = ['High school', 'Bachelors', 'Masters', 'PhD', 'Trade school'];
const GOALS = ['serious', 'casual', 'long-term', 'friendship', 'exploring'];
const DIETS = ['Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian', 'Keto'];
const HABIT = ['never', 'social', 'regular'];
const FITNESS = ['Not active', 'Lightly active', 'Active', 'Very active'];
const BODY = ['Slim', 'Athletic', 'Average', 'Curvy', 'Muscular', 'Plus-size'];
const PRONOUNS_F = ['she/her'];
const PRONOUNS_M = ['he/him'];
const PRONOUNS_NB = ['they/them', 'she/they', 'he/they'];

const BIO_OPENERS = [
  'Weekend hiker, weekday desk person.',
  'I cook when I am stressed, so my flatmates eat well.',
  'Trying to read more and scroll less.',
  'Will happily argue about films for an hour.',
  'Currently learning pottery, badly.',
  'Long walks, strong coffee, no small talk.',
  'I take my dog everywhere. He is the charming one.',
  'New to the city and looking for the good places.',
  'Runner, reader, mediocre guitarist.',
  'I plan holidays I never take.',
];
const PROMPTS_1 = ['The way to my heart is a gig in a small room.', 'I am unreasonably competitive about board games.', 'My best trait is remembering birthdays.', 'I will always say yes to a road trip.', 'I make a genuinely good biryani.'];
const PROMPTS_2 = ['Looking for someone curious about the world.', 'Someone who has their own thing going on.', 'Kindness first, everything else after.', 'A partner in crime for slow Sundays.', 'Someone who laughs at their own jokes.'];
const PROMPTS_3 = ['Ask me about the time I missed a flight on purpose.', 'I still call my grandmother every Sunday.', 'I am learning to cook my mum’s recipes properly.', 'I have strong opinions about train travel.', 'I once walked 30km for a sandwich.'];

// --- helpers -----------------------------------------------------------------

let seed = 42;
/** Deterministic PRNG, so a run is reproducible and diffable. */
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const pickMany = <T>(arr: T[], n: number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
};
const chance = (p: number) => rand() < p;
const intBetween = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const weightedCity = () => {
  const total = CITIES.reduce((sum, c) => sum + c.weight, 0);
  let roll = rand() * total;
  for (const c of CITIES) {
    roll -= c.weight;
    if (roll <= 0) return c;
  }
  return CITIES[0];
};

/** Ages skew young, like a real dating app, rather than being flat 18-65. */
const skewedAge = () => {
  const r = rand();
  if (r < 0.45) return intBetween(22, 28);
  if (r < 0.75) return intBetween(29, 35);
  if (r < 0.92) return intBetween(36, 45);
  return intBetween(46, 62);
};

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/** Signups accelerate toward the present, so the growth chart has a shape. */
const signupDaysAgo = () => Math.floor(90 * Math.pow(rand(), 1.7));

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  console.log(`Seeding ${COUNT} demo profiles directly into the database\n`);

  const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD || 'Passw0rd!', 10);
  const createdIds: { id: number; gender: string; interestedIn: string; createdAt: Date }[] = [];

  for (let start = 0; start < COUNT; start += BATCH) {
    const size = Math.min(BATCH, COUNT - start);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (let i = 0; i < size; i++) {
        const index = start + i;

        // ~48/48/4 across women, men and non-binary.
        const genderRoll = rand();
        const gender = genderRoll < 0.48 ? 'female' : genderRoll < 0.96 ? 'male' : 'other';
        const firstName =
          gender === 'female' ? pick(FIRST_NAMES_F) : gender === 'male' ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_NB);
        const name = `${firstName} ${pick(LAST_NAMES)}`;

        // Mostly straight, with a realistic minority who are not.
        const orientationRoll = rand();
        const interestedIn =
          orientationRoll < 0.82
            ? gender === 'female'
              ? 'male'
              : gender === 'male'
                ? 'female'
                : 'both'
            : orientationRoll < 0.93
              ? 'both'
              : gender === 'female'
                ? 'female'
                : 'male';

        const age = skewedAge();
        const dob = new Date(Date.now() - age * 365.25 * 24 * 60 * 60 * 1000);
        const place = weightedCity();
        const created = daysAgo(signupDaysAgo());

        // Most accounts are active in the last fortnight; a tail has drifted off.
        const lastActive = chance(0.72)
          ? daysAgo(intBetween(0, 14))
          : chance(0.5)
            ? daysAgo(intBetween(15, 45))
            : created;

        const isPremium = chance(0.09);
        // A few profiles are boosted right now, so boost effectiveness is measurable.
        const boostExpiresAt = chance(0.04) ? daysAgo(-intBetween(1, 6) / 24) : null;
        const isBanned = chance(0.012);
        const isShadowBanned = !isBanned && chance(0.015);
        const pronouns =
          gender === 'female' ? PRONOUNS_F : gender === 'male' ? PRONOUNS_M : [pick(PRONOUNS_NB)];

        const userResult = await client.query(
          `INSERT INTO users (
             email, password_hash, name, gender, interested_in, pronouns, date_of_birth,
             city, latitude, longitude, distance_radius, is_verified, is_premium,
             premium_expires_at, boost_expires_at, credit_balance, cooldown_enabled, is_banned,
             is_shadow_banned, onboarding_completed_at, last_active, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22)
           RETURNING id`,
          [
            `demo_bulk_${index}@example.com`,
            passwordHash,
            name,
            gender,
            interestedIn,
            pronouns,
            dob.toISOString().slice(0, 10),
            place.city,
            place.lat + (rand() - 0.5) * 0.35,
            place.lng + (rand() - 0.5) * 0.35,
            pick([10, 25, 50, 50, 100, 20000]),
            chance(0.35),
            isPremium,
            isPremium ? daysAgo(-intBetween(3, 60)) : null,
            boostExpiresAt,
            intBetween(0, 60),
            gender === 'female',
            isBanned,
            isShadowBanned,
            created,
            lastActive,
            created,
          ]
        );

        const userId = userResult.rows[0].id;
        createdIds.push({ id: userId, gender, interestedIn, createdAt: created });

        await client.query(
          `INSERT INTO user_profiles (
             user_id, height, body_type, interests, bio, prompt1, prompt2, prompt3,
             smoker, smoking_habit, drinker, drugs, diet, fitness_level, education,
             occupation, relationship_goal, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)`,
          [
            userId,
            gender === 'female' ? intBetween(150, 178) : intBetween(162, 192),
            pick(BODY),
            pickMany(INTERESTS, intBetween(3, 6)),
            pick(BIO_OPENERS),
            pick(PROMPTS_1),
            pick(PROMPTS_2),
            pick(PROMPTS_3),
            chance(0.18),
            pick(HABIT),
            pick(HABIT),
            chance(0.9) ? 'never' : 'sometimes',
            pick(DIETS),
            pick(FITNESS),
            pick(EDUCATION),
            pick(OCCUPATIONS),
            pick(GOALS),
            created,
          ]
        );

        // A quarter never finished the quiz, which is what real completion looks like.
        if (chance(0.75)) {
          const answers = PERSONALITY_QUESTIONS.map(
            () => pick(['A', 'B', 'C', 'D']) as QuizOptionKey
          );
          const traits = traitsForAnswers(answers);
          const columns = PERSONALITY_QUESTIONS.map((q) => `question${q.number}_answer`);
          const placeholders = answers.map((_, n) => `$${n + 2}`);

          await client.query(
            `INSERT INTO personality_responses (
               user_id, ${columns.join(', ')}, personality_traits, top_traits, created_at, updated_at
             ) VALUES ($1, ${placeholders.join(', ')}, $${answers.length + 2}, $${answers.length + 3}, $${answers.length + 4}, $${answers.length + 4})`,
            [userId, ...answers, traits, traits.slice(0, 3), created]
          );
        }

        await client.query(
          `INSERT INTO user_activity_limits (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
          [userId]
        );
        await client.query(
          `INSERT INTO user_privacy_settings (user_id, hide_distance, hide_city, incognito_mode, show_online_status)
           VALUES ($1, FALSE, FALSE, $2, FALSE) ON CONFLICT (user_id) DO NOTHING`,
          [userId, chance(0.05)]
        );
        await client.query(
          `INSERT INTO user_notification_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
          [userId]
        );

        // Money, for the revenue and token panels.
        if (isPremium) {
          const plan = chance(0.6) ? 'pro' : 'premium';
          const cents = plan === 'pro' ? pick([699, 1499, 2999, 4499]) : pick([1199, 2499, 4999, 7499]);
          await client.query(
            `INSERT INTO subscriptions (user_id, plan, status, starts_at, expires_at, provider, provider_transaction_id, created_at, updated_at)
             VALUES ($1,$2,'active',$3,$4,'demo',$5,$3,$3)`,
            [userId, plan, created, daysAgo(-intBetween(3, 60)), `demo_sub_${userId}`, ]
          );
          await client.query(
            `INSERT INTO token_purchases (user_id, pack_id, tokens, amount_cents, currency, provider, provider_transaction_id, created_at)
             VALUES ($1,$2,$3,$4,'USD','demo',$5,$6)`,
            [userId, '40', 40, 899, `demo_pack_${userId}`, created]
          );
        }

        // Token spend, for the usage panel.
        //
        // The reason strings must be exactly the ones the app writes, because
        // the dashboard maps ledger reasons to its feature buckets by name and
        // anything else silently reports as zero. Amounts are paired with the
        // reason rather than picked independently, so the spend per feature is
        // consistent with TOKEN_COSTS.
        const SPEND_KINDS: { reason: string; amount: number; weight: number }[] = [
          { reason: 'ai_search', amount: 1, weight: 60 },
          { reason: 'superlike', amount: 4, weight: 20 },
          { reason: 'compliment_send', amount: 6, weight: 13 },
          { reason: 'boost_activation', amount: 20, weight: 7 },
        ];
        const pickSpend = () => {
          const total = SPEND_KINDS.reduce((sum, k) => sum + k.weight, 0);
          let roll = rand() * total;
          for (const kind of SPEND_KINDS) {
            roll -= kind.weight;
            if (roll <= 0) return kind;
          }
          return SPEND_KINDS[0];
        };

        const spends = intBetween(0, 6);
        for (let n = 0; n < spends; n++) {
          const kind = pickSpend();
          await client.query(
            `INSERT INTO credit_transactions (user_id, amount, direction, reason, created_at)
             VALUES ($1,$2,'debit',$3,$4)`,
            [userId, kind.amount, kind.reason, daysAgo(intBetween(0, 30))]
          );
        }
      }

      await client.query('COMMIT');
      process.stdout.write(`  ${Math.min(start + size, COUNT)}/${COUNT}\r`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  console.log(`\n${createdIds.length} profiles created. Building activity...\n`);

  // --- likes, matches, messages ---------------------------------------------

  const wants = (a: { gender: string; interestedIn: string }, b: { gender: string; interestedIn: string }) =>
    (a.interestedIn === 'both' || a.interestedIn === b.gender) &&
    (b.interestedIn === 'both' || b.interestedIn === a.gender);

  let likes = 0;
  let matches = 0;
  let messages = 0;
  let reports = 0;

  const client = await pool.connect();
  try {
    for (const liker of createdIds) {
      const attempts = intBetween(0, 5);
      for (let n = 0; n < attempts; n++) {
        const target = createdIds[Math.floor(rand() * createdIds.length)];
        if (target.id === liker.id || !wants(liker, target)) continue;

        const likedAt = daysAgo(intBetween(0, 30));
        // A slice of likes are compliments, which the engagement panel measures
        // a reply rate against.
        const isCompliment = chance(0.08);
        const inserted = await client.query(
          `INSERT INTO likes (liker_id, liked_id, is_on_grid, is_superlike, is_compliment, compliment_message, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [
            liker.id,
            target.id,
            chance(0.4),
            chance(0.06),
            isCompliment,
            isCompliment
              ? pick(['Loved your answer about road trips', 'That biryani line got me', 'Your taste in music is excellent'])
              : null,
            likedAt,
          ]
        );
        if (inserted.rows.length === 0) continue;
        likes++;

        // About a fifth get liked back, which becomes a match and a conversation.
        if (chance(0.2)) {
          const back = await client.query(
            `INSERT INTO likes (liker_id, liked_id, is_on_grid, is_superlike, created_at)
             VALUES ($1,$2,FALSE,FALSE,$3) ON CONFLICT DO NOTHING RETURNING id`,
            [target.id, liker.id, likedAt]
          );
          if (back.rows.length === 0) continue;
          likes++;

          const a = Math.min(liker.id, target.id);
          const b = Math.max(liker.id, target.id);
          const match = await client.query(
            `INSERT INTO matches (user1_id, user2_id, matched_at, last_message_at)
             VALUES ($1,$2,$3,$3) ON CONFLICT DO NOTHING RETURNING id`,
            [a, b, likedAt]
          );
          if (match.rows.length === 0) continue;
          matches++;

          const matchId = match.rows[0].id;
          const lines = intBetween(0, 6);
          for (let m = 0; m < lines; m++) {
            const fromA = m % 2 === 0;
            await client.query(
              `INSERT INTO messages (match_id, sender_id, recipient_id, content, is_read, created_at)
               VALUES ($1,$2,$3,$4,$5,$6)`,
              [
                matchId,
                fromA ? a : b,
                fromA ? b : a,
                pick(['Hey! How is your week going?', 'Your profile made me laugh', 'What are you up to this weekend?', 'Okay but which is the best coffee place here', 'Ha, same actually', 'Would you be up for a walk sometime?']),
                chance(0.7),
                new Date(likedAt.getTime() + (m + 1) * 3600 * 1000),
              ]
            );
            messages++;
          }
        }
      }
    }

    // A moderation queue with something in it.
    for (let n = 0; n < 14; n++) {
      const reporter = createdIds[Math.floor(rand() * createdIds.length)];
      const reported = createdIds[Math.floor(rand() * createdIds.length)];
      if (reporter.id === reported.id) continue;
      await client.query(
        `INSERT INTO reports (reporter_id, reported_id, reason, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$5)`,
        [
          reporter.id,
          reported.id,
          pick(['Inappropriate photos', 'Spam or scam', 'Harassment', 'Fake profile', 'Underage']),
          pick(['pending', 'pending', 'reviewed', 'resolved']),
          daysAgo(intBetween(0, 20)),
        ]
      );
      reports++;
    }

    // Profile views, so the engagement panel is not empty.
    for (let n = 0; n < COUNT * 2; n++) {
      const viewer = createdIds[Math.floor(rand() * createdIds.length)];
      const viewed = createdIds[Math.floor(rand() * createdIds.length)];
      if (viewer.id === viewed.id) continue;
      await client.query(
        `INSERT INTO profile_views (viewer_id, viewed_id, created_at) VALUES ($1,$2,$3)`,
        [viewer.id, viewed.id, daysAgo(intBetween(0, 30))]
      );
    }
  } finally {
    client.release();
  }

  console.log(`  profiles: ${createdIds.length}`);
  console.log(`  likes:    ${likes}`);
  console.log(`  matches:  ${matches}`);
  console.log(`  messages: ${messages}`);
  console.log(`  reports:  ${reports}`);
  console.log(`\nDone. Remove everything with: APPLY_CHANGES=true npm run cleanup:demo-profiles`);

  await pool.end();
};

main().catch((error) => {
  console.error('\nBulk seed failed:', error);
  process.exit(1);
});
