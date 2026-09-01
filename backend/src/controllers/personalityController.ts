/**
 * Serves the quiz the onboarding screen renders.
 *
 * The bank lives on the server so question text and trait mappings cannot drift
 * apart between client and server; the client would otherwise need its own copy
 * and the two would diverge the first time a question was reworded. Only the
 * text and option labels go over the wire — which traits an answer implies is
 * ours to know, not something to hand a client that could then game its answers.
 */
import { Request, Response } from 'express';
import { publicQuestions, QUESTION_COUNT, MAX_ANSWERS_PER_QUESTION, TRAIT_VOCABULARY } from '../utils/personalityQuestions';

export const getPersonalityQuestions = (_req: Request, res: Response) => {
  res.json({
    count: QUESTION_COUNT,
    // The app lets a person pick up to this many options per question.
    max_answers_per_question: MAX_ANSWERS_PER_QUESTION,
    questions: publicQuestions(),
    // The labels the paid filters offer, grouped by facet. Same source as the
    // quiz mappings, so the filter chips can never name a trait nobody has.
    trait_vocabulary: TRAIT_VOCABULARY,
  });
};
