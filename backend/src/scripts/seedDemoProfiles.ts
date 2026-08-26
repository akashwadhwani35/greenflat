/**
 * Seeds realistic demo profiles, likes, matches and conversations.
 *
 * Profiles are created through the real API so they go through the same
 * onboarding path as a person would, which means the AI personality analysis and
 * the persona embeddings actually run. Likes and messages are written straight to
 * the database, because the daily activity limits exist to stop exactly this kind
 * of bulk behaviour.
 *
 * Every account uses a demo_*@example.com address, which is what
 * purgeDemoProfiles.ts matches, so the whole set can be removed in one command.
 *
 * Photos come from randomuser.me, a demo-data service whose portraits are
 * published for placeholder use. They are pictures of real people, so this is
 * fine for a private test build and is NOT suitable for anything public,
 * marketing, or app store screenshots.
 *
 *   API_BASE_URL=https://... DATABASE_URL=postgres://... npm run seed:demo
 */
import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:5001/api').replace(/\/+$/, '');
const PASSWORD = process.env.DEMO_PASSWORD || 'Passw0rd!';
const JWT_SECRET = process.env.JWT_SECRET || '';

type Seed = {
  slug: string;
  name: string;
  gender: 'male' | 'female';
  interestedIn: 'male' | 'female';
  dob: string;
  city: string;
  height: number;
  interests: string[];
  bio: string;
  prompt1: string;
  prompt2: string;
  prompt3: string;
  selfSummary: string;
  idealPartner: string;
  connection: string;
  dealbreakers: string;
  growth: string;
  goal: string;
  drinker: string;
  smoker: boolean;
  answers: string[];
};

