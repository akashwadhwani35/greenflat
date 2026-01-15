import { useState } from 'react';
import { Alert } from 'react-native';

type LikeResult = {
  is_match: boolean;
  match_id: number | null;
  likes_remaining: {
    on_grid: number;
    off_grid: number;
  };
};

type UseLikeProps = {
  token: string;
  apiBaseUrl: string;
  onMatch?: (matchId: number, matchName: string) => void;
  onLikeSuccess?: () => void;
};

export const useLike = ({ token, apiBaseUrl, onMatch, onLikeSuccess }: UseLikeProps) => {
  const [liking, setLiking] = useState(false);
  const [likesRemaining, setLikesRemaining] = useState<{ on_grid: number; off_grid: number } | null>(null);

  const likeProfile = async (
    targetUserId: number,
    targetUserName: string,
    isOnGrid: boolean = true
  ): Promise<LikeResult | null> => {
    if (liking) return null;

    try {
      setLiking(true);

      const response = await fetch(`${apiBaseUrl}/likes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target_user_id: targetUserId,
          is_on_grid: isOnGrid,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific errors
        if (response.status === 429) {
          Alert.alert(
            'Daily Limit Reached',
            data.error || 'You have reached your daily like limit. Try again later!',
            [{ text: 'OK' }]
          );
        } else if (response.status === 400) {
          if (data.error?.includes('already liked')) {
            Alert.alert('Already Liked', 'You have already liked this profile.');
          } else if (data.error?.includes('cooldown')) {
            Alert.alert('User Unavailable', 'This user is currently in cooldown period.');
          } else {
            Alert.alert('Error', data.error || 'Failed to like profile');
          }
        } else {
          throw new Error(data.error || 'Failed to like profile');
        }
        return null;
      }

      // Update likes remaining
      if (data.likes_remaining) {
        setLikesRemaining(data.likes_remaining);
      }

      // Call success callback
      onLikeSuccess?.();

      // Handle match
      if (data.is_match && data.match_id) {
        onMatch?.(data.match_id, targetUserName);
      }

      return {
        is_match: data.is_match,
        match_id: data.match_id,
        likes_remaining: data.likes_remaining,
      };
    } catch (error) {
      console.error('Error liking profile:', error);
      Alert.alert('Error', 'Failed to like profile. Please try again.');
      return null;
    } finally {
      setLiking(false);
    }
  };

  const fetchLikesRemaining = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/likes/remaining`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch likes remaining');
      }

      const data = await response.json();
      setLikesRemaining({
        on_grid: data.on_grid_remaining,
        off_grid: data.off_grid_remaining,
      });

      return data;
    } catch (error) {
      console.error('Error fetching likes remaining:', error);
      return null;
    }
  };

  return {
    likeProfile,
    liking,
    likesRemaining,
    fetchLikesRemaining,
  };
};
