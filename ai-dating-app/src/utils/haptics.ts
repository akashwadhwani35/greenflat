import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Small physical confirmations (board item 20). Every call is fire-and-forget
 * and swallows errors: a missing motor or a web build must never break a tap.
 */
const run = (fn: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  fn().catch(() => {});
};

/** Show me, Like, send message, start/stop recording. */
export const hapticLight = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Green Flag and Boost: a bit longer and heavier, these cost something. */
export const hapticStrong = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
