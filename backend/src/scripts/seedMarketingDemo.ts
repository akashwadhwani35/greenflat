/**
 * Seeds the demo world used to record marketing walkthroughs in the live app.
 *
 * Every account is created with users.is_demo = TRUE from its very first row,
 * so it is never visible to a real person, not even for the seconds between the
 * insert and the profile being filled in (see services/demoWorld.service.ts).
 *
 * Profiles go through the real /profile/complete and /profile/photo endpoints so
 * the AI analysis, embeddings and photo storage run exactly as they do for a
 * person. Likes, matches and chats are written straight to the database, because
 * the daily limits exist to stop precisely this kind of bulk activity.
 *
 * Two accounts are the ones to record with: Ethan (a man looking for women) and
 * Chloe (a woman looking for men). Both are Premium with 500 GFT, and each has an
 * inbox with likes, Green Flags, a pending First Move and three live chats.
 *
 * Photos are read from PHOTO_DIR as m00.jpg..m13.jpg and f00.jpg..f13.jpg. They
 * are not in the repo.
 *
 *   API_BASE_URL=https://.../api DATABASE_URL=... JWT_SECRET=... \
 *   DEMO_PASSWORD=... PHOTO_DIR=/path/to/photos npm run seed:marketing
 *
 * Re-running refuses while the set exists; RESET=true deletes it first. The
 * accounts use demo_us_*@example.com, which purgeDemoProfiles.ts also matches
 * and which notifyEmail never writes to.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initializeUserDefaults } from '../services/accounts.service';
import { PROMPT_QUESTIONS } from '../utils/prompts';

dotenv.config();

const API_BASE_URL = (process.env.API_BASE_URL || '').replace(/\/+$/, '');
const PASSWORD = process.env.DEMO_PASSWORD || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const PHOTO_DIR = process.env.PHOTO_DIR || '';
const RESET = process.env.RESET === 'true';
const EMAIL_PREFIX = 'demo_us_';

type Place = { city: string; lat: number; lng: number };
const PLACES: Record<string, Place> = {
  williamsburg: { city: 'Brooklyn', lat: 40.7081, lng: -73.9571 },
  parkslope: { city: 'Brooklyn', lat: 40.671, lng: -73.9814 },
  bushwick: { city: 'Brooklyn', lat: 40.6944, lng: -73.9213 },
  greenpoint: { city: 'Brooklyn', lat: 40.7305, lng: -73.9515 },
  eastvillage: { city: 'New York', lat: 40.7265, lng: -73.9815 },
  westvillage: { city: 'New York', lat: 40.7358, lng: -74.0036 },
  chelsea: { city: 'New York', lat: 40.7465, lng: -74.0014 },
  uws: { city: 'New York', lat: 40.787, lng: -73.9754 },
  les: { city: 'New York', lat: 40.715, lng: -73.9843 },
  harlem: { city: 'New York', lat: 40.8116, lng: -73.9465 },
  astoria: { city: 'Queens', lat: 40.7644, lng: -73.9235 },
  lic: { city: 'Queens', lat: 40.7447, lng: -73.9485 },
  hoboken: { city: 'Hoboken', lat: 40.744, lng: -74.0324 },
  jerseycity: { city: 'Jersey City', lat: 40.7178, lng: -74.0431 },
};

type Seed = {
  slug: string;
  name: string;
  gender: 'male' | 'female';
  photo: string;
  dob: string;
  place: keyof typeof PLACES;
  height: number;
  occupation: string;
  education: string;
  hometown: string;
  interests: string[];
  bio: string;
  prompts: [number, string][];
  idealPartner: string;
  vibe: string;
  goal: 'long-term' | 'serious' | 'casual' | 'friendship';
  drinker: 'never' | 'socially' | 'often';
  fitness: string;
  starSign: string;
  answers: string[];
  verified: boolean;
};

// Prompt numbers index PROMPT_QUESTIONS (0-based).
const SEEDS: Seed[] = [
  // Men
  {
    slug: 'ethan', name: 'Ethan', gender: 'male', photo: 'm12', dob: '1998-05-11', place: 'westvillage', height: 183,
    occupation: 'Product designer', education: 'Undergraduate', hometown: 'Austin, TX',
    interests: ['Cooking', 'Running', 'Live music', 'Coffee', 'Travel'],
    bio: 'Moved here from Austin for work and stayed for the bagels. I run the West Side Highway most mornings and cook way too much on Sundays.',
    prompts: [[0, 'Long run by the river, a bacon egg and cheese, then a record store I have no business being in.'], [6, 'A playlist someone made for me. Instant serotonin.'], [12, 'Brisket is better than pastrami and I will not be taking questions.']],
    idealPartner: 'Someone curious who likes trying a new place every week.', vibe: 'Easygoing, a little nerdy about food.',
    goal: 'long-term', drinker: 'socially', fitness: 'Active', starSign: 'Taurus',
    answers: ['A', 'B', 'AC', 'C', 'B', 'C', 'B', 'AC', 'B', 'A'], verified: true,
  },
  {
    slug: 'mason', name: 'Mason', gender: 'male', photo: 'm01', dob: '1999-08-22', place: 'williamsburg', height: 185,
    occupation: 'Music producer', education: 'Undergraduate', hometown: 'San Diego, CA',
    interests: ['Music', 'Beaches', 'Festivals', 'Concerts', 'Road trips'],
    bio: 'California kid still adjusting to winters. I make beats in a studio the size of a closet and will absolutely send you a demo.',
    prompts: [[1, 'Bad puns delivered with total confidence.'], [4, 'Vintage synths I cannot afford.'], [11, 'A road trip down the PCH with no plan past day two.']],
    idealPartner: 'Someone warm who does not mind a late night in the studio.', vibe: 'Laid back, sun-chasing.',
    goal: 'serious', drinker: 'socially', fitness: 'Sometimes', starSign: 'Leo',
    answers: ['AB', 'A', 'B', 'AC', 'A', 'B', 'A', 'B', 'C', 'B'], verified: true,
  },
  {
    slug: 'jake', name: 'Jake', gender: 'male', photo: 'm00', dob: '1997-02-03', place: 'les', height: 180,
    occupation: 'Tattoo artist', education: 'High school', hometown: 'Philadelphia, PA',
    interests: ['Art', 'Drawing', 'Travel', 'Photography', 'Cocktails'],
    bio: 'I draw on people for a living. Ask before you ask me to draw on you. Usually found chasing a sunset with a sketchbook.',
    prompts: [[3, 'I cried at the end of Ratatouille. Twice.'], [9, 'Sunsets. I will leave a party early for one.'], [7, 'People who laugh with their whole face.']],
    idealPartner: 'A creative who has their own thing going on.', vibe: 'Artsy, a little chaotic, loyal.',
    goal: 'long-term', drinker: 'socially', fitness: 'Sometimes', starSign: 'Aquarius',
    answers: ['C', 'A', 'B', 'B', 'AB', 'A', 'C', 'B', 'A', 'B'], verified: true,
  },
  {
    slug: 'owen', name: 'Owen', gender: 'male', photo: 'm02', dob: '1996-11-19', place: 'uws', height: 188,
    occupation: 'Architect', education: 'Postgraduate', hometown: 'Boston, MA',
    interests: ['Design', 'Cycling', 'Reading', 'City trips', 'Coffee'],
    bio: 'Architect, so yes I will stop to look at a building mid-sentence. Just got back from Madrid and already planning the next one.',
    prompts: [[2, 'Why the Flatiron is the best building in the city.'], [5, 'A last-minute train to Philly for cheesesteaks and a museum.'], [10, 'Like the best kind of quiet Sunday, every day.']],
    idealPartner: 'Someone who can talk for hours and also sit comfortably in silence.', vibe: 'Thoughtful, dry humor.',
    goal: 'long-term', drinker: 'socially', fitness: 'Active', starSign: 'Scorpio',
    answers: ['B', 'C', 'A', 'C', 'B', 'C', 'B', 'A', 'B', 'B'], verified: true,
  },
  {
    slug: 'jayden', name: 'Jayden', gender: 'male', photo: 'm03', dob: '1999-04-07', place: 'harlem', height: 182,
    occupation: 'Software engineer', education: 'Undergraduate', hometown: 'Atlanta, GA',
    interests: ['Basketball', 'Hip-hop', 'Brunch', 'Fashion', 'Gaming'],
    bio: 'Atlanta raised, Harlem based. Engineer by day, pickup basketball by night. My brunch spot recommendations are elite.',
    prompts: [[13, 'Plans the group trip and somehow also books the restaurant.'], [6, 'Fresh kicks and a good playlist.'], [14, 'Tell me your most controversial food take.']],
    idealPartner: 'Someone with good energy who is down for whatever.', vibe: 'Outgoing, big-hearted.',
    goal: 'serious', drinker: 'socially', fitness: 'Very active', starSign: 'Aries',
    answers: ['A', 'A', 'A', 'AB', 'A', 'A', 'B', 'C', 'A', 'A'], verified: true,
  },
  {
    slug: 'tyler', name: 'Tyler', gender: 'male', photo: 'm04', dob: '2000-01-28', place: 'chelsea', height: 178,
    occupation: 'Marketing at a startup', education: 'Undergraduate', hometown: 'Columbus, OH',
    interests: ['Fashion', 'Gym', 'Café hopping', 'Comedy', 'Concerts'],
    bio: 'Ohio guy who moved to the city with two suitcases and a lot of optimism. Mirror selfies are a necessary evil.',
    prompts: [[1, 'Quote The Office at me at the right moment.'], [4, 'Finding the best iced latte in Chelsea. Taking submissions.'], [8, 'I start sending you memes at 1am.']],
    idealPartner: 'Funny, kind, a little competitive.', vibe: 'Friendly and a bit goofy.',
    goal: 'casual', drinker: 'socially', fitness: 'Active', starSign: 'Aquarius',
    answers: ['A', 'B', 'B', 'A', 'A', 'B', 'A', 'B', 'A', 'C'], verified: false,
  },
  {
    slug: 'hudson', name: 'Hudson', gender: 'male', photo: 'm05', dob: '1997-07-14', place: 'hoboken', height: 186,
    occupation: 'Finance analyst', education: 'Undergraduate', hometown: 'Greenwich, CT',
    interests: ['Golf', 'Fine dining', 'Wine', 'Travel', 'Fitness'],
    bio: 'Finance during the week, golf on weekends when the weather lets me. I make a very good old fashioned and an okay risotto.',
    prompts: [[9, 'Sunday dinner with my family, no phones.'], [11, 'A wine weekend in Napa.'], [8, 'I learn your coffee order without asking.']],
    idealPartner: 'Ambitious, grounded, close to her family.', vibe: 'Steady and a bit old school.',
    goal: 'long-term', drinker: 'socially', fitness: 'Active', starSign: 'Cancer',
    answers: ['B', 'C', 'C', 'C', 'B', 'C', 'B', 'A', 'B', 'B'], verified: true,
  },
  {
    slug: 'leo', name: 'Leo', gender: 'male', photo: 'm06', dob: '2001-03-02', place: 'bushwick', height: 175,
    occupation: 'Grad student', education: 'Postgraduate', hometown: 'Miami, FL',
    interests: ['Movies', 'Indie', 'Board games', 'Cooking', 'Gardening'],
    bio: 'Film grad student who will make you watch something from 1974. I keep too many plants alive in a very small apartment.',
    prompts: [[2, 'Why Before Sunrise is the most realistic love story ever made.'], [3, 'I grew up speaking Spanish and still count in it.'], [14, 'Recommend me a movie and defend it.']],
    idealPartner: 'Someone who reads the subtitles and still talks during the movie.', vibe: 'Soft-spoken, curious.',
    goal: 'serious', drinker: 'never', fitness: 'Sometimes', starSign: 'Pisces',
    answers: ['C', 'B', 'D', 'B', 'B', 'D', 'C', 'B', 'D', 'B'], verified: true,
  },
  {
    slug: 'wyatt', name: 'Wyatt', gender: 'male', photo: 'm07', dob: '1996-06-25', place: 'jerseycity', height: 187,
    occupation: 'Personal trainer', education: 'Undergraduate', hometown: 'Charleston, SC',
    interests: ['Gym', 'Swimming', 'Beaches', 'BBQ', 'Adventure'],
    bio: 'Trainer from the South, so yes I say y\'all. Happiest on a boat with the music too loud.',
    prompts: [[0, 'Morning workout, boat by noon, BBQ till the sun goes down.'], [9, 'My little sister\'s soccer games when I am home.'], [5, 'Driving out to the beach because the forecast said 75.']],
    idealPartner: 'Someone active who likes being outside.', vibe: 'Big energy, southern manners.',
    goal: 'serious', drinker: 'often', fitness: 'Very active', starSign: 'Cancer',
    answers: ['A', 'A', 'B', 'A', 'A', 'A', 'B', 'C', 'A', 'A'], verified: true,
  },
  {
    slug: 'lucas', name: 'Lucas', gender: 'male', photo: 'm08', dob: '1997-10-09', place: 'greenpoint', height: 181,
    occupation: 'Travel writer', education: 'Undergraduate', hometown: 'Denver, CO',
    interests: ['Travel', 'Writing', 'Backpacking', 'Photography', 'Coffee'],
    bio: 'Freelance travel writer. 31 countries and counting, and I still get lost in the subway.',
    prompts: [[3, 'I have eaten reindeer and I have regrets.'], [11, 'Watching the northern lights from somewhere very cold.'], [2, 'The best and worst hostels I have stayed in.']],
    idealPartner: 'Someone who says yes to a spontaneous trip.', vibe: 'Restless in a good way.',
    goal: 'long-term', drinker: 'socially', fitness: 'Active', starSign: 'Libra',
    answers: ['C', 'A', 'B', 'B', 'B', 'A', 'A', 'B', 'B', 'B'], verified: true,
  },
  {
    slug: 'caleb', name: 'Caleb', gender: 'male', photo: 'm09', dob: '2001-12-12', place: 'astoria', height: 177,
    occupation: 'Nursing student', education: 'Undergraduate', hometown: 'Minneapolis, MN',
    interests: ['Sports', 'Video games', 'Pizza', 'Dogs', 'Podcasts'],
    bio: 'Minnesota nice is real and I am proof. Nursing school by day, Mario Kart champion by night.',
    prompts: [[13, 'Remembers everyone\'s birthday.'], [6, 'A dog on the street letting me pet it.'], [14, 'Ask me my Astoria pizza rankings.']],
    idealPartner: 'Someone kind to strangers.', vibe: 'Sweet and a bit shy at first.',
    goal: 'serious', drinker: 'socially', fitness: 'Sometimes', starSign: 'Sagittarius',
    answers: ['B', 'B', 'C', 'B', 'B', 'B', 'C', 'B', 'C', 'C'], verified: false,
  },
  {
    slug: 'miles', name: 'Miles', gender: 'male', photo: 'm10', dob: '2000-09-30', place: 'lic', height: 179,
    occupation: 'Photographer', education: 'Undergraduate', hometown: 'Portland, OR',
    interests: ['Photography', 'Indie', 'Coffee', 'Fashion', 'Art'],
    bio: 'Portland transplant shooting film around Queens. My camera roll is 90% strangers\' dogs.',
    prompts: [[4, 'Expired film. The weirder the colors the better.'], [7, 'People who are a little bit odd and own it.'], [1, 'Send me a terrible photo of yourself.']],
    idealPartner: 'Someone who notices small things.', vibe: 'Chill, observant.',
    goal: 'casual', drinker: 'socially', fitness: 'Sometimes', starSign: 'Libra',
    answers: ['C', 'B', 'B', 'B', 'D', 'B', 'A', 'B', 'B', 'D'], verified: true,
  },
  {
    slug: 'logan', name: 'Logan', gender: 'male', photo: 'm11', dob: '1995-12-04', place: 'eastvillage', height: 180,
    occupation: 'Chef', education: 'Other', hometown: 'Chicago, IL',
    interests: ['Cooking', 'Fine dining', 'Wine', 'Jazz', 'Reading'],
    bio: 'Sous chef in the East Village. I will cook for you but I will also judge your knife skills a little.',
    prompts: [[8, 'I make you my grandma\'s lasagna.'], [12, 'Deep dish is a casserole and that is fine.'], [0, 'Farmers market, cook all afternoon, jazz bar at night.']],
    idealPartner: 'Someone who loves food as much as I do.', vibe: 'Calm, warm, a bit intense about food.',
    goal: 'long-term', drinker: 'socially', fitness: 'Rarely', starSign: 'Sagittarius',
    answers: ['B', 'C', 'C', 'C', 'B', 'C', 'B', 'A', 'B', 'C'], verified: true,
  },
  {
    slug: 'noah', name: 'Noah', gender: 'male', photo: 'm13', dob: '1998-03-17', place: 'parkslope', height: 184,
    occupation: 'High school teacher', education: 'Postgraduate', hometown: 'Santa Barbara, CA',
    interests: ['Beaches', 'Reading', 'Yoga', 'Camping', 'Dogs'],
    bio: 'I teach history to teenagers so my patience is basically infinite. Beach person stuck in a city, making it work.',
    prompts: [[10, 'Easy. Like you can be your full weird self.'], [9, 'Long walks with my dog, Biscuit.'], [3, 'I can recite every US president in order. Fast.']],
    idealPartner: 'Kind, honest, wants a real partner.', vibe: 'Gentle, steady.',
    goal: 'long-term', drinker: 'socially', fitness: 'Active', starSign: 'Pisces',
    answers: ['B', 'C', 'C', 'BC', 'B', 'C', 'C', 'A', 'B', 'C'], verified: true,
  },
  // Women
  {
    slug: 'chloe', name: 'Chloe', gender: 'female', photo: 'f10', dob: '1999-07-21', place: 'eastvillage', height: 165,
    occupation: 'Copywriter', education: 'Undergraduate', hometown: 'Nashville, TN',
    interests: ['Writing', 'Brunch', 'Live music', 'Café hopping', 'Reading'],
    bio: 'Nashville girl writing ads in New York. I laugh too loud in quiet restaurants and I know every word to every Taylor Swift song.',
    prompts: [[1, 'Commit to a bit and never break character.'], [6, 'A perfect iced matcha and a seat by the window.'], [14, 'Tell me the last concert you went to and if it was worth it.']],
    idealPartner: 'Someone funny and genuinely kind, who texts back.', vibe: 'Warm, chatty, a little dramatic.',
    goal: 'long-term', drinker: 'socially', fitness: 'Sometimes', starSign: 'Cancer',
    answers: ['A', 'B', 'B', 'AC', 'A', 'B', 'C', 'B', 'A', 'B'], verified: true,
  },
  {
    slug: 'lily', name: 'Lily', gender: 'female', photo: 'f00', dob: '2000-04-14', place: 'parkslope', height: 162,
    occupation: 'Florist', education: 'Undergraduate', hometown: 'Portland, ME',
    interests: ['Gardening', 'Painting', 'Baking', 'House plants', 'Reading'],
    bio: 'I arrange flowers for a living, which mostly means I smell nice and have cuts on my hands. Will bake you something.',
    prompts: [[0, 'Farmers market, a picnic in Prospect Park, and a nap in the sun.'], [6, 'Fresh peonies on the counter.'], [10, 'Soft and safe and a little bit silly.']],
    idealPartner: 'Gentle, patient, likes being outdoors.', vibe: 'Dreamy and sweet.',
    goal: 'long-term', drinker: 'never', fitness: 'Sometimes', starSign: 'Aries',
    answers: ['B', 'B', 'C', 'B', 'B', 'B', 'C', 'B', 'C', 'C'], verified: true,
  },
  {
    slug: 'emma', name: 'Emma', gender: 'female', photo: 'f01', dob: '1998-09-03', place: 'greenpoint', height: 168,
    occupation: 'Physical therapist', education: 'Postgraduate', hometown: 'Boulder, CO',
    interests: ['Hiking trips', 'Camping', 'Yoga', 'Travel', 'Coffee'],
    bio: 'Colorado girl who misses the mountains. I spend weekends finding the closest trail to the city. Spoiler, it is upstate.',
    prompts: [[11, 'Hike to an alpine lake and swim even though it is freezing.'], [9, 'Sunday yoga, non-negotiable.'], [7, 'People who are up for an early start.']],
    idealPartner: 'Adventurous, active, good at reading maps.', vibe: 'Outdoorsy and upbeat.',
    goal: 'serious', drinker: 'socially', fitness: 'Very active', starSign: 'Virgo',
    answers: ['A', 'A', 'B', 'B', 'A', 'B', 'B', 'C', 'B', 'A'], verified: true,
  },
  {
    slug: 'avery', name: 'Avery', gender: 'female', photo: 'f02', dob: '2001-02-10', place: 'bushwick', height: 170,
    occupation: 'Barista and DJ', education: 'Undergraduate', hometown: 'Seattle, WA',
    interests: ['EDM', 'Nightlife', 'Coffee', 'Festivals', 'Fashion'],
    bio: 'I make your coffee in the morning and your playlist at night. Seattle rain kid, Bushwick resident.',
    prompts: [[4, 'Finding the perfect transition between two songs nobody would pair.'], [1, 'Bad dancing. Committed bad dancing.'], [5, 'A warehouse party someone texted me about at 11pm.']],
    idealPartner: 'Someone who will dance with me even if they are bad at it.', vibe: 'Fun, night owl.',
    goal: 'casual', drinker: 'often', fitness: 'Sometimes', starSign: 'Aquarius',
    answers: ['A', 'A', 'B', 'A', 'A', 'A', 'A', 'B', 'A', 'B'], verified: false,
  },
  {
    slug: 'madison', name: 'Madison', gender: 'female', photo: 'f03', dob: '1999-11-27', place: 'hoboken', height: 163,
    occupation: 'Event planner', education: 'Undergraduate', hometown: 'Chicago, IL',
    interests: ['Festivals', 'Travel', 'Cocktails', 'Fashion', 'Dancing'],
    bio: 'I plan weddings for a living so I have opinions about first dances. Chicago born, Hoboken by way of a very good job offer.',
    prompts: [[5, 'Rooftop drinks that turn into a whole night.'], [13, 'Makes the group chat actually make plans.'], [8, 'I start making you a plus one.']],
    idealPartner: 'Confident, social, makes me laugh.', vibe: 'Bubbly and organised.',
    goal: 'serious', drinker: 'socially', fitness: 'Active', starSign: 'Sagittarius',
    answers: ['A', 'B', 'A', 'A', 'A', 'B', 'B', 'B', 'A', 'B'], verified: true,
  },
  {
    slug: 'sophia', name: 'Sophia', gender: 'female', photo: 'f04', dob: '1997-06-08', place: 'westvillage', height: 167,
    occupation: 'UX researcher', education: 'Postgraduate', hometown: 'Los Angeles, CA',
    interests: ['Design', 'Wine', 'Movies', 'Running', 'Cooking'],
    bio: 'LA native learning to love seasons. I ask people questions for a living, so sorry in advance.',
    prompts: [[2, 'Why people never read the instructions. I have data.'], [0, 'A run, a long lunch, and a movie at the Angelika.'], [7, 'People who are curious about everything.']],
    idealPartner: 'Thoughtful and a good conversationalist.', vibe: 'Curious and a bit sarcastic.',
    goal: 'long-term', drinker: 'socially', fitness: 'Active', starSign: 'Gemini',
    answers: ['C', 'B', 'A', 'C', 'B', 'C', 'B', 'A', 'B', 'B'], verified: true,
  },
  {
    slug: 'hazel', name: 'Hazel', gender: 'female', photo: 'f05', dob: '2000-05-19', place: 'astoria', height: 160,
    occupation: 'Pastry chef', education: 'Other', hometown: 'Providence, RI',
    interests: ['Baking', 'Cake', 'Gardening', 'Reading', 'Café hopping'],
    bio: 'Pastry chef. I will absolutely bring dessert to the first date. Lilac season is my favorite two weeks of the year.',
    prompts: [[6, 'A croissant that shatters properly.'], [3, 'I have never seen Star Wars and I am not sorry.'], [10, 'Like sharing dessert without asking.']],
    idealPartner: 'Sweet, patient, has a sweet tooth.', vibe: 'Cozy and romantic.',
    goal: 'long-term', drinker: 'socially', fitness: 'Rarely', starSign: 'Taurus',
    answers: ['B', 'C', 'C', 'B', 'B', 'B', 'C', 'B', 'C', 'C'], verified: true,
  },
  {
    slug: 'ava', name: 'Ava', gender: 'female', photo: 'f06', dob: '1998-08-30', place: 'jerseycity', height: 172,
    occupation: 'Nurse', education: 'Undergraduate', hometown: 'Tampa, FL',
    interests: ['Beaches', 'Swimming', 'Reality TV', 'Brunch', 'Travel'],
    bio: 'ER nurse from Florida, so very little scares me. On days off you will find me near any body of water.',
    prompts: [[9, 'FaceTiming my mom every Sunday.'], [12, 'The Bachelor is a sport.'], [5, 'Beach day because someone said the water was warm.']],
    idealPartner: 'Someone dependable who can make me laugh after a long shift.', vibe: 'Tough, funny, warm.',
    goal: 'serious', drinker: 'socially', fitness: 'Active', starSign: 'Virgo',
    answers: ['A', 'B', 'A', 'B', 'A', 'B', 'B', 'A', 'A', 'A'], verified: true,
  },
  {
    slug: 'nora', name: 'Nora', gender: 'female', photo: 'f07', dob: '1999-01-16', place: 'uws', height: 166,
    occupation: 'Grad student, psychology', education: 'Postgraduate', hometown: 'Ann Arbor, MI',
    interests: ['Reading', 'Journaling', 'Beaches', 'Podcasts', 'Deep chats'],
    bio: 'Psych grad student at Columbia. I will not analyze you, probably. Lake Michigan sunsets ruined all other sunsets for me.',
    prompts: [[2, 'Attachment styles, but in a fun way.'], [14, 'Ask me what I am reading.'], [10, 'Safe enough to be honest about everything.']],
    idealPartner: 'Emotionally available, likes long talks.', vibe: 'Thoughtful and soft.',
    goal: 'long-term', drinker: 'socially', fitness: 'Sometimes', starSign: 'Capricorn',
    answers: ['B', 'C', 'D', 'D', 'D', 'D', 'C', 'B', 'D', 'D'], verified: true,
  },
  {
    slug: 'ella', name: 'Ella', gender: 'female', photo: 'f08', dob: '2001-10-05', place: 'williamsburg', height: 164,
    occupation: 'Illustrator', education: 'Undergraduate', hometown: 'Burlington, VT',
    interests: ['Drawing', 'Art', 'Indie', 'Cats', 'Crafts'],
    bio: 'Freelance illustrator and full-time cat mom. Ask me to draw you as a frog, I will do it.',
    prompts: [[4, 'Drawing frogs in tiny outfits.'], [13, 'Brings snacks for everyone.'], [0, 'Picnic, sketchbook, a good playlist and nowhere to be.']],
    idealPartner: 'Gentle, creative, loves animals.', vibe: 'Whimsical and kind.',
    goal: 'serious', drinker: 'never', fitness: 'Sometimes', starSign: 'Libra',
    answers: ['C', 'B', 'B', 'B', 'B', 'B', 'C', 'B', 'C', 'D'], verified: false,
  },
  {
    slug: 'mia', name: 'Mia', gender: 'female', photo: 'f09', dob: '2000-12-20', place: 'chelsea', height: 161,
    occupation: 'Social media manager', education: 'Undergraduate', hometown: 'Orlando, FL',
    interests: ['Travel', 'Fashion', 'Movies', 'Sushi', 'Concerts'],
    bio: 'Orlando girl, so yes I have been to Disney more times than I can count and no I am not tired of it.',
    prompts: [[3, 'I have a season pass to Disney World and I use it.'], [1, 'Do a really bad impression of anyone.'], [11, 'Tokyo Disney, obviously.']],
    idealPartner: 'Someone playful who does not take life too seriously.', vibe: 'Playful and loud.',
    goal: 'serious', drinker: 'socially', fitness: 'Sometimes', starSign: 'Sagittarius',
    answers: ['A', 'A', 'B', 'A', 'A', 'A', 'B', 'B', 'A', 'B'], verified: true,
  },
  {
    slug: 'olivia', name: 'Olivia', gender: 'female', photo: 'f11', dob: '1998-02-25', place: 'les', height: 169,
    occupation: 'Lawyer', education: 'Postgraduate', hometown: 'Washington, DC',
    interests: ['Reading', 'Wine', 'Theater', 'Running', 'Fine dining'],
    bio: 'First-year associate at a law firm, so free time is precious. I spend it on Broadway, a good book or a long dinner.',
    prompts: [[12, 'Hamilton is overrated. Come at me.'], [9, 'A long Sunday run, whatever my week looks like.'], [8, 'I clear my calendar for you. That is a big deal.']],
    idealPartner: 'Driven, kind, can keep up in an argument.', vibe: 'Sharp and secretly sentimental.',
    goal: 'long-term', drinker: 'socially', fitness: 'Active', starSign: 'Pisces',
    answers: ['C', 'C', 'A', 'C', 'B', 'C', 'B', 'A', 'B', 'A'], verified: true,
  },
  {
    slug: 'harper', name: 'Harper', gender: 'female', photo: 'f12', dob: '1999-05-02', place: 'hoboken', height: 171,
    occupation: 'Real estate agent', education: 'Undergraduate', hometown: 'San Diego, CA',
    interests: ['Beaches', 'Wine', 'Travel', 'Cooking', 'Fitness'],
    bio: 'I sell apartments in Hoboken and dream about beach houses. Happiest by the ocean with a glass of white wine.',
    prompts: [[0, 'Beach in the morning, long lunch, sunset on a rooftop.'], [7, 'People with ambition and a soft side.'], [5, 'A spontaneous weekend in Montauk.']],
    idealPartner: 'Confident and ready for something real.', vibe: 'Sunny and driven.',
    goal: 'long-term', drinker: 'socially', fitness: 'Active', starSign: 'Taurus',
    answers: ['A', 'B', 'A', 'B', 'A', 'B', 'B', 'A', 'A', 'B'], verified: true,
  },
  {
    slug: 'aubrey', name: 'Aubrey', gender: 'female', photo: 'f13', dob: '2000-08-11', place: 'lic', height: 167,
    occupation: 'Dancer', education: 'Undergraduate', hometown: 'Houston, TX',
    interests: ['Dancing', 'R&B', 'Yoga', 'Beaches', 'Travel'],
    bio: 'Houston raised, dancing my way through New York. Golden hour is my whole personality.',
    prompts: [[6, 'Golden hour light hitting just right.'], [4, 'Learning salsa from YouTube.'], [8, 'I teach you a dance and you actually try.']],
    idealPartner: 'Someone confident who is not afraid to look silly.', vibe: 'Free-spirited.',
    goal: 'casual', drinker: 'socially', fitness: 'Very active', starSign: 'Leo',
    answers: ['A', 'A', 'B', 'A', 'A', 'A', 'A', 'C', 'A', 'B'], verified: true,
  },
];

const post = async (urlPath: string, body: any, token: string) => {
  const response = await fetch(`${API_BASE_URL}${urlPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json: any = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

const main = async () => {
  const missing = ['API_BASE_URL', 'DATABASE_URL', 'JWT_SECRET', 'DEMO_PASSWORD', 'PHOTO_DIR'].filter(
    (k) => !process.env[k]
  );
  if (missing.length) throw new Error(`Missing env: ${missing.join(', ')}`);

  for (const seed of SEEDS) {
    const file = path.join(PHOTO_DIR, `${seed.photo}.jpg`);
    if (!fs.existsSync(file)) throw new Error(`Photo missing: ${file}`);
    for (const [index] of seed.prompts) {
      if (!PROMPT_QUESTIONS[index]) throw new Error(`Bad prompt index ${index} for ${seed.slug}`);
    }
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  });

  const column = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_demo'`
  );
  if (column.rows.length === 0) {
    throw new Error('users.is_demo does not exist yet. Deploy migration 035 before seeding.');
  }

  const existing = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE email LIKE $1`, [`${EMAIL_PREFIX}%@example.com`]);
  if (existing.rows[0].n > 0) {
    if (!RESET) throw new Error(`${existing.rows[0].n} demo_us accounts exist. Re-run with RESET=true to replace them.`);
    // is_demo in the WHERE as well: never let a typo'd prefix reach a real account.
    const removed = await pool.query(`DELETE FROM users WHERE email LIKE $1 AND is_demo = TRUE`, [`${EMAIL_PREFIX}%@example.com`]);
    console.log(`Removed ${removed.rowCount} previous demo accounts.`);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const ids: Record<string, number> = {};

  console.log(`Seeding ${SEEDS.length} demo profiles against ${API_BASE_URL}\n`);
  for (const [i, seed] of SEEDS.entries()) {
    const place = PLACES[seed.place];
    const email = `${EMAIL_PREFIX}${seed.slug}@example.com`;
    const interestedIn = seed.gender === 'male' ? 'female' : 'male';

    const client = await pool.connect();
    let userId: number;
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO users (email, password_hash, name, gender, interested_in, date_of_birth, city,
                            is_demo, country, latitude, longitude, distance_radius, created_at, last_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 'US', $8, $9, 20000,
                 NOW() - ($10 || ' days')::INTERVAL, NOW() - ($11 || ' minutes')::INTERVAL)
         RETURNING id`,
        [email, passwordHash, seed.name, seed.gender, interestedIn, seed.dob, place.city,
         place.lat, place.lng, String(3 + (i % 18)), String(5 + i * 7)]
      );
      userId = inserted.rows[0].id;
      await initializeUserDefaults(client, userId);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    ids[seed.slug] = userId;

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
    const answers = Object.fromEntries(seed.answers.map((a, q) => [`question${q + 1}_answer`, a]));

    const profile = await post('/profile/complete', {
      name: seed.name,
      gender: seed.gender,
      interested_in: interestedIn,
      date_of_birth: seed.dob,
      city: place.city,
      distance_radius: 20000,
      orientation: 'Straight',
      pronouns: [seed.gender === 'male' ? 'he/him' : 'she/her'],
      height: seed.height,
      interests: seed.interests,
      bio: seed.bio,
      prompts: seed.prompts.map(([q, answer]) => ({ question: PROMPT_QUESTIONS[q], answer })),
      smoker: 'never',
      drinker: seed.drinker,
      diet: 'balanced',
      fitness_level: seed.fitness,
      education: seed.education,
      education_level: seed.education,
      occupation: seed.occupation,
      hometown: seed.hometown,
      relationship_goal: seed.goal,
      star_sign: seed.starSign,
      have_kids: 'No',
      family_oriented: seed.goal === 'long-term' ? true : null,
      open_minded: true,
      self_summary: seed.bio,
      ideal_partner_prompt: seed.idealPartner,
      connection_preferences: seed.vibe,
      ...answers,
    }, token);

    const photo = fs.readFileSync(path.join(PHOTO_DIR, `${seed.photo}.jpg`)).toString('base64');
    const uploaded = await post('/profile/photo', { photo_url: `data:image/jpeg;base64,${photo}`, is_primary: true }, token);

    if (seed.verified) {
      await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1 AND is_demo = TRUE', [userId]);
    }

    console.log(`  ${seed.name.padEnd(8)} #${userId}  profile=${profile.status} photo=${uploaded.status}`);
    if (profile.status >= 300 || uploaded.status >= 300) {
      console.log(`    ${JSON.stringify(profile.status >= 300 ? profile.body : uploaded.body)}`);
    }
  }

  // The two recording accounts: Premium for 120 days, 500 GFT, verified.
  for (const slug of ['ethan', 'chloe']) {
    const id = ids[slug];
    await pool.query(
      `UPDATE users SET is_premium = TRUE, premium_expires_at = NOW() + INTERVAL '120 days',
              credit_balance = 500, is_verified = TRUE
       WHERE id = $1 AND is_demo = TRUE`,
      [id]
    );
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan, status, starts_at, expires_at, provider)
       VALUES ($1, 'premium', 'active', NOW(), NOW() + INTERVAL '120 days', 'demo')`,
      [id]
    );
  }

  const like = (from: string, to: string, opts: { superlike?: boolean; ago: number; seen?: boolean }) =>
    pool.query(
      `INSERT INTO likes (liker_id, liked_id, is_on_grid, is_superlike, created_at, seen_at)
       VALUES ($1, $2, TRUE, $3, $4, $5) ON CONFLICT DO NOTHING`,
      [ids[from], ids[to], Boolean(opts.superlike), minutesAgo(opts.ago), opts.seen ? minutesAgo(opts.ago - 1) : null]
    );

  const pair = (a: string, b: string) => {
    const [x, y] = [ids[a], ids[b]];
    return x < y ? [x, y] : [y, x];
  };

  // A chat is a list of [sender slug, text, minutes ago]; the last line decides
  // what shows as unread.
  type Line = [string, string, number];
  const chat = async (a: string, b: string, matchedAgo: number, lines: Line[], unreadForLastRecipient = true) => {
    await like(a, b, { ago: matchedAgo + 30, seen: true });
    await like(b, a, { ago: matchedAgo, seen: true });
    const [u1, u2] = pair(a, b);
    const match = await pool.query(
      `INSERT INTO matches (user1_id, user2_id, matched_at, status, requested_by)
       VALUES ($1, $2, $3, 'active', NULL) RETURNING id`,
      [u1, u2, minutesAgo(matchedAgo)]
    );
    const matchId = match.rows[0].id;
    for (const [n, [sender, text, ago]] of lines.entries()) {
      const recipient = sender === a ? b : a;
      const isLast = n === lines.length - 1;
      await pool.query(
        `INSERT INTO messages (match_id, sender_id, recipient_id, content, message_type, is_read, created_at)
         VALUES ($1, $2, $3, $4, 'text', $5, $6)`,
        [matchId, ids[sender], ids[recipient], text, !(isLast && unreadForLastRecipient), minutesAgo(ago)]
      );
    }
    await pool.query('UPDATE matches SET last_message_at = $2 WHERE id = $1', [matchId, minutesAgo(lines[lines.length - 1][2])]);
  };

  const firstMove = async (from: string, to: string, text: string, ago: number) => {
    await pool.query(
      `INSERT INTO likes (liker_id, liked_id, is_on_grid, is_compliment, compliment_message, created_at)
       VALUES ($1, $2, TRUE, TRUE, $3, $4)`,
      [ids[from], ids[to], text, minutesAgo(ago)]
    );
    const [u1, u2] = pair(from, to);
    const match = await pool.query(
      `INSERT INTO matches (user1_id, user2_id, matched_at, status, requested_by, last_message_at)
       VALUES ($1, $2, $3, 'pending', $4, $3) RETURNING id`,
      [u1, u2, minutesAgo(ago), ids[from]]
    );
    await pool.query(
      `INSERT INTO messages (match_id, sender_id, recipient_id, content, message_type, kind, is_read, created_at)
       VALUES ($1, $2, $3, $4, 'text', 'first_move', FALSE, $5)`,
      [match.rows[0].id, ids[from], ids[to], text, minutesAgo(ago)]
    );
  };

  // Ethan's world.
  for (const [slug, ago] of [['lily', 40], ['avery', 95], ['hazel', 180], ['nora', 300]] as [string, number][]) {
    await like(slug, 'ethan', { ago });
  }
  await like('madison', 'ethan', { superlike: true, ago: 25 });
  await like('harper', 'ethan', { superlike: true, ago: 220 });
  await firstMove('olivia', 'ethan', 'Brisket over pastrami is a bold thing to put in writing. Where is the best one in the city, I need proof.', 55);
  await chat('ethan', 'sophia', 2900, [
    ['sophia', 'Okay a playlist someone made you is the most romantic answer I have seen on here', 2880],
    ['ethan', 'It is the highest form of love. Took me 3 hours once to get the order right', 2860],
    ['sophia', 'Three hours?? What was on it', 2850],
    ['ethan', 'A lot of Bon Iver and one Shania Twain song as a test', 2830],
    ['sophia', 'And did she pass the test', 2825],
    ['ethan', 'We are not together, so you tell me', 2800],
    ['sophia', 'Ha. Fair. Okay I run the West Side Highway too, which stretch are you on', 180],
    ['ethan', 'Usually Chelsea Piers up to 72nd and back. Around 7', 150],
    ['sophia', 'I am a 7:30 person but I could be convinced. Coffee after?', 12],
  ]);
  await chat('ethan', 'mia', 1500, [
    ['ethan', 'How many times have you been to Disney, honest number', 1490],
    ['mia', 'Honest number is embarrassing. Like 60', 1470],
    ['ethan', 'That is not embarrassing that is a lifestyle', 1460],
    ['mia', 'Thank you. Finally someone gets it. Favorite ride, go', 1300],
    ['ethan', 'Tower of Terror and I will not explain myself', 95],
  ], false);
  await chat('ethan', 'emma', 4300, [
    ['emma', 'You run every morning?? Respect. Ever done a trail race', 4280],
    ['ethan', 'Once, in Texas. It was flat and 100 degrees, I do not recommend', 4200],
    ['emma', 'Okay you need a real trail. Breakneck Ridge this Saturday, some friends are going', 600],
    ['ethan', 'I am in. What time does the train leave', 560],
    ['emma', '8:05 from Grand Central. Bring snacks', 540],
  ]);

  // Chloe's world.
  for (const [slug, ago] of [['jake', 30], ['owen', 110], ['tyler', 160], ['leo', 260], ['miles', 410]] as [string, number][]) {
    await like(slug, 'chloe', { ago });
  }
  await like('hudson', 'chloe', { superlike: true, ago: 20 });
  await like('lucas', 'chloe', { superlike: true, ago: 350 });
  await firstMove('noah', 'chloe', 'Every word to every Taylor Swift song is a big claim. All Too Well, ten minute version, no lyrics sheet?', 45);
  await chat('chloe', 'mason', 3000, [
    ['mason', 'Tell me the last concert you went to and if it was worth it. Your own question, so you have to answer first', 2990],
    ['chloe', 'Fair! Maggie Rogers at Forest Hills and yes, I cried', 2970],
    ['mason', 'Okay that is a great show. Mine was a tiny jazz thing in a basement in Bed-Stuy', 2950],
    ['chloe', 'That sounds way cooler than mine', 2940],
    ['mason', 'There is another one Thursday if you want to find out', 140],
    ['chloe', 'Wait yes. Send me the address', 130],
    ['mason', 'Sending now. Doors at 8', 9],
  ]);
  await chat('chloe', 'jayden', 1800, [
    ['jayden', 'Your matcha order, I need to know it', 1790],
    ['chloe', 'Iced, oat milk, no sweetener. I am not a monster', 1760],
    ['jayden', 'Respectable. There is a spot on 116th that would change your life', 1740],
    ['chloe', 'Bold claim from a man who plays pickup at 10pm', 1200],
    ['jayden', 'I contain multitudes. This weekend?', 70],
  ]);
  await chat('chloe', 'wyatt', 5000, [
    ['chloe', 'Okay, y\'all. Where in the South', 4990],
    ['wyatt', 'Charleston! You?', 4980],
    ['chloe', 'Nashville. So we basically grew up together', 4960],
    ['wyatt', 'Basically neighbors. Do you miss real biscuits up here', 4900],
    ['chloe', 'Every single day', 4880],
  ], false);

  // A little life between the others so their inboxes are not empty either.
  await chat('hudson', 'harper', 6000, [
    ['hudson', 'Montauk this weekend is a great idea', 5990],
    ['harper', 'Right? Bring the old fashioneds', 5900],
  ], false);
  await chat('lucas', 'avery', 7000, [
    ['avery', '31 countries is insane, what is number 32', 6990],
    ['lucas', 'Japan in March, if the flights cooperate', 6900],
  ], false);

  const counts = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM users WHERE is_demo) AS users,
       (SELECT COUNT(*)::int FROM likes l JOIN users u ON u.id = l.liker_id WHERE u.is_demo) AS likes,
       (SELECT COUNT(*)::int FROM matches m JOIN users u ON u.id = m.user1_id WHERE u.is_demo) AS matches,
       (SELECT COUNT(*)::int FROM messages g JOIN users u ON u.id = g.sender_id WHERE u.is_demo) AS messages`
  );
  console.log('\nDemo world:', counts.rows[0]);
  console.log(`Record with ${EMAIL_PREFIX}ethan@example.com or ${EMAIL_PREFIX}chloe@example.com.`);

  await pool.end();
};

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
