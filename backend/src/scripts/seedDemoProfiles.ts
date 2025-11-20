import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pool from '../config/database';
import { PERSONALITY_TRAITS_MAP } from '../utils/constants';
import { analyzePersonality } from '../services/openai.service';

dotenv.config();

type Gender = 'male' | 'female';
type InterestedIn = 'male' | 'female' | 'both';

interface DemoProfile {
  email: string;
  password?: string;
  name: string;
  gender: Gender;
  interested_in: InterestedIn;
  date_of_birth: string;
  city: string;
  is_verified?: boolean;
  is_premium?: boolean;
  cooldown_enabled?: boolean;
  height: number;
  body_type: string;
  interests: string[];
  bio: string;
  prompt1: string;
  prompt2: string;
  prompt3: string;
  smoker: boolean;
  drinker: string;
  diet: string;
  fitness_level: string;
  education: string;
  occupation: string;
  relationship_goal: string;
  family_oriented: boolean;
  spiritual: boolean;
  open_minded: boolean;
  career_focused: boolean;
  quizAnswers: string[];
  photos: string[];
}

const DEFAULT_PASSWORD = process.env.DEMO_USER_PASSWORD || 'Passw0rd!';

const femaleProfiles: DemoProfile[] = [
  {
    email: 'aisha.kapoor@example.com',
    name: 'Aisha Kapoor',
    password: DEFAULT_PASSWORD,
    gender: 'female',
    interested_in: 'male',
    date_of_birth: '1994-05-18',
    city: 'Delhi',
    is_verified: true,
    cooldown_enabled: true,
    height: 165,
    body_type: 'athletic',
    interests: ['travel', 'yoga', 'street food', 'photography'],
    bio: 'Product designer who loves sunrise hikes and masala chai conversations.',
    prompt1: 'Perfect Sunday: yoga at Lodhi Garden and a slow brunch.',
    prompt2: 'Green flag: someone who plans spontaneous getaways.',
    prompt3: 'I get irrationally excited about new photo spots.',
    smoker: false,
    drinker: 'social',
    diet: 'vegetarian',
    fitness_level: 'active',
    education: 'Masters in Design',
    occupation: 'Product Designer',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: false,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['B', 'A', 'B', 'A', 'B', 'A', 'B', 'A'],
    photos: [
      'https://randomuser.me/api/portraits/women/45.jpg',
      'https://randomuser.me/api/portraits/women/46.jpg',
    ],
  },
  {
    email: 'neha.sharma@example.com',
    name: 'Neha Sharma',
    password: DEFAULT_PASSWORD,
    gender: 'female',
    interested_in: 'male',
    date_of_birth: '1992-11-02',
    city: 'Mumbai',
    is_verified: true,
    cooldown_enabled: true,
    height: 160,
    body_type: 'slim',
    interests: ['cinema', 'running', 'coffee', 'sustainability'],
    bio: 'Film marketer chasing monsoon runs and meaningful stories.',
    prompt1: 'I light up when the city smells like first rain.',
    prompt2: 'Let’s debate which movie has the best soundtrack.',
    prompt3: 'Teach me your favourite pour-over technique.',
    smoker: false,
    drinker: 'social',
    diet: 'flexitarian',
    fitness_level: 'active',
    education: 'MBA in Marketing',
    occupation: 'Marketing Lead',
    relationship_goal: 'serious',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B'],
    photos: [
      'https://randomuser.me/api/portraits/women/21.jpg',
      'https://randomuser.me/api/portraits/women/22.jpg',
    ],
  },
  {
    email: 'kavya.menon@example.com',
    name: 'Kavya Menon',
    password: DEFAULT_PASSWORD,
    gender: 'female',
    interested_in: 'male',
    date_of_birth: '1995-03-12',
    city: 'Bengaluru',
    cooldown_enabled: true,
    height: 168,
    body_type: 'fit',
    interests: ['startups', 'board games', 'classical music', 'gardening'],
    bio: 'Product manager who code-switches between Carnatic ragas and stand-ups.',
    prompt1: 'I geek out over efficient city design.',
    prompt2: 'Looking for a co-op partner—board games or business ideas.',
    prompt3: 'My love language is playlists and post-it reminders.',
    smoker: false,
    drinker: 'rarely',
    diet: 'vegetarian',
    fitness_level: 'moderate',
    education: 'B.Tech in Computer Science',
    occupation: 'Product Manager',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['C', 'C', 'B', 'C', 'C', 'C', 'C', 'B'],
    photos: [
      'https://randomuser.me/api/portraits/women/18.jpg',
      'https://randomuser.me/api/portraits/women/19.jpg',
    ],
  },
  {
    email: 'priya.desai@example.com',
    name: 'Priya Desai',
    password: DEFAULT_PASSWORD,
    gender: 'female',
    interested_in: 'male',
    date_of_birth: '1990-07-28',
    city: 'Pune',
    cooldown_enabled: true,
    is_premium: true,
    height: 170,
    body_type: 'athletic',
    interests: ['trail running', 'baking', 'travel', 'podcasts'],
    bio: 'Civil engineer who builds bridges by day and sourdough starters by night.',
    prompt1: 'Currently learning how to make the perfect croissant.',
    prompt2: 'We’ll get along if you love early hikes.',
    prompt3: 'My comfort show is Parks and Recreation.',
    smoker: false,
    drinker: 'rarely',
    diet: 'vegan',
    fitness_level: 'intense',
    education: 'Masters in Structural Engineering',
    occupation: 'Civil Engineer',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: false,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['A', 'A', 'C', 'A', 'A', 'A', 'D', 'A'],
    photos: [
      'https://randomuser.me/api/portraits/women/30.jpg',
      'https://randomuser.me/api/portraits/women/31.jpg',
    ],
  },
  {
    email: 'riya.malhotra@example.com',
    name: 'Riya Malhotra',
    password: DEFAULT_PASSWORD,
    gender: 'female',
    interested_in: 'male',
    date_of_birth: '1996-12-05',
    city: 'Hyderabad',
    cooldown_enabled: true,
    height: 162,
    body_type: 'average',
    interests: ['dance', 'poetry', 'fusion food', 'community work'],
    bio: 'UX researcher, kathak dancer, and chai evangelist.',
    prompt1: 'On weekends you’ll find me hosting poetry circles.',
    prompt2: 'We’ll get along if you love experimenting in the kitchen.',
    prompt3: 'I can never say no to live music.',
    smoker: false,
    drinker: 'never',
    diet: 'vegetarian',
    fitness_level: 'moderate',
    education: 'Masters in HCI',
    occupation: 'UX Researcher',
    relationship_goal: 'serious',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['B', 'B', 'A', 'B', 'B', 'B', 'B', 'A'],
    photos: [
      'https://randomuser.me/api/portraits/women/7.jpg',
      'https://randomuser.me/api/portraits/women/8.jpg',
    ],
  },
  {
    email: 'simran.kaur@example.com',
    name: 'Simran Kaur',
    password: DEFAULT_PASSWORD,
    gender: 'female',
    interested_in: 'male',
    date_of_birth: '1993-01-16',
    city: 'Chandigarh',
    cooldown_enabled: true,
    height: 167,
    body_type: 'fit',
    interests: ['photography', 'road trips', 'bollywood trivia', 'running'],
    bio: 'Architect who documents cities and sunsets.',
    prompt1: 'I’m happiest on a highway with a killer playlist.',
    prompt2: 'Great relationships need curiosity and kindness.',
    prompt3: 'I collect postcards from every city I visit.',
    smoker: false,
    drinker: 'social',
    diet: 'vegetarian',
    fitness_level: 'active',
    education: 'B.Arch',
    occupation: 'Architect',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: false,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['A', 'A', 'B', 'A', 'A', 'A', 'A', 'D'],
    photos: [
      'https://randomuser.me/api/portraits/women/38.jpg',
      'https://randomuser.me/api/portraits/women/39.jpg',
    ],
  },
  {
    email: 'ananya.gupta@example.com',
    name: 'Ananya Gupta',
    password: DEFAULT_PASSWORD,
    gender: 'female',
    interested_in: 'male',
    date_of_birth: '1991-04-21',
    city: 'Kolkata',
    cooldown_enabled: true,
    height: 158,
    body_type: 'petite',
    interests: ['literature', 'theatre', 'vegan cooking', 'yoga'],
    bio: 'Publisher building inclusive narratives and brewing kombucha.',
    prompt1: 'Currently staging a community theatre project.',
    prompt2: 'We’ll get along if you love slow mornings and long reads.',
    prompt3: 'Let’s exchange favourite independent bookstores.',
    smoker: false,
    drinker: 'rarely',
    diet: 'vegan',
    fitness_level: 'moderate',
    education: 'Masters in Literature',
    occupation: 'Publishing Editor',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['B', 'B', 'C', 'B', 'B', 'B', 'B', 'B'],
    photos: [
      'https://randomuser.me/api/portraits/women/55.jpg',
      'https://randomuser.me/api/portraits/women/56.jpg',
    ],
  },
  {
    email: 'meera.joshi@example.com',
    name: 'Meera Joshi',
    password: DEFAULT_PASSWORD,
    gender: 'female',
    interested_in: 'male',
    date_of_birth: '1997-09-09',
    city: 'Goa',
    cooldown_enabled: true,
    height: 163,
    body_type: 'fit',
    interests: ['marine conservation', 'surfing', 'culinary experiments', 'photography'],
    bio: 'Marine biologist who surfs at dawn and cooks at dusk.',
    prompt1: 'Best compliment: I make people feel calm.',
    prompt2: 'We’ll get along if you love the ocean.',
    prompt3: 'Currently learning how to ferment everything.',
    smoker: false,
    drinker: 'social',
    diet: 'pescatarian',
    fitness_level: 'active',
    education: 'Masters in Marine Biology',
    occupation: 'Marine Biologist',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: false,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'],
    photos: [
      'https://randomuser.me/api/portraits/women/2.jpg',
      'https://randomuser.me/api/portraits/women/3.jpg',
    ],
  },
  {
    email: 'tara.iyer@example.com',
    name: 'Tara Iyer',
    password: DEFAULT_PASSWORD,
    gender: 'female',
    interested_in: 'male',
    date_of_birth: '1998-08-14',
    city: 'Chennai',
    cooldown_enabled: true,
    height: 169,
    body_type: 'athletic',
    interests: ['bharatanatyam', 'tech policy', 'coffee brewing', 'travel'],
    bio: 'Tech policy analyst and classical dancer balancing rhythm and reform.',
    prompt1: 'Currently obsessed with filter coffee techniques.',
    prompt2: 'We’ll get along if you enjoy live performances.',
    prompt3: 'Let’s swap policy podcasts.',
    smoker: false,
    drinker: 'rarely',
    diet: 'vegetarian',
    fitness_level: 'active',
    education: 'Masters in Public Policy',
    occupation: 'Policy Analyst',
    relationship_goal: 'serious',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['C', 'B', 'C', 'B', 'C', 'C', 'C', 'B'],
    photos: [
      'https://randomuser.me/api/portraits/women/12.jpg',
      'https://randomuser.me/api/portraits/women/13.jpg',
    ],
  },
  {
    email: 'ishita.nair@example.com',
    name: 'Ishita Nair',
    password: DEFAULT_PASSWORD,
    gender: 'female',
    interested_in: 'male',
    date_of_birth: '1993-06-30',
    city: 'Kochi',
    cooldown_enabled: true,
    height: 161,
    body_type: 'average',
    interests: ['ayurveda', 'classical music', 'kayaking', 'reading'],
    bio: 'Wellness entrepreneur grounding modern life with traditional wisdom.',
    prompt1: 'Morning routine involves pranayama and Malayalam poetry.',
    prompt2: 'We’ll get along if you value balance.',
    prompt3: 'I cook to celebrate every small win.',
    smoker: false,
    drinker: 'never',
    diet: 'vegetarian',
    fitness_level: 'moderate',
    education: 'MBA in Entrepreneurship',
    occupation: 'Wellness Founder',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['B', 'C', 'C', 'B', 'B', 'C', 'D', 'B'],
    photos: [
      'https://randomuser.me/api/portraits/women/70.jpg',
      'https://randomuser.me/api/portraits/women/71.jpg',
    ],
  },
  {
    email: 'sanya.bhatia@example.com',
    name: 'Sanya Bhatia',
    password: DEFAULT_PASSWORD,
    gender: 'female',
    interested_in: 'male',
    date_of_birth: '1995-01-27',
    city: 'Jaipur',
    cooldown_enabled: true,
    height: 164,
    body_type: 'fit',
    interests: ['handicrafts', 'cycling', 'history walks', 'sustainability'],
    bio: 'Museum curator reviving heritage through storytelling.',
    prompt1: 'I give the best Pink City food tours.',
    prompt2: 'We’ll get along if you love curious conversations.',
    prompt3: 'Currently designing a zero-waste wardrobe.',
    smoker: false,
    drinker: 'rarely',
    diet: 'vegetarian',
    fitness_level: 'active',
    education: 'Masters in History',
    occupation: 'Museum Curator',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['B', 'A', 'B', 'B', 'B', 'A', 'B', 'B'],
    photos: [
      'https://randomuser.me/api/portraits/women/90.jpg',
      'https://randomuser.me/api/portraits/women/91.jpg',
    ],
  },
  {
    email: 'pooja.reddy@example.com',
    name: 'Pooja Reddy',
    password: DEFAULT_PASSWORD,
    gender: 'female',
    interested_in: 'male',
    date_of_birth: '1992-03-08',
    city: 'Hyderabad',
    cooldown_enabled: true,
    height: 172,
    body_type: 'athletic',
    interests: ['triathlons', 'tech conferences', 'podcasts', 'coffee'],
    bio: 'Cloud architect racing triathlons and redesigning infrastructure.',
    prompt1: 'Let’s trade training hacks and productivity tips.',
    prompt2: 'We’ll get along if you enjoy learning loops.',
    prompt3: 'I love mapping the best coffee spots.',
    smoker: false,
    drinker: 'social',
    diet: 'non-vegetarian',
    fitness_level: 'intense',
    education: 'B.Tech in Electronics',
    occupation: 'Cloud Architect',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: false,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['A', 'A', 'C', 'A', 'C', 'A', 'D', 'C'],
    photos: [
      'https://randomuser.me/api/portraits/women/15.jpg',
      'https://randomuser.me/api/portraits/women/16.jpg',
    ],
  },
  {
    email: 'diya.banerjee@example.com',
    name: 'Diya Banerjee',
    password: DEFAULT_PASSWORD,
    gender: 'female',
    interested_in: 'male',
    date_of_birth: '1999-10-11',
    city: 'Kolkata',
    cooldown_enabled: true,
    height: 159,
    body_type: 'petite',
    interests: ['stand-up comedy', 'indie music', 'astronomy', 'art'],
    bio: 'Data analyst moonlighting as an open mic comic.',
    prompt1: 'I’ll make you laugh even on tough days.',
    prompt2: 'We’ll get along if you embrace curiosity.',
    prompt3: 'Teach me your favourite constellation story.',
    smoker: false,
    drinker: 'social',
    diet: 'non-vegetarian',
    fitness_level: 'moderate',
    education: 'B.Sc in Statistics',
    occupation: 'Data Analyst',
    relationship_goal: 'friendship first',
    family_oriented: true,
    spiritual: false,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['A', 'C', 'A', 'A', 'A', 'A', 'A', 'D'],
    photos: [
      'https://randomuser.me/api/portraits/women/82.jpg',
      'https://randomuser.me/api/portraits/women/83.jpg',
    ],
  },
];


