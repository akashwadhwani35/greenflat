import { useEffect, useState } from 'react';

/**
 * The signed-in user's own answers, in the shape the profile card needs to
 * decide what to highlight.
 *
 * A detail bubble turns green when the person you are looking at gave the same
 * answer you did, so rendering one profile requires knowing two. Fetched once
 * per screen that shows profiles rather than threaded down from the root, since
 * /profile/me is small and the alternative is passing it through four layers of
 * props that do not otherwise care about it.
 */
export type ViewerProfile = {
  interests: string[];
  traits: string[];
  /** Single-value lifestyle answers, lowercased for comparison. */
  attributes: Record<string, string>;
};

const normalize = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

export const useViewerProfile = (
  token: string | null,
  apiBaseUrl: string
): ViewerProfile | null => {
  const [viewer, setViewer] = useState<ViewerProfile | null>(null);

  useEffect(() => {
    if (!token) {
      setViewer(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;

        const profile = data?.profile || {};
        const personality = data?.personality || {};

        setViewer({
          interests: toStringArray(profile.interests),
          traits: [
            ...toStringArray(personality.top_traits),
            ...toStringArray(personality.personality_traits),
          ],
          attributes: {
            relationship_goal: normalize(profile.relationship_goal),
            smoker: normalize(profile.smoking_habit || profile.smoker),
            drinker: normalize(profile.drinker),
            drugs: normalize(profile.drugs),
            diet: normalize(profile.diet),
            fitness_level: normalize(profile.fitness_level),
            city: normalize(data?.user?.city),
          },
        });
      } catch {
        // A failed fetch just means nothing gets highlighted. The profile still renders.
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, apiBaseUrl]);

  return viewer;
};
