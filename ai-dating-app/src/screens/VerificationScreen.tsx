import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/PageHeader';
import { PixelFlag } from '../components/PixelFlag';
import { getDeviceId } from '../utils/deviceId';
import { toUploadableDataUrl } from '../utils/image';

/**
 * Settings → Verification (board 9). Already verified: a success screen. Not
 * yet: the same step as onboarding, with Skip for now / Let's begin at the
 * bottom. Taking the selfie and checking it is one motion.
 */
type Props = {
  onBack: () => void;
  token: string;
  apiBaseUrl: string;
};

type Status = {
  face_status: 'unverified' | 'pending' | 'verified' | 'failed';
  age_verified: boolean;
};

export const VerificationScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const getStatus = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/verification/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.status) setStatus(data.status);
    } catch {
      // Shown as unverified; the check itself reports its own errors.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void getStatus();
  }, []);

  const verify = async (payload: string) => {
    setChecking(true);
    setFailure(null);
    try {
      const response = await fetch(`${apiBaseUrl}/verification/selfie`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          // Lets the server notice one phone verifying many accounts.
          'x-device-id': (await getDeviceId()) || '',
        },
        body: JSON.stringify({ photo_url: payload }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const reason = data?.reasoning ? ` ${data.reasoning}` : '';
        throw new Error(`${data?.error || 'We could not verify that selfie.'}${reason}`);
      }
      await getStatus();
    } catch (error: any) {
      setFailure(error?.message || 'We could not verify that selfie. Try again in better light.');
    } finally {
      setChecking(false);
    }
  };

  const beginFaceCheck = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera needed', 'Allow camera access to verify your face.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        cameraType: ImagePicker.CameraType.front,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setSelfiePreview(asset.uri);
      const payload = Platform.OS === 'web' ? asset.uri : await toUploadableDataUrl(asset.uri);
      await verify(payload);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Unable to open the camera');
    }
  };

  const verified = status?.face_status === 'verified';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Verification" onBack={onBack} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.neonGreen} size="large" /></View>
      ) : verified ? (
        <View style={styles.center}>
          <View style={[styles.bigBadge, { backgroundColor: 'rgba(173, 255, 26, 0.12)', borderColor: theme.colors.neonGreen }]}>
            <PixelFlag size={44} color={theme.colors.neonGreen} />
          </View>
          <Typography variant="h1" style={{ color: theme.colors.text, marginTop: 24, textAlign: 'center' }}>
            Your face is verified
          </Typography>
          <Typography variant="body" style={{ color: theme.colors.muted, marginTop: 10, textAlign: 'center', paddingHorizontal: 32 }}>
            The green flag next to your name is on. Matches can trust it is really you.
          </Typography>
          <TouchableOpacity
            style={[styles.wideButton, { backgroundColor: theme.colors.neonGreen, marginTop: 28 }]}
            onPress={onBack}
            activeOpacity={0.85}
          >
            <Typography variant="bodyStrong" style={{ color: theme.colors.deepBlack }}>Done</Typography>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: '#101D13', borderColor: theme.colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Feather name="shield" size={20} color={theme.colors.neonGreen} />
              <Typography variant="h2" style={{ color: theme.colors.text }}>Face verification</Typography>
            </View>
            <Typography variant="body" style={{ color: theme.colors.muted, marginTop: 10 }}>
              Take a selfie so we can check you match your photos. It is never shown on your
              profile and nobody else sees it.
            </Typography>

            {selfiePreview ? (
              <Image source={{ uri: selfiePreview }} style={styles.preview} />
            ) : null}

            {checking ? (
              <View style={[styles.statusCard, { borderColor: theme.colors.border }]}>
                <ActivityIndicator color={theme.colors.neonGreen} />
                <Typography variant="body" style={{ color: theme.colors.muted, marginLeft: 12, flex: 1 }}>
                  Checking your selfie against your photos…
                </Typography>
              </View>
            ) : null}

            {failure && !checking ? (
              <View style={[styles.statusCard, { borderColor: 'rgba(255, 107, 107, 0.4)', backgroundColor: 'rgba(255, 107, 107, 0.08)' }]}>
                <Feather name="alert-circle" size={20} color={theme.colors.error} />
                <Typography variant="small" style={{ color: theme.colors.text, marginLeft: 12, flex: 1 }}>
                  {failure}
                </Typography>
              </View>
            ) : null}

            {/* One full-width action. Skipping is what the back arrow already
                does on this screen, so a second button for it only split the
                call to action in half. */}
            <TouchableOpacity
              onPress={beginFaceCheck}
              style={[styles.primaryButton, { backgroundColor: theme.colors.neonGreen, borderColor: theme.colors.neonGreen }]}
              disabled={checking}
              activeOpacity={0.85}
            >
              <Typography variant="bodyStrong" style={{ color: theme.colors.deepBlack }}>
                {failure ? 'Try again' : "Let's begin"}
              </Typography>
            </TouchableOpacity>

            <Typography variant="tiny" style={{ color: theme.colors.muted, marginTop: 14 }}>
              Use a clear, front-facing selfie in good light. Your profile needs at least one real photo of you.
            </Typography>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 80 },
  content: { paddingHorizontal: 16, paddingBottom: 120, gap: 14 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18 },
  preview: { width: '100%', height: 260, borderRadius: 14, marginTop: 16, backgroundColor: '#111' },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  primaryButton: {
    width: '100%',
    marginTop: 22,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigBadge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideButton: {
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
});