const femaleFirstNames = ['Aanya', 'Ishita', 'Meera', 'Lara', 'Tanya', 'Radhika', 'Suhani', 'Devika', 'Maira', 'Kimaya'];
const maleFirstNames = ['Arnav', 'Vihaan', 'Ishan', 'Reyansh', 'Dhruv', 'Kabir', 'Aarav', 'Vivaan', 'Advait', 'Neil'];
const lastNames = ['Rao', 'Malik', 'Iyer', 'Kapadia', 'Fernandes', 'Das', 'Chowdhury', 'Singhal', 'Menon', 'Bhagat'];
const cities = ['Delhi', 'Mumbai', 'Bengaluru', 'Hyderabad', 'Pune', 'Chennai', 'Goa', 'Jaipur', 'Ahmedabad', 'Kochi', 'Lucknow', 'Indore'];
const interestPool = ['slow travel', 'yoga', 'indie music', 'culinary experiments', 'climate action', 'board games', 'street photography', 'trail running', 'coffee brewing', 'podcasts', 'gardening', 'ceramics', 'community work'];
const occupations = ['Product Designer', 'Climate Analyst', 'Research Lead', 'Psychologist', 'Founder', 'Engineer', 'Policy Researcher', 'Storyteller', 'Creative Producer', 'Wellness Coach'];
const educations = ['Masters in Design', 'MBA', 'B.Tech', 'Masters in Data Science', 'BA in Psychology', 'Masters in Sustainability', 'B.Des', 'Masters in Communications'];
const bios = [
  'Human-centered {occupation} guiding thoughtful experiences.',
  '{occupation} crafting calm spaces online and offline.',
  '{occupation} building kinder futures with curiosity and intention.',
  '{occupation} who thrives on shared playlists and long-form conversations.',
];
const promptOpeners = [
  'Currently exploring {interest} in {city}.',
  'Favourite ritual: {interest} before sunrise.',
  'Green flag alert: someone who appreciates {interest}.',
  'Ask me about my latest experiment with {interest}.',
  'You’ll usually find me hosting mini-salons on {interest}.',
];
const drinkHabits = ['never', 'rarely', 'social'];
const diets = ['vegetarian', 'vegan', 'pescatarian', 'flexitarian', 'non-vegetarian'];
const fitnessLevels = ['gentle', 'moderate', 'active', 'intense'];
const relationshipGoals = ['long-term', 'serious', 'open to possibilities', 'friendship first'];
const bodyTypes = ['athletic', 'fit', 'average', 'curvy', 'slim'];
const quizOptions = ['A', 'B', 'C', 'D'];
const orientations: InterestedIn[] = ['male', 'female', 'both'];

