/**
 * The situational personality quiz.
 *
 * This is the single authoritative copy: the app fetches it from
 * GET /api/personality/questions rather than shipping its own, so question text
 * and trait mappings cannot drift apart between client and server.
 *
 * The ten questions are Adhiraj's, from the "Greenflag edits" board, verbatim.
 * They replaced an earlier twelve. The board's Filters page defines the vocabulary
 * the answers should produce — it says the personality filters "will be derived
 * from the personality questions" and lists them — so every option here maps to
 * one or two labels from exactly that list, in four categories:
 *
 *   personality        Very social · Social but selective · More private ·
 *                      Adventurous · Curious / open-minded · Practical / grounded ·
 *                      Ambitious / driven · Calm / easygoing
 *   communication      Direct and clear · Thoughtful and careful ·
 *                      Playful and light · Emotional and expressive
 *   relationship_needs Independent · Balanced · Close and affectionate ·
 *                      Takes things slowly · Deeply committed
 *   conflict_style     Talks about it right away · Needs time to think ·
 *                      Looks for a compromise · Focuses on understanding first ·
 *                      Avoids conflict when possible
 *
 * A fifth category on the board, lifestyle, is not something a quiz answer can
 * tell you; it comes from interests instead (see lifestyleFromInterests).
 *
 * The mappings are a first pass and should be reviewed by whoever owns the
 * questions. They are deliberately visible in one place for that reason.
 *
 * Derived labels land in personality_responses.personality_traits (flat, used
 * for the profile snapshot, the green shared-answer highlight and the match
 * score's trait overlap) and personality_responses.trait_profile (grouped by
 * category, used by the paid filters).
 */

export type QuizOptionKey = 'A' | 'B' | 'C' | 'D';

export type TraitCategory =
  | 'personality'
  | 'communication'
  | 'relationship_needs'
  | 'conflict_style'
  | 'lifestyle';

export type Trait = { category: TraitCategory; label: string };

export type QuizOption = {
  key: QuizOptionKey;
  label: string;
  traits: Trait[];
};

export type QuizQuestion = {
  /** 1-based, and matches the questionN_answer column it is stored in. */
  number: number;
  prompt: string;
  options: QuizOption[];
};

// Short constructors keep the bank below readable.
const P = (label: string): Trait => ({ category: 'personality', label });
const C = (label: string): Trait => ({ category: 'communication', label });
const R = (label: string): Trait => ({ category: 'relationship_needs', label });
const X = (label: string): Trait => ({ category: 'conflict_style', label });
const L = (label: string): Trait => ({ category: 'lifestyle', label });

