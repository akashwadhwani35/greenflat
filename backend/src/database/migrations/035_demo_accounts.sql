-- Demo accounts for marketing walkthroughs.
--
-- They share production with real people, so discovery, profiles, likes, First
-- Moves and bookmarks only ever connect two accounts on the same side of this
-- flag (services/demoWorld.service.ts). NOT NULL so the comparison never has to
-- reason about NULL; every existing row is a real account.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
