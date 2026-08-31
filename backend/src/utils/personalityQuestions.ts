/**
 * The situational personality quiz.
 *
 * This is the single authoritative copy: the app fetches it from
 * GET /api/personality/questions rather than shipping its own, so question text
 * and trait mappings cannot drift apart between client and server.
 *
 * Questions 1-8 are taken verbatim from the product spec ("Copy of AI DATING APP
 * - Answers"), including its per-option trait triples. Questions 9-12 were added
 * to reach the twelve the design calls for and follow the same construction: a
 * concrete situation, four plausible answers, no obviously "right" one.
 *
 * The A/B/C/D axis is consistent throughout and the matching engine leans on it:
 *   A → funny / playful / spontaneous
 *   B → caring / empathetic / warm
 *   C → logical / serious / measured
 *   D → responsible / independent / steady
 *
 * Traits derived here land in personality_responses.personality_traits and feed
 * both the profile's personality snapshot and the match score's trait overlap.
 */

export type QuizOptionKey = 'A' | 'B' | 'C' | 'D';

export type QuizOption = {
  key: QuizOptionKey;
  label: string;
  traits: string[];
};

export type QuizQuestion = {
  /** 1-based, and matches the questionN_answer column it is stored in. */
  number: number;
  prompt: string;
  options: QuizOption[];
};

export const PERSONALITY_QUESTIONS: QuizQuestion[] = [
  {
    number: 1,
    prompt: "When your partner has a rough day, what's your first instinct?",
    options: [
      { key: 'A', label: 'Make them laugh with something silly', traits: ['Funny', 'Playful', 'Positive'] },
      { key: 'B', label: 'Listen carefully and comfort them', traits: ['Caring', 'Empathetic', 'Emotionally aware'] },
      { key: 'C', label: 'Give them space and check in later', traits: ['Logical', 'Respectful', 'Calm'] },
      { key: 'D', label: 'Try to fix the problem right away', traits: ['Responsible', 'Serious', 'Supportive'] },
    ],
  },
  {
    number: 2,
    prompt: "You're planning a weekend date. What's your idea of fun?",
    options: [
      { key: 'A', label: 'A surprise road trip with no plan', traits: ['Adventurous', 'Spontaneous', 'Fun'] },
      { key: 'B', label: 'A cozy dinner and movie night', traits: ['Romantic', 'Caring', 'Thoughtful'] },
      { key: 'C', label: 'A stand-up show or something funny', traits: ['Funny', 'Outgoing', 'Social'] },
      { key: 'D', label: 'Visiting a museum or learning something new', traits: ['Intellectual', 'Serious', 'Curious'] },
    ],
  },
  {
    number: 3,
    prompt: 'How do you handle disagreements?',
    options: [
      { key: 'A', label: 'I use humor to cool things down', traits: ['Funny', 'Mature', 'Emotionally intelligent'] },
      { key: 'B', label: 'I try to understand both sides calmly', traits: ['Empathetic', 'Mature', 'Peaceful'] },
      { key: 'C', label: 'I stick to facts and logic', traits: ['Logical', 'Serious', 'Rational'] },
      { key: 'D', label: 'I prefer to drop it and move on', traits: ['Chill', 'Easy-going', 'Non-confrontational'] },
    ],
  },
  {
    number: 4,
    prompt: 'Your partner forgets your birthday. You…',
    options: [
      { key: 'A', label: 'Joke about it but secretly tease them later', traits: ['Funny', 'Forgiving', 'Lighthearted'] },
      { key: 'B', label: 'Feel hurt but want to talk about it', traits: ['Caring', 'Emotionally open', 'Honest'] },
      { key: 'C', label: 'Say it’s fine but quietly take note', traits: ['Serious', 'Observant', 'Reserved'] },
      { key: 'D', label: 'Laugh and plan your own celebration', traits: ['Independent', 'Confident', 'Chill'] },
    ],
  },
  {
    number: 5,
    prompt: "You're in a group chat with friends — how do you show up?",
    options: [
      { key: 'A', label: "I'm the meme-sender", traits: ['Funny', 'Outgoing', 'Social'] },
      { key: 'B', label: 'The emotional support one', traits: ['Caring', 'Empathetic', 'Reliable'] },
      { key: 'C', label: 'The planner who organizes everything', traits: ['Responsible', 'Structured', 'Serious'] },
      { key: 'D', label: 'I reply when needed — quality over quantity', traits: ['Calm', 'Introverted', 'Selective'] },
    ],
  },
  {
    number: 6,
    prompt: "If someone you like cancels plans last minute, what's your reaction?",
    options: [
      { key: 'A', label: 'Make a joke and reschedule', traits: ['Funny', 'Light-hearted', 'Positive'] },
      { key: 'B', label: "Ask if they're okay", traits: ['Caring', 'Thoughtful', 'Loyal'] },
      { key: 'C', label: 'Feel disappointed but keep it cool', traits: ['Serious', 'Grounded', 'Mature'] },
      { key: 'D', label: 'Take it personally — effort matters', traits: ['Committed', 'Intense', 'Sensitive'] },
    ],
  },
  {
    number: 7,
    prompt: 'Your ideal compliment sounds like…',
    options: [
      { key: 'A', label: '“You’re hilarious.”', traits: ['Funny', 'Charismatic', 'Witty'] },
      { key: 'B', label: '“You’re so thoughtful.”', traits: ['Caring', 'Empathetic', 'Warm'] },
      { key: 'C', label: '“You always stay calm.”', traits: ['Serious', 'Reliable', 'Mature'] },
      { key: 'D', label: '“You make me feel safe.”', traits: ['Responsible', 'Supportive', 'Loyal'] },
    ],
  },
  {
    number: 8,
    prompt: 'Which quote feels most like you?',
    options: [
      { key: 'A', label: '“Life’s too short to take too seriously.”', traits: ['Funny', 'Adventurous', 'Free-spirited'] },
      { key: 'B', label: '“Kindness never goes out of style.”', traits: ['Caring', 'Compassionate', 'Selfless'] },
      { key: 'C', label: '“Discipline equals freedom.”', traits: ['Serious', 'Structured', 'Focused'] },
      { key: 'D', label: '“Go with the flow and see where it leads.”', traits: ['Chill', 'Adaptable', 'Laid-back'] },
    ],
  },
  {
    number: 9,
    prompt: "It's Sunday morning and neither of you has plans. What happens?",
    options: [
      { key: 'A', label: 'I suggest something daft and we end up somewhere random', traits: ['Spontaneous', 'Playful', 'Fun'] },
      { key: 'B', label: 'We stay in bed talking for an hour', traits: ['Romantic', 'Warm', 'Present'] },
      { key: 'C', label: 'I get up, make coffee, and start on my list', traits: ['Structured', 'Focused', 'Independent'] },
      { key: 'D', label: 'Whatever they feel like doing is fine by me', traits: ['Easy-going', 'Adaptable', 'Supportive'] },
    ],
  },
  {
    number: 10,
    prompt: 'You meet their closest friends for the first time. You…',
    options: [
      { key: 'A', label: 'Crack a joke in the first minute', traits: ['Outgoing', 'Charismatic', 'Witty'] },
      { key: 'B', label: 'Ask them questions and actually listen', traits: ['Empathetic', 'Curious', 'Warm'] },
      { key: 'C', label: 'Hang back and read the room first', traits: ['Observant', 'Calm', 'Reserved'] },
      { key: 'D', label: 'Offer to get the first round in', traits: ['Generous', 'Responsible', 'Social'] },
    ],
  },
  {
    number: 11,
    prompt: 'Money is tight this month and they suggest an expensive dinner. You…',
    options: [
      { key: 'A', label: 'Counter with somewhere cheaper and funnier', traits: ['Playful', 'Resourceful', 'Honest'] },
      { key: 'B', label: 'Say yes and quietly cover it', traits: ['Selfless', 'Giving', 'Private'] },
      { key: 'C', label: "Tell them straight that it's not in the budget", traits: ['Rational', 'Direct', 'Grounded'] },
      { key: 'D', label: 'Suggest cooking together at home instead', traits: ['Practical', 'Thoughtful', 'Domestic'] },
    ],
  },
  {
    number: 12,
    prompt: "Six months in, what tells you it's working?",
    options: [
      { key: 'A', label: 'We still make each other laugh', traits: ['Playful', 'Light-hearted', 'Optimistic'] },
      { key: 'B', label: 'I feel safe telling them anything', traits: ['Emotionally open', 'Trusting', 'Warm'] },
      { key: 'C', label: 'Our plans line up without much effort', traits: ['Compatible', 'Structured', 'Realistic'] },
      { key: 'D', label: 'We handle the boring days well', traits: ['Steady', 'Committed', 'Mature'] },
    ],
  },
];

