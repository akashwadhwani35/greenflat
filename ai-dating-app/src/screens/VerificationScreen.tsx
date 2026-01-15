import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeProvider';

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
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [lastOtp, setLastOtp] = useState<string | null>(null);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [city, setCity] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');

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
    getStatus().catch(() => {});
  }, []);

  const requestOtp = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/verification/otp/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to send OTP');
      setLastOtp(data.demo_code || null);
      Alert.alert('OTP sent', 'Check SMS (demo shows code inline).');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to send OTP');
    }
  };

  const verifyOtp = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/verification/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone, code: otp }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to verify');
      setStatus(data.status);
      Alert.alert('Verified', 'Your phone is verified.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to verify OTP');
    }
  };

  const startFace = async () => {
    await fetch(`${apiBaseUrl}/verification/face/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    Alert.alert('Started', 'Face verification started (demo).');
  };

  const completeFace = async (success = true) => {
    await fetch(`${apiBaseUrl}/verification/face/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ success, age_verified: true }),
    }).catch(() => {});
    await getStatus();
    Alert.alert(success ? 'Verified' : 'Failed', success ? 'Face verified.' : 'Face verification failed.');
  };

  const verifyLocation = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/verification/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lat: Number(lat), lng: Number(lng), city: city || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to verify location');
      await getStatus();
      Alert.alert('Location verified', 'Your location was recorded.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to verify location');
    }
  };

  const verifySelfie = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/verification/selfie`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ photo_url: selfieUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to verify selfie');
      await getStatus();
      Alert.alert('Verified', 'Selfie verified as 18+.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to verify selfie');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconButton} accessibilityRole="button">
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h1">Verification</Typography>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={theme.colors.brand} /> : null}

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="bodyStrong">Status</Typography>
          <Typography variant="small" muted>
            Phone: {status?.otp_verified ? 'Verified' : 'Unverified'} | Face: {status?.face_status || 'unverified'} | Location:{' '}
            {status?.location_verified ? status.location_city || 'verified' : 'unverified'}
          </Typography>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="h2">Phone verification</Typography>
          <TextInput
            placeholder="Phone (+1 555...)"
            value={phone}
            onChangeText={setPhone}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholderTextColor={theme.colors.muted}
            keyboardType="phone-pad"
          />
          <View style={styles.row}>
            <Button label="Send OTP" onPress={requestOtp} />
            {lastOtp ? (
              <Typography variant="tiny" muted>
                demo code: {lastOtp}
              </Typography>
            ) : null}
          </View>
          <TextInput
            placeholder="OTP"
            value={otp}
            onChangeText={setOtp}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholderTextColor={theme.colors.muted}
            keyboardType="number-pad"
          />
          <Button label="Verify OTP" onPress={verifyOtp} />
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="h2">Face & age</Typography>
          <Typography variant="small" muted>
            You can use AI selfie check (18+ estimate) or the demo buttons below.
          </Typography>
          <TextInput
            placeholder="Selfie URL"
            value={selfieUrl}
            onChangeText={setSelfieUrl}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholderTextColor={theme.colors.muted}
          />
          <Button label="Verify selfie (AI)" onPress={verifySelfie} />
          <View style={styles.row}>
            <Button label="Start face check" onPress={startFace} />
            <Button label="Mark verified" onPress={() => completeFace(true)} />
            <Button label="Mark failed" variant="secondary" onPress={() => completeFace(false)} />
          </View>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border }]}>
          <Typography variant="h2">Location</Typography>
          <Typography variant="small" muted>
            Enter coordinates to verify. (Plug real maps/geolocation in production.)
          </Typography>
          <TextInput
            placeholder="Latitude"
            value={lat}
            onChangeText={setLat}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholderTextColor={theme.colors.muted}
            keyboardType="numeric"
          />
          <TextInput
            placeholder="Longitude"
            value={lng}
            onChangeText={setLng}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholderTextColor={theme.colors.muted}
            keyboardType="numeric"
          />
          <TextInput
            placeholder="City (optional)"
            value={city}
            onChangeText={setCity}
            style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
            placeholderTextColor={theme.colors.muted}
          />
          <Button label="Verify location" onPress={verifyLocation} />
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
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F2',
  },
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
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
});