const pickCycle = <T,>(items: T[], offset: number, count = 1): T[] =>
  Array.from({ length: count }, (_, index) => items[(offset + index) % items.length]);

const createGeneratedProfiles = (targetCount: number): DemoProfile[] => {
  const generated: DemoProfile[] = [];

  for (let i = 0; i < targetCount; i += 1) {
    const gender: Gender = i % 2 === 0 ? 'female' : 'male';
    const firstNames = gender === 'female' ? femaleFirstNames : maleFirstNames;
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[(i + 3) % lastNames.length];
    const name = `${firstName} ${lastName}`;
    const emailSlug = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z]+/g, '.');
    const email = `${emailSlug}.${i + 100}@example.com`;
    const city = cities[(i * 5) % cities.length];
    const birthYear = 1988 + (i % 12);
    const birthMonth = (i % 12) + 1;
    const birthDay = (i % 20) + 8;
    const date_of_birth = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
    const heightBase = gender === 'female' ? 158 : 172;
    const height = heightBase + (i % 10);
    const body_type = bodyTypes[(i + 2) % bodyTypes.length];
    const interests = pickCycle(interestPool, i, 4);
    const occupation = occupations[(i + 4) % occupations.length];
    const education = educations[(i + 2) % educations.length];
    const template = bios[i % bios.length];
    const bio = template.replace('{occupation}', occupation.toLowerCase());
    const prompts = pickCycle(promptOpeners, i, 3).map((prompt, idx) =>
      prompt
        .replace('{interest}', interests[idx % interests.length])
        .replace('{city}', city)
    );
    const [prompt1, prompt2, prompt3] = prompts;
    const quizAnswers = Array.from({ length: 8 }, (_, index) => quizOptions[(i + index) % quizOptions.length]);
    const photoFolder = gender === 'female' ? 'women' : 'men';
    const photoIndexBase = (i * 7) % 90;
    const photos = [
      `https://randomuser.me/api/portraits/${photoFolder}/${photoIndexBase + 1}.jpg`,
      `https://randomuser.me/api/portraits/${photoFolder}/${(photoIndexBase + 12) % 90 + 1}.jpg`,
    ];

    generated.push({
      email,
      password: DEFAULT_PASSWORD,
      name,
      gender,
      interested_in: orientations[(i + 1) % orientations.length],
      date_of_birth,
      city,
      cooldown_enabled: gender === 'female',
      height,
      body_type,
      interests,
      bio,
      prompt1,
      prompt2,
      prompt3,
      smoker: i % 11 === 0 ? true : false,
      drinker: drinkHabits[i % drinkHabits.length],
      diet: diets[i % diets.length],
      fitness_level: fitnessLevels[(i + 1) % fitnessLevels.length],
      education,
      occupation,
      relationship_goal: relationshipGoals[(i + 2) % relationshipGoals.length],
      family_oriented: i % 3 !== 0,
      spiritual: i % 4 === 0,
      open_minded: true,
      career_focused: i % 5 !== 0,
      quizAnswers,
      photos,
    });
  }

  return generated;
};

