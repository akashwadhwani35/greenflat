import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, ActivityIndicator, Alert, Image, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/PageHeader';

type Props = {
  onBack: () => void;
  token: string;
  apiBaseUrl: string;
};

type Status = {
  otp_verified: boolean;
  face_status: 'unverified' | 'pending' | 'verified' | 'failed';
  age_verified: boolean;
  location_verified: boolean;
  location_lat?: number;
  location_lng?: number;
  location_city?: string;
};

export const VerificationScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [selfiePayload, setSelfiePayload] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  const getStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/verification/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Unable to fetch status');
      const data = await response.json();
      setStatus(data.status);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to fetch status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getStatus().catch((err) => console.warn('Failed to load verification status:', err));
  }, []);

  const captureSelfie = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow camera access to verify your selfie.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.7,
        base64: Platform.OS !== 'web',
        cameraType: ImagePicker.CameraType.front,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const payload = Platform.OS === 'web'
        ? asset.uri
        : (asset.base64 ? `data:${asset.type || 'image/jpeg'};base64,${asset.base64}` : asset.uri);
      setSelfiePayload(payload);
      setSelfiePreview(asset.uri);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to capture selfie');
    }
  };

  const verifySelfie = async () => {
    if (!selfiePayload) {
      Alert.alert('Selfie required', 'Please capture a selfie first.');
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/verification/selfie`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ photo_url: selfiePayload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to verify selfie');
      await getStatus();
      Alert.alert('Verified', 'Photo and age verification completed.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to verify selfie');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Verification" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={theme.colors.brand} /> : null}

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">Status</Typography>
          <Typography variant="small" muted>
            Face: {status?.face_status || 'unverified'} | Age: {status?.age_verified ? 'Verified' : 'Unverified'}
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="h2">Photo & age verification</Typography>
          <Typography variant="small" muted>
            Use a clear front-face selfie. AI verifies 18+ and matches it with your profile photo.
          </Typography>
          {selfiePreview ? (
            <Image source={{ uri: selfiePreview }} style={styles.selfiePreview} />
          ) : (
            <View style={[styles.selfiePlaceholder, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <Feather name="camera" size={26} color={theme.colors.muted} />
              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 8 }}>
                No selfie selected
              </Typography>
            </View>
          )}
          <View style={styles.row}>
            <Button label="Capture selfie" onPress={captureSelfie} />
          </View>
          <Button label="Verify selfie" onPress={verifySelfie} />
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">Why verify?</Typography>
          <Typography variant="small" muted>
            Builds trust with matches, reduces spam, and improves your ranking.
          </Typography>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  step: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  selfiePlaceholder: {
    height: 180,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfiePreview: {
    width: '100%',
    height: 240,
    borderRadius: 14,
    backgroundColor: '#111',
  },
});
