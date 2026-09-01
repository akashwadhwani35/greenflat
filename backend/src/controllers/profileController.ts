import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { TOKEN_COSTS } from '../utils/constants';
import { PLACEHOLDER_CITY, PLACEHOLDER_NAME } from '../services/accounts.service';
import {
  PERSONALITY_QUESTIONS,
  normalizeAnswer,
  traitsForAnswers,
  describeAnswers,
  type QuizOptionKey,
} from '../utils/personalityQuestions';
import { analyzePersonality, generateProfileEmbedding, generateBioSuggestions } from '../services/openai.service';
import { consumeCredits, ensureDailyAllowance } from '../services/credits.service';
import { normalizeMediaMessageUrl } from '../services/media.service';
import { storeDataUrl, mediaUrlFor, isGcsConfigured } from '../services/storage.service';

const BOOST_DURATION_HOURS = 6;

export const completeProfile = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const userId = req.userId;
    const {
      // Identity. The staged signup funnel creates the account before any of
      // these are known, so onboarding sends them here.
      name,
      gender,
      interested_in,
      date_of_birth,
      city,
      distance_radius,
      pronouns,
      // Profile data
      height,
      body_type,
      interests,
      bio,
      prompt1,
      prompt2,
      prompt3,
      smoker,
      drinker,
      diet,
      fitness_level,
      education,
      education_level,
      occupation,
      hometown,
      relationship_goal,
      have_kids,
      star_sign,
      politics,
      religion,
      family_oriented,
      spiritual,
      open_minded,
      career_focused,
      // AI persona prompts
      self_summary,
      ideal_partner_prompt,
      connection_preferences,
      dealbreakers,
      growth_journey,
      // Personality quiz answers
      question1_answer,
      question2_answer,
      question3_answer,
      question4_answer,
      question5_answer,
      question6_answer,
      question7_answer,
      question8_answer,
      question9_answer,
      question10_answer,
      question11_answer,
      question12_answer,
    } = req.body;

    await client.query('BEGIN');

    const smokingHabit =
      typeof smoker === 'string'
        ? smoker.toLowerCase()
        : smoker === true
          ? 'regular'
          : smoker === false
            ? 'never'
            : null;

    const smokerBoolean =
      typeof smoker === 'boolean'
        ? smoker
        : smokingHabit
          ? smokingHabit !== 'never'
          : null;

    // Create or update user profile
    const profileResult = await client.query(
      `INSERT INTO user_profiles (
        user_id, height, body_type, interests, bio, prompt1, prompt2, prompt3,
        smoker, smoking_habit, drinker, diet, fitness_level, education, education_level, occupation, hometown,
        relationship_goal, have_kids, star_sign, politics, religion,
        family_oriented, spiritual, open_minded, career_focused,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        height = $2, body_type = $3, interests = $4, bio = $5,
        prompt1 = $6, prompt2 = $7, prompt3 = $8, smoker = $9,
        smoking_habit = $10, drinker = $11, diet = $12, fitness_level = $13, education = $14, education_level = $15,
        occupation = $16, hometown = $17, relationship_goal = $18, have_kids = $19, star_sign = $20,
        politics = $21, religion = $22, family_oriented = $23,
        spiritual = $24, open_minded = $25, career_focused = $26,
        updated_at = NOW()
      RETURNING *`,
      [
        userId, height, body_type, interests, bio, prompt1, prompt2, prompt3,
        smokerBoolean, smokingHabit, drinker, diet, fitness_level, education, education_level, occupation, hometown,
        relationship_goal, have_kids, star_sign, politics, religion,
        family_oriented, spiritual, open_minded, career_focused,
      ]
    );

    const answerColumns = PERSONALITY_QUESTIONS.map((q) => `question${q.number}_answer`);

    const existingPersonalityResult = await client.query(
      `SELECT ${answerColumns.join(', ')}
       FROM personality_responses
       WHERE user_id = $1`,
      [userId]
    );

    const existingAnswers = existingPersonalityResult.rows[0] || {};
    const incomingAnswers: Record<number, unknown> = {
      1: question1_answer,
      2: question2_answer,
      3: question3_answer,
      4: question4_answer,
      5: question5_answer,
      6: question6_answer,
      7: question7_answer,
      8: question8_answer,
      9: question9_answer,
      10: question10_answer,
      11: question11_answer,
      12: question12_answer,
    };

    // Always preserve already-saved quiz answers when a request doesn't include
    // them. Users who took the original eight-question quiz keep those answers
    // and simply have nothing stored for 9-12 until they retake it.
    const answers: Array<QuizOptionKey | null> = PERSONALITY_QUESTIONS.map(
      (question) =>
        normalizeAnswer(incomingAnswers[question.number]) ??
        normalizeAnswer(existingAnswers[`question${question.number}_answer`])
    );

    // Traits are resolved per question, not from a flat letter map: on a
    // situational quiz the same letter means something different each time.
    const uniqueTraits = traitsForAnswers(answers);

    const answerSummary = describeAnswers(answers);
    const aboutYouText = [bio, prompt1, prompt2, prompt3]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join('\n');
    let aiPersonalityInsights = {
      summary: 'You have a unique personality!',
      top_traits: uniqueTraits.slice(0, 3),
      compatibility_tips: 'You would match well with someone who shares your values.',
    };

    if (process.env.OPENAI_API_KEY && (answerSummary.length > 0 || aboutYouText.length > 0)) {
      try {
        const insights = await analyzePersonality(answerSummary, aboutYouText);
        aiPersonalityInsights = {
          summary: insights.summary,
          top_traits: insights.top_traits && insights.top_traits.length > 0 ? insights.top_traits : uniqueTraits.slice(0, 3),
          compatibility_tips: insights.compatibility_tips,
        };
      } catch (error) {
        console.error('Error generating AI personality insights:', error);
      }
    }

    // Save personality responses. Built from the question bank so adding a
    // question is a one-file change rather than an edit to this statement.
    const answerPlaceholders = answers.map((_, i) => `$${i + 2}`);
    const answerAssignments = answerColumns
      .map((column, i) => `${column} = ${answerPlaceholders[i]}`)
      .join(', ');
    const traitsParam = `$${answers.length + 2}`;
    const summaryParam = `$${answers.length + 3}`;
    const tipsParam = `$${answers.length + 4}`;
    const topTraitsParam = `$${answers.length + 5}`;

    await client.query(
      `INSERT INTO personality_responses (
        user_id, ${answerColumns.join(', ')}, personality_traits,
        personality_summary, compatibility_tips, top_traits, updated_at
      ) VALUES ($1, ${answerPlaceholders.join(', ')}, ${traitsParam}, ${summaryParam}, ${tipsParam}, ${topTraitsParam}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        ${answerAssignments},
        personality_traits = ${traitsParam},
        personality_summary = ${summaryParam},
        compatibility_tips = ${tipsParam},
        top_traits = ${topTraitsParam},
        updated_at = NOW()
      RETURNING *`,
      [
        userId,
        ...answers,
        uniqueTraits,
        aiPersonalityInsights.summary,
        aiPersonalityInsights.compatibility_tips,
        aiPersonalityInsights.top_traits,
      ]
    );

    // Pronouns live on users beside name and gender, not in user_profiles: they
    // are identity, shown wherever a name is shown, and were previously collected
    // by the app and then dropped on the floor for want of a column.
    const normalizedPronouns = Array.isArray(pronouns)
      ? pronouns
          .filter((value: unknown): value is string => typeof value === 'string')
          .map((value: string) => value.trim())
          .filter((value: string) => value.length > 0 && value.length <= 40)
          .slice(0, 4)
      : null;

    // Identity fields live on users, not user_profiles. The staged signup funnel
    // creates the account before asking for any of them, so this is where the
    // placeholders put in at signup get replaced with what the user actually said.
    // How far the user will travel. Onboarding asks for this; without it every
    // account silently kept the 50km column default, which the match query then
    // enforced as though the user had chosen it.
    const parsedRadius = Number(distance_radius);
    const normalizedRadius =
      Number.isFinite(parsedRadius) && parsedRadius >= 1 && parsedRadius <= 20000
        ? Math.round(parsedRadius)
        : null;

    const identityUpdate = await client.query(
      `UPDATE users
       SET name = COALESCE($2, name),
           gender = COALESCE($3, gender),
           interested_in = COALESCE($4, interested_in),
           date_of_birth = COALESCE($5, date_of_birth),
           city = COALESCE($6, city),
           pronouns = COALESCE($7, pronouns),
           distance_radius = COALESCE($8, distance_radius),
           cooldown_enabled = CASE WHEN $3::text = 'female' THEN TRUE ELSE cooldown_enabled END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING name, gender, city, date_of_birth`,
      [
        userId,
        typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : null,
        typeof gender === 'string' && ['male', 'female', 'other'].includes(gender) ? gender : null,
        typeof interested_in === 'string' && ['male', 'female', 'both'].includes(interested_in)
          ? interested_in
          : null,
        date_of_birth || null,
        typeof city === 'string' && city.trim() ? city.trim().slice(0, 100) : null,
        normalizedPronouns,
        normalizedRadius,
      ]
    );

    // Onboarding counts as finished once the account has real identity values
    // rather than the signup placeholders. Until this is stamped the user does
    // not appear in anyone's discovery results.
    const identity = identityUpdate.rows[0] || {};
    const hasRealIdentity =
      Boolean(identity.name) &&
      identity.name !== PLACEHOLDER_NAME &&
      Boolean(identity.city) &&
      identity.city !== PLACEHOLDER_CITY;

    if (hasRealIdentity) {
      await client.query(
        `UPDATE users
         SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW())
         WHERE id = $1`,
        [userId]
      );
    }

    const personaSegments = [
      bio,
      prompt1,
      prompt2,
      prompt3,
      self_summary,
      ideal_partner_prompt,
      connection_preferences,
      dealbreakers,
      growth_journey,
      uniqueTraits.join(', '),
    ]
      .filter((segment): segment is string => Boolean(segment && segment.length > 0))
      .join('\n');

    let personaEmbedding: number[] | null = null;
    if (process.env.OPENAI_API_KEY && personaSegments.trim().length > 0) {
      try {
        personaEmbedding = await generateProfileEmbedding(personaSegments);
      } catch (error) {
        console.error('Error generating persona embedding:', error);
      }
    }

    const personaResult = await client.query(
      `INSERT INTO user_ai_profiles (
        user_id, self_summary, ideal_partner_prompt, connection_preferences,
        dealbreakers, growth_journey, persona_embedding, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        self_summary = $2,
        ideal_partner_prompt = $3,
        connection_preferences = $4,
        dealbreakers = $5,
        growth_journey = $6,
        persona_embedding = $7,
        updated_at = NOW()
      RETURNING *`,
      [
        userId,
        self_summary || null,
        ideal_partner_prompt || null,
        connection_preferences || null,
        dealbreakers || null,
        growth_journey || null,
        personaEmbedding ? JSON.stringify(personaEmbedding) : null,
      ]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Profile completed successfully',
      profile: profileResult.rows[0],
      personality_traits: uniqueTraits,
      ai_insights: aiPersonalityInsights,
      ai_persona: personaResult.rows[0] || null,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Complete profile error:', error);
    res.status(500).json({ error: 'Failed to complete profile' });
  } finally {
    client.release();
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    // Get user data
    const userResult = await pool.query(
      `SELECT id, email, name, gender, interested_in, pronouns, date_of_birth, city, distance_radius,
              is_verified, is_premium, premium_expires_at, boost_expires_at, credit_balance, cooldown_enabled
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get profile data
    const profileResult = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    // Get personality data
    const personalityResult = await pool.query(
      'SELECT * FROM personality_responses WHERE user_id = $1',
      [userId]
    );

    // Get AI persona data
    const aiProfileResult = await pool.query(
      'SELECT user_id, self_summary, ideal_partner_prompt, connection_preferences, dealbreakers, growth_journey, persona_embedding, updated_at FROM user_ai_profiles WHERE user_id = $1',
      [userId]
    );

    // Get photos
    const photosResult = await pool.query(
      'SELECT id, photo_url, is_primary, order_index FROM photos WHERE user_id = $1 ORDER BY order_index',
      [userId]
    );

    res.json({
      user: userResult.rows[0],
      profile: profileResult.rows[0] || null,
      personality: personalityResult.rows[0] || null,
      ai_persona: aiProfileResult.rows[0] ? {
        ...aiProfileResult.rows[0],
        persona_embedding: aiProfileResult.rows[0].persona_embedding || [],
      } : null,
      photos: photosResult.rows,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const activateBoost = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = req.userId!;

    // Boost costs tokens, so settle the free allowance first.
    await ensureDailyAllowance(userId);

    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT is_premium, premium_expires_at, boost_expires_at, credit_balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const now = Date.now();
    const currentCreditBalance = Number(user.credit_balance || 0);
    const premiumExpiresAt = user.premium_expires_at ? new Date(user.premium_expires_at).getTime() : null;
    const hasPaidPlan = Boolean(user.is_premium) && (premiumExpiresAt === null || premiumExpiresAt > now);

    const boostExpiresAt = user.boost_expires_at ? new Date(user.boost_expires_at).getTime() : null;
    if (boostExpiresAt && boostExpiresAt > now) {
      await client.query('COMMIT');
      return res.json({
        message: 'Boost is already active',
        boost_active: true,
        boost_expires_at: new Date(boostExpiresAt).toISOString(),
        credit_balance: currentCreditBalance,
      });
    }

    let chargedTokens = 0;
    let remainingCredits = currentCreditBalance;
    if (!hasPaidPlan) {
      if (currentCreditBalance < TOKEN_COSTS.BOOST) {
        await client.query('ROLLBACK');
        return res.status(402).json({
          error: `Boost requires Premium or ${TOKEN_COSTS.BOOST} tokens.`,
          required_tokens: TOKEN_COSTS.BOOST,
          credit_balance: currentCreditBalance,
        });
      }

      remainingCredits = await consumeCredits(
        userId,
        TOKEN_COSTS.BOOST,
        'boost_activation',
        { source: 'profile_boost' },
        client
      );
      chargedTokens = TOKEN_COSTS.BOOST;
    }

    const updateResult = await client.query(
      `UPDATE users
       SET boost_expires_at = NOW() + INTERVAL '${BOOST_DURATION_HOURS} hours',
           updated_at = NOW()
       WHERE id = $1
       RETURNING boost_expires_at`,
      [userId]
    );

    await client.query('COMMIT');

    return res.json({
      message: `Boost activated for ${BOOST_DURATION_HOURS} hours`,
      boost_active: true,
      boost_expires_at: updateResult.rows[0].boost_expires_at,
      charged_tokens: chargedTokens,
      credit_balance: remainingCredits,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Activate boost error:', error);
    return res.status(500).json({ error: 'Failed to activate boost' });
  } finally {
    client.release();
  }
};

export const uploadPhoto = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { photo_url, is_primary, order_index } = req.body;

    if (!photo_url) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }

    // The app sends the picked image straight from expo-image-picker as a base64
    // data: URL, so that is the primary path: it is stored in GCS and replaced
    // with a URL served back through this API.
    //
    // A plain URL is still accepted (re-adding an existing photo, or a client
    // that uploaded separately) but must pass the host allowlist. Before this the
    // column took any string at all, including arbitrary third-party URLs that
    // the app would then render for every viewer.
    let normalizedPhotoUrl: string;
    const isDataUrl = typeof photo_url === 'string' && photo_url.trim().startsWith('data:');

    try {
      const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
      const protocol = forwardedProto || req.protocol || 'https';
      const requestHost = req.get('host') || undefined;

      if (isDataUrl) {
        if (!isGcsConfigured()) {
          return res.status(503).json({ error: 'Photo storage is not configured' });
        }
        const stored = await storeDataUrl(photo_url);
        normalizedPhotoUrl = mediaUrlFor(stored.objectName, `${protocol}://${requestHost}`);
      } else {
        normalizedPhotoUrl = normalizeMediaMessageUrl(photo_url, {
          requestHost,
          allowHttpForRequestHost: protocol !== 'https',
        });
      }
    } catch (validationError: any) {
      return res.status(400).json({ error: validationError?.message || 'Invalid photo' });
    }

    // If this is primary photo, unset other primary photos
    if (is_primary) {
      await pool.query(
        'UPDATE photos SET is_primary = FALSE WHERE user_id = $1',
        [userId]
      );
    }

    const result = await pool.query(
      'INSERT INTO photos (user_id, photo_url, is_primary, order_index) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, normalizedPhotoUrl, is_primary || false, order_index || 0]
    );

    res.status(201).json({
      message: 'Photo uploaded successfully',
      photo: result.rows[0],
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
};

export const deletePhoto = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { photoId } = req.params;

    const result = await pool.query(
      'DELETE FROM photos WHERE id = $1 AND user_id = $2 RETURNING id',
      [photoId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    res.json({ message: 'Photo deleted' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
};

export const setPrimaryPhoto = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { photo_id } = req.body;
    if (!photo_id) {
      return res.status(400).json({ error: 'photo_id is required' });
    }

    await pool.query('UPDATE photos SET is_primary = FALSE WHERE user_id = $1', [userId]);
    await pool.query('UPDATE photos SET is_primary = TRUE WHERE id = $1 AND user_id = $2', [photo_id, userId]);

    res.json({ message: 'Primary photo updated' });
  } catch (error) {
    console.error('Set primary photo error:', error);
    res.status(500).json({ error: 'Failed to set primary photo' });
  }
};

export const reorderPhoto = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { photo_id, order_index } = req.body;
    if (!photo_id || typeof order_index !== 'number') {
      return res.status(400).json({ error: 'photo_id and order_index are required' });
    }

    const result = await pool.query(
      'UPDATE photos SET order_index = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [order_index, photo_id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    res.json({ message: 'Photo reordered', photo: result.rows[0] });
  } catch (error) {
    console.error('Reorder photo error:', error);
    res.status(500).json({ error: 'Failed to reorder photo' });
  }
};

export const updateUserBasics = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { name, city, gender, date_of_birth, interested_in, pronouns } = req.body;

    const normalizedPronouns = Array.isArray(pronouns)
      ? pronouns
          .filter((value: unknown): value is string => typeof value === 'string')
          .map((value: string) => value.trim())
          .filter((value: string) => value.length > 0 && value.length <= 40)
          .slice(0, 4)
      : null;

    if (!name && !city && !gender && !date_of_birth && !interested_in && !normalizedPronouns) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           city = COALESCE($2, city),
           gender = COALESCE($3, gender),
           date_of_birth = COALESCE($4, date_of_birth),
           interested_in = COALESCE($5, interested_in),
           pronouns = COALESCE($6, pronouns),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, city, gender, date_of_birth, interested_in, pronouns`,
      [name || null, city || null, gender || null, date_of_birth || null, interested_in || null, normalizedPronouns, userId]
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user basics error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getBioSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'AI features are not configured' });
    }

    const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profileResult = await pool.query(
      'SELECT interests FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    const personalityResult = await pool.query(
      'SELECT top_traits FROM personality_responses WHERE user_id = $1',
      [userId]
    );

    const name = userResult.rows[0].name || 'User';
    const interests: string[] = profileResult.rows[0]?.interests || [];
    const traits: string[] = personalityResult.rows[0]?.top_traits || [];

    if (interests.length === 0 && traits.length === 0) {
      return res.status(400).json({ error: 'Complete your profile first to get bio suggestions' });
    }

    const suggestions = await generateBioSuggestions(name, interests, traits);
    res.json({ suggestions });
  } catch (error) {
    console.error('Bio suggestions error:', error);
    res.status(500).json({ error: 'Failed to generate bio suggestions' });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
};
