/**
 * The fixed prompt list a profile can answer (up to three). Must match
 * ai-dating-app/src/services/prompts.ts word for word: the question text is
 * what gets stored, so the app and the server agree by string.
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

const questionSet = new Set(PROMPT_QUESTIONS);

/** Keeps only well-formed entries from the fixed list, one per question, at most three. */
export const normalizePrompts = (input: unknown): ProfilePrompt[] | null => {
  if (input === undefined) return null;
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: ProfilePrompt[] = [];
  for (const item of input) {
    const question = typeof item?.question === 'string' ? item.question.trim() : '';
    const answer = typeof item?.answer === 'string' ? item.answer.trim().replace(/\s+/g, ' ') : '';
    if (!questionSet.has(question) || !answer || seen.has(question)) continue;
    seen.add(question);
    out.push({ question, answer: answer.slice(0, MAX_PROMPT_ANSWER) });
    if (out.length >= MAX_PROMPTS) break;
  }
  return out;
};

export const normalizePrompt = (input: unknown): ProfilePrompt | null => {
  const list = normalizePrompts(input === undefined ? undefined : [input]);
  return list && list.length > 0 ? list[0] : null;
};

/** Question and answer as one line each, for the AI persona text. */
export const promptsToText = (prompts: unknown): string => {
  const list = Array.isArray(prompts) ? prompts : [];
  return list
    .filter((p: any) => p && typeof p.question === 'string' && typeof p.answer === 'string')
    .map((p: any) => `${p.question} ${p.answer}`)
    .join('\n');
};
