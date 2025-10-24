import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { DAILY_LIMITS } from '../utils/constants';
import { SearchFilters } from '../types';
import { parseSearchQuery, generateMatchReason } from '../services/openai.service';

// Helper function to calculate age from date of birth
const calculateAge = (dateOfBirth: Date): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Helper function to calculate match percentage
const calculateMatchPercentage = (
  searchQuery: string,
  aiPreferences: {
    personality_traits?: string[];
    interests?: string[];
    physical_attributes?: string[];
    lifestyle?: string[];
    values?: string[];
  } | null,
  userInterests: string[],
  userPersonality: string[],
  targetInterests: string[],
  targetPersonality: string[]
): number => {
  let matchScore = 0;
  let totalFactors = 0;

  // Interests overlap (40% weight)
  if (userInterests && targetInterests) {
    const commonInterests = userInterests.filter(i => targetInterests.includes(i));
    const interestScore = userInterests.length > 0
      ? (commonInterests.length / userInterests.length) * 40
      : 20;
    matchScore += interestScore;
    totalFactors += 40;
  }

  // Personality traits overlap (40% weight)
  if (userPersonality && targetPersonality) {
    const commonTraits = userPersonality.filter(t => targetPersonality.includes(t));
    const traitScore = userPersonality.length > 0
      ? (commonTraits.length / userPersonality.length) * 40
      : 20;
    matchScore += traitScore;
    totalFactors += 40;
  }

  // Search query keyword matching (20% weight)
  if (searchQuery) {
    const queryWords = searchQuery.toLowerCase().split(' ');
    const allTargetText = [
      ...(targetInterests || []),
      ...(targetPersonality || []),
    ].join(' ').toLowerCase();

    const matchingWords = queryWords.filter(word =>
      word.length > 3 && allTargetText.includes(word)
    );

    const queryScore = queryWords.length > 0
      ? (matchingWords.length / queryWords.length) * 20
      : 10;
    matchScore += queryScore;
    totalFactors += 20;
  }

  // AI preference alignment bonus (up to 15 additional points)
  if (aiPreferences) {
    let aiScore = 0;
    let aiTotal = 0;

    if (aiPreferences.interests && aiPreferences.interests.length > 0 && targetInterests) {
      const overlap = aiPreferences.interests.filter((interest) =>
        (targetInterests || []).map(i => i?.toLowerCase()).includes(interest.toLowerCase())
      );
      aiScore += overlap.length > 0 ? 5 : 0;
      aiTotal += 5;
    }

    if (aiPreferences.personality_traits && aiPreferences.personality_traits.length > 0 && targetPersonality) {
      const overlap = aiPreferences.personality_traits.filter((trait) =>
        (targetPersonality || []).map(t => t?.toLowerCase()).includes(trait.toLowerCase())
      );
      aiScore += overlap.length > 0 ? 5 : 0;
      aiTotal += 5;
    }

    if (aiPreferences.values && aiPreferences.values.length > 0) {
      const overlap = aiPreferences.values.filter((value) =>
        [
          ...(targetInterests || []),
          ...(targetPersonality || []),
        ]
          .map(item => item?.toLowerCase())
          .includes(value.toLowerCase())
      );
      aiScore += overlap.length > 0 ? 3 : 0;
      aiTotal += 3;
    }

    if (aiPreferences.lifestyle && aiPreferences.lifestyle.length > 0) {
      aiScore += 2;
      aiTotal += 2;
    }

    if (aiTotal > 0) {
      matchScore += aiScore;
      totalFactors += aiTotal;
    }
  }

  return Math.min(Math.round((matchScore / totalFactors) * 100), 99);
};

