import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  Image,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { InputField } from '../components/InputField';
import { UnderlineInput } from '../components/UnderlineInput';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

type OnboardingScreenProps = {
  onComplete: (result: { token: string; name: string; userId?: number }) => void;
  onBack?: () => void;
  apiBaseUrl: string;
};

type SlideKey = 'basic' | 'intentions' | 'location' | 'physical' | 'lifestyle' | 'personality' | 'prompts' | 'photos' | 'contact';

type Slide = {
  key: SlideKey;
  title: string;
  subtitle?: string;
};

const slides: Slide[] = [
  { key: 'basic', title: "Let's start with you", subtitle: 'Your name, identity, and age.' },
  { key: 'intentions', title: 'What brings you here?', subtitle: 'Your relationship goals and vibe.' },
  { key: 'location', title: 'Where are you?', subtitle: 'Detect or search your city.' },
  { key: 'physical', title: 'A bit about your look', subtitle: 'Height and body type (optional).' },
  { key: 'lifestyle', title: 'Your lifestyle', subtitle: 'Habits that matter to you.' },
  { key: 'personality', title: 'Show your personality', subtitle: 'Interests and a quick quiz.' },
  { key: 'prompts', title: 'Tell us about yourself', subtitle: 'This helps our AI understand you and find your best match.' },
  { key: 'photos', title: 'Add your photos', subtitle: 'Show the real you.' },
  { key: 'contact', title: 'Secure your profile', subtitle: 'Email or phone + verification.' },
];

const identityOptions = ['She / Her', 'He / Him', 'They / Them', 'Another label'];
const lookingForOptions = ['Friendship', 'Dating', 'Long-term', 'Exploring'];
const bodyTypeOptions = ['Slim', 'Athletic', 'Average', 'Curvy', 'Muscular', 'Plus-size'];
const drinkerOptions = ['Never', 'Social', 'Regular'];
const smokerOptions = ['Never', 'Social', 'Regular'];
const dietOptions = ['Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Other'];
const fitnessOptions = ['Not active', 'Lightly active', 'Active', 'Very active'];
const interestOptions = ['Travel', 'Fitness', 'Music', 'Art', 'Cooking', 'Gaming', 'Reading', 'Sports', 'Movies', 'Technology', 'Photography', 'Dancing'];

