import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { DAILY_LIMITS, TOKEN_COSTS } from '../utils/constants';
import { SearchFilters } from '../types';
import { parseSearchQuery, generateMatchReason, generateMatchNarrative, cosineSimilarity } from '../services/openai.service';
import { consumeCredits, getCreditBalance, ensureDailyAllowance } from '../services/credits.service';

// AI Match is the curated set. Anything the scorer puts under this is not a
// recommendation worth making; it stays available to search and off-grid.
const ON_GRID_MIN_MATCH = 60;

const haversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const parseEmbedding = (value: any): number[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((num) => Number(num)).filter((num) => Number.isFinite(num));
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((num) => Number(num)).filter((num) => Number.isFinite(num)) : [];
    } catch {
      return [];
    }
  }
  if (typeof value === 'object') {
    const maybeArray = Object.values(value);
    if (maybeArray.every((num) => typeof num === 'number')) {
      return maybeArray as number[];
    }
  }
  return [];
};

const buildPersonaSummary = (persona: any, profile: any): string => {
  const sections = [
    persona?.self_summary,
    persona?.connection_preferences,
    persona?.ideal_partner_prompt,
    persona?.growth_journey,
    persona?.dealbreakers ? `Dealbreakers: ${persona.dealbreakers}` : undefined,
    profile?.bio,
    profile?.prompt1,
    profile?.prompt2,
    profile?.prompt3,
    Array.isArray(profile?.interests) ? `Interests: ${(profile.interests as string[]).join(', ')}` : undefined,
  ];

  return sections
    .filter((value): value is string => Boolean(value && value.trim().length > 0))
    .join('\n');
};


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
  targetPersonality: string[],
  userPersonaEmbedding: number[],
  targetPersonaEmbedding: number[]
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

  if (userPersonaEmbedding.length > 0 && targetPersonaEmbedding.length > 0) {
    const embeddingScore = Math.max(0, cosineSimilarity(userPersonaEmbedding, targetPersonaEmbedding));
    matchScore += embeddingScore * 15;
    totalFactors += 15;
  }

  if (totalFactors === 0) return 1;
  return Math.min(Math.round((matchScore / totalFactors) * 100), 99);
};

