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
      occupation,
      relationship_goal,
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

    // Create or update user profile
    const profileResult = await client.query(
      `INSERT INTO user_profiles (
        user_id, height, body_type, interests, bio, prompt1, prompt2, prompt3,
        smoker, drinker, diet, fitness_level, education, occupation,
        relationship_goal, family_oriented, spiritual, open_minded, career_focused,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        height = $2, body_type = $3, interests = $4, bio = $5,
        prompt1 = $6, prompt2 = $7, prompt3 = $8, smoker = $9,
        drinker = $10, diet = $11, fitness_level = $12, education = $13,
        occupation = $14, relationship_goal = $15, family_oriented = $16,
        spiritual = $17, open_minded = $18, career_focused = $19,
        updated_at = NOW()
      RETURNING *`,
      [
        userId, height, body_type, interests, bio, prompt1, prompt2, prompt3,
        smoker, drinker, diet, fitness_level, education, occupation,
        relationship_goal, family_oriented, spiritual, open_minded, career_focused,
      ]
    );

    // Calculate personality traits from quiz answers
    const answers = [
      question1_answer,
      question2_answer,
      question3_answer,
      question4_answer,
      question5_answer,
      question6_answer,
      question7_answer,
      question8_answer,
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
    let aiPersonalityInsights = {
      summary: 'You have a unique personality!',
      top_traits: uniqueTraits.slice(0, 3),
      compatibility_tips: 'You would match well with someone who shares your values.',
    };

    if (process.env.OPENAI_API_KEY && filteredAnswers.length > 0) {
      try {
        const insights = await analyzePersonality(filteredAnswers);
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
        userId, question1_answer, question2_answer, question3_answer,
        question4_answer, question5_answer, question6_answer,
        question7_answer, question8_answer, uniqueTraits,
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
      'SELECT id, email, name, gender, interested_in, date_of_birth, city, is_verified, is_premium, cooldown_enabled FROM users WHERE id = $1',
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
    const { name, city } = req.body;

    if (!name && !city) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           city = COALESCE($2, city),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, city`,
      [name || null, city || null, userId]
    );

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user basics error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};