const personalityQuestions = [
  { q: 'At a party, I usually:', a: 'Socialize with everyone', b: 'Talk to a few close friends', c: 'Observe and listen', d: 'Leave early' },
  { q: 'I make decisions based on:', a: 'Logic and facts', b: 'Feelings and values', c: 'Gut instinct', d: 'What others think' },
  { q: 'My ideal weekend is:', a: 'Adventure and excitement', b: 'Relaxing at home', c: 'Trying something new', d: 'Time with loved ones' },
  { q: 'When facing a problem, I:', a: 'Analyze all options', b: 'Ask for advice', c: 'Go with my instinct', d: 'Sleep on it' },
  { q: 'I value most:', a: 'Honesty', b: 'Loyalty', c: 'Kindness', d: 'Ambition' },
  { q: 'In relationships, I need:', a: 'Independence', b: 'Quality time', c: 'Deep conversations', d: 'Physical affection' },
  { q: 'My communication style is:', a: 'Direct and clear', b: 'Thoughtful and careful', c: 'Playful and light', d: 'Emotional and expressive' },
  { q: 'I handle conflict by:', a: 'Addressing it immediately', b: 'Taking time to process', c: 'Compromising', d: 'Avoiding when possible' },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete, onBack, apiBaseUrl }) => {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [citySuggestions, setCitySuggestions] = useState<{ city: string; lat?: number; lng?: number }[]>([]);

  const [form, setForm] = useState({
    // Basic
    name: '',
    identity: '',
    dateOfBirth: '',

    // Intentions
    lookingFor: [] as string[],
    vibe: '',

    // Location
    city: '',
    lat: null as number | null,
    lng: null as number | null,
    useCurrentCity: false,

    // Physical
    height: '',
    bodyType: '',

    // Lifestyle
    smoker: 'Never' as 'Never' | 'Social' | 'Regular',
    drinker: 'Social' as 'Never' | 'Social' | 'Regular',
    diet: '',
    fitnessLevel: '',

    // Personality
    interests: [] as string[],
    q1: '', q2: '', q3: '', q4: '', q5: '', q6: '', q7: '', q8: '',

    // Prompts
    bio: '',
    prompt1: '',
    prompt2: '',
    prompt3: '',

    // Photos
    photos: [] as string[],
    primaryPhotoIndex: 0,

    // Contact
    contactValue: '',
    contactType: 'email' as 'email' | 'phone',
    otp: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());
  const isValidPhone = (value: string) => /^[0-9+()\-\s]{8,}$/.test(value.trim());

  const progress = (step + 1) / slides.length;

  const maximumDOB = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date;
  }, []);

  const transition = useRef(new Animated.Value(1)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDatePicker = () => {
    const initial = form.dateOfBirth ? new Date(form.dateOfBirth) : maximumDOB;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode: 'date',
        value: initial,
        maximumDate: maximumDOB,
        onChange: (_, selectedDate) => {
          if (selectedDate) {
            setForm((prev) => ({ ...prev, dateOfBirth: selectedDate.toISOString().slice(0, 10) }));
          }
        },
      });
    } else {
      setShowIOSPicker(true);
    }
  };

  const toggleArrayValue = (array: string[], value: string) => {
    return array.includes(value) ? array.filter(v => v !== value) : [...array, value];
  };

  const validateStep = (): boolean => {
    const current = slides[step].key;
    const nextErrors: Record<string, string> = {};

    switch (current) {
      case 'basic':
        if (!form.name.trim()) nextErrors.name = 'Tell us your name.';
        if (!form.identity) nextErrors.identity = 'Pick how you identify.';
        if (!form.dateOfBirth) nextErrors.dateOfBirth = 'Select your birth date (18+).';
        break;
      case 'intentions':
        if (form.lookingFor.length === 0) nextErrors.lookingFor = 'Choose at least one intention.';
        break;
      case 'location':
        if (!form.city.trim()) nextErrors.city = 'Add your city.';
        break;
      case 'personality':
        if (form.interests.length === 0) nextErrors.interests = 'Pick at least 3 interests.';
        if (!form.q1 || !form.q2 || !form.q3 || !form.q4 || !form.q5 || !form.q6 || !form.q7 || !form.q8) {
          nextErrors.quiz = 'Please answer all personality questions.';
        }
        break;
      case 'prompts':
        if (!form.bio.trim()) nextErrors.bio = 'Write a short bio.';
        break;
      case 'photos':
        if (form.photos.length === 0) nextErrors.photos = 'Add at least one photo.';
        break;
      case 'contact':
        if (!form.contactValue.trim()) {
          nextErrors.contact = 'Add email or phone.';
        } else if (form.contactType === 'email' && !isValidEmail(form.contactValue)) {
          nextErrors.contact = 'That email does not look right.';
        } else if (form.contactType === 'phone' && !isValidPhone(form.contactValue)) {
          nextErrors.contact = 'Add phone with country code.';
        }
        if (form.password.length < 8) {
          nextErrors.password = 'Password must be at least 8 characters.';
        }
        if (form.confirmPassword !== form.password) {
          nextErrors.confirmPassword = 'Passwords do not match.';
        }
        break;
      default:
        break;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const mapIdentityToGender = (identity: string) => {
    if (identity.toLowerCase().includes('she')) return 'female';
    if (identity.toLowerCase().includes('he')) return 'male';
    return 'other';
  };

  const resolveEmail = () => {
    if (form.contactType === 'email') {
      return form.contactValue.trim();
    }
    const digits = form.contactValue.replace(/[^0-9]/g, '');
    return `${digits || 'user'}@phone.greenflag.app`;
  };

  const submitToBackend = async () => {
    const email = resolveEmail();
    const gender = mapIdentityToGender(form.identity || '');
    const interested_in = gender === 'female' ? 'male' : gender === 'male' ? 'female' : 'both';
    const password = form.password;

    const signupResponse = await fetch(`${apiBaseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name: form.name.trim(),
        gender,
        interested_in,
        date_of_birth: form.dateOfBirth,
        city: form.city || 'Unknown',
      }),
    });

    const signupBody = await signupResponse.json().catch(() => ({}));
    let token = signupBody?.token as string | undefined;
    let userId = signupBody?.user?.id as number | undefined;

    if (!signupResponse.ok) {
      const errorMessage = signupBody.error || 'Unable to create your account.';
      if (signupResponse.status === 400 && errorMessage.toLowerCase().includes('already')) {
        const loginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!loginResponse.ok) {
          const loginBody = await loginResponse.json().catch(() => ({}));
          throw new Error(loginBody.error || errorMessage);
        }

        const loginBody = await loginResponse.json();
        token = loginBody.token;
        userId = loginBody.user?.id;
      } else {
        throw new Error(errorMessage);
      }
    }

    if (!token) throw new Error('No token returned from the server.');

    const userHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const profilePayload = {
      height: form.height || null,
      body_type: form.bodyType || null,
      interests: form.interests,
      bio: form.bio,
      prompt1: form.prompt1 || null,
      prompt2: form.prompt2 || null,
      prompt3: form.prompt3 || null,
      smoker: form.smoker.toLowerCase(),
      drinker: form.drinker.toLowerCase(),
      diet: form.diet || 'balanced',
      fitness_level: form.fitnessLevel || 'active',
      education: null,
      occupation: null,
      relationship_goal: form.lookingFor[0]?.toLowerCase() || 'exploring',
      family_oriented: true,
      spiritual: true,
      open_minded: true,
      career_focused: true,
      self_summary: form.bio,
      ideal_partner_prompt: form.prompt1 || form.bio || 'Kind, curious, and communicates well.',
      connection_preferences: form.vibe || 'Open to meaningful connections',
      dealbreakers: 'Poor communication and unkindness.',
      growth_journey: 'Investing in emotional fitness and healthy routines.',
      question1_answer: form.q1 || 'A',
      question2_answer: form.q2 || 'B',
      question3_answer: form.q3 || 'C',
      question4_answer: form.q4 || 'A',
      question5_answer: form.q5 || 'B',
      question6_answer: form.q6 || 'C',
      question7_answer: form.q7 || 'D',
      question8_answer: form.q8 || 'A',
    };

    const completeProfileResponse = await fetch(`${apiBaseUrl}/profile/complete`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify(profilePayload),
    });

    if (!completeProfileResponse.ok) {
      const errorBody = await completeProfileResponse.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Unable to complete your profile.');
    }

    // Upload photos
    for (let i = 0; i < form.photos.length; i++) {
      await fetch(`${apiBaseUrl}/profile/photo`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({ photo_url: form.photos[i], is_primary: i === form.primaryPhotoIndex }),
      }).catch(() => {});
    }

    // Verify location
    if (form.lat !== null && form.lng !== null) {
      await fetch(`${apiBaseUrl}/verification/location`, {
        method: 'POST',
        headers: userHeaders,
        body: JSON.stringify({ lat: form.lat, lng: form.lng, city: form.city || undefined }),
      }).catch(() => {});
    }

    return { token, userId };
  };

  const handleContinue = async () => {
    Keyboard.dismiss();
    if (!validateStep()) return;

    if (step === slides.length - 1) {
      setLoading(true);
      try {
        const result = await submitToBackend();
        onComplete({ token: result.token, name: form.name.trim(), userId: result.userId });
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Something went wrong finishing setup.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setStep((prev) => Math.min(prev + 1, slides.length - 1));
  };

  const handleBack = () => {
    if (step === 0) {
      onBack?.();
      return;
    }
    setStep((prev) => prev - 1);
  };

  const selectPhoto = async () => {
    try {
      console.log('Photo picker initiated...');

      // Request permission
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Permission status:', perm.granted);

      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to add your photo.');
        return;
      }

      console.log('Launching image picker...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.7,
        base64: Platform.OS !== 'web', // Don't use base64 on web
      });

      console.log('Image picker result:', { canceled: result.canceled, assetsLength: result.assets?.length });

      if (result.canceled || !result.assets?.length) {
        console.log('Image picker was cancelled or no assets');
        return;
      }

      const asset = result.assets[0];
      console.log('Selected asset:', { uri: asset.uri, type: asset.type });

      // On web, just use the URI directly; on mobile, use base64
      const dataUrl = Platform.OS === 'web'
        ? asset.uri
        : (asset.base64 ? `data:${asset.type || 'image/jpeg'};base64,${asset.base64}` : asset.uri);

      console.log('Adding photo to form...');
      setForm((prev) => ({ ...prev, photos: [...prev.photos, dataUrl] }));
      console.log('Photo added successfully');
    } catch (error: any) {
      console.error('Photo picker error:', error);
      Alert.alert('Error', `Could not pick a photo: ${error.message || 'Please try again.'}`);
    }
  };

  const selectCurrentLocation = async () => {
    try {
      setLoading(true);
      setLocationError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Please enter manually.');
        setLoading(false);
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationError('Location services are off. Turn on location (GPS) or enter your city manually.');
        Alert.alert('Turn on Location', 'Enable Location services to detect your city automatically.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
        ]);
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      });

      const { latitude, longitude } = location.coords;

      // Use backend geocoding directly (skip Expo to avoid rate limits)
      try {
        console.log('Attempting backend geocoding with:', { lat: latitude, lng: longitude, apiBaseUrl });
        const response = await fetch(`${apiBaseUrl}/geocode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: latitude, lng: longitude }),
        });

        console.log('Backend response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('Backend geocoding success:', data);
          const detectedCity = data.city;
          if (detectedCity) {
            setForm((prev) => ({
              ...prev,
              city: detectedCity,
              useCurrentCity: true,
              lat: latitude,
              lng: longitude,
            }));
            return;
          }
        } else {
          const errorData = await response.json();
          console.log('Backend geocoding error:', errorData);
          setLocationError(`Backend error: ${errorData.error || 'Unknown error'}. Please enter manually.`);
          return;
        }
      } catch (backendError: any) {
        console.log('Backend geocoding failed:', backendError);
        setLocationError(`Network error: ${backendError.message}. Check if backend is running.`);
        return;
      }

      // If no city was returned
      setLocationError('Could not detect city name. Please enter manually.');
    } catch (error: any) {
      console.error('Location detection error:', error);
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('unavailable') || message.includes('provider')) {
        setLocationError('Current location is unavailable. Turn on location services or enter your city manually.');
      } else {
        setLocationError(`Error: ${error.message}. Please enter manually.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCityChange = (text: string) => {
    setForm((prev) => ({ ...prev, city: text, useCurrentCity: false }));
    setLocationError(null);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (text.trim().length < 2) {
      setCitySuggestions([]);
      return;
    }

    // Debounce: wait 500ms after user stops typing
    timeoutRef.current = setTimeout(() => {
      void geocodeCityFromTextValue(text.trim(), true);
    }, 500);
  };

  const geocodeCityFromText = async () => {
    return geocodeCityFromTextValue(form.city, false);
  };

  const geocodeCityFromTextValue = async (text: string, silent?: boolean) => {
    if (!text.trim()) {
      if (!silent) setLocationError('Enter a city to verify with Maps.');
      return;
    }
    try {
      // Don't show loading spinner for silent autocomplete requests
      if (!silent) {
        setLoading(true);
      }
      setLocationError(null);

      const response = await fetch(`${apiBaseUrl}/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (!silent) throw new Error(data.error || 'Unable to verify city');
        return;
      }

      // Only show suggestions, don't auto-fill the city
      if (data.suggestions && data.suggestions.length > 0) {
        setCitySuggestions(data.suggestions);
      } else {
        setCitySuggestions([]);
      }
    } catch (error: any) {
      if (!silent) setLocationError(error.message || 'Unable to verify city');
      setCitySuggestions([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step, transition]);

  const renderChipRow = (options: string[], selectedValues: string[], toggle: (option: string) => void, multiSelect = true) => (
    <View style={styles.chipRow}>
      {options.map((option) => (
        <Chip
          key={option}
          label={option}
          selected={selectedValues.includes(option)}
          onPress={() => toggle(option)}
        />
      ))}
    </View>
  );

  const renderSlide = () => {
    const current = slides[step].key;

    switch (current) {
      case 'basic':
        return (
          <View style={styles.slideStack}>
            <View style={[styles.card, { backgroundColor: '#101D13' }]}>
              <UnderlineInput
                placeholder="Your name"
                value={form.name}
                onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
                autoCapitalize="words"
                error={errors.name}
              />
              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 16 }}>How do you identify?</Typography>
              {renderChipRow(identityOptions, form.identity ? [form.identity] : [], (option) =>
                setForm((prev) => ({ ...prev, identity: option }))
              , false)}
              {errors.identity ? <Typography variant="small" tone="error">{errors.identity}</Typography> : null}

              <TouchableOpacity
                style={[styles.dateButton, {
                  borderColor: form.dateOfBirth ? theme.colors.neonGreen : theme.colors.borderLight,
                  marginTop: 16
                }]}
                onPress={openDatePicker}
              >
                <Feather name="calendar" size={20} color={theme.colors.neonGreen} />
                <Typography variant="body" style={{ flex: 1, color: form.dateOfBirth ? theme.colors.neonGreen : theme.colors.muted }}>
                  {form.dateOfBirth ? form.dateOfBirth : 'Select your birth date (18+)'}
                </Typography>
              </TouchableOpacity>
              {errors.dateOfBirth ? <Typography variant="small" tone="error">{errors.dateOfBirth}</Typography> : null}
              {showIOSPicker ? (
                <View style={{ backgroundColor: theme.colors.neonGreen, borderRadius: theme.radius.md, padding: 12, marginTop: 8 }}>
                  <DateTimePicker
                    mode="date"
                    display="spinner"
                    value={form.dateOfBirth ? new Date(form.dateOfBirth) : maximumDOB}
                    maximumDate={maximumDOB}
                    themeVariant="light"
                    accentColor={theme.colors.deepBlack}
                    textColor={theme.colors.deepBlack}
                    onChange={(_, date) => {
                      setShowIOSPicker(false);
                      if (date) {
                        setForm((prev) => ({ ...prev, dateOfBirth: date.toISOString().slice(0, 10) }));
                      }
                    }}
                  />
                </View>
              ) : null}
            </View>
          </View>
        );

      case 'intentions':
        return (
          <View style={styles.slideStack}>
            <View style={[styles.card, { backgroundColor: '#101D13' }]}>
              <Typography variant="body" style={{ color: theme.colors.muted }}>What are you looking for?</Typography>
              {renderChipRow(lookingForOptions, form.lookingFor, (option) =>
                setForm((prev) => ({ ...prev, lookingFor: toggleArrayValue(prev.lookingFor, option) }))
              )}
              {errors.lookingFor ? <Typography variant="small" tone="error">{errors.lookingFor}</Typography> : null}

              <View style={{ marginTop: 16 }}>
                <View style={{ marginBottom: 0 }}>
                  <UnderlineInput
                    placeholder="One line about your vibe (optional)"
                    value={form.vibe}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, vibe: text }))}
                    multiline
                  />
                </View>
                <Typography variant="tiny" style={{ color: theme.colors.muted, marginTop: -18, fontStyle: 'italic' }}>
                  e.g., "Weekend hiker who loves spontaneous road trips" or "Deep conversations over coffee"
                </Typography>
              </View>
            </View>
          </View>
        );

      case 'location':
        return (
          <View style={styles.slideStack}>
            <View style={[styles.card, { backgroundColor: '#101D13' }]}>
              {/* If location not detected yet */}
              {!form.city || form.lat === null ? (
                <>
                  {/* Large centered map icon */}
                  <View style={styles.locationIconWrapper}>
                    <View style={[styles.locationIconLarge, { backgroundColor: theme.colors.neonGreen }]}>
                      <Feather name="map-pin" size={64} color={theme.colors.deepBlack} />
                    </View>
                  </View>

                  <Typography variant="h1" style={{ color: theme.colors.text, textAlign: 'center', marginTop: 24, marginBottom: 12 }}>
                    Enable Location
                  </Typography>

                  <Typography variant="body" style={{ color: theme.colors.muted, textAlign: 'center', marginBottom: 32, paddingHorizontal: 16 }}>
                    We need your location to find the best matches near you. Your exact location is never shared with other users.
                  </Typography>

                  <View style={{ width: '100%', marginBottom: 8 }}>
                    <UnderlineInput
                      placeholder="Enter your city manually"
                      value={form.city}
                      onChangeText={handleCityChange}
                      autoCapitalize="words"
                      error={errors.city}
                    />
                    {citySuggestions.length > 0 ? (
                      <View style={[styles.suggestionsPanel, { borderColor: theme.colors.borderLight }]}>
                        {citySuggestions.map((s) => (
                          <TouchableOpacity
                            key={`${s.city}-${s.lat ?? 'na'}-${s.lng ?? 'na'}`}
                            style={styles.suggestionRow}
                            onPress={() => {
                              setForm((prev) => ({
                                ...prev,
                                city: s.city,
                                lat: typeof s.lat === 'number' ? s.lat : prev.lat,
                                lng: typeof s.lng === 'number' ? s.lng : prev.lng,
                                useCurrentCity: false,
                              }));
                              setCitySuggestions([]);
                              setLocationError(null);
                              setErrors((prev) => ({ ...prev, city: '' }));
                            }}
                          >
                            <Feather name="map-pin" size={14} color={theme.colors.neonGreen} />
                            <Typography variant="small" style={{ color: theme.colors.text, marginLeft: 10, flex: 1 }}>
                              {s.city}
                            </Typography>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                  </View>

                  {locationError && (
                    <View style={[styles.errorBanner, { backgroundColor: 'rgba(255, 107, 107, 0.1)', borderColor: theme.colors.error }]}>
                      <Feather name="alert-circle" size={18} color={theme.colors.error} />
                      <Typography variant="small" style={{ color: theme.colors.error, marginLeft: 10, flex: 1 }}>
                        {locationError}
                      </Typography>
                    </View>
                  )}
                </>
              ) : (
                <>
                  {/* Location detected - show success state */}
                  <View style={styles.locationIconWrapper}>
                    <View style={[styles.locationIconLarge, { backgroundColor: 'rgba(188, 246, 65, 0.15)' }]}>
                      <Feather name="map-pin" size={64} color={theme.colors.neonGreen} />
                    </View>
                  </View>

                  <View style={[styles.locationSuccessCard, { backgroundColor: 'rgba(188, 246, 65, 0.1)', borderColor: theme.colors.neonGreen }]}>
                    <Feather name="check-circle" size={24} color={theme.colors.neonGreen} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
                        Location Detected
                      </Typography>
                      <Typography variant="body" style={{ color: theme.colors.muted, marginTop: 4 }}>
                        {form.city}
                      </Typography>
                    </View>
                  </View>

                  <Typography variant="small" style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 24 }}>
                    We'll use this to find matches near you
                  </Typography>

                  {/* Option to change location */}
                  <TouchableOpacity
                    style={styles.changeLocationButton}
                    onPress={selectCurrentLocation}
                    disabled={loading}
                  >
                    <Feather name="refresh-cw" size={16} color={theme.colors.neonGreen} />
                    <Typography variant="small" style={{ color: theme.colors.neonGreen, marginLeft: 8 }}>
                      {loading ? 'Detecting...' : 'Detect Again'}
                    </Typography>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        );

      case 'physical':
        return (
          <View style={styles.slideStack}>
            <View style={[styles.card, { backgroundColor: '#101D13' }]}>
              <UnderlineInput
                placeholder="Height (e.g., 5'8 or 173cm)"
                value={form.height}
                onChangeText={(text) => setForm((prev) => ({ ...prev, height: text }))}
              />
              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 16 }}>Body type (optional)</Typography>
              {renderChipRow(bodyTypeOptions, form.bodyType ? [form.bodyType] : [], (option) =>
                setForm((prev) => ({ ...prev, bodyType: option }))
              , false)}
            </View>
          </View>
        );

      case 'lifestyle':
        return (
          <View style={styles.slideStack}>
            <View style={[styles.card, { backgroundColor: '#101D13' }]}>
              <View style={{ gap: 20 }}>
                <View>
                  <Typography variant="small" style={{ color: theme.colors.muted }}>Smoking habits</Typography>
                  {renderChipRow(smokerOptions, [form.smoker], (option) =>
                    setForm((prev) => ({ ...prev, smoker: option as 'Never' | 'Social' | 'Regular' }))
                  , false)}
                </View>

                <View>
                  <Typography variant="small" style={{ color: theme.colors.muted }}>Drinking habits</Typography>
                  {renderChipRow(drinkerOptions, [form.drinker], (option) =>
                    setForm((prev) => ({ ...prev, drinker: option as any }))
                  , false)}
                </View>

                <View>
                  <Typography variant="small" style={{ color: theme.colors.muted }}>Diet</Typography>
                  {renderChipRow(dietOptions, form.diet ? [form.diet] : [], (option) =>
                    setForm((prev) => ({ ...prev, diet: option }))
                  , false)}
                </View>

                <View>
                  <Typography variant="small" style={{ color: theme.colors.muted }}>Fitness level</Typography>
                  {renderChipRow(fitnessOptions, form.fitnessLevel ? [form.fitnessLevel] : [], (option) =>
                    setForm((prev) => ({ ...prev, fitnessLevel: option }))
                  , false)}
                </View>
              </View>
            </View>
          </View>
        );

      case 'personality':
        return (
          <View style={styles.slideStack}>
            <View style={[styles.card, { backgroundColor: '#101D13' }]}>
              <Typography variant="body" style={{ color: theme.colors.muted }}>Pick your interests (at least 3)</Typography>
              {renderChipRow(interestOptions, form.interests, (option) =>
                setForm((prev) => ({ ...prev, interests: toggleArrayValue(prev.interests, option) }))
              )}
              {errors.interests ? <Typography variant="small" tone="error">{errors.interests}</Typography> : null}
            </View>

            <View style={[styles.card, { backgroundColor: '#101D13', marginTop: 16 }]}>
              <Typography variant="h2" style={{ color: theme.colors.text, marginBottom: 16 }}>Quick Personality Quiz</Typography>
              {personalityQuestions.map((pq, idx) => (
                <View key={idx} style={{ marginBottom: 20 }}>
                  <Typography variant="small" style={{ color: theme.colors.text, marginBottom: 8 }}>{idx + 1}. {pq.q}</Typography>
                  <View style={styles.quizOptions}>
                    {['a', 'b', 'c', 'd'].map((opt) => {
                      const qKey = `q${idx + 1}` as keyof typeof form;
                      const isSelected = form[qKey] === opt.toUpperCase();
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => setForm((prev) => ({ ...prev, [qKey]: opt.toUpperCase() }))}
                          style={[
                            styles.quizOption,
                            {
                              backgroundColor: isSelected ? theme.colors.neonGreen : theme.colors.surfaceLight,
                              borderColor: isSelected ? theme.colors.neonGreen : theme.colors.border,
                            }
                          ]}
                        >
                          <Typography variant="tiny" style={{ color: isSelected ? theme.colors.deepBlack : theme.colors.text }}>
                            {pq[opt as 'a' | 'b' | 'c' | 'd']}
                          </Typography>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
              {errors.quiz ? <Typography variant="small" tone="error">{errors.quiz}</Typography> : null}
            </View>
          </View>
        );

      case 'prompts':
        return (
          <View style={styles.slideStack}>
            <View style={[styles.card, { backgroundColor: '#101D13' }]}>
              <Typography variant="body" style={{ color: theme.colors.muted }}>
                Tell us about yourself so AI can find your best match.
              </Typography>
              <TextInput
                style={[styles.bioCardInput, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Write a short bio about yourself..."
                placeholderTextColor={theme.colors.muted}
                value={form.bio}
                onChangeText={(text) => setForm((prev) => ({ ...prev, bio: text }))}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={500}
              />
              <Typography variant="small" style={{ color: theme.colors.muted, textAlign: 'right' }}>
                {form.bio.length}/500
              </Typography>
              {errors.bio ? <Typography variant="small" tone="error">{errors.bio}</Typography> : null}

              <TextInput
                style={[styles.bioCardInput, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Prompt 1: My ideal date is..."
                placeholderTextColor={theme.colors.muted}
                value={form.prompt1}
                onChangeText={(text) => setForm((prev) => ({ ...prev, prompt1: text }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={240}
              />

              <TextInput
                style={[styles.bioCardInput, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Prompt 2: I'm known for..."
                placeholderTextColor={theme.colors.muted}
                value={form.prompt2}
                onChangeText={(text) => setForm((prev) => ({ ...prev, prompt2: text }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={240}
              />

              <TextInput
                style={[styles.bioCardInput, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Prompt 3: My perfect weekend..."
                placeholderTextColor={theme.colors.muted}
                value={form.prompt3}
                onChangeText={(text) => setForm((prev) => ({ ...prev, prompt3: text }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={240}
              />
            </View>
          </View>
        );

      case 'photos':
        return (
          <View style={styles.slideStack}>
            <View style={[styles.card, { backgroundColor: '#101D13' }]}>
              <View style={styles.photoGrid}>
                {form.photos.map((photo, idx) => (
                  <View key={idx} style={styles.photoItem}>
                    <Image source={{ uri: photo }} style={styles.photoImage} />
                    <TouchableOpacity
                      style={[styles.photoRemove, { backgroundColor: theme.colors.error }]}
                      onPress={() => setForm((prev) => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))}
                    >
                      <Feather name="x" size={16} color="#FFF" />
                    </TouchableOpacity>
                    {idx === form.primaryPhotoIndex && (
                      <View style={[styles.primaryBadge, { backgroundColor: theme.colors.neonGreen }]}>
                        <Typography variant="tiny" style={{ color: theme.colors.deepBlack, fontWeight: '600' }}>Primary</Typography>
                      </View>
                    )}
                  </View>
                ))}
                <TouchableOpacity style={[styles.photoAdd, { borderColor: theme.colors.neonGreen }]} onPress={selectPhoto}>
                  <Feather name="plus" size={32} color={theme.colors.neonGreen} />
                  <Typography variant="small" style={{ color: theme.colors.neonGreen, marginTop: 8 }}>Add Photo</Typography>
                </TouchableOpacity>
              </View>
              {errors.photos ? <Typography variant="small" tone="error">{errors.photos}</Typography> : null}
            </View>
          </View>
        );

      case 'contact':
        return (
          <View style={styles.slideStack}>
            <View style={[styles.card, { backgroundColor: '#101D13' }]}>
              <Typography variant="body" style={{ color: theme.colors.muted, marginBottom: 16 }}>
                We'll send you a verification code
              </Typography>

              {/* Contact Type Selection */}
              <View style={styles.chipRow}>
                <Chip label="Email" selected={form.contactType === 'email'} onPress={() => setForm((prev) => ({ ...prev, contactType: 'email', contactValue: '', otp: '' }))} />
                <Chip label="Phone" selected={form.contactType === 'phone'} onPress={() => setForm((prev) => ({ ...prev, contactType: 'phone', contactValue: '', otp: '' }))} />
              </View>

              {/* Contact Input */}
                <UnderlineInput
                  placeholder={form.contactType === 'email' ? 'you@example.com' : '+1 234 567 8900'}
                  keyboardType={form.contactType === 'email' ? 'email-address' : 'phone-pad'}
                  value={form.contactValue}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, contactValue: text }))}
                  error={errors.contact}
                  style={{ marginTop: 16 }}
                />

              <UnderlineInput
                placeholder="Create password"
                value={form.password}
                onChangeText={(text) => setForm((prev) => ({ ...prev, password: text }))}
                secureTextEntry
                error={errors.password}
                style={{ marginTop: 12 }}
              />

              <UnderlineInput
                placeholder="Confirm password"
                value={form.confirmPassword}
                onChangeText={(text) => setForm((prev) => ({ ...prev, confirmPassword: text }))}
                secureTextEntry
                error={errors.confirmPassword}
                style={{ marginTop: 12 }}
              />

              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 16 }}>
                You can complete phone OTP and selfie verification in Verification after signup.
              </Typography>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const animatedContentStyle = {
    opacity: transition,
    transform: [
      {
        translateY: transition.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={[
              styles.backButton,
              { borderColor: theme.colors.neonGreen }
            ]}
            disabled={step === 0 && !onBack}
          >
            <Feather name="chevron-left" size={28} color={theme.colors.neonGreen} />
          </TouchableOpacity>

          <View style={styles.progressInfo}>
            <Typography variant="small" style={{ color: theme.colors.muted }}>
              Step {step + 1} of {slides.length}
            </Typography>
            <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.colors.neonGreen }]} />
            </View>
          </View>
        </View>

        {/* Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.stage}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
          >
            <Animated.View style={[styles.contentColumn, animatedContentStyle]}>
              <View style={styles.titleSection}>
                <Typography variant="display" style={{ color: theme.colors.text }}>
                  {slides[step].title}
                </Typography>
                {slides[step].subtitle ? (
                  <Typography variant="body" style={{ color: theme.colors.muted, marginTop: 8 }}>
                    {slides[step].subtitle}
                  </Typography>
                ) : null}
              </View>

              <View style={styles.formSection}>{renderSlide()}</View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: theme.colors.background }]}>
        <Button
          label={
            loading
              ? 'Please wait…'
              : slides[step].key === 'location' && !form.city.trim()
              ? 'Use my current location'
              : step === slides.length - 1
              ? "Let's begin"
              : 'Continue'
          }
          onPress={slides[step].key === 'location' && !form.city.trim() ? selectCurrentLocation : handleContinue}
          fullWidth
          disabled={loading}
          loading={loading}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 16 : 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressInfo: {
    flex: 1,
    gap: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  stage: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  contentColumn: {
    width: '100%',
  },
  titleSection: {
    marginBottom: 24,
  },
  formSection: {
    gap: 16,
  },
  slideStack: {
    gap: 16,
  },
  card: {
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  quizOptions: {
    gap: 8,
  },
  quizOption: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  bioCardInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 150,
    fontFamily: 'RedHatDisplay_400Regular',
    marginTop: 10,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoAdd: {
    width: 100,
    height: 100,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIconWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  locationIconLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ADFF1A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  locationSuccessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    marginTop: 24,
  },
  changeLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  suggestionsPanel: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sendOtpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    marginTop: 16,
    shadowColor: '#ADFF1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 16,
  },
});