export const searchMatches = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { search_query, filters = {}, exclude_ids = [], is_on_grid, limit } = req.body as {
      search_query: string;
      filters: SearchFilters;
      exclude_ids?: number[];
      is_on_grid?: boolean;
      limit?: number;
      charge_credits?: boolean;
    };
    const chargeCredits = Boolean((req.body as any)?.charge_credits);

    // Top up the free allowance before anything reads or spends the balance.
    await ensureDailyAllowance(userId);
    const isAIEnabled = Boolean(process.env.OPENAI_API_KEY);
    let remainingCredits: number | null = null;

    // Use AI to parse natural language search query
    let aiParsedQuery: Awaited<ReturnType<typeof parseSearchQuery>> | null = null;
    const enhancedFilters: SearchFilters = { ...filters };

    // Filters the AI inferred from prose rather than ones the user set explicitly.
    // A phrase like "late 20s" should narrow the results, but it must never be the
    // reason someone sees an empty grid, so these are dropped and retried on zero.
    const aiInferredFilterKeys: Array<keyof SearchFilters> = [];

    if (isAIEnabled && search_query && search_query.trim().length > 0) {
      aiParsedQuery = await parseSearchQuery(search_query);

      const applyInferred = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
        if (value === undefined || value === null) return;
        if (enhancedFilters[key] !== undefined && enhancedFilters[key] !== null) return;
        enhancedFilters[key] = value;
        aiInferredFilterKeys.push(key);
      };

      applyInferred('minAge', aiParsedQuery?.filters?.min_age as any);
      applyInferred('maxAge', aiParsedQuery?.filters?.max_age as any);
      applyInferred('minHeight', aiParsedQuery?.filters?.min_height as any);
      applyInferred('city', aiParsedQuery?.filters?.city as any);
      applyInferred('relationship_goal', aiParsedQuery?.filters?.relationship_goal as any);
    }

    // Get current user data
    const currentUserResult = await pool.query(
      `SELECT u.*, p.interests as user_interests, pr.personality_traits as user_personality,
              uap.self_summary, uap.ideal_partner_prompt, uap.connection_preferences,
              uap.dealbreakers, uap.growth_journey, uap.persona_embedding
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       LEFT JOIN personality_responses pr ON u.id = pr.user_id
       LEFT JOIN user_ai_profiles uap ON u.id = uap.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const normalizedSearchQuery = (search_query || '').trim();
    const shouldChargeForAISearch = chargeCredits && normalizedSearchQuery.length > 0 && is_on_grid !== false;

    const currentUser = currentUserResult.rows[0];
    const premiumExpiresAt = currentUser.premium_expires_at ? new Date(currentUser.premium_expires_at).getTime() : null;
    const hasPaidPlan = Boolean(currentUser.is_premium) && (premiumExpiresAt === null || premiumExpiresAt > Date.now());
    const hasFilterValue = (value: unknown) => {
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null;
    };
    // Free per the board: gender, age, distance, relationship intention,
    // religion, children, smoking, drinking, marijuana, drugs. Everything else
    // needs a plan. Dating intentions moved to free at the board's request.
    const paidFilterKeys: Array<keyof SearchFilters> = [
      'ethnicity',
      'minHeight',
      'maxHeight',
      'politics',
      'education_level',
      'personality_traits',
      'communication_style',
      'relationship_needs',
      'conflict_style',
      'lifestyle',
    ];
    const activePaidFilters = paidFilterKeys.filter((key) => hasFilterValue((filters as any)[key]));
    if (!hasPaidPlan && activePaidFilters.length > 0) {
      return res.status(402).json({
        error: 'Paid plan required for advanced filters.',
        paid_filters: activePaidFilters,
      });
    }

    const userAge = calculateAge(currentUser.date_of_birth);
    const currentUserPersonaEmbedding = parseEmbedding((currentUser as any).persona_embedding);
    const currentUserLat = Number((currentUser as any).latitude);
    const currentUserLng = Number((currentUser as any).longitude);
    const hasUserLocation = Number.isFinite(currentUserLat) && Number.isFinite(currentUserLng);
    const maxDistanceKm = typeof enhancedFilters.distance_km === 'number'
      ? enhancedFilters.distance_km
      : (Number.isFinite((currentUser as any).distance_radius) ? Number((currentUser as any).distance_radius) : null);

    const seekerPersonaSummary = buildPersonaSummary(
      {
        self_summary: (currentUser as any).self_summary,
        connection_preferences: (currentUser as any).connection_preferences,
        ideal_partner_prompt: (currentUser as any).ideal_partner_prompt,
        dealbreakers: (currentUser as any).dealbreakers,
        growth_journey: (currentUser as any).growth_journey,
      },
      {
        bio: (currentUser as any).bio,
        prompt1: (currentUser as any).prompt1,
        prompt2: (currentUser as any).prompt2,
        prompt3: (currentUser as any).prompt3,
        interests: currentUser.user_interests || [],
      }
    );

    // Determine on-grid and off-grid result counts based on gender
    const limits = currentUser.gender === 'male' ? DAILY_LIMITS.male : DAILY_LIMITS.female;
    const onGridCount = limits.on_grid_results;
    const offGridCount = limits.off_grid_results;

    // Built as a function so the same query can be re-run with the AI-inferred
    // filters removed when they eliminate every candidate.
    const buildCandidateQuery = (f: SearchFilters): { sql: string; params: any[] } => {
      // Build base query for candidates
      let queryParams: any[] = [userId];
      let paramIndex = 2;

      let baseQuery = `
        SELECT
          u.id, u.name, u.gender, u.orientation, u.pronouns, u.date_of_birth, u.city, u.is_verified, u.latitude, u.longitude, u.boost_expires_at,
          p.height, p.body_type, p.interests, p.bio, p.prompt1, p.prompt2, p.prompt3,
          p.smoker, p.smoking_habit, p.drinker, p.drugs, p.diet, p.fitness_level, p.relationship_goal,
          pr.personality_traits, pr.personality_summary, pr.compatibility_tips, pr.top_traits,
          privacy.hide_distance, privacy.hide_city, privacy.incognito_mode, privacy.show_online_status,
          uap.self_summary, uap.ideal_partner_prompt, uap.connection_preferences,
          uap.dealbreakers, uap.growth_journey, uap.persona_embedding,
          primary_photo.photo_url as primary_photo
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        LEFT JOIN personality_responses pr ON u.id = pr.user_id
        LEFT JOIN user_ai_profiles uap ON u.id = uap.user_id
        LEFT JOIN user_privacy_settings privacy ON privacy.user_id = u.id
        LEFT JOIN photos primary_photo ON primary_photo.user_id = u.id AND primary_photo.is_primary = TRUE
        LEFT JOIN likes existing_like ON existing_like.liker_id = $1 AND existing_like.liked_id = u.id
        WHERE u.id != $1
          AND existing_like.id IS NULL
          -- A live block in EITHER direction hides the profile everywhere.
          -- Written as NOT IN over subqueries that only reference $1 (never the
          -- outer row): a LEFT JOIN with a block each way let a lifted block's
          -- row pass while the other was still active, and duplicated the
          -- candidate; a correlated NOT EXISTS is not supported by the in-memory
          -- test database. Both id columns are NOT NULL, so NOT IN is safe.
          AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $1 AND unblocked_at IS NULL)
          AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = $1 AND unblocked_at IS NULL)
          -- AI Match additionally never brings back someone who was blocked and
          -- later unblocked: lifting a block should not turn into a
          -- recommendation. Search and off-grid still can, deliberately.
          ${is_on_grid === false ? '' : `AND u.id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $1)
          AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = $1)`}
          -- Accounts exist before profiles do (Google sign-in and the staged
          -- signup funnel both create the user first), and an un-onboarded one
          -- still carries placeholder name/city/date-of-birth. Never show those.
          AND u.onboarding_completed_at IS NOT NULL
      `;

      const requestedInterestedIn =
        typeof f.interested_in === 'string' &&
        ['male', 'female', 'both'].includes(f.interested_in)
          ? f.interested_in
          : undefined;
      const effectiveInterestedIn = requestedInterestedIn || currentUser.interested_in;

      // Seeker preference (can be overridden by filter): interested_in='both' should not collapse results.
      if (effectiveInterestedIn !== 'both') {
        baseQuery += ` AND u.gender = $${paramIndex}`;
        queryParams.push(effectiveInterestedIn);
        paramIndex++;
      }

      // Reciprocal preference: candidate should also be open to the seeker's gender.
      baseQuery += ` AND (u.interested_in = 'both' OR u.interested_in = $${paramIndex})`;
      queryParams.push(currentUser.gender);
      paramIndex++;

      // Respect candidate privacy and blocking.
      baseQuery += ` AND COALESCE(privacy.incognito_mode, FALSE) = FALSE`;

      // Apply age filters
      if (f.minAge || f.maxAge) {
        const minDate = f.maxAge
          ? new Date(new Date().setFullYear(new Date().getFullYear() - f.maxAge))
          : null;
        const maxDate = f.minAge
          ? new Date(new Date().setFullYear(new Date().getFullYear() - f.minAge))
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

      // Apply minimum height filter
      if (f.minHeight) {
        baseQuery += ` AND p.height >= $${paramIndex}`;
        queryParams.push(f.minHeight);
        paramIndex++;
      }

      // Apply maximum height filter
      if (f.maxHeight) {
        baseQuery += ` AND p.height <= $${paramIndex}`;
        queryParams.push(f.maxHeight);
        paramIndex++;
      }

      // Apply city filter only if explicitly specified
      if (f.city) {
        baseQuery += ` AND u.city = $${paramIndex}`;
        queryParams.push(f.city);
        paramIndex++;
      }
      // Note: City filtering is now optional - profiles from all cities will show if no city filter is specified

      // Apply smoking habit filter

      // Free filters accept one value or several. A list means any-of.
      const anyOf = (column: string, value: unknown) => {
        const list = (Array.isArray(value) ? value : [value])
          .map((v) => String(v ?? '').trim().toLowerCase())
          .filter(Boolean);
        if (list.length === 0) return;
        baseQuery += ` AND LOWER(${column}) = ANY($${paramIndex}::text[])`;
        queryParams.push(list);
        paramIndex++;
      };

      if (f.smoking_habit && (Array.isArray(f.smoking_habit) || String(f.smoking_habit).trim().length > 0)) {
        anyOf('p.smoking_habit', f.smoking_habit);
      } else if (f.smoker !== undefined) {
        // Backwards-compatible boolean smoker filter.
        baseQuery += ` AND p.smoker = $${paramIndex}`;
        queryParams.push(f.smoker);
        paramIndex++;
      }

      // Apply drinker filter
      if (f.drinker) {
        anyOf('p.drinker', f.drinker);
      }

      const relationshipGoalFilter = f.relationship_goal || f.dating_intentions;

      // Apply relationship goal filter
      if (relationshipGoalFilter) {
        baseQuery += ` AND p.relationship_goal = $${paramIndex}`;
        queryParams.push(relationshipGoalFilter);
        paramIndex++;
      }

      // Apply religion filter
      if (f.religion) {
        anyOf('p.religion', f.religion);
      }

      // Apply children filter
      if (f.have_kids) {
        anyOf('p.have_kids', f.have_kids);
      }

      // Apply politics filter
      if (f.politics) {
        baseQuery += ` AND LOWER(p.politics) = LOWER($${paramIndex})`;
        queryParams.push(f.politics);
        paramIndex++;
      }

      // Apply education filter
      if (f.education_level) {
        baseQuery += ` AND LOWER(COALESCE(p.education_level, p.education, '')) = LOWER($${paramIndex})`;
        queryParams.push(f.education_level);
        paramIndex++;
      }

      // Apply ethnicity filter
      if (f.ethnicity) {
        baseQuery += ` AND LOWER(p.ethnicity) = LOWER($${paramIndex})`;
        queryParams.push(f.ethnicity);
        paramIndex++;
      }

      // Apply drugs filter
      if (f.drugs) {
        anyOf('p.drugs', f.drugs);
      }

      // Apply marijuana filter
      if (f.marijuana) {
        anyOf('p.marijuana', f.marijuana);
      }

      // Check cooldown status - exclude users in cooldown
      baseQuery += ` AND (u.cooldown_until IS NULL OR u.cooldown_until < NOW())`;

      // Exclude already viewed/swiped profiles (for off-grid refresh)
      if (exclude_ids && exclude_ids.length > 0) {
        baseQuery += ` AND u.id NOT IN (${exclude_ids.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
        queryParams.push(...exclude_ids);
        paramIndex += exclude_ids.length;
      }

      return { sql: baseQuery, params: queryParams };
    };

    // First pass honours everything, including whatever the AI inferred.
    const primaryQuery = buildCandidateQuery(enhancedFilters);
    let candidates = (await pool.query(primaryQuery.sql, primaryQuery.params)).rows;

    // If the AI's own guesses are what emptied the grid, drop them and try again
    // rather than telling the user there is nobody out there.
    let relaxedFilters: string[] = [];
    if (candidates.length === 0 && aiInferredFilterKeys.length > 0) {
      const userOnlyFilters: SearchFilters = { ...filters };
      const retryQuery = buildCandidateQuery(userOnlyFilters);
      const retryRows = (await pool.query(retryQuery.sql, retryQuery.params)).rows;

      if (retryRows.length > 0) {
        candidates = retryRows;
        relaxedFilters = aiInferredFilterKeys.map(String);
        for (const key of aiInferredFilterKeys) {
          delete (enhancedFilters as any)[key];
        }
      }
    }

    if (candidates.length === 0) {
      // Mirror the shape the caller asked for. Returning on_grid_matches to a
      // client that reads `matches` handed it undefined instead of an empty list.
      const emptyBody = {
        credit_balance: await getCreditBalance(userId),
        relaxed_filters: relaxedFilters,
        message: 'No matches found. Try adjusting your search criteria.',
      };

      if (is_on_grid === true || is_on_grid === false) {
        return res.json({ ...emptyBody, matches: [] });
      }
      return res.json({ ...emptyBody, on_grid_matches: [], off_grid_matches: [] });
    }

    // Trait facets from the quiz, applied here rather than in SQL. The whole
    // candidate set is already in memory for scoring, labels are unique across
    // facets so the flat array is enough, and this keeps the query portable.
    // Any-of within a facet; all chosen facets must be satisfied.
    const facetKeys = ['personality_traits', 'communication_style', 'relationship_needs', 'conflict_style', 'lifestyle'] as const;
    const wantedByFacet = facetKeys
      .map((key) => {
        const raw = (enhancedFilters as any)[key];
        const list = (Array.isArray(raw) ? raw : raw ? [raw] : [])
          .map((v: unknown) => String(v).trim().toLowerCase())
          .filter(Boolean);
        return list;
      })
      .filter((list) => list.length > 0);
    const facetFiltered = wantedByFacet.length === 0
      ? candidates
      : candidates.filter((candidate: any) => {
          const have = new Set(
            (Array.isArray(candidate.personality_traits) ? candidate.personality_traits : [])
              .map((t: unknown) => String(t).trim().toLowerCase())
          );
          return wantedByFacet.every((wanted) => wanted.some((label) => have.has(label)));
        });

    // Calculate match percentages for all candidates
    const scoredCandidates = facetFiltered
      .map((candidate: any) => {
        let distance_km: number | null = null;
        if (hasUserLocation) {
          const rawLat = candidate.latitude;
          const rawLng = candidate.longitude;
          if (rawLat != null && rawLng != null) {
            const candLat = Number(rawLat);
            const candLng = Number(rawLng);
            if (Number.isFinite(candLat) && Number.isFinite(candLng)) {
              distance_km = haversineDistanceKm(currentUserLat, currentUserLng, candLat, candLng);
            }
          }
        }

        if (maxDistanceKm && Number.isFinite(distance_km) && (distance_km as number) > maxDistanceKm) {
          return null;
        }

        const candidateEmbedding = parseEmbedding(candidate.persona_embedding);
        const boostExpiresAt = candidate.boost_expires_at ? new Date(candidate.boost_expires_at).getTime() : null;
        const boostActive = Boolean(boostExpiresAt && boostExpiresAt > Date.now());
        const matchPercentage = calculateMatchPercentage(
          search_query || '',
          aiParsedQuery?.preferences || null,
          currentUser.user_interests || [],
          currentUser.user_personality || [],
          candidate.interests || [],
          candidate.personality_traits || [],
          currentUserPersonaEmbedding,
          candidateEmbedding
        );

        return {
          ...candidate,
          city: candidate.hide_city ? null : candidate.city,
          match_percentage: matchPercentage,
          age: calculateAge(candidate.date_of_birth),
          persona_embedding: candidateEmbedding,
          boost_active: boostActive,
          boost_expires_at: candidate.boost_expires_at || null,
          distance_km: candidate.hide_distance ? undefined : (distance_km ?? undefined),
          is_active: candidate.show_online_status ? true : false,
          is_on_grid: is_on_grid !== false,
        };
      })
      .filter((candidate: any): candidate is any => Boolean(candidate));

    // Boosted users are ranked ahead while boost is active, then by match percentage.
    scoredCandidates.sort((a: any, b: any) => {
      const boostDiff = Number(b.boost_active) - Number(a.boost_active);
      if (boostDiff !== 0) return boostDiff;
      return b.match_percentage - a.match_percentage;
    });

    const shuffleCandidates = (items: any[]) => [...items].sort(() => Math.random() - 0.5);
    const prioritizeBoostedCandidates = (items: any[]) => {
      const boosted = items.filter((candidate: any) => candidate.boost_active);
      const nonBoosted = items.filter((candidate: any) => !candidate.boost_active);
      return [...shuffleCandidates(boosted), ...shuffleCandidates(nonBoosted)];
    };

    // If specific type requested (for refresh), return only that type
    let onGridMatches: any[];
    let offGridMatches: any[];

    // The compatibility floor is for the unprompted AI Match feed. When someone
    // types a search ("funny"), they asked for people who fit the words, ranked
    // by fit; hiding every result under 60% made the same search succeed on one
    // account and fail on another for reasons the user could not see.
    const clearsFloor = (c: any) =>
      normalizedSearchQuery.length > 0 || c.match_percentage >= ON_GRID_MIN_MATCH;

    if (is_on_grid === true) {
      // Only return on-grid matches
      const requestedLimit = limit || onGridCount;
      onGridMatches = scoredCandidates
        .filter(clearsFloor)
        .slice(0, requestedLimit);
      offGridMatches = [];
    } else if (is_on_grid === false) {
      // Off-grid remains exploratory, but boosted profiles stay prioritized.
      const prioritizedOffGrid = prioritizeBoostedCandidates(scoredCandidates);
      const requestedLimit = limit || offGridCount;
      offGridMatches = prioritizedOffGrid.slice(0, requestedLimit);
      onGridMatches = [];
    } else {
      // Return both types (default behavior)
      onGridMatches = scoredCandidates
        .filter(clearsFloor)
        .slice(0, onGridCount);
      const offGridCandidates = scoredCandidates.slice(onGridCount);
      const prioritizedOffGrid = prioritizeBoostedCandidates(offGridCandidates);
      offGridMatches = prioritizedOffGrid.slice(0, offGridCount);
    }

    // Generate AI match reasons for on-grid matches (top matches only)
    let onGridWithReasons = onGridMatches.map((match: any) => ({
      ...match,
      match_reason: 'You might enjoy a thoughtful conversation together.',
      match_highlights: [],
      suggested_openers: [],
    }));

    // Tracks whether any real AI work happened on this request. The user is only
    // billed for an AI search when the model actually answered; a request served
    // entirely from hardcoded fallbacks is free.
    let aiDidRealWork = aiParsedQuery ? aiParsedQuery.degraded === false : false;

    if (isAIEnabled && onGridMatches.length > 0) {
      onGridWithReasons = await Promise.all(
        onGridMatches.map(async (match: any) => {
          const candidateSummary = buildPersonaSummary(match, match);
          try {
            const narrative = await generateMatchNarrative(
              seekerPersonaSummary,
              candidateSummary,
              match.match_percentage,
              match.name
            );

            if (narrative.degraded === false) aiDidRealWork = true;

            return {
              ...match,
              match_reason: narrative.summary,
              match_highlights: narrative.highlights || [],
              suggested_openers: narrative.suggested_openers || [],
            };
          } catch (error) {
            console.error('Error generating match narrative:', error);
            try {
              const fallbackReason = await generateMatchReason(
                seekerPersonaSummary,
                candidateSummary,
                match.match_percentage,
                match.name
              );
              return {
                ...match,
                match_reason: fallbackReason,
                match_highlights: [],
                suggested_openers: [],
              };
            } catch (fallbackError) {
              console.error('Fallback match reason failed:', fallbackError);
              return {
                ...match,
                match_reason: 'You have overlapping interests and compatible energy.',
                match_highlights: [],
                suggested_openers: [],
              };
            }
          }
        })
      );
    }

    // Charge only when we are returning visible on-grid profiles AND the AI
    // actually ran. If every model call fell back to canned copy, the search was
    // keyword matching, so billing a token for it would be charging for nothing.
    if (shouldChargeForAISearch && onGridWithReasons.length > 0 && aiDidRealWork) {
      try {
        remainingCredits = await consumeCredits(
          userId,
          TOKEN_COSTS.AI_SEARCH,
          'ai_search',
          { search_query: normalizedSearchQuery, on_grid_results: onGridWithReasons.length }
        );
      } catch (error: any) {
        if (error.message === 'INSUFFICIENT_CREDITS') {
          return res.status(402).json({ error: 'Not enough tokens. AI Search costs 1 token.' });
        }
        throw error;
      }
    } else {
      remainingCredits = await getCreditBalance(userId);
    }

    // Save search history
    await pool.query(
      'INSERT INTO search_history (user_id, search_query, filters) VALUES ($1, $2, $3)',
      [userId, search_query || '', JSON.stringify(enhancedFilters)]
    );

    // Record the off-grid set that is about to be shown, so Rewind can bring it
    // back after the app has been closed. Only the last few are worth keeping.
    if (is_on_grid === false && offGridMatches.length > 0) {
      const shownIds = offGridMatches.map((candidate: any) => candidate.id);
      await pool.query(
        'INSERT INTO off_grid_history (user_id, candidate_ids) VALUES ($1, $2)',
        [userId, JSON.stringify(shownIds)]
      );
      await pool.query(
        `DELETE FROM off_grid_history
          WHERE user_id = $1
            AND id NOT IN (
              SELECT id FROM off_grid_history
               WHERE user_id = $1
               ORDER BY id DESC
               LIMIT 10
            )`,
        [userId]
      );
    }

    // Return response based on request type
    if (is_on_grid === true) {
      // Return only on-grid matches
      res.json({
        matches: onGridWithReasons,
        credit_balance: remainingCredits,
        relaxed_filters: relaxedFilters,
        ai_context: aiParsedQuery
          ? {
              search_intent: aiParsedQuery.search_intent,
              preferences: aiParsedQuery.preferences,
              filters_inferred: aiParsedQuery.filters,
              degraded: aiParsedQuery.degraded === true,
            }
          : null,
      });
    } else if (is_on_grid === false) {
      // Return only off-grid matches
      res.json({
        matches: offGridMatches,
        credit_balance: remainingCredits,
        relaxed_filters: relaxedFilters,
        ai_context: aiParsedQuery
          ? {
              search_intent: aiParsedQuery.search_intent,
              preferences: aiParsedQuery.preferences,
              filters_inferred: aiParsedQuery.filters,
              degraded: aiParsedQuery.degraded === true,
            }
          : null,
      });
    } else {
      // Return both types (default)
      res.json({
        on_grid_matches: onGridWithReasons,
        off_grid_matches: offGridMatches,
        credit_balance: remainingCredits,
        relaxed_filters: relaxedFilters,
        ai_context: aiParsedQuery
          ? {
              search_intent: aiParsedQuery.search_intent,
              preferences: aiParsedQuery.preferences,
              filters_inferred: aiParsedQuery.filters,
              degraded: aiParsedQuery.degraded === true,
            }
          : null,
      });
    }
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