export const searchMatches = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { search_query, filters = {} } = req.body as { search_query: string; filters: SearchFilters };
    const isAIEnabled = Boolean(process.env.OPENAI_API_KEY);

    // Use AI to parse natural language search query
    let aiParsedQuery: Awaited<ReturnType<typeof parseSearchQuery>> | null = null;
    const enhancedFilters: SearchFilters = { ...filters };

    if (isAIEnabled && search_query && search_query.trim().length > 0) {
      aiParsedQuery = await parseSearchQuery(search_query);

      // Merge AI-parsed filters with user-provided filters
      if (aiParsedQuery?.filters?.min_age && !enhancedFilters.minAge) {
        enhancedFilters.minAge = aiParsedQuery.filters.min_age;
      }
      if (aiParsedQuery?.filters?.max_age && !enhancedFilters.maxAge) {
        enhancedFilters.maxAge = aiParsedQuery.filters.max_age;
      }
      if (aiParsedQuery?.filters?.min_height && !enhancedFilters.minHeight) {
        enhancedFilters.minHeight = aiParsedQuery.filters.min_height;
      }
      if (aiParsedQuery?.filters?.city && !enhancedFilters.city) {
        enhancedFilters.city = aiParsedQuery.filters.city;
      }
      if (aiParsedQuery?.filters?.relationship_goal && !enhancedFilters.relationship_goal) {
        enhancedFilters.relationship_goal = aiParsedQuery.filters.relationship_goal;
      }
    }

    // Get current user data
    const currentUserResult = await pool.query(
      `SELECT u.*, p.interests as user_interests, pr.personality_traits as user_personality
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       LEFT JOIN personality_responses pr ON u.id = pr.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentUser = currentUserResult.rows[0];
    const userAge = calculateAge(currentUser.date_of_birth);

    // Determine on-grid and off-grid result counts based on gender
    const limits = currentUser.gender === 'male' ? DAILY_LIMITS.male : DAILY_LIMITS.female;
    const onGridCount = limits.on_grid_results;
    const offGridCount = limits.off_grid_results;

    // Build base query for candidates
    let queryParams: any[] = [userId, currentUser.interested_in];
    let paramIndex = 3;

    let baseQuery = `
      SELECT DISTINCT
        u.id, u.name, u.gender, u.date_of_birth, u.city, u.is_verified,
        p.height, p.interests, p.bio, p.prompt1, p.prompt2, p.prompt3,
        p.smoker, p.drinker, p.relationship_goal,
        pr.personality_traits,
        (SELECT photo_url FROM photos WHERE user_id = u.id AND is_primary = TRUE LIMIT 1) as primary_photo
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      LEFT JOIN personality_responses pr ON u.id = pr.user_id
      WHERE u.id != $1
        AND u.gender = $2
        AND NOT EXISTS (
          SELECT 1 FROM likes WHERE liker_id = $1 AND liked_id = u.id
        )
    `;

    // Apply age filters
    if (enhancedFilters.minAge || enhancedFilters.maxAge) {
      const minDate = enhancedFilters.maxAge
        ? new Date(new Date().setFullYear(new Date().getFullYear() - enhancedFilters.maxAge))
        : null;
      const maxDate = enhancedFilters.minAge
        ? new Date(new Date().setFullYear(new Date().getFullYear() - enhancedFilters.minAge))
        : null;

      if (minDate) {
        baseQuery += ` AND u.date_of_birth >= $${paramIndex}`;
        queryParams.push(minDate);
        paramIndex++;
      }
      if (maxDate) {
        baseQuery += ` AND u.date_of_birth <= $${paramIndex}`;
        queryParams.push(maxDate);
        paramIndex++;
      }
    }

    // Apply height filter
    if (enhancedFilters.minHeight) {
      baseQuery += ` AND p.height >= $${paramIndex}`;
      queryParams.push(enhancedFilters.minHeight);
      paramIndex++;
    }

    // Apply city filter
    if (enhancedFilters.city) {
      baseQuery += ` AND u.city = $${paramIndex}`;
      queryParams.push(enhancedFilters.city);
      paramIndex++;
    } else {
      // Default to same city as current user
      baseQuery += ` AND u.city = $${paramIndex}`;
      queryParams.push(currentUser.city);
      paramIndex++;
    }

    // Apply smoker filter
    if (enhancedFilters.smoker !== undefined) {
      baseQuery += ` AND p.smoker = $${paramIndex}`;
      queryParams.push(enhancedFilters.smoker);
      paramIndex++;
    }

    // Apply relationship goal filter
    if (enhancedFilters.relationship_goal) {
      baseQuery += ` AND p.relationship_goal = $${paramIndex}`;
      queryParams.push(enhancedFilters.relationship_goal);
      paramIndex++;
    }

    // Check cooldown status - exclude users in cooldown
    baseQuery += ` AND (u.cooldown_until IS NULL OR u.cooldown_until < NOW())`;

    // Execute query
    const candidatesResult = await pool.query(baseQuery, queryParams);
    const candidates = candidatesResult.rows;

    if (candidates.length === 0) {
      return res.json({
        on_grid_matches: [],
        off_grid_matches: [],
        message: 'No matches found. Try adjusting your search criteria.',
      });
    }

    // Calculate match percentages for all candidates
    const scoredCandidates = candidates.map((candidate: any) => {
      const matchPercentage = calculateMatchPercentage(
        search_query || '',
        aiParsedQuery?.preferences || null,
        currentUser.user_interests || [],
        currentUser.user_personality || [],
        candidate.interests || [],
        candidate.personality_traits || []
      );

      return {
        ...candidate,
        match_percentage: matchPercentage,
        age: calculateAge(candidate.date_of_birth),
      };
    });

    // Sort by match percentage
    scoredCandidates.sort((a: any, b: any) => b.match_percentage - a.match_percentage);

    // Split into on-grid (high match) and off-grid (broader discovery)
    const onGridMatches = scoredCandidates.slice(0, onGridCount);
    const offGridCandidates = scoredCandidates.slice(onGridCount);

    // Randomize off-grid a bit to encourage exploration
    const shuffledOffGrid = offGridCandidates.sort(() => Math.random() - 0.5);
    const offGridMatches = shuffledOffGrid.slice(0, offGridCount);

    // Generate AI match reasons for on-grid matches (top matches only)
    let onGridWithReasons = onGridMatches;
    if (isAIEnabled && onGridMatches.length > 0) {
      const currentProfileSummary = [
        currentUser.name,
        currentUser.city,
        ...(currentUser.user_interests || []),
        ...(currentUser.user_personality || []),
      ]
        .filter(Boolean)
        .join(', ');

      onGridWithReasons = await Promise.all(
        onGridMatches.map(async (match: any) => {
          try {
            const matchProfileText = [
              match.name,
              match.city,
              ...(match.interests || []),
              ...(match.personality_traits || []),
            ]
              .filter(Boolean)
              .join(', ');

            const matchReason = await generateMatchReason(
              currentProfileSummary,
              matchProfileText,
              match.match_percentage
            );

            return { ...match, match_reason: matchReason };
          } catch (error) {
            console.error('Error generating match reason:', error);
            return { ...match, match_reason: 'You share common interests' };
          }
        })
      );
    }

    // Save search history
    await pool.query(
      'INSERT INTO search_history (user_id, search_query, filters) VALUES ($1, $2, $3)',
      [userId, search_query || '', JSON.stringify(enhancedFilters)]
    );

    res.json({
      on_grid_matches: onGridWithReasons,
      off_grid_matches: offGridMatches,
      ai_context: aiParsedQuery
        ? {
            search_intent: aiParsedQuery.search_intent,
            preferences: aiParsedQuery.preferences,
            filters_inferred: aiParsedQuery.filters,
          }
        : null,
    });
  } catch (error) {
    console.error('Search matches error:', error);
    res.status(500).json({ error: 'Failed to search matches' });
  }
};

export const refreshOffGrid = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Get the user's last search
    const lastSearchResult = await pool.query(
      'SELECT search_query, filters FROM search_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (lastSearchResult.rows.length === 0) {
      return res.status(400).json({ error: 'No previous search found' });
    }

    const { search_query, filters } = lastSearchResult.rows[0];

    // Re-run the search (this will get new off-grid results)
    req.body = { search_query, filters: filters || {} };
    return searchMatches(req, res);
  } catch (error) {
    console.error('Refresh off-grid error:', error);
    res.status(500).json({ error: 'Failed to refresh off-grid matches' });
  }
};

export const getUserDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { targetUserId } = req.params;

    const result = await pool.query(
      `SELECT
        u.id, u.name, u.gender, u.date_of_birth, u.city, u.is_verified,
        p.height, p.body_type, p.interests, p.bio, p.prompt1, p.prompt2, p.prompt3,
        p.smoker, p.drinker, p.diet, p.fitness_level, p.education, p.occupation,
        p.relationship_goal, p.family_oriented, p.spiritual, p.open_minded, p.career_focused,
        pr.personality_traits,
        pr.personality_summary,
        pr.compatibility_tips,
        pr.top_traits
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      LEFT JOIN personality_responses pr ON u.id = pr.user_id
      WHERE u.id = $1`,
      [targetUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get photos
    const photosResult = await pool.query(
      'SELECT photo_url, is_primary, order_index FROM photos WHERE user_id = $1 ORDER BY order_index',
      [targetUserId]
    );

    const user = result.rows[0];

    res.json({
      user: {
        ...user,
        age: calculateAge(user.date_of_birth),
      },
      photos: photosResult.rows,
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
};
