import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { InputField } from '../components/InputField';
import { UnderlineInput } from '../components/UnderlineInput';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

type OnboardingScreenProps = {
  onComplete: (result: { token: string; name: string }) => void;
  apiBaseUrl: string;
};

type SlideKey =
  | 'name'
  | 'identity'
  | 'lookingFor'
  | 'connection'
  | 'feelMost'
  | 'photo'
  | 'location'
  | 'nearby'
  | 'contact'
  | 'success';

type Slide = {
  key: SlideKey;
  title: string;
  subtitle?: string;
};

const slides: Slide[] = [
  { key: 'name', title: 'What should we call you?', subtitle: 'Share the name you want to be greeted with 🌿' },
  { key: 'identity', title: 'How do you identify?', subtitle: 'Choose the label that feels most like you — you can edit this anytime.' },
  { key: 'lookingFor', title: 'What are you looking for right now?', subtitle: 'We’ll tailor your prompts and matches around your intention.' },
  { key: 'connection', title: 'What matters most in a connection?', subtitle: 'Think values, rhythms, or rituals that tell someone you’re aligned.' },
  { key: 'feelMost', title: 'When do you feel most like yourself?', subtitle: 'Paint us a scene. The more human and specific, the better.' },
  { key: 'photo', title: 'Upload a photo that feels like you.', subtitle: 'Natural light, warm energy, and no NSFW content please.' },
  { key: 'location', title: 'Where are you based?', subtitle: 'We use this to surface nearby green flags and thoughtful date ideas.' },
  { key: 'nearby', title: 'Would you like to meet people near you?', subtitle: 'Keep it local or open the doors wider — you can change this anytime.' },
  { key: 'contact', title: 'Let’s secure your account.', subtitle: 'A gentle four-digit code keeps your space protected.' },
  { key: 'success', title: 'You’re all set 🌿', subtitle: 'Greenflag is ready when you are.' },
];

