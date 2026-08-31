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
import { publicQuestions, QUESTION_COUNT } from '../utils/personalityQuestions';

export const getPersonalityQuestions = (_req: Request, res: Response) => {
  res.json({
    count: QUESTION_COUNT,
    questions: publicQuestions(),
  });
};
