import request from 'supertest';
import type { Server } from 'http';
import app from '../index';
import pool from '../config/database';
import { registerReceiptValidator, resetReceiptValidator } from '../services/payments.service';
import { resetRateLimits } from '../middleware/rateLimit';

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

  it('refuses token purchases while payments are not configured', async () => {
    const user = await signupAndCompleteProfile({
      email: `wallet_${Date.now()}@example.com`,
      name: 'Maya',
    });

    const purchaseResponse = await agent
      .post('/api/wallet/purchase')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ pack_id: '15' });
    expect(purchaseResponse.status).toBe(501);
    expect(purchaseResponse.body.payments_enabled).toBe(false);

    // Balance must be untouched: no payment, no tokens.
    const walletResponse = await agent
      .get('/api/wallet/summary')
      .set('Authorization', `Bearer ${user.token}`);
    expect(walletResponse.status).toBe(200);
    expect(walletResponse.body.credit_balance).toBe(50);
  });

  it('tops spent tokens back up to the free allowance once per interval', async () => {
    const user = await signupAndCompleteProfile({
      email: `allowance_${Date.now()}@example.com`,
      name: 'Reeta',
    });

    // Spend down to nothing, as an active user eventually would.
    await pool.query(
      'UPDATE users SET credit_balance = 0, last_token_refill_at = NULL WHERE id = $1',
      [user.userId]
    );

    const first = await agent
      .get('/api/wallet/summary')
      .set('Authorization', `Bearer ${user.token}`);
    expect(first.status).toBe(200);
    expect(first.body.credit_balance).toBe(30);
    expect(first.body.free_allowance).toBe(30);
    expect(first.body.next_refill_at).toBeTruthy();

    // The grant is ledgered so the wallet history stays truthful.
    const ledger = await pool.query(
      `SELECT amount, direction FROM credit_transactions
       WHERE user_id = $1 AND reason = 'daily_allowance'`,
      [user.userId]
    );
    expect(ledger.rows).toHaveLength(1);
    expect(Number(ledger.rows[0].amount)).toBe(30);
    expect(ledger.rows[0].direction).toBe('credit');

    // Spending then immediately re-reading must NOT hand out a second allowance.
    await pool.query('UPDATE users SET credit_balance = 4 WHERE id = $1', [user.userId]);
    const second = await agent
      .get('/api/wallet/summary')
      .set('Authorization', `Bearer ${user.token}`);
    expect(second.body.credit_balance).toBe(4);

    // Once the interval has elapsed, they are topped back up to the floor.
    await pool.query(
      "UPDATE users SET last_token_refill_at = NOW() - INTERVAL '25 hours' WHERE id = $1",
      [user.userId]
    );
    const third = await agent
      .get('/api/wallet/summary')
      .set('Authorization', `Bearer ${user.token}`);
    expect(third.body.credit_balance).toBe(30);
  });

  it('does not reduce a balance that is already above the free allowance', async () => {
    const user = await signupAndCompleteProfile({
      email: `abovefloor_${Date.now()}@example.com`,
      name: 'Ira',
    });

    // Someone who bought a pack sits above the floor and must keep every token.
    await pool.query(
      "UPDATE users SET credit_balance = 120, last_token_refill_at = NOW() - INTERVAL '25 hours' WHERE id = $1",
      [user.userId]
    );

    const wallet = await agent
      .get('/api/wallet/summary')
      .set('Authorization', `Bearer ${user.token}`);
    expect(wallet.body.credit_balance).toBe(120);
  });

  it('refuses subscriptions while payments are not configured', async () => {
    const user = await signupAndCompleteProfile({
      email: `sub_${Date.now()}@example.com`,
      name: 'Nina',
    });

    const response = await agent
      .post('/api/wallet/subscribe')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ plan: 'pro', duration: '1month' });

    // The route must exist and refuse deliberately, not 404.
    expect(response.status).toBe(501);

    const profile = await agent
      .get('/api/profile/me')
      .set('Authorization', `Bearer ${user.token}`);
    expect(profile.body.user.is_premium).toBe(false);
  });

  it('grants a token pack only against a validated store receipt', async () => {
    const user = await signupAndCompleteProfile({
      email: `receipt_${Date.now()}@example.com`,
      name: 'Priya',
    });

    // Stand in for RevenueCat's verification of an Apple/Google receipt.
    registerReceiptValidator(async (claim) => {
      // The user id must come from the JWT, never from the request body.
      expect(claim.appUserId).toBe(String(user.userId));
      return {
        transactionId: `txn_${claim.productId}_fixed`,
        provider: 'apple' as const,
        productId: claim.productId,
        amountCents: 399,
        currency: 'USD',
      };
    });
    process.env.PAYMENTS_ENABLED = 'true';

    try {
      // A purchase without a receipt is rejected even when payments are live.
      const noReceipt = await agent
        .post('/api/wallet/purchase')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ pack_id: '15' });
      expect(noReceipt.status).toBe(400);

      const purchase = await agent
        .post('/api/wallet/purchase')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ pack_id: '15', receipt: 'store-receipt-blob' });
      expect(purchase.status).toBe(200);
      expect(purchase.body.wallet.credit_balance).toBe(65);

      // Replaying the same receipt must not credit a second time.
      const replay = await agent
        .post('/api/wallet/purchase')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ pack_id: '15', receipt: 'store-receipt-blob' });
      expect(replay.status).toBe(200);
      expect(replay.body.duplicate).toBe(true);

      const wallet = await agent
        .get('/api/wallet/summary')
        .set('Authorization', `Bearer ${user.token}`);
      expect(wallet.body.credit_balance).toBe(65);
    } finally {
      delete process.env.PAYMENTS_ENABLED;
      resetReceiptValidator();
    }
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

    // Already received today's free allowance and spent it down, so no top-up is
    // due and the balance genuinely cannot cover a boost.
    await pool.query(
      'UPDATE users SET credit_balance = 5, last_token_refill_at = NOW() WHERE id = $1',
      [user.userId]
    );

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

  it('blocks a banned user on their existing token, not just at login', async () => {
    const user = await signupAndCompleteProfile({
      email: `banned_${Date.now()}@example.com`,
      name: 'Banned User',
    });

    // Token is already issued and still well within its 7-day life.
    const beforeBan = await agent
      .get('/api/profile/me')
      .set('Authorization', `Bearer ${user.token}`);
    expect(beforeBan.status).toBe(200);

    await pool.query('UPDATE users SET is_banned = TRUE WHERE id = $1', [user.userId]);

    const afterBan = await agent
      .get('/api/profile/me')
      .set('Authorization', `Bearer ${user.token}`);
    expect(afterBan.status).toBe(403);
  });

  it('accepts the data URL the app actually sends for a profile photo', async () => {
    const user = await signupAndCompleteProfile({
      email: `dataurl_${Date.now()}@example.com`,
      name: 'Data URL',
    });

    // expo-image-picker hands the app a base64 data URL and PhotoManagerScreen
    // posts it straight here. Rejecting it broke photo upload entirely.
    const response = await agent
      .post('/api/profile/photo')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        photo_url:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        is_primary: true,
      });

    // Without a bucket configured this is 503 (storage unavailable), never 400.
    // A 400 would mean the payload itself was rejected, which is the bug.
    expect(response.status).not.toBe(400);
  });

  it('rejects profile photos that are not on an allowed https host', async () => {
    const user = await signupAndCompleteProfile({
      email: `photo_${Date.now()}@example.com`,
      name: 'Photo User',
    });

    // Data URLs are the app's normal upload path and are covered above. What must
    // still be refused is an arbitrary third-party URL, which would have the app
    // render a stranger's host for every viewer.
    const arbitraryHost = await agent
      .post('/api/profile/photo')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ photo_url: 'https://evil.example.com/tracker.png' });
    expect(arbitraryHost.status).toBe(400);
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

  it('sends and verifies an OTP by email', async () => {
    const user = await signupAndCompleteProfile({
      email: `emailotp_${Date.now()}@example.com`,
      name: 'Email OTP',
    });
    const target = `verify.me.${Date.now()}@example.com`;

    const request = await agent
      .post('/api/verification/otp/request')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ email: target });

    expect(request.status).toBe(200);
    expect(request.body.channel).toBe('email');
    // The address must never be echoed back in full.
    expect(request.body.destination_hint).not.toBe(target);
    expect(request.body.destination_hint).toContain('@');

    const stored = await pool.query('SELECT code FROM otp_codes WHERE email = $1', [target]);
    expect(stored.rows).toHaveLength(1);

    const wrong = await agent
      .post('/api/verification/otp/verify')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ email: target, code: '000000' });
    expect(wrong.status).toBe(400);

    const verify = await agent
      .post('/api/verification/otp/verify')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ email: target, code: stored.rows[0].code });

    expect(verify.status).toBe(200);
    expect(verify.body.verification.email_verified).toBe(true);

    const flag = await pool.query('SELECT is_verified FROM users WHERE id = $1', [user.userId]);
    expect(flag.rows[0].is_verified).toBe(true);
  });

  it('rejects a malformed email for OTP', async () => {
    const user = await signupAndCompleteProfile({
      email: `bademail_${Date.now()}@example.com`,
      name: 'Bad Email',
    });

    const response = await agent
      .post('/api/verification/otp/request')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ email: 'not-an-address' });

    expect(response.status).toBe(400);
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


  // --- Staged signup funnel -------------------------------------------------

  const readOtpCode = async (channel: 'phone' | 'email', value: string) => {
    const record = await pool.query(`SELECT code FROM otp_codes WHERE ${channel} = $1`, [value]);
    expect(record.rows.length).toBe(1);
    return String(record.rows[0].code);
  };

  const runRegistrationFunnel = async (phone: string, email: string, password = 'Passw0rd!') => {
    const start = await agent.post('/api/auth/register/start').send({});
    expect(start.status).toBe(201);
    const registration_token = start.body.registration_token as string;
    expect(registration_token).toBeTruthy();

    if (start.body.phone_required) {
      const phoneStep = await agent
        .post('/api/auth/register/phone')
        .send({ registration_token, phone });
      expect(phoneStep.status).toBe(200);

      const phoneVerify = await agent
        .post('/api/auth/register/phone/verify')
        .send({ registration_token, code: await readOtpCode('phone', phone) });
      expect(phoneVerify.status).toBe(200);
    }

    const emailStep = await agent
      .post('/api/auth/register/email')
      .send({ registration_token, email });
    expect(emailStep.status).toBe(200);

    const emailVerify = await agent
      .post('/api/auth/register/email/verify')
      .send({ registration_token, code: await readOtpCode('email', email) });
    expect(emailVerify.status).toBe(200);

    const complete = await agent
      .post('/api/auth/register/complete')
      .send({ registration_token, password });

    return { registration_token, complete };
  };

  it('creates an account through the staged signup funnel', async () => {
    const email = `funnel_${Date.now()}@example.com`;
    const { complete } = await runRegistrationFunnel('+15551230001', email);

    expect(complete.status).toBe(201);
    expect(complete.body.token).toBeTruthy();
    expect(complete.body.user.email).toBe(email);
    // The account exists but has no profile yet, so the app must send them on.
    expect(complete.body.onboarding_required).toBe(true);
    expect(complete.body.user.onboarding_completed).toBe(false);

    // The phone verified during the funnel carries onto the new account.
    const status = await agent
      .get('/api/verification/status')
      .set('Authorization', `Bearer ${complete.body.token}`);
    expect(status.status).toBe(200);
    expect(status.body.status.otp_verified).toBe(true);
    expect(status.body.status.phone).toBe('+15551230001');

    // And the password set at the last step is the one that logs in.
    const login = await agent.post('/api/auth/login').send({ email, password: 'Passw0rd!' });
    expect(login.status).toBe(200);
  });

  it('refuses to finish a registration whose email was never verified', async () => {
    const start = await agent.post('/api/auth/register/start').send({});
    const registration_token = start.body.registration_token as string;

    const phone = '+15551230002';
    await agent.post('/api/auth/register/phone').send({ registration_token, phone });
    await agent
      .post('/api/auth/register/phone/verify')
      .send({ registration_token, code: await readOtpCode('phone', phone) });

    await agent
      .post('/api/auth/register/email')
      .send({ registration_token, email: `unverified_${Date.now()}@example.com` });

    // Skips straight past the email OTP screen.
    const complete = await agent
      .post('/api/auth/register/complete')
      .send({ registration_token, password: 'Passw0rd!' });
    expect(complete.status).toBe(409);
    expect(complete.body.error).toMatch(/verify your email/i);
  });

  it('refuses to reach the email step until the phone is verified', async () => {
    const start = await agent.post('/api/auth/register/start').send({});
    expect(start.body.phone_required).toBe(true);
    const registration_token = start.body.registration_token as string;

    await agent
      .post('/api/auth/register/phone')
      .send({ registration_token, phone: '+15551230003' });

    const emailStep = await agent
      .post('/api/auth/register/email')
      .send({ registration_token, email: `tooearly_${Date.now()}@example.com` });
    expect(emailStep.status).toBe(409);
    expect(emailStep.body.error).toMatch(/verify your phone/i);
  });

  it('skips the phone steps entirely when no SMS provider is available', async () => {
    process.env.ALLOW_DEV_OTP_BYPASS = 'false';
    try {
      const capabilities = await agent.get('/api/auth/capabilities');
      expect(capabilities.status).toBe(200);
      expect(capabilities.body.sms).toBe(false);

      const start = await agent.post('/api/auth/register/start').send({});
      expect(start.body.phone_required).toBe(false);
    } finally {
      delete process.env.ALLOW_DEV_OTP_BYPASS;
    }
  });

  it('rejects a registration password below the minimum length', async () => {
    const email = `shortpw_${Date.now()}@example.com`;
    const { complete } = await runRegistrationFunnel('+15551230004', email, 'short');
    expect(complete.status).toBe(400);
    expect(complete.body.error).toMatch(/at least 8 characters/i);
  });

  it('refuses a registration for an email that is already an account', async () => {
    const existing = await signupAndCompleteProfile({
      email: `taken_${Date.now()}@example.com`,
      name: 'Taken User',
    });

    const start = await agent.post('/api/auth/register/start').send({});
    const registration_token = start.body.registration_token as string;
    const phone = '+15551230005';
    await agent.post('/api/auth/register/phone').send({ registration_token, phone });
    await agent
      .post('/api/auth/register/phone/verify')
      .send({ registration_token, code: await readOtpCode('phone', phone) });

    const emailStep = await agent
      .post('/api/auth/register/email')
      .send({ registration_token, email: existing.signupPayload.email });
    expect(emailStep.status).toBe(409);
    expect(emailStep.body.error).toMatch(/already registered/i);
  });


  it('lets one honest signup finish without tripping its own rate limit', async () => {
    // Rate limiting is off under test by default, which is why a limiter sized
    // smaller than the funnel it guards went unnoticed: the funnel makes six
    // requests, and the signup limiter allows five per hour. Turn it on here so
    // the budgets are exercised rather than assumed.
    process.env.ENABLE_RATE_LIMIT_IN_TESTS = 'true';
    resetRateLimits();
    try {
      const email = `ratelimit_${Date.now()}@example.com`;
      const { complete } = await runRegistrationFunnel('+15551230007', email);
      expect(complete.status).toBe(201);
    } finally {
      delete process.env.ENABLE_RATE_LIMIT_IN_TESTS;
      resetRateLimits();
    }
  });

  it('still refuses bulk funnel creation from one address', async () => {
    process.env.ENABLE_RATE_LIMIT_IN_TESTS = 'true';
    resetRateLimits();
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 17; i++) {
        const response = await agent.post('/api/auth/register/start').send({});
        statuses.push(response.status);
      }
      // 15 allowed per hour, so the tail must be rejected.
      expect(statuses.filter((code) => code === 201).length).toBe(15);
      expect(statuses[statuses.length - 1]).toBe(429);
    } finally {
      delete process.env.ENABLE_RATE_LIMIT_IN_TESTS;
      resetRateLimits();
    }
  });


  it('resets a password by emailing the code, with no phone on the account', async () => {
    const email = `reset_${Date.now()}@example.com`;
    const user = await signupAndCompleteProfile({ email, name: 'Reset User' });
    expect(user.token).toBeTruthy();

    // No verified phone anywhere on this account. Password reset used to be
    // phone-only, which meant it returned 503 to everyone whenever SMS was
    // unconfigured, and worked for nobody who had skipped phone verification.
    const request = await agent.post('/api/auth/forgot-password').send({ email });
    expect(request.status).toBe(200);
    expect(request.body.channel).toBe('email');

    const code = await readOtpCode('email', email);

    const reset = await agent
      .post('/api/auth/reset-password')
      .send({ email, code, new_password: 'BrandNew1!' });
    expect(reset.status).toBe(200);

    // Old password is dead, new one works.
    const oldLogin = await agent.post('/api/auth/login').send({ email, password: 'Passw0rd!' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await agent.post('/api/auth/login').send({ email, password: 'BrandNew1!' });
    expect(newLogin.status).toBe(200);
  });

  it('does not reveal whether an address has an account', async () => {
    const response = await agent
      .post('/api/auth/forgot-password')
      .send({ email: `nobody_${Date.now()}@example.com` });
    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/if that email is registered/i);
  });


  // --- Bookmarks and rewind -------------------------------------------------

  const setPremium = async (userId: number, premium: boolean) => {
    await pool.query(
      'UPDATE users SET is_premium = $2, premium_expires_at = NULL WHERE id = $1',
      [userId, premium]
    );
  };

  const putInCooldown = async (userId: number) => {
    await pool.query(
      "UPDATE users SET cooldown_until = NOW() + INTERVAL '5 hours' WHERE id = $1",
      [userId]
    );
  };

  it('blocks likes during cooldown for paying users too, and offers a bookmark', async () => {
    const seeker = await signupAndCompleteProfile({
      email: `cool_seeker_${Date.now()}@example.com`,
      name: 'Cooldown Seeker',
      gender: 'male',
      interested_in: 'female',
    });
    const target = await signupAndCompleteProfile({
      email: `cool_target_${Date.now()}@example.com`,
      name: 'Cooldown Target',
      gender: 'female',
      interested_in: 'male',
    });

    // Paying used to buy a way THROUGH someone's cooldown, which inverted the
    // mechanic: cooldown exists to stop a person who hit their limit being
    // flooded, so it has to hold against paid accounts as well.
    await setPremium(seeker.userId, true);
    await putInCooldown(target.userId);

    const like = await agent
      .post('/api/likes')
      .set('Authorization', `Bearer ${seeker.token}`)
      .send({ target_user_id: target.userId, is_on_grid: true });

    expect(like.status).toBe(400);
    expect(like.body.error).toMatch(/cooldown/i);
    expect(like.body.can_bookmark).toBe(true);
  });

  it('saves a bookmark and reports when it becomes actionable', async () => {
    const seeker = await signupAndCompleteProfile({
      email: `bm_seeker_${Date.now()}@example.com`,
      name: 'BM Seeker',
      gender: 'male',
      interested_in: 'female',
    });
    const target = await signupAndCompleteProfile({
      email: `bm_target_${Date.now()}@example.com`,
      name: 'BM Target',
      gender: 'female',
      interested_in: 'male',
    });

    await setPremium(seeker.userId, true);
    await putInCooldown(target.userId);

    const saved = await agent
      .post('/api/bookmarks')
      .set('Authorization', `Bearer ${seeker.token}`)
      .send({ target_user_id: target.userId });
    expect(saved.status).toBe(201);

    const whileCooling = await agent
      .get('/api/bookmarks')
      .set('Authorization', `Bearer ${seeker.token}`);
    expect(whileCooling.status).toBe(200);
    expect(whileCooling.body.bookmarks).toHaveLength(1);
    expect(whileCooling.body.bookmarks[0].in_cooldown).toBe(true);
    expect(whileCooling.body.bookmarks[0].is_available).toBe(false);
    expect(whileCooling.body.available_count).toBe(0);

    // Cooldown lapses: the bookmark becomes something you can act on.
    await pool.query('UPDATE users SET cooldown_until = NULL WHERE id = $1', [target.userId]);

    const afterCooling = await agent
      .get('/api/bookmarks')
      .set('Authorization', `Bearer ${seeker.token}`);
    expect(afterCooling.body.bookmarks[0].is_available).toBe(true);
    expect(afterCooling.body.available_count).toBe(1);

    const removed = await agent
      .delete(`/api/bookmarks/${target.userId}`)
      .set('Authorization', `Bearer ${seeker.token}`);
    expect(removed.status).toBe(200);

    const empty = await agent
      .get('/api/bookmarks')
      .set('Authorization', `Bearer ${seeker.token}`);
    expect(empty.body.bookmarks).toHaveLength(0);
  });

  it('refuses bookmarks to accounts that are not paying', async () => {
    const seeker = await signupAndCompleteProfile({
      email: `bm_free_${Date.now()}@example.com`,
      name: 'Free Seeker',
    });
    const target = await signupAndCompleteProfile({
      email: `bm_free_target_${Date.now()}@example.com`,
      name: 'Free Target',
    });

    const saved = await agent
      .post('/api/bookmarks')
      .set('Authorization', `Bearer ${seeker.token}`)
      .send({ target_user_id: target.userId });
    expect(saved.status).toBe(403);
    expect(saved.body.upgrade_required).toBe(true);
  });

  it('rewinds to the previous off-grid set, and only for paying users', async () => {
    const seeker = await signupAndCompleteProfile({
      email: `rw_${Date.now()}@example.com`,
      name: 'Rewind User',
      gender: 'male',
      interested_in: 'female',
    });

    // Two sets recorded: what is on screen now, and the one before it.
    await pool.query('INSERT INTO off_grid_history (user_id, candidate_ids) VALUES ($1, $2)', [
      seeker.userId,
      JSON.stringify([1, 2]),
    ]);
    await pool.query('INSERT INTO off_grid_history (user_id, candidate_ids) VALUES ($1, $2)', [
      seeker.userId,
      JSON.stringify([3, 4]),
    ]);

    const denied = await agent
      .post('/api/matches/rewind-off-grid')
      .set('Authorization', `Bearer ${seeker.token}`);
    expect(denied.status).toBe(403);
    expect(denied.body.upgrade_required).toBe(true);

    await setPremium(seeker.userId, true);

    const target = await signupAndCompleteProfile({
      email: `rw_target_${Date.now()}@example.com`,
      name: 'Rewind Target',
      gender: 'female',
      interested_in: 'male',
    });

    // Point the older set at a profile that really exists.
    await pool.query('DELETE FROM off_grid_history WHERE user_id = $1', [seeker.userId]);
    await pool.query('INSERT INTO off_grid_history (user_id, candidate_ids) VALUES ($1, $2)', [
      seeker.userId,
      JSON.stringify([target.userId]),
    ]);
    await pool.query('INSERT INTO off_grid_history (user_id, candidate_ids) VALUES ($1, $2)', [
      seeker.userId,
      JSON.stringify([999999]),
    ]);

    const rewound = await agent
      .post('/api/matches/rewind-off-grid')
      .set('Authorization', `Bearer ${seeker.token}`);
    expect(rewound.status).toBe(200);
    expect(rewound.body.matches.map((m: any) => m.id)).toContain(target.userId);

    // Nothing left behind it, so a second rewind has nowhere to go.
    const again = await agent
      .post('/api/matches/rewind-off-grid')
      .set('Authorization', `Bearer ${seeker.token}`);
    expect(again.status).toBe(404);
  });

  // --- Quiz, pronouns, and discovery eligibility ----------------------------

  it('serves twelve situational questions with four options each', async () => {
    const response = await agent.get('/api/personality/questions');
    expect(response.status).toBe(200);
    expect(response.body.count).toBe(12);
    expect(response.body.questions).toHaveLength(12);

    response.body.questions.forEach((question: any, index: number) => {
      expect(question.number).toBe(index + 1);
      expect(typeof question.prompt).toBe('string');
      expect(question.prompt.length).toBeGreaterThan(0);
      expect(question.options.map((o: any) => o.key)).toEqual(['A', 'B', 'C', 'D']);
      // Trait mappings stay server-side so answers cannot be reverse-engineered.
      question.options.forEach((option: any) => expect(option.traits).toBeUndefined());
    });
  });

  it('stores all twelve answers and derives traits per question, not per letter', async () => {
    const user = await signupAndCompleteProfile(
      { email: `quiz_${Date.now()}@example.com`, name: 'Quiz User' },
      {
        question9_answer: 'A',
        question10_answer: 'B',
        question11_answer: 'C',
        question12_answer: 'D',
      }
    );

    const stored = await pool.query(
      `SELECT question9_answer, question10_answer, question11_answer, question12_answer,
              personality_traits
       FROM personality_responses WHERE user_id = $1`,
      [user.userId]
    );
    expect(stored.rows[0].question9_answer).toBe('A');
    expect(stored.rows[0].question12_answer).toBe('D');

    const traits: string[] = stored.rows[0].personality_traits;
    // Q1=A is "Make them laugh" -> Playful; Q12=D is "We handle the boring days
    // well" -> Steady. A flat A/B/C/D map could not produce both.
    expect(traits).toEqual(expect.arrayContaining(['Playful', 'Steady']));
    expect(new Set(traits).size).toBe(traits.length);
  });

  it('keeps quiz answers that a later profile update does not resend', async () => {
    const user = await signupAndCompleteProfile(
      { email: `quizkeep_${Date.now()}@example.com`, name: 'Quiz Keep' },
      { question9_answer: 'C' }
    );

    const update = await agent
      .post('/api/profile/complete')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ bio: 'Updated bio only.' });
    expect(update.status).toBe(200);

    const stored = await pool.query(
      'SELECT question1_answer, question9_answer FROM personality_responses WHERE user_id = $1',
      [user.userId]
    );
    expect(stored.rows[0].question1_answer).toBe('A');
    expect(stored.rows[0].question9_answer).toBe('C');
  });


  it('saves how far the user will travel, which onboarding now asks for', async () => {
    const user = await signupAndCompleteProfile(
      { email: `radius_${Date.now()}@example.com`, name: 'Radius User' },
      { distance_radius: 25 }
    );

    const stored = await pool.query('SELECT distance_radius FROM users WHERE id = $1', [
      user.userId,
    ]);
    // Previously nothing ever wrote this, so every account silently kept the
    // 50km column default while the match query treated it as a real choice.
    expect(Number(stored.rows[0].distance_radius)).toBe(25);

    const me = await agent.get('/api/profile/me').set('Authorization', `Bearer ${user.token}`);
    expect(Number(me.body.user.distance_radius)).toBe(25);
  });

  it('ignores a nonsense travel distance rather than storing it', async () => {
    const user = await signupAndCompleteProfile(
      { email: `radius_bad_${Date.now()}@example.com`, name: 'Bad Radius' },
      { distance_radius: -5 }
    );
    const stored = await pool.query('SELECT distance_radius FROM users WHERE id = $1', [
      user.userId,
    ]);
    expect(Number(stored.rows[0].distance_radius)).toBe(50);
  });

  it('persists pronouns, which the app collected but previously discarded', async () => {
    const user = await signupAndCompleteProfile(
      { email: `pronouns_${Date.now()}@example.com`, name: 'Pronoun User' },
      { pronouns: ['She / Her', 'They / Them'] }
    );

    const me = await agent
      .get('/api/profile/me')
      .set('Authorization', `Bearer ${user.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.pronouns).toEqual(['She / Her', 'They / Them']);
  });

  it('hides accounts that have not finished onboarding from discovery', async () => {
    const seeker = await signupAndCompleteProfile({
      email: `seeker_${Date.now()}@example.com`,
      name: 'Seeker',
      gender: 'male',
      interested_in: 'female',
    });

    // An account created by the funnel: real, logged in, but no profile yet.
    const funnelEmail = `ghost_${Date.now()}@example.com`;
    const { complete } = await runRegistrationFunnel('+15551230006', funnelEmail);
    expect(complete.status).toBe(201);

    const search = await agent
      .post('/api/matches/search')
      .set('Authorization', `Bearer ${seeker.token}`)
      .send({ search_query: '', is_on_grid: true });
    expect(search.status).toBe(200);

    const returnedIds = [
      ...(search.body.on_grid || []),
      ...(search.body.off_grid || []),
    ].map((candidate: any) => candidate.id);
    expect(returnedIds).not.toContain(complete.body.user.id);
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