const maleProfiles: DemoProfile[] = [
  {
    email: 'arjun.singh@example.com',
    name: 'Arjun Singh',
    password: DEFAULT_PASSWORD,
    gender: 'male',
    interested_in: 'female',
    date_of_birth: '1991-02-14',
    city: 'Delhi',
    is_verified: true,
    height: 180,
    body_type: 'athletic',
    interests: ['football', 'street food', 'mentoring', 'travel'],
    bio: 'Growth marketer who plans spontaneous weekend getaways.',
    prompt1: 'Friends describe me as reliable and up for adventure.',
    prompt2: 'Favourite debate: hills vs beaches.',
    prompt3: 'Currently building a mentorship community.',
    smoker: false,
    drinker: 'social',
    diet: 'non-vegetarian',
    fitness_level: 'active',
    education: 'MBA in Strategy',
    occupation: 'Growth Marketer',
    relationship_goal: 'serious',
    family_oriented: true,
    spiritual: false,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['D', 'A', 'C', 'D', 'C', 'A', 'D', 'A'],
    photos: [
      'https://randomuser.me/api/portraits/men/45.jpg',
      'https://randomuser.me/api/portraits/men/46.jpg',
    ],
  },
  {
    email: 'rohan.mehta@example.com',
    name: 'Rohan Mehta',
    password: DEFAULT_PASSWORD,
    gender: 'male',
    interested_in: 'female',
    date_of_birth: '1992-09-03',
    city: 'Mumbai',
    height: 182,
    body_type: 'athletic',
    interests: ['music festivals', 'startups', 'cycling', 'mixology'],
    bio: 'Strategy consultant who curates playlists for every mood.',
    prompt1: 'Let’s find the coziest jazz bar in the city.',
    prompt2: 'My superpower is optimizing weekend mini-getaways.',
    prompt3: 'I host monthly founder jams—join us?',
    smoker: false,
    drinker: 'social',
    diet: 'non-vegetarian',
    fitness_level: 'active',
    education: 'MBA in Finance',
    occupation: 'Strategy Consultant',
    relationship_goal: 'serious',
    family_oriented: true,
    spiritual: false,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['A', 'A', 'C', 'D', 'A', 'A', 'A', 'C'],
    photos: [
      'https://randomuser.me/api/portraits/men/21.jpg',
      'https://randomuser.me/api/portraits/men/22.jpg',
    ],
  },
  {
    email: 'karan.malhotra@example.com',
    name: 'Karan Malhotra',
    password: DEFAULT_PASSWORD,
    gender: 'male',
    interested_in: 'female',
    date_of_birth: '1994-04-19',
    city: 'Bengaluru',
    height: 176,
    body_type: 'fit',
    interests: ['gaming', 'trail running', 'craft coffee', 'investing'],
    bio: 'Lead engineer building fintech products and analog playlists.',
    prompt1: 'Currently training for my first marathon.',
    prompt2: 'Teach me your favourite board game strategy.',
    prompt3: 'I run a tiny coffee tasting club—ask me about beans.',
    smoker: false,
    drinker: 'rarely',
    diet: 'non-vegetarian',
    fitness_level: 'active',
    education: 'B.Tech in Computer Science',
    occupation: 'Software Lead',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: false,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['C', 'A', 'C', 'C', 'C', 'C', 'C', 'C'],
    photos: [
      'https://randomuser.me/api/portraits/men/35.jpg',
      'https://randomuser.me/api/portraits/men/36.jpg',
    ],
  },
  {
    email: 'rahul.iyer@example.com',
    name: 'Rahul Iyer',
    password: DEFAULT_PASSWORD,
    gender: 'male',
    interested_in: 'female',
    date_of_birth: '1993-12-22',
    city: 'Chennai',
    height: 174,
    body_type: 'lean',
    interests: ['classical music', 'coding', 'badminton', 'vegan cooking'],
    bio: 'Full-stack engineer with a soft spot for Carnatic concerts.',
    prompt1: 'Weekends mean badminton at dawn and coffee after.',
    prompt2: 'I cook elaborate Onam spreads for friends.',
    prompt3: 'Currently learning lo-fi music production.',
    smoker: false,
    drinker: 'rarely',
    diet: 'vegetarian',
    fitness_level: 'moderate',
    education: 'M.S. in Computer Science',
    occupation: 'Software Engineer',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['C', 'B', 'C', 'C', 'C', 'C', 'C', 'B'],
    photos: [
      'https://randomuser.me/api/portraits/men/5.jpg',
      'https://randomuser.me/api/portraits/men/6.jpg',
    ],
  },
  {
    email: 'varun.desai@example.com',
    name: 'Varun Desai',
    password: DEFAULT_PASSWORD,
    gender: 'male',
    interested_in: 'female',
    date_of_birth: '1989-08-30',
    city: 'Ahmedabad',
    height: 178,
    body_type: 'average',
    interests: ['entrepreneurship', 'cricket', 'photography', 'street food'],
    bio: 'Startup founder building SaaS products and Ahmedabad food trails.',
    prompt1: 'I plan quarterly road trips for my friends.',
    prompt2: 'Pitch your dream side project to me.',
    prompt3: 'Let’s photograph the old city at sunrise.',
    smoker: false,
    drinker: 'social',
    diet: 'non-vegetarian',
    fitness_level: 'active',
    education: 'B.Com',
    occupation: 'Startup Founder',
    relationship_goal: 'serious',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['D', 'A', 'C', 'C', 'B', 'A', 'D', 'A'],
    photos: [
      'https://randomuser.me/api/portraits/men/11.jpg',
      'https://randomuser.me/api/portraits/men/12.jpg',
    ],
  },
  {
    email: 'aman.kapoor@example.com',
    name: 'Aman Kapoor',
    password: DEFAULT_PASSWORD,
    gender: 'male',
    interested_in: 'female',
    date_of_birth: '1995-06-17',
    city: 'Pune',
    is_premium: true,
    height: 181,
    body_type: 'athletic',
    interests: ['product design', 'mentorship', 'travel', 'baking'],
    bio: 'Design lead baking sourdough and mentoring young founders.',
    prompt1: 'Currently sketching a travel app for slow explorers.',
    prompt2: 'We’ll get along if you love design museums.',
    prompt3: 'I bake bread every Saturday—taste tester wanted.',
    smoker: false,
    drinker: 'social',
    diet: 'flexitarian',
    fitness_level: 'active',
    education: 'Masters in Interaction Design',
    occupation: 'Design Lead',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: false,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['A', 'A', 'C', 'A', 'C', 'A', 'D', 'B'],
    photos: [
      'https://randomuser.me/api/portraits/men/70.jpg',
      'https://randomuser.me/api/portraits/men/71.jpg',
    ],
  },
  {
    email: 'siddharth.rao@example.com',
    name: 'Siddharth Rao',
    password: DEFAULT_PASSWORD,
    gender: 'male',
    interested_in: 'female',
    date_of_birth: '1993-03-05',
    city: 'Hyderabad',
    height: 177,
    body_type: 'fit',
    interests: ['data science', 'trekking', 'board games', 'brewing'],
    bio: 'Data scientist who measures life in coffee ratios.',
    prompt1: 'Most proud of: building a community data lab.',
    prompt2: 'I plan at least two treks a year.',
    prompt3: 'Currently perfecting my cold brew recipe.',
    smoker: false,
    drinker: 'social',
    diet: 'vegetarian',
    fitness_level: 'active',
    education: 'M.S. in Data Science',
    occupation: 'Data Scientist',
    relationship_goal: 'serious',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['C', 'B', 'C', 'C', 'C', 'C', 'D', 'B'],
    photos: [
      'https://randomuser.me/api/portraits/men/58.jpg',
      'https://randomuser.me/api/portraits/men/59.jpg',
    ],
  },
  {
    email: 'vivek.sharma@example.com',
    name: 'Vivek Sharma',
    password: DEFAULT_PASSWORD,
    gender: 'male',
    interested_in: 'female',
    date_of_birth: '1990-10-10',
    city: 'Gurgaon',
    height: 183,
    body_type: 'athletic',
    interests: ['fitness', 'podcasts', 'angel investing', 'volunteering'],
    bio: 'Ops director balancing HIIT workouts and NGO weekends.',
    prompt1: 'I volunteer with an education nonprofit every Sunday.',
    prompt2: 'Podcast recommendations always welcome.',
    prompt3: 'Life goal: run the Comrades Marathon.',
    smoker: false,
    drinker: 'rarely',
    diet: 'high-protein',
    fitness_level: 'intense',
    education: 'MBA in Operations',
    occupation: 'Operations Director',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['D', 'A', 'C', 'C', 'C', 'A', 'D', 'C'],
    photos: [
      'https://randomuser.me/api/portraits/men/63.jpg',
      'https://randomuser.me/api/portraits/men/64.jpg',
    ],
  },
  {
    email: 'nikhil.patel@example.com',
    name: 'Nikhil Patel',
    password: DEFAULT_PASSWORD,
    gender: 'male',
    interested_in: 'female',
    date_of_birth: '1996-01-29',
    city: 'Surat',
    height: 175,
    body_type: 'fit',
    interests: ['garba', 'yoga', 'vegan cooking', 'travel'],
    bio: 'Sustainability consultant bringing zero-waste ideas to life.',
    prompt1: 'Favourite time of year: Navratri nights.',
    prompt2: 'Let’s trade plant-based recipes.',
    prompt3: 'I shoot film photos on every trip.',
    smoker: false,
    drinker: 'never',
    diet: 'vegan',
    fitness_level: 'active',
    education: 'Masters in Sustainability',
    occupation: 'Sustainability Consultant',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['B', 'B', 'B', 'B', 'B', 'B', 'B', 'B'],
    photos: [
      'https://randomuser.me/api/portraits/men/86.jpg',
      'https://randomuser.me/api/portraits/men/87.jpg',
    ],
  },
  {
    email: 'aditya.verma@example.com',
    name: 'Aditya Verma',
    password: DEFAULT_PASSWORD,
    gender: 'male',
    interested_in: 'female',
    date_of_birth: '1993-05-07',
    city: 'Noida',
    height: 179,
    body_type: 'average',
    interests: ['stand-up comedy', 'filmmaking', 'basketball', 'podcasts'],
    bio: 'Product marketer who moonlights as an open mic host.',
    prompt1: 'I write sketches about everyday absurdities.',
    prompt2: 'You’ll win me over with witty banter.',
    prompt3: 'Curating a list of the city’s best food trucks.',
    smoker: false,
    drinker: 'social',
    diet: 'non-vegetarian',
    fitness_level: 'moderate',
    education: 'BBA in Marketing',
    occupation: 'Product Marketing Manager',
    relationship_goal: 'serious',
    family_oriented: true,
    spiritual: false,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'D'],
    photos: [
      'https://randomuser.me/api/portraits/men/29.jpg',
      'https://randomuser.me/api/portraits/men/30.jpg',
    ],
  },
  {
    email: 'harsh.gupta@example.com',
    name: 'Harsh Gupta',
    password: DEFAULT_PASSWORD,
    gender: 'male',
    interested_in: 'female',
    date_of_birth: '1990-03-16',
    city: 'Bhopal',
    height: 184,
    body_type: 'athletic',
    interests: ['architecture', 'cycling', 'birding', 'photography'],
    bio: 'Urban planner reimagining inclusive public spaces.',
    prompt1: 'I map sunrise cycling routes in every city I visit.',
    prompt2: 'We’ll get along if you love design museums.',
    prompt3: 'Currently obsessed with bird photography.',
    smoker: false,
    drinker: 'rarely',
    diet: 'vegetarian',
    fitness_level: 'active',
    education: 'Masters in Urban Design',
    occupation: 'Urban Planner',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['C', 'B', 'C', 'C', 'C', 'C', 'C', 'B'],
    photos: [
      'https://randomuser.me/api/portraits/men/82.jpg',
      'https://randomuser.me/api/portraits/men/83.jpg',
    ],
  },
  {
    email: 'manish.kulkarni@example.com',
    name: 'Manish Kulkarni',
    password: DEFAULT_PASSWORD,
    gender: 'male',
    interested_in: 'female',
    date_of_birth: '1988-11-25',
    city: 'Nagpur',
    height: 177,
    body_type: 'average',
    interests: ['music production', 'spirituality', 'running', 'tech'],
    bio: 'Product ops lead producing ambient music on weekends.',
    prompt1: 'Morning routine: 5k run + raga practice.',
    prompt2: 'Let’s exchange mindfulness practices.',
    prompt3: 'I experiment with modular synths—happy to teach.',
    smoker: false,
    drinker: 'rarely',
    diet: 'vegetarian',
    fitness_level: 'active',
    education: 'MBA in Technology Management',
    occupation: 'Product Operations Lead',
    relationship_goal: 'long-term',
    family_oriented: true,
    spiritual: true,
    open_minded: true,
    career_focused: true,
    quizAnswers: ['B', 'C', 'C', 'B', 'B', 'C', 'D', 'B'],
    photos: [
      'https://randomuser.me/api/portraits/men/17.jpg',
      'https://randomuser.me/api/portraits/men/18.jpg',
    ],
  },
];