/**
 * Brings back the off-grid set shown before the current one.
 *
 * Premium only, per the spec: refreshing off-grid is free and unlimited, and
 * paying is what buys back the people you scrolled past. The history lives in
 * the database rather than in the app, so this still works after the app has
 * been closed, which is what it was sold as.
 */
export const rewindOffGrid = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const userResult = await pool.query(
      'SELECT is_premium, premium_expires_at FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const expiresAt = user.premium_expires_at ? new Date(user.premium_expires_at).getTime() : null;
    const isPremium = Boolean(user.is_premium) && (expiresAt === null || expiresAt > Date.now());
    if (!isPremium) {
      return res.status(403).json({
        error: 'Rewind is available on paid plans only',
        upgrade_required: true,
      });
    }

    // The newest row is what is on screen now, so the one before it is the
    // "previous" set the user wants back.
    const history = await pool.query(
      // Ordered by id, not created_at: two sets recorded in the same instant
      // would otherwise come back in an arbitrary order, and "previous" would be
      // a coin flip.
      'SELECT id, candidate_ids FROM off_grid_history WHERE user_id = $1 ORDER BY id DESC LIMIT 2',
      [userId]
    );

    if (history.rows.length < 2) {
      return res.status(404).json({ error: 'No previous off-grid set to go back to' });
    }

    const current = history.rows[0];
    const previous = history.rows[1];

    const rawIds = Array.isArray(previous.candidate_ids)
      ? previous.candidate_ids
      : JSON.parse(previous.candidate_ids || '[]');
    const ids = rawIds
      .map((value: unknown) => Number(value))
      .filter((value: number) => Number.isInteger(value) && value > 0);

    if (ids.length === 0) {
      return res.status(404).json({ error: 'No previous off-grid set to go back to' });
    }

    // An IN list of placeholders rather than = ANY($n::int[]): the array form
    // depends on a cast that not every driver/engine path handles identically.
    const idPlaceholders = ids.map((_: number, index: number) => `$${index + 2}`).join(', ');

    const profiles = await pool.query(
      `SELECT
         u.id, u.name, u.gender, u.pronouns, u.date_of_birth, u.city, u.is_verified,
         p.height, p.body_type, p.interests, p.bio, p.prompt1, p.prompt2, p.prompt3,
         p.smoker, p.smoking_habit, p.drinker, p.drugs, p.diet, p.fitness_level,
         p.relationship_goal,
         pr.personality_traits, pr.top_traits,
         primary_photo.photo_url AS primary_photo
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN personality_responses pr ON pr.user_id = u.id
       LEFT JOIN photos primary_photo
         ON primary_photo.user_id = u.id AND primary_photo.is_primary = TRUE
       LEFT JOIN blocks blocked_rel
         ON ((blocked_rel.blocker_id = $1 AND blocked_rel.blocked_id = u.id)
          OR (blocked_rel.blocker_id = u.id AND blocked_rel.blocked_id = $1))
         AND blocked_rel.unblocked_at IS NULL
       WHERE u.id IN (${idPlaceholders})
         AND u.is_banned = FALSE
         AND u.onboarding_completed_at IS NOT NULL
         AND blocked_rel.id IS NULL`,
      [userId, ...ids]
    );

    // Stepping back consumes the current set, so pressing rewind repeatedly
    // walks further back rather than toggling between two sets.
    await pool.query('DELETE FROM off_grid_history WHERE id = $1', [current.id]);

    const matches = profiles.rows.map((row: any) => ({
      ...row,
      age: calculateAge(row.date_of_birth),
      is_on_grid: false,
    }));

    return res.json({ matches, rewound: true });
  } catch (error) {
    console.error('Rewind off-grid error:', error);
    return res.status(500).json({ error: 'Failed to rewind' });
  }
};

