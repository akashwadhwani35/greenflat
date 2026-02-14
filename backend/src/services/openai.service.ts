import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const VISION_MODEL = process.env.OPENAI_VISION_MODEL || OPENAI_MODEL;

interface ParsedSearchQuery {
  preferences: {
    personality_traits?: string[];
    interests?: string[];
    physical_attributes?: string[];
    lifestyle?: string[];
    values?: string[];
  };
  filters: {
    min_age?: number;
    max_age?: number;
    min_height?: number;
    max_height?: number;
    city?: string;
    relationship_goal?: string;
  };
  search_intent: string;
}

/**
 * Parse natural language search query into structured filters and preferences
 */
export const parseSearchQuery = async (query: string): Promise<ParsedSearchQuery> => {
  const prompt = `You are an AI dating app assistant. Parse the following natural language search query into structured preferences and filters.

Search Query: "${query}"

Extract the following information:
1. Personality traits (e.g., funny, caring, adventurous, serious, confident)
2. Interests/hobbies (e.g., hiking, reading, movies, travel, fitness)
3. Physical attributes (e.g., tall, athletic, specific height)
4. Lifestyle preferences (e.g., non-smoker, social drinker, fitness enthusiast)
5. Values (e.g., family-oriented, career-focused, spiritual)
6. Hard filters (age range, height range, city, relationship goals)

Return a JSON object with this exact structure:
{
  "preferences": {
    "personality_traits": ["trait1", "trait2"],
    "interests": ["interest1", "interest2"],
    "physical_attributes": ["attr1"],
    "lifestyle": ["lifestyle1"],
    "values": ["value1"]
  },
  "filters": {
    "min_age": number or null,
    "max_age": number or null,
    "min_height": number in cm or null,
    "max_height": number in cm or null,
    "city": "city name" or null,
    "relationship_goal": "serious/casual/long-term/friendship" or null
  },
  "search_intent": "A brief summary of what the user is looking for"
}

Examples:
- "tall, loves hiking, 25-30, Delhi" → min_age: 25, max_age: 30, city: "Delhi", interests: ["hiking"], physical_attributes: ["tall"]
- "funny girl who likes travel and books" → personality_traits: ["funny"], interests: ["travel", "books"]
- "height above 5.8ft" → min_height: 173

Only return the JSON object, no other text.`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return parsed as ParsedSearchQuery;
  } catch (error) {
    console.error('Error parsing search query:', error);
    // Return empty structure on error
    return {
      preferences: {},
      filters: {},
      search_intent: query,
    };
  }
};

/**
 * Generate embedding for a user's profile
 */
export const generateProfileEmbedding = async (profileText: string): Promise<number[]> => {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: profileText,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return [];
  }
};

/**
 * Calculate cosine similarity between two embeddings
 */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Generate match reasoning - why these two users are a good match
 */

/**
 * Generate a rich explanation for why two users align
 */
export const generateMatchNarrative = async (
  seekerProfile: string,
  candidateProfile: string,
  matchPercentage: number
): Promise<{
  summary: string;
  highlights: string[];
  suggested_openers: string[];
}> => {
  const prompt = `You are Greenflag, an emotionally intelligent dating coach. Explain why two people (User A and User B) could be a meaningful match.

User A Persona:
${seekerProfile}

User B Persona:
${candidateProfile}

They have a compatibility score of ${matchPercentage}%.

Return JSON with keys summary (2 sentences max), highlights (array of 2-3 bullet points describing alignment), and suggested_openers (array of 2 gentle conversation starters tied to their common ground). Keep language warm, human, and specific.`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary || 'You share relatable energy.',
      highlights: parsed.highlights || [],
      suggested_openers: parsed.suggested_openers || [],
    };
  } catch (error) {
    console.error('Error generating match narrative:', error);
    return {
      summary: 'You share similar intentions and would likely enjoy a thoughtful first chat.',
      highlights: [
        'Shared interests suggest easy conversation',
        'Values appear aligned from your profiles',
      ],
      suggested_openers: [
        'Ask about a recent moment that made them feel alive',
        'Share a story that reflects your common interest',
      ],
    };
  }
};
export const generateMatchReason = async (
  userProfile: string,
  matchProfile: string,
  matchPercentage: number
): Promise<string> => {
  const prompt = `You are a dating app matchmaker. Explain why these two people are a ${matchPercentage}% match in one short, friendly sentence (max 15 words).

User 1 Profile: ${userProfile}

User 2 Profile: ${matchProfile}

Focus on the strongest common ground: shared interests, complementary personality traits, or aligned values.

Examples:
- "Both love adventure travel and share a passion for photography"
- "Your thoughtful nature complements their caring personality"
- "Mutual love for fitness and healthy lifestyle"

Return only the match reason, nothing else.`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 50,
    });

    return response.choices[0].message.content?.trim() || 'You share common interests';
  } catch (error) {
    console.error('Error generating match reason:', error);
    return 'You might be a great match';
  }
};

