import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { toUploadableDataUrl } from '../utils/image';
import { Button } from '../components/Button';
import { InputField } from '../components/InputField';
import { UnderlineInput } from '../components/UnderlineInput';
import { Chip } from '../components/Chip';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

type OnboardingScreenProps = {
  onComplete: (result: { token: string; name: string; userId?: number }) => void;
  onBack?: () => void;
  apiBaseUrl: string;
  /** When provided (e.g. Google OAuth), skip the contact/password step. */
  existingToken?: string | null;
  existingUserId?: number | null;
};

type SlideKey =
  | 'basic'
  | 'intentions'
  | 'location'
  | 'understand'
  | 'prompts'
  | 'world'
  | 'photos'
  | 'optional'
  | 'safety';

type Slide = {
  key: SlideKey;
  title: string;
  subtitle?: string;
};

const allSlides: Slide[] = [
  { key: 'basic', title: 'Tell about yourself', subtitle: 'Name, birthday, and how you identify.' },
  { key: 'intentions', title: "Who I'm looking for", subtitle: 'Who you want to meet, and what for.' },
  { key: 'location', title: 'Where', subtitle: 'Your city and how far you will travel.' },
  { key: 'understand', title: 'Understand me', subtitle: 'Ten situations. Pick what you would actually do.' },
  { key: 'prompts', title: 'Tell me more', subtitle: 'In your own words. This is what our AI reads.' },
  { key: 'world', title: 'My world', subtitle: 'What you spend your time on.' },
  { key: 'photos', title: 'Show me', subtitle: 'Photos of you, not your holiday.' },
  { key: 'optional', title: 'Optional details', subtitle: 'Skip anything you would rather not say.' },
  { key: 'safety', title: 'Safety', subtitle: 'A quick face check keeps GreenFlag real.' },
];

const lookingForOptions = ['Friendship', 'Dating', 'Long-term', 'Exploring'];
const bodyTypeOptions = ['Slim', 'Athletic', 'Average', 'Curvy', 'Muscular', 'Plus-size'];
const drinkerOptions = ['Never', 'Social', 'Regular'];
const smokerOptions = ['Never', 'Social', 'Regular'];
const dietOptions = ['Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Other'];
const fitnessOptions = ['Not active', 'Lightly active', 'Active', 'Very active'];
const interestedInOptions = ['Men', 'Women', 'Everyone'];
const genderOptions = ['Woman', 'Man', 'Non-binary'];
const orientationOptions = ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Queer', 'Asexual', 'Prefer not to say'];
const pronounOptions = ['she/her', 'he/him', 'they/them', 'ze/zir', 'xe/xim', 'ey/em'];
const drugsOptions = ['Never', 'Sometimes', 'Regularly'];
// Board step 3 is "Location + distance". Values are km; the widest is a
// practical stand-in for "anywhere" without needing a separate flag.
const distanceOptions = [
  { label: '10 km', value: 10 },
  { label: '25 km', value: 25 },
  { label: '50 km', value: 50 },
  { label: '100 km', value: 100 },
  { label: 'Anywhere', value: 20000 },
];
const interestOptions = ['Travel', 'Fitness', 'Music', 'Art', 'Cooking', 'Gaming', 'Reading', 'Sports', 'Movies', 'Technology', 'Photography', 'Dancing'];

/**
 * The quiz is fetched from GET /api/personality/questions rather than hardcoded.
 *
 * The server owns the bank because it also owns the trait mapping each answer
 * implies; a second copy here would drift the first time a question was reworded,
 * and answers would then be scored against the wrong traits.
 */
type QuizQuestion = {
  number: number;
  prompt: string;
  options: { key: string; label: string }[];
};