// Written by hand rather than generated, so the grid does not read as filler.
const SEEDS: Seed[] = [
  {
    slug: 'ananya', name: 'Ananya', gender: 'female', interestedIn: 'male',
    dob: '1997-03-14', city: 'Delhi', height: 163,
    interests: ['pottery', 'hiking', 'street food'],
    bio: 'Ceramicist by weekend, product designer by weekday. I will find the best momos in any neighbourhood.',
    prompt1: 'I once drove to Rishikesh at 4am because someone said the light was good.',
    prompt2: 'Looking for someone who has a strong opinion about something small.',
    prompt3: 'Currently learning to throw a bowl that is not lopsided.',
    selfSummary: 'Curious, a bit stubborn, happiest with clay under my nails.',
    idealPartner: 'Someone kind who asks a second question.',
    connection: 'Slow build. I like knowing how someone thinks before anything else.',
    dealbreakers: 'Being rude to waiters.',
    growth: 'Learning that resting is not the same as wasting time.',
    goal: 'serious', drinker: 'social', smoker: false,
    answers: ['A', 'B', 'A', 'C', 'B', 'A', 'D', 'A'],
  },
  {
    slug: 'meera', name: 'Meera', gender: 'female', interestedIn: 'male',
    dob: '1995-08-02', city: 'Delhi', height: 168,
    interests: ['film photography', 'books', 'trekking'],
    bio: 'I develop my own film in the kitchen sink. Half my shelf is books I have already read twice.',
    prompt1: 'Best trip was Spiti, alone, no signal for nine days.',
    prompt2: 'I reread books I love instead of starting new ones.',
    prompt3: 'Ask me about the darkroom I built in a bathroom.',
    selfSummary: 'Quiet, observant, happiest outdoors with a camera.',
    idealPartner: 'Patient, likes being outside, does not need to fill every silence.',
    connection: 'Honesty, and being comfortable saying nothing.',
    dealbreakers: 'Cynicism dressed up as realism.',
    growth: 'Getting better at saying what I actually want.',
    goal: 'serious', drinker: 'rarely', smoker: false,
    answers: ['B', 'B', 'A', 'C', 'B', 'C', 'D', 'B'],
  },
  {
    slug: 'ishita', name: 'Ishita', gender: 'female', interestedIn: 'male',
    dob: '1999-01-27', city: 'Delhi', height: 158,
    interests: ['running', 'cooking', 'live music'],
    bio: 'Training for a half marathon I did not think through. I cook when I am stressed, so my flatmates eat well.',
    prompt1: 'I have run every Sunday morning for three years, rain included.',
    prompt2: 'The way to my heart is a gig in a small room.',
    prompt3: 'My biryani is genuinely good and I will not be modest about it.',
    selfSummary: 'High energy, warm, terrible at sitting still.',
    idealPartner: 'Someone with their own thing going on.',
    connection: 'Enthusiasm. I like people who are into something properly.',
    dealbreakers: 'Flakiness.',
    growth: 'Learning that not every weekend needs a plan.',
    goal: 'serious', drinker: 'social', smoker: false,
    answers: ['A', 'A', 'B', 'A', 'A', 'A', 'C', 'A'],
  },
  {
    slug: 'ritika', name: 'Ritika', gender: 'female', interestedIn: 'male',
    dob: '1994-11-09', city: 'Delhi', height: 170,
    interests: ['architecture', 'cycling', 'coffee'],
    bio: 'Architect. I will point out the brickwork on a building you have walked past a hundred times.',
    prompt1: 'I cycle to work through Lodhi Gardens and it is the best part of my day.',
    prompt2: 'I make coffee with an unreasonable amount of equipment.',
    prompt3: 'Ask me why that flyover is badly designed.',
    selfSummary: 'Precise about work, relaxed about most other things.',
    idealPartner: 'Someone thoughtful who does not take themselves too seriously.',
    connection: 'Long conversations that go sideways.',
    dealbreakers: 'People who never change their mind.',
    growth: 'Learning to leave things good enough.',
    goal: 'serious', drinker: 'social', smoker: false,
    answers: ['C', 'B', 'C', 'C', 'B', 'C', 'D', 'C'],
  },
  {
    slug: 'sana', name: 'Sana', gender: 'female', interestedIn: 'male',
    dob: '1996-06-21', city: 'Delhi', height: 165,
    interests: ['painting', 'travel', 'dogs'],
    bio: 'I paint badly and often. Two rescue dogs run my life and I am fine with it.',
    prompt1: 'My dogs are called Biscuit and Bhindi. No, I do not want to explain.',
    prompt2: 'I have been to eleven states and remember all of them by their food.',
    prompt3: 'I will drag you to an exhibition and then argue about it.',
    selfSummary: 'Soft on people, chaotic about schedules.',
    idealPartner: 'Someone gentle, who likes animals and does not mind mess.',
    connection: 'Warmth first, everything else after.',
    dealbreakers: 'Not liking dogs. Genuinely.',
    growth: 'Learning to be on time.',
    goal: 'serious', drinker: 'rarely', smoker: false,
    answers: ['B', 'A', 'B', 'B', 'A', 'B', 'C', 'B'],
  },
  {
    slug: 'tara', name: 'Tara', gender: 'female', interestedIn: 'male',
    dob: '1993-04-05', city: 'Delhi', height: 172,
    interests: ['yoga', 'writing', 'plants'],
    bio: 'I write for a living and keep too many plants. Currently failing at monstera propagation.',
    prompt1: 'I teach a yoga class on Saturday mornings that I am mostly unqualified for.',
    prompt2: 'I keep a notebook of overheard sentences.',
    prompt3: 'The plants outnumber the furniture now.',
    selfSummary: 'Calm on the outside, always writing something in my head.',
    idealPartner: 'Someone steady who reads.',
    connection: 'Depth over frequency. I am a bad texter, a good listener.',
    dealbreakers: 'Contempt.',
    growth: 'Learning to send the message instead of drafting it forever.',
    goal: 'serious', drinker: 'rarely', smoker: false,
    answers: ['C', 'B', 'C', 'D', 'B', 'C', 'D', 'C'],
  },
  {
    slug: 'arjun', name: 'Arjun', gender: 'male', interestedIn: 'female',
    dob: '1995-04-10', city: 'Delhi', height: 180,
    interests: ['hiking', 'film photography', 'cooking'],
    bio: 'Weekend hiker, slow coffee, still shoot on 35mm. Currently failing at sourdough.',
    prompt1: 'I will always say yes to a sunrise trek.',
    prompt2: 'Looking for someone who asks second questions.',
    prompt3: 'My starter is named and I am not proud of that.',
    selfSummary: 'Curious and grounded, a bit restless on weekends.',
    idealPartner: 'Someone kind who is genuinely interested in things.',
    connection: 'Depth over small talk, slow build.',
    dealbreakers: 'Dismissiveness, phone at dinner.',
    growth: 'Learning to slow down and not fill every silence.',
    goal: 'serious', drinker: 'social', smoker: false,
    answers: ['A', 'B', 'A', 'C', 'B', 'A', 'D', 'A'],
  },
  {
    slug: 'kabir', name: 'Kabir', gender: 'male', interestedIn: 'female',
    dob: '1993-09-18', city: 'Delhi', height: 176,
    interests: ['music', 'books', 'cycling'],
    bio: 'I play bass in a band that practises more than it performs. Reading through the Russians, slowly.',
    prompt1: 'We have played four gigs and I remember all of them.',
    prompt2: 'I am 600 pages into a book I started in March.',
    prompt3: 'I cycle everywhere, including places I should not.',
    selfSummary: 'Easy-going, a bit obsessive about the things I like.',
    idealPartner: 'Someone with taste and patience.',
    connection: 'Shared enthusiasm. I want to hear about your thing.',
    dealbreakers: 'People who are bored by everything.',
    growth: 'Learning to finish what I start.',
    goal: 'serious', drinker: 'social', smoker: false,
    answers: ['D', 'B', 'C', 'D', 'B', 'D', 'D', 'D'],
  },
  {
    slug: 'rohan', name: 'Rohan', gender: 'male', interestedIn: 'female',
    dob: '1997-12-01', city: 'Delhi', height: 183,
    interests: ['running', 'street food', 'football'],
    bio: 'Five-a-side on Wednesdays, long runs on Sundays. I know where the good chaat is.',
    prompt1: 'I have opinions about which paratha lane is actually best.',
    prompt2: 'I run to think, not to be healthy.',
    prompt3: 'I will absolutely take football too seriously.',
    selfSummary: 'Straightforward, competitive, warmer than I look.',
    idealPartner: 'Someone who says what they mean.',
    connection: 'Doing things together rather than talking about doing things.',
    dealbreakers: 'Game playing.',
    growth: 'Learning to lose gracefully.',
    goal: 'serious', drinker: 'social', smoker: false,
    answers: ['A', 'A', 'A', 'A', 'A', 'A', 'C', 'A'],
  },
  {
    slug: 'dev', name: 'Dev', gender: 'male', interestedIn: 'female',
    dob: '1992-07-23', city: 'Delhi', height: 178,
    interests: ['architecture', 'travel', 'coffee'],
    bio: 'I design buildings and photograph other people’s. Been to twenty countries, remember four properly.',
    prompt1: 'I plan trips around one building I want to stand inside.',
    prompt2: 'I make a flat white better than most cafes here.',
    prompt3: 'Ask me about the year I lived in Ahmedabad.',
    selfSummary: 'Considered, quiet until I am not.',
    idealPartner: 'Someone curious who likes wandering without a plan.',
    connection: 'Slow, honest, unhurried.',
    dealbreakers: 'Incuriosity.',
    growth: 'Learning to stop optimising everything.',
    goal: 'serious', drinker: 'social', smoker: false,
    answers: ['C', 'C', 'C', 'C', 'C', 'C', 'D', 'C'],
  },
  {
    slug: 'vikram', name: 'Vikram', gender: 'male', interestedIn: 'female',
    dob: '1996-02-16', city: 'Delhi', height: 174,
    interests: ['dogs', 'cooking', 'trekking'],
    bio: 'I foster dogs, which means my flat is always a bit chaotic. I cook for people as a love language.',
    prompt1: 'Seventeen dogs have passed through this house. I cried each time.',
    prompt2: 'Sunday is for a long cook with the windows open.',
    prompt3: 'I have done Kheerganga four times and will go again.',
    selfSummary: 'Soft-hearted, practical, allergic to pretence.',
    idealPartner: 'Someone warm who does not mind fur on everything.',
    connection: 'Kindness. It is genuinely the whole thing for me.',
    dealbreakers: 'Cruelty of any kind.',
    growth: 'Learning to ask for help.',
    goal: 'serious', drinker: 'rarely', smoker: false,
    answers: ['B', 'B', 'B', 'B', 'B', 'B', 'C', 'B'],
  },
  {
    slug: 'aditya', name: 'Aditya', gender: 'male', interestedIn: 'female',
    dob: '1994-10-30', city: 'Delhi', height: 181,
    interests: ['live music', 'writing', 'yoga'],
    bio: 'Journalist. I spend my week talking to strangers and my weekend avoiding everyone.',
    prompt1: 'The best interview I did was with a man who repairs typewriters.',
    prompt2: 'I go to gigs alone and prefer it.',
    prompt3: 'I started yoga for my back and stayed for the quiet.',
    selfSummary: 'Observant, introverted, funnier once comfortable.',
    idealPartner: 'Someone self-contained who likes their own company too.',
    connection: 'Real conversation, not performance.',
    dealbreakers: 'People who talk only about themselves.',
    growth: 'Learning to be less guarded.',
    goal: 'serious', drinker: 'rarely', smoker: false,
    answers: ['C', 'D', 'D', 'D', 'D', 'C', 'D', 'D'],
  },
];