export const analyzePersonality = async (
  answers: string[],
  aboutYouText: string
): Promise<{
  summary: string;
  top_traits: string[];
  compatibility_tips: string;
}> => {
  const prompt = `Based only on the two inputs below, provide personality insights.

Input 1: Personality quiz answers (A/B/C/D)
${answers.join(', ') || 'No quiz answers provided'}

Input 2: "Tell us about yourself" text
${aboutYouText || 'No text provided'}

Important:
- Use ONLY these two inputs.
- Do NOT infer from photos, location, age, interests outside Input 2, or any other profile fields.

Quiz context:
- A answers → Funny, Playful, Adventurous, Spontaneous
- B answers → Caring, Empathetic, Romantic, Thoughtful
- C answers → Logical, Calm, Serious, Mature, Structured
- D answers → Responsible, Independent, Confident, Chill

Return JSON with:
{
  "summary": "A 2-3 sentence personality summary",
  "top_traits": ["trait1", "trait2", "trait3"],
  "compatibility_tips": "One sentence on what type of person they'd match with"
}

Only return the JSON object.`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Error analyzing personality:', error);
    return {
      summary: 'You have a unique personality!',
      top_traits: ['Friendly', 'Open-minded'],
      compatibility_tips: 'You would match well with someone who shares your values.',
    };
  }
};

/**
 * Generate profile bio suggestions
 */
export const generateBioSuggestions = async (
  name: string,
  interests: string[],
  personalityTraits: string[]
): Promise<string[]> => {
  const prompt = `Generate 3 creative, concise dating profile bio suggestions for ${name}.

Interests: ${interests.join(', ')}
Personality: ${personalityTraits.join(', ')}

Guidelines:
- Each bio should be 1-2 sentences
- Be authentic and engaging
- Show personality
- Avoid clichés

Return as JSON array of strings: ["bio1", "bio2", "bio3"]`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return parsed.bios || parsed.suggestions || [];
  } catch (error) {
    console.error('Error generating bio suggestions:', error);
    return [
      `${name} loves ${interests[0] || 'exploring new experiences'} and values genuine connections.`,
    ];
  }
};

