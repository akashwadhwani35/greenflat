-- Sexual orientation, and room for two answers per quiz question.

-- The design board's "Who I'm looking for" step lists orientation, interested-in
-- and dating intent as three separate things. The first two had been collapsed
-- into interested_in alone. Identity, so it sits on users beside gender.
ALTER TABLE users ADD COLUMN IF NOT EXISTS orientation VARCHAR(30);

-- Quiz answers were CHAR(1): exactly one letter. People are not that clear-cut,
-- so a question may now carry up to two answers, stored as sorted letters ("AC").
-- Existing single-letter answers remain valid as they are.
DO $$
DECLARE n INT;
BEGIN
  FOR n IN 1..12 LOOP
    EXECUTE format('ALTER TABLE personality_responses ALTER COLUMN question%s_answer TYPE VARCHAR(2)', n);
  END LOOP;
END $$;