export const PERSONALITY_QUESTIONS: QuizQuestion[] = [
  {
    number: 1,
    prompt: 'You have a free day, nothing planned. What sounds best?',
    options: [
      { key: 'A', label: 'Go somewhere new', traits: [P('Adventurous'), L('Travel-loving')] },
      { key: 'B', label: 'Meet friends or family', traits: [P('Very social'), R('Close and affectionate')] },
      { key: 'C', label: 'Work on something I care about', traits: [P('Ambitious / driven'), L('Creative')] },
      { key: 'D', label: 'Stay home and recharge', traits: [P('More private'), L('Homebody')] },
    ],
  },
  {
    number: 2,
    prompt: 'Big opportunity comes up — exciting, but it could fail. What do you do?',
    options: [
      { key: 'A', label: 'Take it', traits: [P('Adventurous'), P('Ambitious / driven')] },
      { key: 'B', label: 'Weigh the risks first', traits: [P('Practical / grounded'), C('Thoughtful and careful')] },
      { key: 'C', label: 'Ask someone I trust', traits: [P('Social but selective'), R('Close and affectionate')] },
      { key: 'D', label: 'Wait until I feel ready', traits: [P('Calm / easygoing'), R('Takes things slowly')] },
    ],
  },
  {
    number: 3,
    prompt: "You're stuck on a hard problem with no clear answer. What's your first move?",
    options: [
      { key: 'A', label: 'Look at the facts', traits: [P('Practical / grounded'), C('Direct and clear')] },
      { key: 'B', label: 'Brainstorm different angles', traits: [P('Curious / open-minded'), L('Creative')] },
      { key: 'C', label: 'Talk it through with someone', traits: [P('Very social'), C('Emotional and expressive')] },
      { key: 'D', label: 'Trust my gut', traits: [P('Adventurous'), C('Direct and clear')] },
    ],
  },
  {
    number: 4,
    prompt: "Your partner's had a rough day. What's your instinct?",
    options: [
      { key: 'A', label: 'Try to lighten the mood', traits: [C('Playful and light')] },
      { key: 'B', label: 'Just listen and comfort them', traits: [R('Close and affectionate'), C('Emotional and expressive')] },
      { key: 'C', label: 'Give space, check in later', traits: [R('Independent'), X('Needs time to think')] },
      { key: 'D', label: 'Try to help fix it', traits: [P('Practical / grounded'), X('Talks about it right away')] },
    ],
  },
  {
    number: 5,
    prompt: "Your partner says something hurt them, but you didn't mean it that way. What do you do?",
    options: [
      { key: 'A', label: 'Ask exactly what hurt them', traits: [X('Focuses on understanding first'), C('Thoughtful and careful')] },
      { key: 'B', label: 'Explain what you actually meant', traits: [C('Direct and clear'), X('Talks about it right away')] },
      { key: 'C', label: 'Apologize and adjust, no questions needed', traits: [R('Close and affectionate'), X('Looks for a compromise')] },
      { key: 'D', label: 'Take a beat before responding', traits: [X('Needs time to think'), P('Calm / easygoing')] },
    ],
  },
  {
    number: 6,
    prompt: 'Someone you trusted breaks that trust — but genuinely changes after. What happens next?',
    options: [
      { key: 'A', label: 'I forgive and move forward fully', traits: [R('Balanced'), P('Calm / easygoing')] },
      { key: 'B', label: 'I forgive, but need time to feel it', traits: [X('Needs time to think'), C('Thoughtful and careful')] },
      { key: 'C', label: 'I forgive, but it stays in the back of my mind', traits: [P('Social but selective'), R('Takes things slowly')] },
      { key: 'D', label: "Trust like that doesn't fully come back for me", traits: [R('Independent'), P('Practical / grounded')] },
    ],
  },
  {
    number: 7,
    prompt: "Your partner wants noticeably more alone time than you do. What's your read?",
    options: [
      { key: 'A', label: 'I respect it and give them room', traits: [R('Independent')] },
      { key: 'B', label: 'I give room, but want reassurance too', traits: [R('Close and affectionate'), C('Emotional and expressive')] },
      { key: 'C', label: 'I look for a middle ground', traits: [R('Balanced'), X('Looks for a compromise')] },
      { key: 'D', label: "I start to wonder if something's wrong", traits: [R('Deeply committed'), C('Emotional and expressive')] },
    ],
  },
  {
    number: 8,
    prompt: 'Six months in, what tells you "this is real"?',
    options: [
      { key: 'A', label: 'We still make each other laugh', traits: [C('Playful and light')] },
      { key: 'B', label: 'I can tell them anything', traits: [C('Emotional and expressive'), R('Close and affectionate')] },
      { key: 'C', label: 'I trust them fully', traits: [R('Deeply committed')] },
      { key: 'D', label: 'We support each other and still have our own lives', traits: [R('Balanced'), R('Independent')] },
    ],
  },
  {
    number: 9,
    prompt: "Someone gives you honest, unflattering feedback about yourself. What's your first reaction?",
    options: [
      { key: 'A', label: 'I get defensive, then think about it later', traits: [C('Emotional and expressive'), X('Needs time to think')] },
      { key: 'B', label: 'I take it seriously right away', traits: [C('Direct and clear'), P('Ambitious / driven')] },
      { key: 'C', label: 'I ask follow-up questions to understand it', traits: [P('Curious / open-minded'), X('Focuses on understanding first')] },
      { key: 'D', label: 'I brush it off unless it comes from someone close', traits: [P('Social but selective'), R('Independent')] },
    ],
  },
  {
    number: 10,
    prompt: 'In a serious argument, what feels most natural to you?',
    options: [
      { key: 'A', label: 'Fix it as fast as possible', traits: [X('Talks about it right away'), X('Looks for a compromise')] },
      { key: 'B', label: 'Make sure we truly understand each other', traits: [X('Focuses on understanding first'), C('Thoughtful and careful')] },
      { key: 'C', label: 'Say exactly how I feel, no filtering', traits: [C('Direct and clear'), C('Emotional and expressive')] },
      { key: 'D', label: 'Step back and return to it later', traits: [X('Needs time to think'), X('Avoids conflict when possible')] },
    ],
  },
];

export const QUESTION_COUNT = PERSONALITY_QUESTIONS.length;

/** Column names in personality_responses, in question order. */
export const ANSWER_COLUMNS = PERSONALITY_QUESTIONS.map((q) => `question${q.number}_answer`);

const VALID_KEYS: QuizOptionKey[] = ['A', 'B', 'C', 'D'];

/** Up to two option keys per question, stored as sorted letters: "A" or "AC". */
export type QuizAnswer = string;

export const MAX_ANSWERS_PER_QUESTION = 2;

/**
 * Accepts "A", "ac", ["C","A"], and returns the canonical form ("AC"), or null.
 * Sorted and deduplicated so "CA" and "AC" are the same stored value, and capped
 * at two because the point is "I'm between these", not "all of the above".
 */
export const normalizeAnswer = (value: unknown): QuizAnswer | null => {
  const raw: string[] = Array.isArray(value)
    ? value.map((v) => String(v))
    : typeof value === 'string'
      ? value.split('')
      : [];

  const keys = [...new Set(raw.map((c) => c.trim().toUpperCase()))]
    .filter((c): c is QuizOptionKey => VALID_KEYS.includes(c as QuizOptionKey))
    .sort()
    .slice(0, MAX_ANSWERS_PER_QUESTION);

  return keys.length > 0 ? keys.join('') : null;
};

