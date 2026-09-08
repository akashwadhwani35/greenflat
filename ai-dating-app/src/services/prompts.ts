/**
 * Profile prompts: a person picks up to three from this fixed list and
 * answers each. Must match backend/src/utils/prompts.ts word for word, since
 * the question text itself is what gets stored and validated.
 */
export const PROMPT_QUESTIONS: readonly string[] = [
  'A perfect day for me looks like…',
  'The fastest way to make me laugh is…',
  'Something I could talk about for hours is…',
  'One thing people are usually surprised to learn about me is…',
  'My most random obsession right now is…',
  'The best last-minute plan is…',
  'A small thing that instantly makes my day better is…',
  'The kind of person I naturally click with is…',
  'You’ll know I really like you when…',
  'One thing I’ll always make time for is…',
  'A great relationship, to me, feels like…',
  'Something I want to experience with the right person is…',
  'One opinion I’ll happily debate is…',
  'My friends would probably say I’m the one who…',
  'The easiest way to start a conversation with me is…',
];

export const MAX_PROMPTS = 3;
export const MAX_PROMPT_ANSWER = 200;

export type ProfilePrompt = { question: string; answer: string };

/** Whatever the server or an older row hands back, as a clean list. */
export const parsePrompts = (raw: unknown): ProfilePrompt[] => {
  let list = raw;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { return []; }
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((p: any) => p && typeof p.question === 'string' && typeof p.answer === 'string' && p.answer.trim())
    .slice(0, MAX_PROMPTS)
    .map((p: any) => ({ question: p.question, answer: p.answer }));
};

/** A First Move card message stores the prompt as JSON in its content. */
export const parsePromptCard = (content: string | null | undefined): ProfilePrompt | null => {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed.question === 'string' && typeof parsed.answer === 'string') return parsed;
  } catch {
    // Not a prompt card.
  }
  return null;
};