export const getUserDetails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { targetUserId } = req.params;

    const blockResult = await pool.query(
      `SELECT 1 FROM blocks
       WHERE ((blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1))
         AND unblocked_at IS NULL
       LIMIT 1`,
      [userId, targetUserId]
    );
    if (blockResult.rows.length > 0) {
      return res.status(403).json({ error: 'User unavailable' });
    }

    const result = await pool.query(
      `SELECT
        u.id, u.name, u.gender, u.orientation, u.pronouns, u.date_of_birth, u.city, u.is_verified,
        p.height, p.body_type, p.interests, p.bio, p.prompt1, p.prompt2, p.prompt3,
        p.smoker, p.smoking_habit, p.drinker, p.drugs, p.diet, p.fitness_level, p.education, p.occupation,
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

export const unmatch = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = req.userId!;
    const { matchId } = req.params;

    await client.query('BEGIN');

    const matchResult = await client.query(
      'SELECT id, user1_id, user2_id FROM matches WHERE id = $1 FOR UPDATE',
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];
    if (match.user1_id !== userId && match.user2_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You are not part of this match' });
    }

    const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;

    await client.query('DELETE FROM matches WHERE id = $1', [matchId]);
    await client.query(
      'DELETE FROM likes WHERE (liker_id = $1 AND liked_id = $2) OR (liker_id = $2 AND liked_id = $1)',
      [userId, otherUserId]
    );

    await client.query('COMMIT');
    return res.json({ message: 'Unmatched successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Unmatch error:', error);
    return res.status(500).json({ error: 'Failed to unmatch' });
  } finally {
    client.release();
  }
};
