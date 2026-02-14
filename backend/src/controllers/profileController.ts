import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { PERSONALITY_TRAITS_MAP } from '../utils/constants';
import { analyzePersonality, generateProfileEmbedding } from '../services/openai.service';

export const completeProfile = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const userId = req.userId;
    const {
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

    const existingPersonalityResult = await client.query(
      `SELECT question1_answer, question2_answer, question3_answer, question4_answer,
              question5_answer, question6_answer, question7_answer, question8_answer
       FROM personality_responses
       WHERE user_id = $1`,
      [userId]
    );

    const existingAnswers = existingPersonalityResult.rows[0] || {};
    const normalizeAnswer = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const upper = value.trim().toUpperCase();
      return ['A', 'B', 'C', 'D'].includes(upper) ? upper : null;
    };

    // Always preserve already-saved quiz answers when a request doesn't include them.
    const answers = [
      normalizeAnswer(question1_answer) ?? normalizeAnswer(existingAnswers.question1_answer),
      normalizeAnswer(question2_answer) ?? normalizeAnswer(existingAnswers.question2_answer),
      normalizeAnswer(question3_answer) ?? normalizeAnswer(existingAnswers.question3_answer),
      normalizeAnswer(question4_answer) ?? normalizeAnswer(existingAnswers.question4_answer),
      normalizeAnswer(question5_answer) ?? normalizeAnswer(existingAnswers.question5_answer),
      normalizeAnswer(question6_answer) ?? normalizeAnswer(existingAnswers.question6_answer),
      normalizeAnswer(question7_answer) ?? normalizeAnswer(existingAnswers.question7_answer),
      normalizeAnswer(question8_answer) ?? normalizeAnswer(existingAnswers.question8_answer),
    ];

    const personalityTraits: string[] = [];
    answers.forEach((answer) => {
      if (answer && PERSONALITY_TRAITS_MAP[answer]) {
        personalityTraits.push(...PERSONALITY_TRAITS_MAP[answer]);
      }
    });

    // Remove duplicates
    const uniqueTraits = [...new Set(personalityTraits)];

    const filteredAnswers = answers.filter((answer): answer is string => Boolean(answer));
    const aboutYouText = [bio, prompt1, prompt2, prompt3]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join('\n');
    let aiPersonalityInsights = {
      summary: 'You have a unique personality!',
      top_traits: uniqueTraits.slice(0, 3),
      compatibility_tips: 'You would match well with someone who shares your values.',
    };

    if (process.env.OPENAI_API_KEY && (filteredAnswers.length > 0 || aboutYouText.length > 0)) {
      try {
        const insights = await analyzePersonality(filteredAnswers, aboutYouText);
        aiPersonalityInsights = {
          summary: insights.summary,
          top_traits: insights.top_traits && insights.top_traits.length > 0 ? insights.top_traits : uniqueTraits.slice(0, 3),
          compatibility_tips: insights.compatibility_tips,
        };
      } catch (error) {
        console.error('Error generating AI personality insights:', error);
      }
    }

    // Save personality responses
    await client.query(
      `INSERT INTO personality_responses (
        user_id, question1_answer, question2_answer, question3_answer,
        question4_answer, question5_answer, question6_answer,
        question7_answer, question8_answer, personality_traits,
        personality_summary, compatibility_tips, top_traits, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        question1_answer = $2, question2_answer = $3, question3_answer = $4,
        question4_answer = $5, question5_answer = $6, question6_answer = $7,
        question7_answer = $8, question8_answer = $9, personality_traits = $10,
        personality_summary = $11, compatibility_tips = $12, top_traits = $13,
        updated_at = NOW()
      RETURNING *`,
      [
        userId, answers[0], answers[1], answers[2],
        answers[3], answers[4], answers[5],
        answers[6], answers[7], uniqueTraits,
        aiPersonalityInsights.summary,
        aiPersonalityInsights.compatibility_tips,
        aiPersonalityInsights.top_traits,
      ]
    );

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
      `SELECT id, email, name, gender, interested_in, date_of_birth, city,
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
  try {
    const userId = req.userId!;
    const userResult = await pool.query(
      'SELECT is_premium, premium_expires_at, boost_expires_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const now = Date.now();
    const premiumExpiresAt = user.premium_expires_at ? new Date(user.premium_expires_at).getTime() : null;
    const hasPaidPlan = Boolean(user.is_premium) && (premiumExpiresAt === null || premiumExpiresAt > now);

    if (!hasPaidPlan) {
      return res.status(403).json({ error: 'Boost is available only for paid plans' });
    }

    const boostExpiresAt = user.boost_expires_at ? new Date(user.boost_expires_at).getTime() : null;
    if (boostExpiresAt && boostExpiresAt > now) {
      return res.json({
        message: 'Boost is already active',
        boost_active: true,
        boost_expires_at: new Date(boostExpiresAt).toISOString(),
      });
    }

    const updateResult = await pool.query(
      `UPDATE users
       SET boost_expires_at = NOW() + INTERVAL '24 hours',
           updated_at = NOW()
       WHERE id = $1
       RETURNING boost_expires_at`,
      [userId]
    );

    return res.json({
      message: 'Boost activated for 24 hours',
      boost_active: true,
      boost_expires_at: updateResult.rows[0].boost_expires_at,
    });
  } catch (error) {
    console.error('Activate boost error:', error);
    return res.status(500).json({ error: 'Failed to activate boost' });
  }
};

export const uploadPhoto = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { photo_url, is_primary, order_index } = req.body;

    if (!photo_url) {
      return res.status(400).json({ error: 'Photo URL is required' });
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
      [userId, photo_url, is_primary || false, order_index || 0]
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
    const { name, city, gender, date_of_birth } = req.body;

    if (!name && !city && !gender && !date_of_birth) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           city = COALESCE($2, city),
           gender = COALESCE($3, gender),
           date_of_birth = COALESCE($4, date_of_birth),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, city, gender, date_of_birth`,
      [name || null, city || null, gender || null, date_of_birth || null, userId]
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user basics error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
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