export const QUESTION_COUNT = PERSONALITY_QUESTIONS.length;

/** Column names in personality_responses, in question order. */
export const ANSWER_COLUMNS = PERSONALITY_QUESTIONS.map((q) => `question${q.number}_answer`);

const VALID_KEYS: QuizOptionKey[] = ['A', 'B', 'C', 'D'];

export const normalizeAnswer = (value: unknown): QuizOptionKey | null => {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase() as QuizOptionKey;
  return VALID_KEYS.includes(upper) ? upper : null;
};

/**
 * Traits for a full answer sheet, deduplicated and in question order.
 *
 * `answers` is indexed by question number minus one; a null means unanswered and
 * contributes nothing. Unlike the old flat A/B/C/D map, the same letter means
 * different things on different questions, which is the point of asking twelve.
 */
export const traitsForAnswers = (answers: Array<QuizOptionKey | null>): string[] => {
  const traits: string[] = [];

  PERSONALITY_QUESTIONS.forEach((question, index) => {
    const answer = answers[index];
    if (!answer) return;
    const option = question.options.find((o) => o.key === answer);
    if (option) traits.push(...option.traits);
  });

  return [...new Set(traits)];
};

/** Compact "1A: Funny, Playful, Positive" lines, used to ground the AI prompt. */
export const describeAnswers = (answers: Array<QuizOptionKey | null>): string =>
  PERSONALITY_QUESTIONS.map((question, index) => {
    const answer = answers[index];
    if (!answer) return null;
    const option = question.options.find((o) => o.key === answer);
    if (!option) return null;
    return `Q${question.number}${answer} (${option.label}) → ${option.traits.join(', ')}`;
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