export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete, onBack, apiBaseUrl, existingToken, existingUserId }) => {
  const theme = useTheme();
  // Skip the contact step when the user already has an account (e.g. Google OAuth)
  // Every step is shown. Account creation happens before onboarding now, in the
  // signup funnel, so there is no longer a contact/password step to drop for
  // users who arrived already signed in.
  const slides = allSlides;
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [citySuggestions, setCitySuggestions] = useState<{ city: string; label?: string; level?: 'city' | 'state'; lat?: number; lng?: number }[]>([]);
  // Maps lookup answered with a server error: let a typed city through rather than block signup.
  const [mapsUnavailable, setMapsUnavailable] = useState(false);

  const [form, setForm] = useState({
    // Basic
    name: '',
    gender: '' as '' | 'male' | 'female' | 'other',
    pronouns: [] as string[],
    interestedIn: '' as '' | 'male' | 'female' | 'both',
    orientation: '',
    dateOfBirth: '',

    // Intentions
    lookingFor: [] as string[],
    vibe: '',

    // Location
    city: '',
    lat: null as number | null,
    lng: null as number | null,
    useCurrentCity: false,
    // True once the city came from GPS or was picked from the suggestions.
    cityConfirmed: false,
    distanceRadius: 50,

    // Physical
    height: '',
    bodyType: '',

    // Lifestyle
    // Nothing pre-selected: an unanswered question is not "Never".
    smoker: '' as '' | 'Never' | 'Social' | 'Regular',
    drinker: '' as '' | 'Never' | 'Social' | 'Regular',
    drugs: '',
    diet: '',
    fitnessLevel: '',

    // Personality. Keyed by question number so the bank can grow without
    // touching this shape.
    interests: [] as string[],
    // Up to two option keys per question, e.g. ['A'] or ['A','C'].
    answers: {} as Record<number, string[]>,

    // Prompts
    bio: '',
    prompt1: '',
    prompt2: '',
    prompt3: '',

    // Photos
    photos: [] as string[],
    primaryPhotoIndex: 0,

    // Safety
    faceCheckPhoto: '' as string,
    faceCheckSkipped: false,
  });

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  // Which question is on screen. The quiz shows one at a time.
  const [quizIndex, setQuizIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [questionsError, setQuestionsError] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Every page starts at the top. Without this the scroll offset from the
  // previous step carried over, so after scrolling down and tapping Continue
  // the next page opened already scrolled to the middle.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step, quizIndex]);

  useEffect(() => {
    let cancelled = false;

    const loadQuestions = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/personality/questions`);
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok || !Array.isArray(data?.questions)) throw new Error('bad payload');
        setQuestions(data.questions);
        setQuestionsError(false);
      } catch {
        if (!cancelled) setQuestionsError(true);
      }
    };

    void loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);



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
        if (!form.gender) nextErrors.gender = 'Pick how you identify.';
        if (!form.dateOfBirth) nextErrors.dateOfBirth = 'Select your birth date (18+).';
        break;
      case 'intentions':
        if (!form.orientation) nextErrors.orientation = 'Pick your orientation.';
        if (!form.interestedIn) nextErrors.interestedIn = "Tell us who you're interested in.";
        if (form.lookingFor.length === 0) nextErrors.lookingFor = 'Choose at least one intention.';
        break;
      case 'location':
        if (!form.city.trim()) nextErrors.city = 'Add your city.';
        // A typed name is not enough: it has to be a real city or state from
        // the list (or GPS), so a country name cannot be saved as a city.
        else if (!form.cityConfirmed && !mapsUnavailable) nextErrors.city = 'Pick your city or state from the list.';
        break;
      case 'understand': {
        if (questions.length === 0) {
          nextErrors.quiz = 'Questions could not load. Check your connection and try again.';
          break;
        }
        const current = questions[quizIndex];
        if (current && (form.answers[current.number]?.length ?? 0) === 0) {
          nextErrors.quiz = 'Pick at least one.';
        }
        break;
      }
      case 'prompts':
        if (!form.bio.trim()) nextErrors.bio = 'Write a short bio.';
        break;
      case 'world':
        if (form.interests.length < 3) nextErrors.interests = 'Pick at least 3 interests.';
        break;
      case 'photos':
        if (form.photos.length === 0) nextErrors.photos = 'Add at least one photo.';
        break;
      // 'optional' and 'safety' are both skippable by design.
      default:
        break;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitToBackend = async (options: { skipFaceCheck?: boolean } = {}) => {
    // Onboarding always runs signed in: the account was created either by the
    // signup funnel or by Google before we ever got here.
    const token = existingToken;
    const userId = existingUserId ?? undefined;

    if (!token) throw new Error('You are not signed in. Please start again.');

    const userHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const profilePayload = {
      // Identity. The signup funnel created the account with placeholders for
      // these; this is where the real values land, and stamping them is what
      // makes the profile eligible to appear in anyone's discovery.
      name: form.name.trim(),
      gender: form.gender,
      interested_in: form.interestedIn,
      date_of_birth: form.dateOfBirth,
      city: form.city || 'Unknown',
      distance_radius: form.distanceRadius,
      orientation: form.orientation || null,
      pronouns: form.pronouns,

      height: form.height ? Number(form.height) : null,
      body_type: form.bodyType || null,
      interests: form.interests,
      bio: form.bio,
      prompt1: form.prompt1 || null,
      prompt2: form.prompt2 || null,
      prompt3: form.prompt3 || null,
      smoker: form.smoker ? form.smoker.toLowerCase() : null,
      drinker: form.drinker ? form.drinker.toLowerCase() : null,
      drugs: form.drugs ? form.drugs.toLowerCase() : null,
      diet: form.diet || null,
      fitness_level: form.fitnessLevel || null,
      education: null,
      occupation: null,
      relationship_goal: form.lookingFor[0]?.toLowerCase() || 'exploring',
      family_oriented: null,
      spiritual: null,
      open_minded: null,
      career_focused: null,
      self_summary: form.bio,
      ideal_partner_prompt: form.prompt1 || null,
      connection_preferences: form.vibe || null,
      dealbreakers: null,
      growth_journey: null,
      ...Object.fromEntries(
        questions.map((question) => [
          `question${question.number}_answer`,
          (form.answers[question.number] || []).join('') || null,
        ])
      ),
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
      try {
        const photoRes = await fetch(`${apiBaseUrl}/profile/photo`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({ photo_url: form.photos[i], is_primary: i === form.primaryPhotoIndex }),
        });
        if (!photoRes.ok) {
          console.warn(`Photo upload ${i + 1} failed: HTTP ${photoRes.status}`);
        }
      } catch (err) {
        console.warn(`Photo upload ${i + 1} error:`, err);
      }
    }

    // Face check, if they took one. Failure here must not fail onboarding: the
    // step is optional by design and can be redone from Verification.
    if (form.faceCheckPhoto && !options.skipFaceCheck) {
      try {
        const faceRes = await fetch(`${apiBaseUrl}/verification/selfie`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({ photo_url: form.faceCheckPhoto }),
        });
        if (!faceRes.ok) {
          console.warn(`Face check failed: HTTP ${faceRes.status}`);
        }
      } catch (err) {
        console.warn('Face check error:', err);
      }
    }

    // Verify location
    if (form.lat !== null && form.lng !== null) {
      try {
        const locRes = await fetch(`${apiBaseUrl}/verification/location`, {
          method: 'POST',
          headers: userHeaders,
          body: JSON.stringify({ lat: form.lat, lng: form.lng, city: form.city || undefined }),
        });
        if (!locRes.ok) {
          console.warn(`Location verification failed: HTTP ${locRes.status}`);
        }
      } catch (err) {
        console.warn('Location verification error:', err);
      }
    }

    return { token, userId };
  };

  const handleContinue = async () => {
    Keyboard.dismiss();
    if (!validateStep()) return;

    // Inside the quiz, Continue means "next question" until the last one.
    if (slides[step].key === 'understand' && quizIndex < questions.length - 1) {
      setQuizIndex((i) => i + 1);
      return;
    }

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

  // "Skip for now" used to only set a flag and leave the person on the
  // screen. It is the last step, so skipping means finishing: no camera, no
  // permission prompt, straight on to the intro slides.
  const skipFaceCheck = async () => {
    Keyboard.dismiss();
    setForm((prev) => ({ ...prev, faceCheckPhoto: '', faceCheckSkipped: true }));
    setLoading(true);
    try {
      const result = await submitToBackend({ skipFaceCheck: true });
      onComplete({ token: result.token, name: form.name.trim(), userId: result.userId });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong finishing setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (slides[step].key === 'understand' && quizIndex > 0) {
      setQuizIndex((i) => i - 1);
      return;
    }
    if (step === 0) {
      onBack?.();
      return;
    }
    setStep((prev) => prev - 1);
  };

  /**
   * Selfie for the face check. Camera rather than library on purpose: a picture
   * chosen from the gallery proves nothing about who is holding the phone.
   */
  const captureFaceCheck = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Camera needed', 'Allow camera access to verify your face, or skip this step.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) return;

      const dataUrl = await toUploadableDataUrl(result.assets[0].uri);
      setForm((prev) => ({ ...prev, faceCheckPhoto: dataUrl, faceCheckSkipped: false }));
    } catch (error: any) {
      console.error('Face check capture error:', error);
      Alert.alert('Error', error.message || 'Could not open the camera. You can skip this step.');
    }
  };

  const selectPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to add your photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      // Downscale before it becomes base64. A full-resolution photo held in
      // state as a string is what was exhausting memory and killing the app at
      // the end of onboarding.
      const dataUrl = await toUploadableDataUrl(asset.uri);

      setForm((prev) => ({ ...prev, photos: [...prev.photos, dataUrl] }));
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
        const response = await fetch(`${apiBaseUrl}/geocode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: latitude, lng: longitude }),
        });

        if (response.ok) {
          const data = await response.json();
          const detectedCity = data.city;
          if (detectedCity) {
            setForm((prev) => ({
              ...prev,
              city: detectedCity,
              useCurrentCity: true,
              cityConfirmed: true,
              lat: latitude,
              lng: longitude,
            }));
            return;
          }
        } else {
          const errorData = await response.json();
          setLocationError(`Backend error: ${errorData.error || 'Unknown error'}. Please enter manually.`);
          return;
        }
      } catch (backendError: any) {
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
    setForm((prev) => ({ ...prev, city: text, useCurrentCity: false, cityConfirmed: false, lat: null, lng: null }));
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
        setCitySuggestions([]);
        if (response.status === 404) {
          // Google found the text but only as a country or similar.
          setMapsUnavailable(false);
          setLocationError(data.error || 'Enter a city or state, not a country.');
          return;
        }
        // A dead Maps key used to look exactly like "no matching city". Tell the
        // person what is going on so they type their city and carry on.
        setMapsUnavailable(true);
        setLocationError(data.error || 'City search is unavailable right now. Type your city and continue.');
        if (!silent) throw new Error(data.error || 'Unable to verify city');
        return;
      }
      setMapsUnavailable(false);

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

  // Re-rendered once after each entry animation. The translateY runs on the
  // native driver, and on Android the ScrollView's content size stayed stale
  // until the next JS render, so a step would not scroll until something was
  // tapped. Bumping state after the animation is that render.
  const [, setLayoutTick] = useState(0);

  useEffect(() => {
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setLayoutTick((t) => t + 1));
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
              {renderChipRow(
                genderOptions,
                form.gender ? [form.gender === 'female' ? 'Woman' : form.gender === 'male' ? 'Man' : 'Non-binary'] : [],
                (option) => {
                  const value = option === 'Woman' ? 'female' : option === 'Man' ? 'male' : 'other';
                  setForm((prev) => ({ ...prev, gender: value as 'male' | 'female' | 'other' }));
                },
                false
              )}
              {errors.gender ? <Typography variant="small" tone="error">{errors.gender}</Typography> : null}

              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 16 }}>Your pronouns (optional)</Typography>
              {renderChipRow(pronounOptions, form.pronouns, (option) =>
                setForm((prev) => ({ ...prev, pronouns: toggleArrayValue(prev.pronouns, option) }))
              )}

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
              <Typography variant="body" style={{ color: theme.colors.muted }}>Interested in</Typography>
              {renderChipRow(
                interestedInOptions,
                form.interestedIn
                  ? [form.interestedIn === 'male' ? 'Men' : form.interestedIn === 'female' ? 'Women' : 'Everyone']
                  : [],
                (option) => {
                  const value = option === 'Men' ? 'male' : option === 'Women' ? 'female' : 'both';
                  setForm((prev) => ({ ...prev, interestedIn: value as 'male' | 'female' | 'both' }));
                },
                false
              )}
              {errors.interestedIn ? <Typography variant="small" tone="error">{errors.interestedIn}</Typography> : null}

              <Typography variant="body" style={{ color: theme.colors.muted, marginTop: 20 }}>What are you looking for?</Typography>
              {renderChipRow(lookingForOptions, form.lookingFor, (option) =>
                setForm((prev) => ({ ...prev, lookingFor: toggleArrayValue(prev.lookingFor, option) }))
              )}
              {errors.lookingFor ? <Typography variant="small" tone="error">{errors.lookingFor}</Typography> : null}

              <Typography variant="body" style={{ color: theme.colors.muted, marginTop: 20 }}>Your orientation</Typography>
              {renderChipRow(orientationOptions, form.orientation ? [form.orientation] : [], (option) =>
                setForm((prev) => ({ ...prev, orientation: option }))
              , false)}
              {errors.orientation ? <Typography variant="small" tone="error">{errors.orientation}</Typography> : null}


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
                      <Feather name="map-pin" size={28} color={theme.colors.deepBlack} />
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
                                cityConfirmed: true,
                              }));
                              setCitySuggestions([]);
                              setLocationError(null);
                              setErrors((prev) => ({ ...prev, city: '' }));
                            }}
                          >
                            <Feather name="map-pin" size={14} color={theme.colors.neonGreen} />
                            <Typography variant="small" style={{ color: theme.colors.text, marginLeft: 10, flex: 1 }}>
                              {s.label || s.city}
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
                      <Feather name="map-pin" size={28} color={theme.colors.neonGreen} />
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

                  <View style={styles.locationActionsRow}>
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
                    <TouchableOpacity
                      style={styles.changeLocationButton}
                      onPress={() => {
                        setForm((prev) => ({ ...prev, city: '', lat: null, lng: null, useCurrentCity: false }));
                        setCitySuggestions([]);
                        setLocationError(null);
                      }}
                      disabled={loading}
                    >
                      <Feather name="edit-2" size={16} color={theme.colors.neonGreen} />
                      <Typography variant="small" style={{ color: theme.colors.neonGreen, marginLeft: 8 }}>
                        Change
                      </Typography>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
            <View style={[styles.card, { backgroundColor: '#101D13', marginTop: 16 }]}>
              <Typography variant="small" style={{ color: theme.colors.muted }}>
                How far are you willing to travel?
              </Typography>
              {renderChipRow(
                distanceOptions.map((option) => option.label),
                [
                  (distanceOptions.find((option) => option.value === form.distanceRadius) ||
                    distanceOptions[2]).label,
                ],
                (label) => {
                  const picked = distanceOptions.find((option) => option.label === label);
                  if (picked) setForm((prev) => ({ ...prev, distanceRadius: picked.value }));
                },
                false
              )}
              <Typography variant="tiny" style={{ color: theme.colors.muted, marginTop: 8 }}>
                You can change this later in search filters.
              </Typography>
            </View>
          </View>
        );

      case 'understand': {
        const question = questions[quizIndex];
        const chosen = question ? form.answers[question.number] || [] : [];
        return (
          <View style={styles.slideStack}>
            <View style={[styles.card, { backgroundColor: '#101D13' }]}>
              {questionsError && questions.length === 0 ? (
                <Typography variant="small" tone="error">
                  Questions could not load. Check your connection and go back a step to retry.
                </Typography>
              ) : null}

              {questions.length === 0 && !questionsError ? (
                <ActivityIndicator color={theme.colors.neonGreen} style={{ marginVertical: 24 }} />
              ) : null}

              {question ? (
                <>
                  <Typography variant="tiny" style={{ color: theme.colors.muted, letterSpacing: 1 }}>
                    QUESTION {quizIndex + 1} OF {questions.length}
                  </Typography>
                  <Typography variant="h2" style={{ color: theme.colors.text, marginTop: 8, marginBottom: 6 }}>
                    {question.prompt}
                  </Typography>
                  <Typography variant="small" style={{ color: theme.colors.muted, marginBottom: 16 }}>
                    Pick one. Pick two if you are honestly between them.
                  </Typography>

                  <View style={{ gap: 10 }}>
                    {question.options.map((option) => {
                      const isSelected = chosen.includes(option.key);
                      const atLimit = chosen.length >= 2 && !isSelected;
                      return (
                        <TouchableOpacity
                          key={option.key}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected, disabled: atLimit }}
                          disabled={atLimit}
                          onPress={() =>
                            setForm((prev) => {
                              const current = prev.answers[question.number] || [];
                              const next = current.includes(option.key)
                                ? current.filter((k) => k !== option.key)
                                : [...current, option.key].slice(0, 2);
                              return { ...prev, answers: { ...prev.answers, [question.number]: next } };
                            })
                          }
                          style={[
                            styles.quizOption,
                            {
                              backgroundColor: isSelected ? theme.colors.neonGreen : theme.colors.surfaceLight,
                              borderColor: isSelected ? theme.colors.neonGreen : theme.colors.border,
                              opacity: atLimit ? 0.45 : 1,
                              paddingVertical: 14,
                            },
                          ]}
                        >
                          <Typography
                            variant="body"
                            style={{ color: isSelected ? theme.colors.deepBlack : theme.colors.text }}
                          >
                            {option.label}
                          </Typography>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {errors.quiz ? <Typography variant="small" tone="error" style={{ marginTop: 16 }}>{errors.quiz}</Typography> : null}
            </View>
          </View>
        );
      }

      case 'world':
        return (
          <View style={styles.slideStack}>
            <View style={[styles.card, { backgroundColor: '#101D13' }]}>
              <Typography variant="body" style={{ color: theme.colors.muted }}>Pick your interests (3 to 10)</Typography>
              {renderChipRow(interestOptions, form.interests, (option) =>
                setForm((prev) => {
                  const next = toggleArrayValue(prev.interests, option);
                  // Ten at most; a tap past that does nothing.
                  return next.length > 10 ? prev : { ...prev, interests: next };
                })
              )}
              {errors.interests ? <Typography variant="small" tone="error">{errors.interests}</Typography> : null}
            </View>
          </View>
        );

      case 'optional':
        return (
          <View style={styles.slideStack}>
            <View style={[styles.card, { backgroundColor: '#101D13' }]}>
              <Typography variant="body" style={{ color: theme.colors.muted, marginBottom: 8 }}>
                All optional. Leave anything blank.
              </Typography>

              <UnderlineInput
                placeholder="Height in cm (e.g. 173)"
                value={form.height}
                keyboardType="number-pad"
                maxLength={3}
                // Numbers only. It used to accept anything, including a name.
                onChangeText={(text) => setForm((prev) => ({ ...prev, height: text.replace(/[^0-9]/g, '') }))}
              />

              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 16 }}>Body type</Typography>
              {renderChipRow(bodyTypeOptions, form.bodyType ? [form.bodyType] : [], (option) =>
                setForm((prev) => ({ ...prev, bodyType: option }))
              , false)}

              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 16 }}>Smoking</Typography>
              {renderChipRow(smokerOptions, form.smoker ? [form.smoker] : [], (option) =>
                setForm((prev) => ({ ...prev, smoker: prev.smoker === option ? '' : (option as 'Never' | 'Social' | 'Regular') }))
              , false)}

              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 16 }}>Drinking</Typography>
              {renderChipRow(drinkerOptions, form.drinker ? [form.drinker] : [], (option) =>
                setForm((prev) => ({ ...prev, drinker: prev.drinker === option ? '' : (option as 'Never' | 'Social' | 'Regular') }))
              , false)}

              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 16 }}>Drugs</Typography>
              {renderChipRow(drugsOptions, form.drugs ? [form.drugs] : [], (option) =>
                setForm((prev) => ({ ...prev, drugs: option }))
              , false)}

              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 16 }}>Diet</Typography>
              {renderChipRow(dietOptions, form.diet ? [form.diet] : [], (option) =>
                setForm((prev) => ({ ...prev, diet: option }))
              , false)}

              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 16 }}>Fitness level</Typography>
              {renderChipRow(fitnessOptions, form.fitnessLevel ? [form.fitnessLevel] : [], (option) =>
                setForm((prev) => ({ ...prev, fitnessLevel: option }))
              , false)}
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
                        <Typography variant="tiny" style={{ color: theme.colors.deepBlack, fontFamily: theme.fonts.bodyStrong.family }}>Primary</Typography>
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

      case 'safety':
        return (
          <View style={styles.slideStack}>
            <View style={[styles.card, { backgroundColor: '#101D13' }]}>
              <Typography variant="body" style={{ color: theme.colors.muted }}>
                Take a selfie so we can check you match your photos. It is never shown on your
                profile and nobody else sees it.
              </Typography>

              {form.faceCheckPhoto ? (
                <View style={[styles.locationSuccessCard, { backgroundColor: 'rgba(188, 246, 65, 0.1)', borderColor: theme.colors.neonGreen, marginTop: 20 }]}>
                  <Feather name="check-circle" size={24} color={theme.colors.neonGreen} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
                      Selfie captured
                    </Typography>
                    <Typography variant="body" style={{ color: theme.colors.muted, marginTop: 4 }}>
                      We'll check it in the background.
                    </Typography>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.dateButton, { borderColor: theme.colors.borderLight, marginTop: 20 }]}
                  onPress={captureFaceCheck}
                  disabled={loading}
                  accessibilityRole="button"
                >
                  <Feather name="camera" size={20} color={theme.colors.neonGreen} />
                  <Typography variant="body" style={{ flex: 1, color: theme.colors.muted }}>
                    {loading ? 'Opening camera...' : 'Take a selfie'}
                  </Typography>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={skipFaceCheck}
                style={{ marginTop: 20, alignSelf: 'flex-start' }}
                accessibilityRole="button"
                disabled={loading}
              >
                <Typography variant="small" style={{ color: theme.colors.muted, textDecorationLine: 'underline' }}>
                  Skip for now
                </Typography>
              </TouchableOpacity>

              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 12 }}>
                You can do this any time from Verification. Verified profiles get shown more.
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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.stage}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            // flexGrow so the content always fills the viewport and the list is
            // scrollable from the first render. The interests step would not
            // scroll until a chip was tapped: nothing had forced a re-measure.
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
          >
            <Animated.View key={`${step}-${quizIndex}`} style={[styles.contentColumn, animatedContentStyle]}>
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
    marginBottom: 8,
  },
  locationIconLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
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