/** The individual option keys inside a stored answer. */
export const answerKeys = (answer: QuizAnswer | null): QuizOptionKey[] =>
  answer ? (answer.split('') as QuizOptionKey[]) : [];

const chosenTraits = (answers: Array<QuizAnswer | null>): Trait[] => {
  const out: Trait[] = [];
  PERSONALITY_QUESTIONS.forEach((question, index) => {
    for (const key of answerKeys(answers[index])) {
      const option = question.options.find((o) => o.key === key);
      if (option) out.push(...option.traits);
    }
  });
  return out;
};

/**
 * Flat, deduplicated labels for a full answer sheet, in question order. Labels
 * are unique across categories, so the category is recoverable from the label.
 */
export const traitsForAnswers = (answers: Array<QuizAnswer | null>): string[] =>
  [...new Set(chosenTraits(answers).map((t) => t.label))];

export type TraitProfile = Record<TraitCategory, string[]>;

const emptyProfile = (): TraitProfile => ({
  personality: [],
  communication: [],
  relationship_needs: [],
  conflict_style: [],
  lifestyle: [],
});

/**
 * The same labels grouped by category, which is the shape the paid filters
 * read. Within a category, labels are ordered by how often the answers pointed
 * at them, so the first entry is the strongest signal.
 */
export const traitProfileForAnswers = (
  answers: Array<QuizAnswer | null>,
  interests: string[] = []
): TraitProfile => {
  const profile = emptyProfile();
  const counts = new Map<string, number>();

  for (const trait of [...chosenTraits(answers), ...lifestyleFromInterests(interests)]) {
    const id = `${trait.category} ${trait.label}`;
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([id]) => {
      const [category, label] = id.split(' ') as [TraitCategory, string];
      if (!profile[category].includes(label)) profile[category].push(label);
    });

  return profile;
};

/**
 * Lifestyle is the one filter category on the board that a situational quiz
 * cannot tell you, so it is read off the interests the person picked instead.
 */
const INTEREST_TO_LIFESTYLE: Record<string, string[]> = {
  fitness: ['Fitness-focused', 'Active'],
  sports: ['Active'],
  running: ['Active', 'Fitness-focused'],
  cycling: ['Active', 'Outdoorsy'],
  yoga: ['Active'],
  hiking: ['Outdoorsy', 'Active'],
  travel: ['Travel-loving'],
  cooking: ['Foodie'],
  art: ['Creative'],
  music: ['Creative'],
  'live music': ['Creative', 'Night owl'],
  photography: ['Creative'],
  dancing: ['Creative', 'Night owl'],
  theatre: ['Creative'],
  reading: ['Homebody'],
  movies: ['Homebody'],
  gaming: ['Homebody', 'Night owl'],
  'board games': ['Homebody'],
  technology: ['Career-focused'],
};

export const lifestyleFromInterests = (interests: string[]): Trait[] => {
  const out: Trait[] = [];
  for (const raw of interests) {
    const labels = INTEREST_TO_LIFESTYLE[String(raw).trim().toLowerCase()];
    if (labels) out.push(...labels.map(L));
  }
  return out;
};

/** Compact per-question lines, used to ground the AI prompt. */
export const describeAnswers = (answers: Array<QuizAnswer | null>): string =>
  PERSONALITY_QUESTIONS.map((question, index) => {
    const keys = answerKeys(answers[index]);
    if (keys.length === 0) return null;
    const parts = keys
      .map((key) => question.options.find((o) => o.key === key))
      .filter((o): o is QuizOption => Boolean(o))
      .map((o) => `${o.key} (${o.label}) → ${o.traits.map((t) => t.label).join(', ')}`);
    if (parts.length === 0) return null;
    // Two answers read as "between these", which the model should treat as a blend.
    return `Q${question.number}: ${parts.join('  |  ')}`;
  })
    .filter((line): line is string => line !== null)
    .join('\n');

/** The payload the app renders. Trait mappings stay server-side. */
export const publicQuestions = () =>
  PERSONALITY_QUESTIONS.map((q) => ({
    number: q.number,
    prompt: q.prompt,
    options: q.options.map((o) => ({ key: o.key, label: o.label })),
  }));

/** The filter vocabulary, for the app to render paid-filter chips from. */
export const TRAIT_VOCABULARY: TraitProfile = {
  personality: ['Very social', 'Social but selective', 'More private', 'Adventurous', 'Curious / open-minded', 'Practical / grounded', 'Ambitious / driven', 'Calm / easygoing'],
  communication: ['Direct and clear', 'Thoughtful and careful', 'Playful and light', 'Emotional and expressive'],
  relationship_needs: ['Independent', 'Balanced', 'Close and affectionate', 'Takes things slowly', 'Deeply committed'],
  conflict_style: ['Talks about it right away', 'Needs time to think', 'Looks for a compromise', 'Focuses on understanding first', 'Avoids conflict when possible'],
  lifestyle: ['Active', 'Fitness-focused', 'Creative', 'Career-focused', 'Travel-loving', 'Homebody', 'Foodie', 'Outdoorsy', 'Night owl'],
};
