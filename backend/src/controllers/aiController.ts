import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { sidekickChat } from '../services/openai.service';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const uniqueStrings = (items: unknown[]): string[] => {
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (!out.includes(trimmed)) out.push(trimmed);
  }
  return out;
};

const mergeMemory = (existing: any, update: any) => {
  const base = existing && typeof existing === 'object' ? existing : {};
  const next: any = { ...base };

  const mergeArray = (key: string) => {
    const merged = uniqueStrings([...(base[key] || []), ...(update?.[key] || [])]);
    if (merged.length) next[key] = merged;
  };

  mergeArray('must_haves');
  mergeArray('nice_to_haves');
  mergeArray('dealbreakers');

  for (const key of ['vibe', 'city', 'relationship_goal'] as const) {
    const value = update?.[key];
    if (typeof value === 'string' && value.trim().length) next[key] = value.trim();
  }

  for (const key of ['age_min', 'age_max'] as const) {
    const value = update?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) next[key] = value;
  }

  next.updated_at = new Date().toISOString();
  return next;
};

export const sidekick = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { messages } = req.body as { messages: ChatMessage[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages is required' });
    }

    const cleaned = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }))
      .slice(-16);

    const userResult = await pool.query(
      `SELECT u.name, u.city, u.gender, u.interested_in, u.is_premium,
              p.interests, p.relationship_goal,
              pr.personality_summary, pr.top_traits
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN personality_responses pr ON pr.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    const user = userResult.rows[0] || {};

    const memoryRow = await pool.query('SELECT memory FROM user_sidekick_memory WHERE user_id = $1', [userId]);
    const existingMemory = memoryRow.rows[0]?.memory || {};

    // Candidate snapshot (so the sidekick can tailor guidance to what's available).
    // NOTE: This is intentionally a small sample for prompt budget.
    const candidatesResult = await pool.query(
      `SELECT
          u.id, u.name, u.date_of_birth, u.city, u.is_verified,
          p.interests, p.relationship_goal
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id != $1
         AND u.gender = $2
         AND u.city = $3
       ORDER BY u.created_at DESC
       LIMIT 20`,
      [userId, user.interested_in || 'male', user.city || '']
    );

    const candidateSnapshot = candidatesResult.rows
      .map((c: any) => {
        const interests = Array.isArray(c.interests) ? (c.interests as string[]).slice(0, 5).join(', ') : '';
        const goal = c.relationship_goal ? `goal=${c.relationship_goal}` : '';
        const verified = c.is_verified ? 'verified' : '';
        return `- ${c.name}${goal ? ` (${goal})` : ''}${verified ? ` (${verified})` : ''}${interests ? ` — ${interests}` : ''}`;
      })
      .join('\n');

    const userContext = [
      `Name: ${user.name || 'Unknown'}`,
      `City: ${user.city || 'Unknown'}`,
      `Interested in: ${user.interested_in || 'Unknown'}`,
      user.relationship_goal ? `Relationship goal: ${user.relationship_goal}` : null,
      Array.isArray(user.interests) && user.interests.length ? `Interests: ${user.interests.join(', ')}` : null,
      user.personality_summary ? `Personality: ${user.personality_summary}` : null,
      Array.isArray(user.top_traits) && user.top_traits.length ? `Top traits: ${user.top_traits.join(', ')}` : null,
      existingMemory && Object.keys(existingMemory).length ? `Sidekick memory: ${JSON.stringify(existingMemory)}` : null,
      candidateSnapshot ? `Candidate snapshot (do not list in chat):\n${candidateSnapshot}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const ai = await sidekickChat(cleaned, userContext);

    if (ai.memory_update && typeof ai.memory_update === 'object') {
      const merged = mergeMemory(existingMemory, ai.memory_update);
      await pool.query(
        `INSERT INTO user_sidekick_memory (user_id, memory, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET memory = $2, updated_at = NOW()`,
        [userId, merged]
      );
    }

    res.json(ai);
  } catch (error: any) {
    console.error('AI sidekick error:', error);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
};