const identityOptions = ['She / Her', 'He / Him', 'They / Them', 'Another label'];
const lookingForOptions = ['Friendship', 'Dating', 'Long-term', 'Exploring'];
const otpSlots = [0, 1, 2, 3];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete, apiBaseUrl }) => {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const [form, setForm] = useState({
    name: '',
    identity: '',
    lookingFor: [] as string[],
    connection: '',
    feelMost: '',
    photoSelected: false,
    city: '',
    useCurrentCity: false,
    meetNearby: 'yes',
    dateOfBirth: '',
    contactValue: '',
    contactType: 'email' as 'email' | 'phone',
    otp: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  void apiBaseUrl;

  const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value.trim());
  const isValidPhone = (value: string) => /^[0-9+()\-\s]{8,}$/.test(value.trim());

  const rawProgress = (step + 1) / slides.length;
  const progress = Math.max(rawProgress, 0.1);

  const maximumDOB = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date;
  }, []);

  const transition = useRef(new Animated.Value(1)).current;

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

  const toggleLookingFor = (option: string) => {
    setForm((prev) => {
      const exists = prev.lookingFor.includes(option);
      return {
        ...prev,
        lookingFor: exists ? prev.lookingFor.filter((item) => item !== option) : [...prev.lookingFor, option],
      };
    });
  };

  const isStepCompleted = useCallback((key: SlideKey) => {
    switch (key) {
      case 'name':
        return form.name.trim().length > 0;
      case 'identity':
        return Boolean(form.identity);
      case 'lookingFor':
        return form.lookingFor.length > 0;
      case 'connection':
        return form.connection.trim().length > 0;
      case 'feelMost':
        return form.feelMost.trim().length > 0;
      case 'photo':
        return form.photoSelected;
      case 'location':
        return Boolean(form.dateOfBirth) && form.city.trim().length > 0;
      case 'nearby':
        return Boolean(form.meetNearby);
      case 'contact':
        return form.contactValue.trim().length > 0 && form.otp.length === 4;
      case 'success':
        return step === slides.length - 1;
      default:
        return false;
    }
  }, [form, step]);

  const validateStep = (): boolean => {
    const current = slides[step].key;
    const nextErrors: Record<string, string> = {};

    switch (current) {
      case 'name':
        if (!form.name.trim()) nextErrors.name = 'Tell us your name so we can greet you properly.';
        break;
      case 'identity':
        if (!form.identity) nextErrors.identity = 'Pick the label that feels most like you.';
        break;
      case 'lookingFor':
        if (form.lookingFor.length === 0) nextErrors.lookingFor = 'Choose at least one intention.';
        break;
      case 'connection':
        if (!form.connection.trim()) nextErrors.connection = 'Share what makes a connection feel right.';
        break;
      case 'feelMost':
        if (!form.feelMost.trim()) nextErrors.feelMost = 'Let us know when you feel most like yourself.';
        break;
      case 'photo':
        if (!form.photoSelected) nextErrors.photo = 'Add a photo so matches can feel your energy.';
        break;
      case 'location':
        if (!form.dateOfBirth) nextErrors.dateOfBirth = 'Select your birth date (18+).';
        if (!form.city.trim()) nextErrors.city = 'Let us know your city to curate local matches.';
        break;
      case 'contact':
        if (!form.contactValue.trim()) {
          nextErrors.contact = 'Share an email or phone so we can protect your account.';
        } else if (form.contactType === 'email' && !isValidEmail(form.contactValue)) {
          nextErrors.contact = 'That email doesn’t look quite right.';
        } else if (form.contactType === 'phone' && !isValidPhone(form.contactValue)) {
          nextErrors.contact = 'Add a phone number with country code.';
        }
        if (form.otp.length !== 4) nextErrors.otp = 'Enter the 4-digit code we sent.';
        break;
      default:
        break;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleContinue = () => {
    Keyboard.dismiss();
    if (!validateStep()) return;

    if (slides[step].key === 'success') {
      onComplete({ token: 'demo-token', name: form.name.trim() });
      return;
    }

    if (step === slides.length - 2) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setStep((prev) => prev + 1);
      }, 600);
      return;
    }

    setStep((prev) => Math.min(prev + 1, slides.length - 1));
  };

  const handleBack = () => {
    if (step === 0) return;
    setStep((prev) => prev - 1);
  };

  const selectPhoto = () => {
    Alert.alert('Photo upload', 'Photo upload is coming soon. For now, we’ll mark this as done.');
    setForm((prev) => ({ ...prev, photoSelected: true }));
  };

  const selectCurrentLocation = () => {
    setForm((prev) => ({ ...prev, city: 'Detected location', useCurrentCity: true }));
  };

  useEffect(() => {
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step, transition]);

  const renderChipRow = (options: string[], selectedValues: string[], toggle: (option: string) => void) => (
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

  const renderOTPInputs = () => (
    <View style={styles.otpRow}>
      {otpSlots.map((slot) => (
        <TextInput
          key={slot}
          value={form.otp[slot] || ''}
          onChangeText={(text) => {
            const clean = text.replace(/[^0-9]/g, '').slice(-1);
            const next = form.otp.split('');
            next[slot] = clean;
            const otp = next.join('').slice(0, 4);
            setForm((prev) => ({ ...prev, otp }));
          }}
          keyboardType="numeric"
          maxLength={1}
          style={[styles.otpInput, { borderColor: theme.colors.border }]}
          returnKeyType="next"
        />
      ))}
    </View>
  );

  const renderSlide = () => {
    const current = slides[step].key;

    switch (current) {
      case 'name':
        return (
          <UnderlineInput
            placeholder="Your name"
            value={form.name}
            onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
            autoCapitalize="words"
            textContentType="givenName"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            error={errors.name}
          />
        );
      case 'identity':
        return (
          <View style={styles.slideStack}>
            <Typography variant="body" muted>Choose the label that feels most like you 💫.</Typography>
            {renderChipRow(identityOptions, form.identity ? [form.identity] : [], (option) =>
              setForm((prev) => ({ ...prev, identity: option }))
            )}
            {errors.identity ? <Typography variant="small" tone="error">{errors.identity}</Typography> : null}
          </View>
        );
      case 'lookingFor':
        return (
          <View style={styles.slideStack}>
            <Typography variant="body" muted>Pick the intentions you’d love to explore 🌱.</Typography>
            {renderChipRow(lookingForOptions, form.lookingFor, toggleLookingFor)}
            {errors.lookingFor ? <Typography variant="small" tone="error">{errors.lookingFor}</Typography> : null}
          </View>
        );
      case 'connection':
        return (
          <View style={styles.slideStack}>
            <Typography variant="small" muted>Example: Honest communication, shared curiosity, feeling emotionally held.</Typography>
            <UnderlineInput
              placeholder="Your answer"
              value={form.connection}
              onChangeText={(text) => setForm((prev) => ({ ...prev, connection: text }))}
              multiline
              error={errors.connection}
            />
          </View>
        );
      case 'feelMost':
        return (
          <View style={styles.slideStack}>
            <Typography variant="small" muted>Example: Slow mornings journaling with a cup of tea.</Typography>
            <UnderlineInput
              placeholder="I feel most like myself when..."
              value={form.feelMost}
              onChangeText={(text) => setForm((prev) => ({ ...prev, feelMost: text }))}
              multiline
              error={errors.feelMost}
            />
          </View>
        );
      case 'photo':
        return (
          <View style={styles.slideStack}>
            <TouchableOpacity style={[styles.photoDrop, { borderColor: theme.colors.primary }]} onPress={selectPhoto}>
              <Feather name="image" size={28} color={theme.colors.primary} />
              <Typography variant="body" muted>
                {form.photoSelected ? 'Photo added – you look great 🌿' : 'Tap to choose a photo'}
              </Typography>
            </TouchableOpacity>
            <Typography variant="small" muted>Soft, natural photos keep the space feeling human. We gently review anything flagged.</Typography>
            {errors.photo ? <Typography variant="small" tone="error">{errors.photo}</Typography> : null}
          </View>
        );
      case 'location':
        return (
          <View style={styles.slideStack}>
            <TouchableOpacity
              style={[styles.dobButton, { borderColor: form.dateOfBirth ? theme.colors.primary : theme.colors.border }]}
              onPress={openDatePicker}
            >
              <Feather name="calendar" size={18} color={theme.colors.primary} />
              <Typography variant="body" style={styles.dobLabel}>
                {form.dateOfBirth ? form.dateOfBirth : 'Choose your birth date'}
              </Typography>
            </TouchableOpacity>
            {errors.dateOfBirth ? <Typography variant="small" tone="error">{errors.dateOfBirth}</Typography> : null}
            <Typography variant="small" muted>Greenflag is for adults 18+. We never display your birth date.</Typography>
            {showIOSPicker ? (
              <DateTimePicker
                mode="date"
                value={form.dateOfBirth ? new Date(form.dateOfBirth) : maximumDOB}
                maximumDate={maximumDOB}
                onChange={(_, date) => {
                  setShowIOSPicker(false);
                  if (date) {
                    setForm((prev) => ({ ...prev, dateOfBirth: date.toISOString().slice(0, 10) }));
                  }
                }}
              />
            ) : null}
            <Typography variant="small" muted>Example: Bengaluru</Typography>
            <UnderlineInput
              placeholder="Enter your city"
              value={form.city}
              onChangeText={(text) => setForm((prev) => ({ ...prev, city: text, useCurrentCity: false }))}
              error={errors.city}
            />
            <Typography variant="small" muted>We'll suggest gentle matches near {form.city ? form.city : 'you'} — change it anytime.</Typography>
            <Button label="Use current location" variant="secondary" onPress={selectCurrentLocation} fullWidth />
          </View>
        );
      case 'nearby':
        return (
          <View style={styles.slideStack}>
            <Typography variant="body" muted>Follow the pace that feels right today.</Typography>
            <View style={styles.chipRow}>
              <Chip label="Yes, keep it nearby" selected={form.meetNearby === 'yes'} onPress={() => setForm((prev) => ({ ...prev, meetNearby: 'yes' }))} />
              <Chip label="Open to anywhere" selected={form.meetNearby === 'no'} onPress={() => setForm((prev) => ({ ...prev, meetNearby: 'no' }))} />
            </View>
          </View>
        );
      case 'contact':
        return (
          <View style={styles.slideStack}>
            <Typography variant="body" muted>Use email or phone — we’ll send a gentle 4-digit code.</Typography>
            <View style={styles.chipRow}>
              <Chip label="Email" selected={form.contactType === 'email'} onPress={() => setForm((prev) => ({ ...prev, contactType: 'email', contactValue: '' }))} />
              <Chip label="Phone" selected={form.contactType === 'phone'} onPress={() => setForm((prev) => ({ ...prev, contactType: 'phone', contactValue: '' }))} />
            </View>
            <Typography variant="small" muted>We'll only use this for secure sign-in and gentle safety nudges.</Typography>
            <UnderlineInput
              placeholder={form.contactType === 'email' ? 'you@example.com' : '+91 98765 43210'}
              keyboardType={form.contactType === 'email' ? 'email-address' : 'phone-pad'}
              value={form.contactValue}
              onChangeText={(text) => setForm((prev) => ({ ...prev, contactValue: text }))}
              error={errors.contact}
            />
            <Typography variant="body" muted style={{ marginTop: 12 }}>Enter the 4-digit code</Typography>
            {renderOTPInputs()}
            {errors.otp ? <Typography variant="small" tone="error">{errors.otp}</Typography> : null}
          </View>
        );
      case 'success':
        return (
          <View style={styles.slideStack}>
            <Typography variant="body" muted>Ready to meet your green flags?</Typography>
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
          outputRange: [28, 0],
        }),
      },
    ],
  };

  const animatedFooterStyle = {
    opacity: transition,
    transform: [
      {
        translateY: transition.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.colors.background }]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleBack} style={[styles.backButton, { borderColor: theme.colors.border }]} accessibilityRole="button">
              <Feather name="arrow-left" size={20} color={step === 0 ? theme.colors.muted : theme.colors.primary} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.stage}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Animated.View style={[styles.contentColumn, animatedContentStyle]}>
                <View style={styles.progressContainer}>
                  <Typography variant="small" muted>
                    Step {Math.min(step + 1, slides.length)} of {slides.length}
                  </Typography>
                  <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.colors.primary }]} />
                  </View>
                  <View style={styles.progressDots}>
                    {slides.map((slide, index) => {
                      const completed = isStepCompleted(slide.key);
                      const isCurrent = index === step;
                      return (
                        <View
                          key={slide.key}
                          style={[
                            styles.progressDot,
                            completed && styles.progressDotCompleted,
                            isCurrent && styles.progressDotCurrent,
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>

                <View style={styles.questionBlock}>
                  <Typography variant="display" align="left">
                    {slides[step].title}
                  </Typography>
                  {slides[step].subtitle ? (
                    <Typography variant="body" muted style={styles.helperText}>
                      {slides[step].subtitle}
                    </Typography>
                  ) : null}
                </View>

                <View style={styles.formBlock}>{renderSlide()}</View>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>

      <View style={[styles.footer, { backgroundColor: theme.colors.background }]}>
        <Animated.View style={[styles.footerContent, animatedFooterStyle]}>
          {slides[step].key === 'success' ? (
            <Button label="Let's begin" onPress={handleContinue} fullWidth />
          ) : (
            <Button
              label={loading ? 'Please wait…' : 'Continue'}
              onPress={handleContinue}
              fullWidth
              disabled={loading}
            />
          )}
        </Animated.View>
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
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 50,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingBottom: 140,
  },
  contentColumn: {
    width: '100%',
    maxWidth: 342,
    alignSelf: 'flex-start',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 24,
  },
  progressTrack: {
    width: '100%',
    height: 2,
    borderRadius: 999,
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(18,22,20,0.12)',
  },
  progressDotCompleted: {
    backgroundColor: '#3BB273',
  },
  progressDotCurrent: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3BB273',
  },
  questionBlock: {
    gap: 12,
    marginBottom: 32,
  },
  helperText: {
    marginTop: 8,
  },
  formBlock: {
    gap: 16,
  },
  slideStack: {
    gap: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  photoDrop: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 24,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  dobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  dobLabel: {
    flex: 1,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 12,
  },
  otpInput: {
    width: 54,
    height: 54,
    borderWidth: 1,
    borderRadius: 16,
    textAlign: 'center',
    fontSize: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  footerContent: {
    maxWidth: 342,
    alignSelf: 'flex-start',
    width: '100%',
  },
  successWrap: {
    gap: 24,
  },
});
