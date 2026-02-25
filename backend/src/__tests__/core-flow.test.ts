import request from 'supertest';
import type { Server } from 'http';
import app from '../index';
import pool from '../config/database';

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

let agent!: request.SuperTest<request.Test>;

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

  const signupResponse = await agent.post('/api/auth/signup').send(signupPayload);
  expect(signupResponse.status).toBe(201);
  const token = signupResponse.body.token as string;
  const userId = signupResponse.body.user?.id as number;
  expect(token).toBeTruthy();
  expect(userId).toBeTruthy();

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

  const profileResponse = await agent
    .post('/api/profile/complete')
    .set('Authorization', `Bearer ${token}`)
    .send(baseProfile);

  expect(profileResponse.status).toBe(200);
  expect(profileResponse.body.ai_persona).toBeTruthy();

  return { token, userId, signupPayload };
};

const createMutualMatch = async (
  userAToken: string,
  userAId: number,
  userBToken: string,
  userBId: number
) => {
  const firstLike = await agent
    .post('/api/likes')
    .set('Authorization', `Bearer ${userAToken}`)
    .send({ target_user_id: userBId, is_on_grid: true });
  expect(firstLike.status).toBe(200);

  const secondLike = await agent
    .post('/api/likes')
    .set('Authorization', `Bearer ${userBToken}`)
    .send({ target_user_id: userAId, is_on_grid: true });
  expect(secondLike.status).toBe(200);
  expect(secondLike.body.is_match).toBe(true);
  expect(secondLike.body.match_id).toBeTruthy();
  return secondLike.body.match_id as number;
};

