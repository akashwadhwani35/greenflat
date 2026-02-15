import { useState, useEffect, useRef, useCallback } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type NavigationScreen = 'likes' | 'matches' | 'conversations' | null;

export const usePushNotifications = (
  token: string | null,
  apiBaseUrl: string,
  onNavigate?: (screen: NavigationScreen, params?: Record<string, unknown>) => void,
) => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const registeredRef = useRef(false);

  const registerTokenWithBackend = useCallback(async (pushToken: string, authToken: string) => {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(`${apiBaseUrl}/push/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({ pushToken }),
        });
        if (response.ok) {
          registeredRef.current = true;
          return;
        }
        console.error(`Push token registration failed (attempt ${attempt + 1}): HTTP ${response.status}`);
      } catch (err) {
        console.error(`Push token registration error (attempt ${attempt + 1}):`, err);
      }
      // Wait before retrying (1s, 2s, 4s)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    registeredRef.current = false;

    registerForPushNotificationsAsync().then(pushToken => {
      setExpoPushToken(pushToken || null);

      if (pushToken && token) {
        registerTokenWithBackend(pushToken, token);
      }
    });

    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(incoming => {
      setNotification(incoming);
    });

    // Listener for when user taps on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.screen && onNavigate) {
        onNavigate(data.screen as NavigationScreen, data);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [token, apiBaseUrl, registerTokenWithBackend, onNavigate]);

  return { expoPushToken, notification };
};

async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let pushToken;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3BB273',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return;
    }

    pushToken = (await Notifications.getExpoPushTokenAsync({
      projectId: 'ed5ee7ff-6a2b-4105-8b4c-f727e1021b44',
    })).data;
  }

  return pushToken;
}
