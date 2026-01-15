import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedSession = {
  token: string;
  user: {
    id: number;
    name: string;
  };
};

const SESSION_KEY = 'greenflag.session.v1';

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