describe('GreenFlag backend core flow', () => {
  let server: Server;

  beforeAll(() => {
    server = app.listen(0, '127.0.0.1');
    agent = request(server);
  });

  afterAll((done) => {
    server.close(done);
  });

  it('responds to health check', async () => {
    const response = await agent.get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('registers and logs in a user', async () => {
    const email = `user_${Date.now()}@example.com`;
    const password = 'Passw0rd!';

    await signupAndCompleteProfile({ email });

    const loginResponse = await agent
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

    const searchResponse = await agent
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

  it('allows unmatching an existing match', async () => {
    const userA = await signupAndCompleteProfile({
      email: `unmatch_a_${Date.now()}@example.com`,
      name: 'Nora',
      gender: 'female',
      interested_in: 'male',
    });
    const userB = await signupAndCompleteProfile({
      email: `unmatch_b_${Date.now()}@example.com`,
      name: 'Kabir',
      gender: 'male',
      interested_in: 'female',
    });

    const matchId = await createMutualMatch(userA.token, userA.userId, userB.token, userB.userId);

    const unmatchResponse = await agent
      .post(`/api/matches/${matchId}/unmatch`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({});

    expect(unmatchResponse.status).toBe(200);

    const matchesAfter = await agent
      .get('/api/matches')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(matchesAfter.status).toBe(200);
    expect(matchesAfter.body.matches.length).toBe(0);
  });

  it('creates a report for a matched user', async () => {
    const userA = await signupAndCompleteProfile({
      email: `report_a_${Date.now()}@example.com`,
      name: 'Ria',
      gender: 'female',
      interested_in: 'male',
    });
    const userB = await signupAndCompleteProfile({
      email: `report_b_${Date.now()}@example.com`,
      name: 'Aman',
      gender: 'male',
      interested_in: 'female',
    });

    const matchId = await createMutualMatch(userA.token, userA.userId, userB.token, userB.userId);

    const reportResponse = await agent
      .post('/api/report')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ match_id: matchId, reason: 'harassment' });

    expect(reportResponse.status).toBe(201);
    expect(reportResponse.body.report.reason).toBe('harassment');
    expect(reportResponse.body.report.reporter_id).toBe(userA.userId);
    expect(reportResponse.body.report.reported_id).toBe(userB.userId);
  });

  it('applies wallet purchase credits', async () => {
    const user = await signupAndCompleteProfile({
      email: `wallet_${Date.now()}@example.com`,
      name: 'Maya',
    });

    const purchaseResponse = await agent
      .post('/api/wallet/purchase')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ plan: 'starter' });
    expect(purchaseResponse.status).toBe(200);

    const walletResponse = await agent
      .get('/api/wallet/summary')
      .set('Authorization', `Bearer ${user.token}`);
    expect(walletResponse.status).toBe(200);
    expect(walletResponse.body.credit_balance).toBe(60);
  });

  it('activates boost for non-premium users by consuming 20 credits for 6 hours', async () => {
    const user = await signupAndCompleteProfile({
      email: `boost_tokens_${Date.now()}@example.com`,
      name: 'Boost Token User',
    });

    const boostResponse = await agent
      .post('/api/profile/boost')
      .set('Authorization', `Bearer ${user.token}`)
      .send({});

    expect(boostResponse.status).toBe(200);
    expect(boostResponse.body.boost_active).toBe(true);
    expect(boostResponse.body.charged_tokens).toBe(20);
    expect(boostResponse.body.credit_balance).toBe(30);

    const boostExpiresAt = new Date(boostResponse.body.boost_expires_at).getTime();
    const diffHours = (boostExpiresAt - Date.now()) / (1000 * 60 * 60);
    expect(diffHours).toBeGreaterThan(5.8);
    expect(diffHours).toBeLessThan(6.2);
  });

  it('rejects boost when user lacks premium and has insufficient tokens', async () => {
    const user = await signupAndCompleteProfile({
      email: `boost_insufficient_${Date.now()}@example.com`,
      name: 'No Boost Credits',
    });

    await pool.query('UPDATE users SET credit_balance = 5 WHERE id = $1', [user.userId]);

    const boostResponse = await agent
      .post('/api/profile/boost')
      .set('Authorization', `Bearer ${user.token}`)
      .send({});

    expect(boostResponse.status).toBe(402);
    expect(boostResponse.body.error).toMatch(/Premium or 20 tokens/i);
    expect(boostResponse.body.required_tokens).toBe(20);
    expect(boostResponse.body.credit_balance).toBe(5);
  });

  it('shows GreenFlag likes at the top of incoming likes and supports upgrading an existing like', async () => {
    const receiver = await signupAndCompleteProfile({
      email: `incoming_receiver_${Date.now()}@example.com`,
      name: 'Receiver',
      gender: 'female',
      interested_in: 'male',
    });
    const regularLiker = await signupAndCompleteProfile({
      email: `incoming_regular_${Date.now()}@example.com`,
      name: 'Regular Liker',
      gender: 'male',
      interested_in: 'female',
    });
    const greenFlagLiker = await signupAndCompleteProfile({
      email: `incoming_greenflag_${Date.now()}@example.com`,
      name: 'GreenFlag Liker',
      gender: 'male',
      interested_in: 'female',
    });

    const regularLike = await agent
      .post('/api/likes')
      .set('Authorization', `Bearer ${regularLiker.token}`)
      .send({ target_user_id: receiver.userId, is_on_grid: true });
    expect(regularLike.status).toBe(200);

    const greenFlagLike = await agent
      .post('/api/likes')
      .set('Authorization', `Bearer ${greenFlagLiker.token}`)
      .send({ target_user_id: receiver.userId, is_on_grid: true, is_superlike: true });
    expect(greenFlagLike.status).toBe(200);
    expect(greenFlagLike.body.is_superlike).toBe(true);

    const incomingLikesBeforeUpgrade = await agent
      .get('/api/likes/incoming')
      .set('Authorization', `Bearer ${receiver.token}`);
    expect(incomingLikesBeforeUpgrade.status).toBe(200);
    expect(incomingLikesBeforeUpgrade.body.likes.length).toBeGreaterThanOrEqual(2);
    expect(incomingLikesBeforeUpgrade.body.likes[0].user.id).toBe(greenFlagLiker.userId);
    expect(incomingLikesBeforeUpgrade.body.likes[0].is_superlike).toBe(true);

    const upgradeRegularLikeToGreenFlag = await agent
      .post('/api/likes')
      .set('Authorization', `Bearer ${regularLiker.token}`)
      .send({ target_user_id: receiver.userId, is_on_grid: true, is_superlike: true });
    expect(upgradeRegularLikeToGreenFlag.status).toBe(200);
    expect(upgradeRegularLikeToGreenFlag.body.is_superlike).toBe(true);

    const incomingLikesAfterUpgrade = await agent
      .get('/api/likes/incoming')
      .set('Authorization', `Bearer ${receiver.token}`);
    expect(incomingLikesAfterUpgrade.status).toBe(200);
    expect(incomingLikesAfterUpgrade.body.likes.length).toBeGreaterThanOrEqual(2);
    expect(incomingLikesAfterUpgrade.body.likes[0].user.id).toBe(regularLiker.userId);
    expect(incomingLikesAfterUpgrade.body.likes[0].is_superlike).toBe(true);
    expect(incomingLikesAfterUpgrade.body.likes[1].is_superlike).toBe(true);
  });

  it('deletes account and invalidates login', async () => {
    const email = `delete_${Date.now()}@example.com`;
    const user = await signupAndCompleteProfile({ email, name: 'Delete Me' });

    const deleteResponse = await agent
      .delete('/api/profile/me')
      .set('Authorization', `Bearer ${user.token}`);
    expect(deleteResponse.status).toBe(200);

    const loginResponse = await agent
      .post('/api/auth/login')
      .send({ email, password: 'Passw0rd!' });
    expect(loginResponse.status).toBe(401);
  });

  it('enforces non-premium message daily limits', async () => {
    const female = await signupAndCompleteProfile({
      email: `msg_f_${Date.now()}@example.com`,
      name: 'Sara',
      gender: 'female',
      interested_in: 'male',
    });
    const male = await signupAndCompleteProfile({
      email: `msg_m_${Date.now()}@example.com`,
      name: 'Dev',
      gender: 'male',
      interested_in: 'female',
    });

    const matchId = await createMutualMatch(female.token, female.userId, male.token, male.userId);

    for (let i = 0; i < 3; i++) {
      const messageResponse = await agent
        .post('/api/messages')
        .set('Authorization', `Bearer ${male.token}`)
        .send({ match_id: matchId, content: `Message ${i + 1}` });
      expect(messageResponse.status).toBe(200);
    }

    const fourthMessage = await agent
      .post('/api/messages')
      .set('Authorization', `Bearer ${male.token}`)
      .send({ match_id: matchId, content: 'Message 4' });
    expect(fourthMessage.status).toBe(429);
  });

  it('persists privacy settings and supports block/unblock', async () => {
    const userA = await signupAndCompleteProfile({
      email: `privacy_a_${Date.now()}@example.com`,
      name: 'Priya',
      gender: 'female',
      interested_in: 'male',
    });
    const userB = await signupAndCompleteProfile({
      email: `privacy_b_${Date.now()}@example.com`,
      name: 'Arnav',
      gender: 'male',
      interested_in: 'female',
    });

    const updateSettings = await agent
      .post('/api/privacy/settings')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ hide_city: true, hide_distance: true, incognito_mode: true, show_online_status: false });
    expect(updateSettings.status).toBe(200);
    expect(updateSettings.body.settings.hide_city).toBe(true);

    const getSettings = await agent
      .get('/api/privacy/settings')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(getSettings.status).toBe(200);
    expect(getSettings.body.settings.incognito_mode).toBe(true);

    const matchId = await createMutualMatch(userA.token, userA.userId, userB.token, userB.userId);

    const initialMessage = await agent
      .post('/api/messages')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ match_id: matchId, content: 'hello before block' });
    expect(initialMessage.status).toBe(200);

    const blockResponse = await agent
      .post('/api/privacy/block')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ target_user_id: userB.userId });
    expect(blockResponse.status).toBe(200);

    const blockedConversations = await agent
      .get('/api/conversations')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(blockedConversations.status).toBe(200);
    expect(
      blockedConversations.body.conversations.some((c: any) => c.match_id === matchId)
    ).toBe(false);

    const blockedSend = await agent
      .post('/api/messages')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ match_id: matchId, content: 'should fail while blocked' });
    expect(blockedSend.status).toBe(403);

    const blockedList = await agent
      .get('/api/privacy/blocked')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(blockedList.status).toBe(200);
    expect(blockedList.body.blocked_users.length).toBe(1);
    expect(blockedList.body.blocked_users[0].user_id).toBe(userB.userId);

    const likeWhileBlocked = await agent
      .post('/api/likes')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ target_user_id: userB.userId, is_on_grid: true });
    expect(likeWhileBlocked.status).toBe(400);

    const unblockResponse = await agent
      .post('/api/privacy/unblock')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ target_user_id: userB.userId });
    expect(unblockResponse.status).toBe(200);

    const blockedAfter = await agent
      .get('/api/privacy/blocked')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(blockedAfter.status).toBe(200);
    expect(blockedAfter.body.blocked_users.length).toBe(0);

    const conversationsAfterUnblock = await agent
      .get('/api/conversations')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(conversationsAfterUnblock.status).toBe(200);
    const restored = conversationsAfterUnblock.body.conversations.find((c: any) => c.match_id === matchId);
    expect(restored).toBeTruthy();
    expect(restored.last_message).toBeNull();

    const messagesAfterUnblock = await agent
      .get(`/api/messages/${matchId}`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(messagesAfterUnblock.status).toBe(200);
    expect(messagesAfterUnblock.body.messages).toEqual([]);

    const sendAfterUnblock = await agent
      .post('/api/messages')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ match_id: matchId, content: 'hello after unblock' });
    expect(sendAfterUnblock.status).toBe(200);
  });

  it('persists notification preferences server-side', async () => {
    const user = await signupAndCompleteProfile({
      email: `notif_${Date.now()}@example.com`,
      name: 'Noah',
    });

    const updateResponse = await agent
      .post('/api/notifications/preferences')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ likes: false, matches: false, messages: true, daily_picks: false, product_updates: false });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.preferences.likes).toBe(false);
    expect(updateResponse.body.preferences.messages).toBe(true);

    const getResponse = await agent
      .get('/api/notifications/preferences')
      .set('Authorization', `Bearer ${user.token}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.preferences.likes).toBe(false);
    expect(getResponse.body.preferences.matches).toBe(false);
    expect(getResponse.body.preferences.daily_picks).toBe(false);
  });

  it('supports dev OTP fallback when SMS provider is not configured', async () => {
    const user = await signupAndCompleteProfile({
      email: `otp_${Date.now()}@example.com`,
      name: 'Otp User',
    });

    const otpResponse = await agent
      .post('/api/verification/otp/request')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ phone: '+15555555555' });
    expect(otpResponse.status).toBe(200);
    // dev_code is no longer returned in the response (logged to console instead)
    expect(otpResponse.body.dev_code).toBeUndefined();
    expect(otpResponse.body.message).toBe('OTP sent');
  });

  it('verifies OTP with normalized phone format and persists verified status', async () => {
    const user = await signupAndCompleteProfile({
      email: `otp_verify_${Date.now()}@example.com`,
      name: 'Otp Verify User',
    });

    const requestResponse = await agent
      .post('/api/verification/otp/request')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ phone: '(555) 123-4567' });
    expect(requestResponse.status).toBe(200);
    expect(requestResponse.body.normalized_phone).toBe('+15551234567');

    const otpRecord = await pool.query(
      'SELECT code FROM otp_codes WHERE phone = $1',
      [requestResponse.body.normalized_phone]
    );
    expect(otpRecord.rows.length).toBe(1);
    const code = String(otpRecord.rows[0].code);

    const verifyResponse = await agent
      .post('/api/verification/otp/verify')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ phone: '5551234567', code: ` ${code} ` });
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.status.otp_verified).toBe(true);
    expect(verifyResponse.body.status.phone).toBe('+15551234567');

    const statusResponse = await agent
      .get('/api/verification/status')
      .set('Authorization', `Bearer ${user.token}`);
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.status.otp_verified).toBe(true);
  });

  it('rate limits repeated OTP requests for the same phone', async () => {
    const user = await signupAndCompleteProfile({
      email: `otp_limit_${Date.now()}@example.com`,
      name: 'Otp Limit User',
    });

    const first = await agent
      .post('/api/verification/otp/request')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ phone: '+15551234567' });
    expect(first.status).toBe(200);

    const second = await agent
      .post('/api/verification/otp/request')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ phone: '+15551234567' });
    expect(second.status).toBe(429);
  });

  it('rejects local media payloads and accepts secure hosted media URLs', async () => {
    const userA = await signupAndCompleteProfile({
      email: `media_a_${Date.now()}@example.com`,
      name: 'Media A',
      gender: 'female',
      interested_in: 'male',
    });
    const userB = await signupAndCompleteProfile({
      email: `media_b_${Date.now()}@example.com`,
      name: 'Media B',
      gender: 'male',
      interested_in: 'female',
    });
    const matchId = await createMutualMatch(userA.token, userA.userId, userB.token, userB.userId);

    const blockedPayload = await agent
      .post('/api/messages')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        match_id: matchId,
        message_type: 'image',
        content: 'data:image/png;base64,AAAA',
      });
    expect(blockedPayload.status).toBe(400);

    const hostedUrl = await agent
      .post('/api/messages')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        match_id: matchId,
        message_type: 'image',
        content: 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg',
      });
    expect(hostedUrl.status).toBe(200);
  });

  it('returns clear selfie verification config error when OpenAI is unavailable', async () => {
    const user = await signupAndCompleteProfile({
      email: `selfie_${Date.now()}@example.com`,
      name: 'Selfie User',
    });

    const selfieResponse = await agent
      .post('/api/verification/selfie')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ photo_url: 'data:image/jpeg;base64,AAAA' });
    expect(selfieResponse.status).toBe(503);
    expect(selfieResponse.body.error).toMatch(/not configured/i);
  });
});
