import request from 'supertest';
import app from '../index';

type SignupOverrides = Partial<{
  email: string;
  password: string;
  name: string;
  gender: 'male' | 'female';
  interested_in: 'male' | 'female' | 'both';
  date_of_birth: string;
  city: string;
}>;

type ProfileOverrides = Partial<Record<string, any>>;

const signupAndCompleteProfile = async (
  signupOverrides: SignupOverrides,
  profileOverrides: ProfileOverrides = {}
) => {
  const signupPayload = {
    email: 'alex@example.com',
    password: 'Passw0rd!',
    name: 'Alex Test',
    gender: 'female' as const,
    interested_in: 'male' as const,
    date_of_birth: '1994-06-15',
    city: 'Delhi',
    ...signupOverrides,
  };

  const signupResponse = await request(app).post('/api/auth/signup').send(signupPayload);
  expect(signupResponse.status).toBe(201);
  const token = signupResponse.body.token as string;
  expect(token).toBeTruthy();

  const baseProfile = {
    height: 168,
    body_type: 'athletic',
    interests: ['travel', 'music', 'fitness'],
    bio: `Hi, I'm ${signupPayload.name}.`,
    prompt1: 'Weekend hikes and pour-over coffee.',
    prompt2: 'Looking for someone curious about the world.',
    prompt3: 'Currently learning pottery.',
    self_summary: 'I am an intentional designer who loves meaningful weekends.',
    ideal_partner_prompt: 'Looking for a grounded, curious partner who values slow mornings.',
    connection_preferences: 'Shared curiosity, respect, emotional availability.',
    dealbreakers: 'Dismissive communication, zero accountability.',
    growth_journey: 'Learning to invite more playfulness into life.',
    smoker: false,
    drinker: 'social',
    diet: 'balanced',
    fitness_level: 'active',
    education: 'Bachelor of Design',
    occupation: 'Product Designer',
    relationship_goal: 'serious',
    family_oriented: true,
    spiritual: false,
    open_minded: true,
    career_focused: true,
    question1_answer: 'A',
    question2_answer: 'B',
    question3_answer: 'C',
    question4_answer: 'A',
    question5_answer: 'B',
    question6_answer: 'C',
    question7_answer: 'D',
    question8_answer: 'A',
    ...profileOverrides,
  };

  const profileResponse = await request(app)
    .post('/api/profile/complete')
    .set('Authorization', `Bearer ${token}`)
    .send(baseProfile);

  expect(profileResponse.status).toBe(200);
  expect(profileResponse.body.ai_persona).toBeTruthy();

  return { token, signupPayload };
};

describe('GreenFlag backend core flow', () => {
  it('responds to health check', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('registers and logs in a user', async () => {
    const email = `user_${Date.now()}@example.com`;
    const password = 'Passw0rd!';

    await signupAndCompleteProfile({ email });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.token).toBeTruthy();
    expect(loginResponse.body.user.email).toBe(email);
  });

  it('returns on-grid matches after onboarding', async () => {
    const primaryUserEmail = `primary_${Date.now()}@example.com`;
    const maleUserEmail = `male_${Date.now()}@example.com`;

    const { token } = await signupAndCompleteProfile({ email: primaryUserEmail, name: 'Aisha Kapoor' });

    await signupAndCompleteProfile(
      {
        email: maleUserEmail,
        name: 'Arjun Sharma',
        gender: 'male',
        interested_in: 'female',
        date_of_birth: '1991-03-10',
        city: 'Delhi',
      },
      {
        interests: ['travel', 'music', 'fitness'],
        smoker: false,
        drinker: 'never',
        relationship_goal: 'serious',
        self_summary: 'Product lead who loves sunrise runs and honest conversations.',
        ideal_partner_prompt: 'Someone thoughtful, active, and open to building rituals together.',
        connection_preferences: 'Shared adventures, emotional self-awareness.',
        dealbreakers: 'Unkindness, inconsistent effort.',
        growth_journey: 'Training for an ultra marathon this year.',
      }
    );

    const searchResponse = await request(app)
      .post('/api/matches/search')
      .set('Authorization', `Bearer ${token}`)
      .send({ search_query: 'adventurous, loves travel, 30, Delhi' });

    expect(searchResponse.status).toBe(200);
    expect(Array.isArray(searchResponse.body.on_grid_matches)).toBe(true);
    expect(searchResponse.body.on_grid_matches.length).toBeGreaterThan(0);
    const [firstMatch] = searchResponse.body.on_grid_matches;
    expect(firstMatch.name).toBe('Arjun Sharma');
    expect(Array.isArray(firstMatch.match_highlights)).toBe(true);
    expect(Array.isArray(firstMatch.suggested_openers)).toBe(true);
  });
});