const baseProfiles: DemoProfile[] = [...femaleProfiles, ...maleProfiles];
const generatedProfiles = createGeneratedProfiles(Math.max(0, 100 - baseProfiles.length));
const demoProfiles: DemoProfile[] = [...baseProfiles, ...generatedProfiles];

const deriveTraitsFromQuiz = (answers: string[]): string[] => {
  const traits = answers.map(answer => PERSONALITY_TRAITS_MAP[answer] || []).flat();
  return [...new Set(traits)];
};

const seedDemoProfiles = async () => {
  console.log(`🚀 Seeding demo profiles (${demoProfiles.length} users)...`);
  let createdCount = 0;

  for (const profile of demoProfiles) {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [profile.email]);

      if (existing.rows.length > 0) {
        console.log(`ℹ️  ${profile.email} already exists, skipping.`);
      } else {
        await client.query('BEGIN');
        transactionStarted = true;

        const passwordHash = await bcrypt.hash(profile.password ?? DEFAULT_PASSWORD, 10);
        const cooldownEnabled = profile.cooldown_enabled ?? (profile.gender === 'female');

        const userResult = await client.query(
          `INSERT INTO users (
            email, password_hash, name, gender, interested_in, date_of_birth,
            city, is_verified, is_premium, cooldown_enabled
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id`,
          [
            profile.email,
            passwordHash,
            profile.name,
            profile.gender,
            profile.interested_in,
            profile.date_of_birth,
            profile.city,
            profile.is_verified ?? false,
            profile.is_premium ?? false,
            cooldownEnabled,
          ]
        );

        const userId = userResult.rows[0].id;

        await client.query(
          `INSERT INTO user_profiles (
            user_id, height, body_type, interests, bio, prompt1, prompt2, prompt3,
            smoker, drinker, diet, fitness_level, education, occupation,
            relationship_goal, family_oriented, spiritual, open_minded, career_focused
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
          [
            userId,
            profile.height,
            profile.body_type,
            profile.interests,
            profile.bio,
            profile.prompt1,
            profile.prompt2,
            profile.prompt3,
            profile.smoker,
            profile.drinker,
            profile.diet,
            profile.fitness_level,
            profile.education,
            profile.occupation,
            profile.relationship_goal,
            profile.family_oriented,
            profile.spiritual,
            profile.open_minded,
            profile.career_focused,
          ]
        );

        const [
          question1 = null,
          question2 = null,
          question3 = null,
          question4 = null,
          question5 = null,
          question6 = null,
          question7 = null,
          question8 = null,
        ] = profile.quizAnswers;

        const uniqueTraits = deriveTraitsFromQuiz(profile.quizAnswers);

        let personalityInsights = {
          summary: 'You have a unique personality!',
          compatibility_tips: 'You would match well with someone who shares your values.',
          top_traits: uniqueTraits.slice(0, 3),
        };

        if (process.env.OPENAI_API_KEY) {
          try {
            const insights = await analyzePersonality(profile.quizAnswers);
            personalityInsights = {
              summary: insights.summary,
              compatibility_tips: insights.compatibility_tips,
              top_traits: insights.top_traits && insights.top_traits.length > 0
                ? insights.top_traits
                : uniqueTraits.slice(0, 3),
            };
          } catch (error) {
            console.error(`⚠️  AI personality insights failed for ${profile.email}:`, error);
          }
        }

        await client.query(
          `INSERT INTO personality_responses (
            user_id, question1_answer, question2_answer, question3_answer,
            question4_answer, question5_answer, question6_answer,
            question7_answer, question8_answer, personality_traits,
            personality_summary, compatibility_tips, top_traits
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            userId,
            question1,
            question2,
            question3,
            question4,
            question5,
            question6,
            question7,
            question8,
            uniqueTraits,
            personalityInsights.summary,
            personalityInsights.compatibility_tips,
            personalityInsights.top_traits,
          ]
        );

        for (const [index, photoUrl] of profile.photos.entries()) {
          await client.query(
            `INSERT INTO photos (user_id, photo_url, is_primary, order_index)
             VALUES ($1, $2, $3, $4)`,
            [userId, photoUrl, index === 0, index]
          );
        }

        await client.query(
          `INSERT INTO user_activity_limits (user_id)
           VALUES ($1)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId]
        );

        await client.query('COMMIT');
        transactionStarted = false;
        createdCount += 1;
        console.log(`✅ Seeded ${profile.name} (${profile.email})`);
      }
    } catch (error) {
      if (transactionStarted) {
        await client.query('ROLLBACK');
      }
      console.error(`❌ Failed to seed ${profile.email}:`, error);
    } finally {
      client.release();
    }
  }

  console.log(`🎉 Created ${createdCount} new demo users.`);
};

seedDemoProfiles()
  .then(async () => {
    await pool.end();
    console.log('Done seeding demo profiles.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Unhandled error while seeding demo profiles:', error);
    await pool.end();
    process.exit(1);
  });