export const sidekickChat = async (
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  userContext?: string
): Promise<{
  reply: string;
  suggested_prompts: string[];
  inferred_search_query: string | null;
  should_refresh: boolean;
  memory_update?: {
    must_haves?: string[];
    nice_to_haves?: string[];
    dealbreakers?: string[];
    vibe?: string | null;
    age_min?: number | null;
    age_max?: number | null;
    city?: string | null;
    relationship_goal?: string | null;
  };
}> => {
  const system = `You are GreenFlag Sidekick — a warm, witty, emotionally intelligent dating coach inside a dating app.

Goals:
1) Be chatty, responsive, and supportive. Mirror the user's tone.
2) Ask 1-2 smart follow-up questions to clarify what they want.
3) When you have enough info to find matches, propose updating their AI Match feed.
4) Learn over time: extract durable preferences and keep them consistent across sessions.

Rules:
- Keep replies concise (3-7 short lines max), but not robotic.
- Do NOT list user profiles or show results inside this chat.
- Prefer emotionally-aware language and actionable prompts.
- Avoid explicit sexual content. Keep it PG-13.

Return JSON with:
{
  "reply": "string",
  "suggested_prompts": ["string", "string", "string"],
  "inferred_search_query": "string or null",
  "should_refresh": true/false,
  "memory_update": {
    "must_haves": ["string"],
    "nice_to_haves": ["string"],
    "dealbreakers": ["string"],
    "vibe": "string or null",
    "age_min": number or null,
    "age_max": number or null,
    "city": "string or null",
    "relationship_goal": "string or null"
  }
}

Interpretation:
- inferred_search_query: a natural-language query we can send to match search.
- should_refresh: true only when you're confident enough to refresh on-grid matches now.`;

  const contextBlock = userContext ? `\n\nUser context:\n${userContext}\n` : '';
  const payloadMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: system + contextBlock },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  if (!process.env.OPENAI_API_KEY) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content?.trim() || '';
    return {
      reply:
        `Got you. Tell me 2 things:\n` +
        `1) What vibe are you craving (calm, playful, ambitious, artsy)?\n` +
        `2) Any hard filters (age range, city, relationship goal)?`,
      suggested_prompts: [
        'I want someone emotionally mature and consistent.',
        'Prefer someone who loves fitness + travel, 25-32.',
        'I’m open, but I want something long-term.',
      ],
      inferred_search_query: lastUser ? lastUser : null,
      should_refresh: false,
      memory_update: {},
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: payloadMessages,
      temperature: 0.75,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No response from OpenAI');

    const parsed = JSON.parse(content);
    const reply = typeof parsed.reply === 'string' ? parsed.reply : 'Got it — tell me a bit more.';
    const suggested_prompts = Array.isArray(parsed.suggested_prompts)
      ? parsed.suggested_prompts.filter((p: any) => typeof p === 'string').slice(0, 6)
      : [];
    const inferred_search_query =
      typeof parsed.inferred_search_query === 'string' && parsed.inferred_search_query.trim().length > 0
        ? parsed.inferred_search_query.trim()
        : null;
    const should_refresh = Boolean(parsed.should_refresh);

    const memory_update = parsed.memory_update && typeof parsed.memory_update === 'object' ? parsed.memory_update : undefined;
    return { reply, suggested_prompts, inferred_search_query, should_refresh, memory_update };
  } catch (error) {
    console.error('Error generating sidekick chat:', error);
    return {
      reply: 'I’m here. Tell me the top 2 qualities you want right now, and any dealbreakers.',
      suggested_prompts: ['Kind + emotionally mature', 'Loves travel + fitness', 'Looking for long-term'],
      inferred_search_query: null,
      should_refresh: false,
      memory_update: {},
    };
  }
};

export default {
  parseSearchQuery,
  generateProfileEmbedding,
  cosineSimilarity,
  generateMatchReason,
  generateMatchNarrative,
  analyzePersonality,
  generateBioSuggestions,
  sidekickChat,
};

/**
 * Simple selfie/age check using OpenAI Vision. Returns true if clearly 18+ with one face.
 */
export const analyzeSelfieAge = async (
  photoUrl: string
): Promise<{ isAdult: boolean; confidence: number; reasoning: string }> => {
  if (!process.env.OPENAI_API_KEY) {
    return { isAdult: false, confidence: 0, reasoning: 'OpenAI API key not configured' };
  }

  const prompt = `You are verifying a dating-profile selfie. Determine if the person appears to be 18 years or older and ensure only one face is present.
Return JSON: {"isAdult": true/false, "confidence": 0-1, "reasoning": "short reason"}. Say false if unsure or face is missing/multiple.`;

  try {
    const response = await openai.chat.completions.create({
      model: VISION_MODEL,
      temperature: 0,
      max_tokens: 150,
      messages: [
        { role: 'user', content: prompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: photoUrl },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No vision response');
    }
    const parsed = JSON.parse(content);
    return {
      isAdult: Boolean(parsed.isAdult),
      confidence: Number(parsed.confidence) || 0,
      reasoning: parsed.reasoning || 'No reasoning provided',
    };
  } catch (error) {
    console.error('Vision age check error:', error);
    return { isAdult: false, confidence: 0, reasoning: 'Vision check failed' };
  }
};
