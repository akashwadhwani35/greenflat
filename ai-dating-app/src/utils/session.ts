import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedSession = {
  token: string;
  user: {
    id: number;
    name: string;
    is_admin?: boolean;
  };
};

const SESSION_KEY = 'greenflag.session.v1';
const FIRST_SEARCH_DONE_PREFIX = 'greenflag.firstSearchDone.v1.';
const WELCOME_SHOWN_PREFIX = 'greenflag.welcomeShown.v1.';
const SUBSCRIPTION_NUDGE_PREFIX = 'greenflag.subscriptionNudgeAt.v1.';
const PASSED_IDS_PREFIX = 'greenflag.passedIds.v1.';

export const loadSession = async (): Promise<SavedSession | null> => {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSession;
    if (!parsed?.token || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveSession = async (session: SavedSession): Promise<void> => {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = async (): Promise<void> => {
  await AsyncStorage.removeItem(SESSION_KEY);
};

export const loadFirstSearchDone = async (userId: number): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(`${FIRST_SEARCH_DONE_PREFIX}${userId}`);
    return value === '1';
  } catch {
    return false;
  }
};

export const saveFirstSearchDone = async (userId: number): Promise<void> => {
  await AsyncStorage.setItem(`${FIRST_SEARCH_DONE_PREFIX}${userId}`, '1');
};

export const hasWelcomeBeenShown = async (userId: number): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(`${WELCOME_SHOWN_PREFIX}${userId}`);
    return value === '1';
  } catch {
    return false;
  }
};

export const markWelcomeShown = async (userId: number): Promise<void> => {
  await AsyncStorage.setItem(`${WELCOME_SHOWN_PREFIX}${userId}`, '1');
};

/**
 * Profiles this account rejected. Keyed by user id so one account's passes
 * never leak into another on the same phone; capped so the key stays small.
 */
export const loadPassedIds = async (userId: number): Promise<number[]> => {
  try {
    const raw = await AsyncStorage.getItem(`${PASSED_IDS_PREFIX}${userId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
};

export const savePassedIds = async (userId: number, ids: number[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(`${PASSED_IDS_PREFIX}${userId}`, JSON.stringify(ids.slice(-500)));
  } catch {
    // Best-effort; the in-memory set still applies for this session.
  }
};

/** When the subscription page was last shown as a pop-up (ms since epoch), or 0. */
export const loadSubscriptionNudgeShownAt = async (userId: number): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(`${SUBSCRIPTION_NUDGE_PREFIX}${userId}`);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

export const markSubscriptionNudgeShown = async (userId: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(`${SUBSCRIPTION_NUDGE_PREFIX}${userId}`, String(Date.now()));
  } catch {
    // Best-effort only.
  }
};

const ONBOARDING_DRAFT_PREFIX = 'greenflag.onboardingDraft.v1.';
const LAST_SEARCH_PREFIX = 'greenflag.lastSearch.v1.';

export type OnboardingDraft = { step: number; quizIndex: number; form: Record<string, unknown>; savedAt: number };

/** Where the person was in onboarding, so an app kill does not send them to step 1. */
export const loadOnboardingDraft = async (userId: number): Promise<OnboardingDraft | null> => {
  try {
    const raw = await AsyncStorage.getItem(`${ONBOARDING_DRAFT_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.form !== 'object') return null;
    return parsed as OnboardingDraft;
  } catch {
    return null;
  }
};

export const saveOnboardingDraft = async (userId: number, draft: Omit<OnboardingDraft, 'savedAt'>): Promise<void> => {
  try {
    await AsyncStorage.setItem(`${ONBOARDING_DRAFT_PREFIX}${userId}`, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Best-effort only.
  }
};

export const clearOnboardingDraft = async (userId: number): Promise<void> => {
  try {
    await AsyncStorage.removeItem(`${ONBOARDING_DRAFT_PREFIX}${userId}`);
  } catch {
    // Best-effort only.
  }
};

export type LastSearch = { query: string; matches: unknown[]; savedAt: number };

/** The latest AI Match results, kept until the next search (board item 7). */
export const loadLastSearch = async (userId: number): Promise<LastSearch | null> => {
  try {
    const raw = await AsyncStorage.getItem(`${LAST_SEARCH_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.query !== 'string' || !Array.isArray(parsed.matches)) return null;
    return parsed as LastSearch;
  } catch {
    return null;
  }
};

export const saveLastSearch = async (userId: number, search: Omit<LastSearch, 'savedAt'>): Promise<void> => {
  try {
    await AsyncStorage.setItem(`${LAST_SEARCH_PREFIX}${userId}`, JSON.stringify({ ...search, savedAt: Date.now() }));
  } catch {
    // Best-effort only.
  }
};