const post = async (path: string, body: any, token?: string) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json: any = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
};

/** Portraits from randomuser.me. Placeholder demo data, not for public use. */
const fetchPortraitDataUrl = async (gender: 'male' | 'female', index: number): Promise<string | null> => {
  const folder = gender === 'male' ? 'men' : 'women';
  const url = `https://randomuser.me/api/portraits/${folder}/${index % 90}.jpg`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) return null;
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
};

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required (used for likes, matches and messages)');
  }
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required (tokens are minted locally to skip the signup rate limit)');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  });

  console.log(`Seeding ${SEEDS.length} demo profiles against ${API_BASE_URL}\n`);

  const created: { id: number; token: string; seed: Seed }[] = [];

  for (const [i, seed] of SEEDS.entries()) {
    const email = `demo_${seed.slug}@example.com`;

    // Users are inserted directly rather than through /auth/signup: the signup
    // rate limiter allows 5 per hour per IP, which is correct for real traffic
    // and useless for seeding. Everything after this still goes through the API,
    // so the AI personality analysis and embeddings run exactly as they would
    // for a real person.
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const inserted = await pool.query(
      `INSERT INTO users (email, password_hash, name, gender, interested_in, date_of_birth, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [email, passwordHash, seed.name, seed.gender, seed.interestedIn, seed.dob, seed.city]
    );

    const userId = inserted.rows[0].id as number;
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });

    const profile = await post(
      '/profile/complete',
      {
        height: seed.height,
        interests: seed.interests,
        bio: seed.bio,
        prompt1: seed.prompt1,
        prompt2: seed.prompt2,
        prompt3: seed.prompt3,
        self_summary: seed.selfSummary,
        ideal_partner_prompt: seed.idealPartner,
        connection_preferences: seed.connection,
        dealbreakers: seed.dealbreakers,
        growth_journey: seed.growth,
        relationship_goal: seed.goal,
        drinker: seed.drinker,
        smoker: seed.smoker,
        question1_answer: seed.answers[0],
        question2_answer: seed.answers[1],
        question3_answer: seed.answers[2],
        question4_answer: seed.answers[3],
        question5_answer: seed.answers[4],
        question6_answer: seed.answers[5],
        question7_answer: seed.answers[6],
        question8_answer: seed.answers[7],
      },
      token
    );

    // Two photos each so the profile gallery has something to swipe through.
    let photoCount = 0;
    for (let p = 0; p < 2; p++) {
      const dataUrl = await fetchPortraitDataUrl(seed.gender, i * 2 + p + 3);
      if (!dataUrl) continue;
      const uploaded = await post('/profile/photo', { photo_url: dataUrl, is_primary: p === 0 }, token);
      if (uploaded.status < 300) photoCount++;
    }

    created.push({ id: userId, token, seed });
    console.log(
      `  ✓ ${seed.name.padEnd(8)} #${String(userId).padEnd(3)} profile=${profile.status} photos=${photoCount}`
    );
  }

  console.log(`\n${created.length} profiles ready. Building activity...\n`);

  const byGender = (g: 'male' | 'female') => created.filter((c) => c.seed.gender === g);
  const women = byGender('female');
  const men = byGender('male');

  if (women.length === 0 || men.length === 0) {
    console.log('Not enough profiles of both genders to build matches; skipping activity.');
    await pool.end();
    return;
  }

  // Likes are inserted directly: the daily activity limits exist precisely to
  // prevent this volume through the API.
  let likes = 0;
  const like = async (from: number, to: number, superlike = false) => {
    await pool.query(
      `INSERT INTO likes (liker_id, liked_id, is_on_grid, is_superlike)
       VALUES ($1, $2, TRUE, $3) ON CONFLICT DO NOTHING`,
      [from, to, superlike]
    );
    likes++;
  };

  // Every man likes two women; a subset is reciprocated so there are real matches.
  for (const [i, m] of men.entries()) {
    await like(m.id, women[i % women.length].id, i % 4 === 0);
    await like(m.id, women[(i + 1) % women.length].id);
  }
  for (const [i, w] of women.entries()) {
    if (i % 2 === 0) await like(w.id, men[i % men.length].id);
  }

  // Mutual likes become matches.
  const mutual = await pool.query(
    `SELECT a.liker_id AS u1, a.liked_id AS u2
     FROM likes a
     JOIN likes b ON b.liker_id = a.liked_id AND b.liked_id = a.liker_id
     WHERE a.liker_id < a.liked_id`
  );

  let matches = 0;
  const conversations: { matchId: number; u1: number; u2: number }[] = [];
  for (const row of mutual.rows) {
    const inserted = await pool.query(
      `INSERT INTO matches (user1_id, user2_id, matched_at)
       VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING RETURNING id`,
      [row.u1, row.u2]
    );
    if (inserted.rows.length > 0) {
      matches++;
      conversations.push({ matchId: inserted.rows[0].id, u1: row.u1, u2: row.u2 });
    }
  }

  const OPENERS = [
    ['That Spiti trip sounds like a story. Did you plan it or just go?', 'Just went. Booked a bus the night before and figured it out.'],
    ['Okay but which paratha lane, genuinely.', 'Gali Paranthe Wali, and I will die on this hill.'],
    ['Your starter has a name? What is it.', 'Gerald. He is temperamental but we understand each other.'],
    ['Which building did you plan a whole trip around?', 'The Salk Institute. Stood there for two hours, said nothing.'],
    ['Biscuit and Bhindi is an incredible pair of names.', 'Bhindi came first. Biscuit was named to match the energy.'],
  ];

  let messages = 0;
  for (const [i, c] of conversations.entries()) {
    const pair = OPENERS[i % OPENERS.length];
    for (const [j, text] of pair.entries()) {
      const sender = j === 0 ? c.u1 : c.u2;
      const recipient = j === 0 ? c.u2 : c.u1;
      await pool.query(
        `INSERT INTO messages (match_id, sender_id, recipient_id, content, message_type, is_read, created_at)
         VALUES ($1, $2, $3, $4, 'text', $5, NOW() - ($6 || ' minutes')::INTERVAL)`,
        [c.matchId, sender, recipient, text, j === 0, String((pair.length - j) * 7)]
      );
      messages++;
    }
    await pool.query('UPDATE matches SET last_message_at = NOW() WHERE id = $1', [c.matchId]);
  }

  // A few profile views so the admin engagement numbers are not all zero.
  let views = 0;
  for (const m of men) {
    for (const w of women.slice(0, 3)) {
      await pool.query(
        'INSERT INTO profile_views (viewer_id, viewed_id) VALUES ($1, $2)',
        [m.id, w.id]
      );
      views++;
    }
  }

  console.log(`  likes:    ${likes}`);
  console.log(`  matches:  ${matches}`);
  console.log(`  messages: ${messages}`);
  console.log(`  views:    ${views}`);
  console.log(`\nDone. Remove everything with: APPLY_CHANGES=true npm run cleanup:demo-profiles`);

  await pool.end();
};

main().catch(async (error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
