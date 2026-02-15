import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/PageHeader';

type Props = {
  onBack: () => void;
  onOpenPhotos?: () => void;
  token: string;
  apiBaseUrl: string;
};

// Interest categories with emoji icons
const INTEREST_CATEGORIES = [
  {
    name: 'Self-care',
    emoji: '🧘',
    items: ['Aromatherapy', 'Astrology', 'Cold plunging', 'Crystals', 'Deep chats', 'Journaling', 'Mindfulness', 'Nutrition', 'Meditation', 'Skincare'],
  },
  {
    name: 'Sports',
    emoji: '⚽',
    items: ['Badminton', 'Baseball', 'Basketball', 'Bodybuilding', 'Bouldering', 'Bowling', 'Boxing', 'Cardio', 'Cricket', 'Cycling', 'Football', 'Golf', 'Gym', 'Running', 'Swimming', 'Tennis', 'Yoga'],
  },
  {
    name: 'Creativity',
    emoji: '🎨',
    items: ['Art', 'Crafts', 'Crocheting', 'Dancing', 'Design', 'Drawing', 'Fashion', 'Knitting', 'Music', 'Painting', 'Photography', 'Pottery', 'Singing', 'Writing'],
  },
  {
    name: 'Going out',
    emoji: '🎉',
    items: ['Bars', 'Café hopping', 'Clubs', 'Concerts', 'Drag shows', 'Festivals', 'Improv', 'Karaoke', 'Live music', 'Nightlife', 'Theater'],
  },
  {
    name: 'Staying in',
    emoji: '🏠',
    items: ['AI', 'Baking', 'Board games', 'Chess', 'Cooking', 'Gardening', 'House plants', 'Podcasts', 'Puzzles', 'Reading', 'Video games'],
  },
  {
    name: 'Film and TV',
    emoji: '🎬',
    items: ['Action', 'Anime', 'Bollywood', 'Comedy', 'Crime', 'Documentaries', 'Drama', 'Horror', 'K-Drama', 'Reality TV', 'Romance', 'Sci-Fi', 'Thriller'],
  },
  {
    name: 'Music',
    emoji: '🎵',
    items: ['Afro', 'Classical', 'Country', 'EDM', 'Hip-hop', 'Indie', 'Jazz', 'K-pop', 'Pop', 'R&B', 'Rap', 'Rock', 'Soul'],
  },
  {
    name: 'Food and drink',
    emoji: '🍕',
    items: ['BBQ', 'Beer', 'Biryani', 'Boba tea', 'Brunch', 'Burgers', 'Cake', 'Cocktails', 'Coffee', 'Fine dining', 'Pizza', 'Sushi', 'Vegan', 'Wine'],
  },
  {
    name: 'Traveling',
    emoji: '✈️',
    items: ['Backpacking', 'Beaches', 'Camping', 'City trips', 'Exploring', 'Hiking trips', 'Road trips', 'Solo trips', 'Adventure'],
  },
  {
    name: 'Pets',
    emoji: '🐾',
    items: ['Birds', 'Cats', 'Dogs', 'Fish', 'Rabbits', 'Reptiles'],
  },
];

const LANGUAGE_OPTIONS = [
  'English', 'Hindi', 'Spanish', 'French', 'German', 'Mandarin', 'Japanese',
  'Korean', 'Portuguese', 'Arabic', 'Tamil', 'Telugu', 'Bengali', 'Marathi',
  'Kannada', 'Malayalam', 'Punjabi', 'Gujarati', 'Italian', 'Russian',
  'Dutch', 'Turkish', 'Vietnamese', 'Thai', 'Indonesian', 'Polish',
  'Swedish', 'Greek', 'Czech', 'Romanian', 'Hungarian', 'Finnish',
];

const PRONOUN_OPTIONS = [
  'she/her', 'he/him', 'they/them', 'ze/zir', 'xe/xim', 'co/co', 'ey/em', 've/ver', 'per/per',
];

const COMMUNITY_OPTIONS = [
  'Black Lives Matter', 'Feminism', 'Environmentalism', 'Trans rights',
  'LGBTQ+ rights', 'Disability rights', 'Reproductive rights', 'Immigrant rights',
  'Indigenous rights', 'Voter rights', 'Human rights', 'Neurodiversity',
  'Mental health advocacy', 'Animal rights', 'Volunteering',
];

type MoreAboutField =
  | 'age'
  | 'work'
  | 'education'
  | 'gender'
  | 'location'
  | 'hometown'
  | 'height'
  | 'exercise'
  | 'educationLevel'
  | 'drinking'
  | 'smoking'
  | 'lookingFor'
  | 'kids'
  | 'haveKids'
  | 'starSign'
  | 'politics'
  | 'religion';

type ModalType =
  | 'interests'
  | 'languages'
  | 'pronouns'
  | 'communities'
  | 'bio'
  | 'moreAbout'
  | 'moreField'
  | null;

type FormState = {
  name: string;
  city: string;
  dateOfBirth: string;
  gender: string;
  bio: string;
  interests: string[];
  languages: string[];
  pronouns: string[];
  communities: string[];
  work: string;
  education: string;
  hometown: string;
  heightCm: string;
  exercise: string;
  educationLevel: string;
  drinking: string;
  smoking: string;
  lookingFor: string;
  kids: string;
  haveKids: string;
  starSign: string;
  politics: string;
  religion: string;
};

const GENDER_OPTIONS = ['Man', 'Woman', 'Non-binary', 'Other'];
const EXERCISE_OPTIONS = ['Very active', 'Active', 'Sometimes', 'Rarely'];
const EDUCATION_LEVEL_OPTIONS = ['High school', 'Undergraduate', 'Postgraduate', 'PhD', 'Other'];
const DRINKING_OPTIONS = ['Never', 'Socially', 'Often'];
const SMOKING_OPTIONS = ['Never', 'Social', 'Regular'];
const LOOKING_FOR_OPTIONS = ['Long-term relationship', 'Serious', 'Casual', 'Friendship'];
const KIDS_OPTIONS = ['Want kids', 'Open to kids', 'Do not want kids'];
const HAVE_KIDS_OPTIONS = ['No', 'Have kids'];
const STAR_SIGN_OPTIONS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const POLITICS_OPTIONS = ['Liberal', 'Moderate', 'Conservative', 'Apolitical'];
const RELIGION_OPTIONS = ['Spiritual', 'Religious', 'Agnostic', 'Atheist'];

const ageFromDob = (dob: string): string => {
  if (!dob) return '';
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return String(Math.max(age, 18));
};

const dobFromAge = (ageRaw: string, fallbackDob: string): string => {
  const ageNum = Number(ageRaw);
  if (!Number.isFinite(ageNum) || ageNum <= 0) return fallbackDob;
  const now = new Date();
  const year = now.getFullYear() - ageNum;
  return `${year}-01-01`;
};

const normalizeGoalForUi = (value: string) => {
  const cleaned = value.replace(/[_-]/g, ' ').trim().toLowerCase();
  if (cleaned === 'long term' || cleaned === 'long term relationship') return 'Long-term relationship';
  if (cleaned === 'serious') return 'Serious';
  if (cleaned === 'casual') return 'Casual';
  if (cleaned === 'friendship') return 'Friendship';
  return value;
};

const normalizeGoalForApi = (value: string) => {
  const cleaned = value.trim().toLowerCase();
  if (cleaned.includes('long-term') || cleaned.includes('long term')) return 'long-term';
  if (cleaned.includes('serious')) return 'serious';
  if (cleaned.includes('casual')) return 'casual';
  if (cleaned.includes('friend')) return 'friendship';
  return cleaned;
};

const normalizeGenderForUi = (value: string) => {
  const v = value.trim().toLowerCase();
  if (v === 'male') return 'Man';
  if (v === 'female') return 'Woman';
  if (v === 'non-binary' || v === 'non binary') return 'Non-binary';
  if (!v) return '';
  return 'Other';
};

const normalizeGenderForApi = (value: string) => {
  const v = value.trim().toLowerCase();
  if (v === 'man' || v === 'male') return 'male';
  if (v === 'woman' || v === 'female') return 'female';
  if (v === 'non-binary') return 'other';
  if (v === 'other') return 'other';
  return undefined;
};

const iconForField = (field: MoreAboutField): { lib: 'feather' | 'mci'; name: string } => {
  switch (field) {
    case 'age': return { lib: 'mci', name: 'cake-variant-outline' };
    case 'work': return { lib: 'mci', name: 'briefcase-outline' };
    case 'education': return { lib: 'mci', name: 'school-outline' };
    case 'gender': return { lib: 'mci', name: 'gender-male-female' };
    case 'location': return { lib: 'mci', name: 'map-marker-outline' };
    case 'hometown': return { lib: 'mci', name: 'home-outline' };
    case 'height': return { lib: 'mci', name: 'ruler' };
    case 'exercise': return { lib: 'mci', name: 'dumbbell' };
    case 'educationLevel': return { lib: 'mci', name: 'school' };
    case 'drinking': return { lib: 'mci', name: 'glass-wine' };
    case 'smoking': return { lib: 'mci', name: 'smoking-off' };
    case 'lookingFor': return { lib: 'mci', name: 'magnify' };
    case 'kids': return { lib: 'mci', name: 'baby-carriage' };
    case 'haveKids': return { lib: 'mci', name: 'baby-face-outline' };
    case 'starSign': return { lib: 'mci', name: 'zodiac-virgo' };
    case 'politics': return { lib: 'mci', name: 'bank-outline' };
    case 'religion': return { lib: 'mci', name: 'emoticon-outline' };
    default: return { lib: 'feather', name: 'circle' };
  }
};

const renderFieldIcon = (field: MoreAboutField, color: string) => {
  const icon = iconForField(field);
  if (icon.lib === 'mci') {
    return <MaterialCommunityIcons name={icon.name as any} size={21} color={color} />;
  }
  return <Feather name={icon.name as any} size={19} color={color} />;
};

const titleForField = (field: MoreAboutField) => {
  switch (field) {
    case 'age': return 'Age';
    case 'work': return 'Work';
    case 'education': return 'Education';
    case 'gender': return 'Gender';
    case 'location': return 'Location';
    case 'hometown': return 'Hometown';
    case 'height': return 'Height';
    case 'exercise': return 'Exercise';
    case 'educationLevel': return 'Education level';
    case 'drinking': return 'Drinking';
    case 'smoking': return 'Smoking';
    case 'lookingFor': return 'Looking for';
    case 'kids': return 'Kids';
    case 'haveKids': return 'Have kids';
    case 'starSign': return 'Star sign';
    case 'politics': return 'Politics';
    case 'religion': return 'Religion';
    default: return 'Field';
  }
};

export const ProfileEditScreen: React.FC<Props> = ({ onBack, onOpenPhotos, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedMoreField, setSelectedMoreField] = useState<MoreAboutField | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileSnapshot, setProfileSnapshot] = useState<any>(null);

  const [form, setForm] = useState<FormState>({
    name: '',
    city: '',
    dateOfBirth: '',
    gender: '',
    bio: '',
    interests: [],
    languages: [],
    pronouns: [],
    communities: [],
    work: '',
    education: '',
    hometown: '',
    heightCm: '',
    exercise: '',
    educationLevel: '',
    drinking: '',
    smoking: '',
    lookingFor: '',
    kids: '',
    haveKids: '',
    starSign: '',
    politics: '',
    religion: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${apiBaseUrl}/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const profile = data.profile || {};
          const user = data.user || {};
          setProfileSnapshot(data);

          setForm({
            name: user.name || '',
            city: user.city || '',
            dateOfBirth: user.date_of_birth || '',
            gender: normalizeGenderForUi(user.gender || ''),
            bio: profile.bio || '',
            interests: Array.isArray(profile.interests) ? profile.interests : [],
            languages: Array.isArray(profile.languages) ? profile.languages : [],
            pronouns: Array.isArray(profile.pronouns) ? profile.pronouns : [],
            communities: Array.isArray(profile.communities) ? profile.communities : [],
            work: profile.occupation || '',
            education: profile.education || '',
            hometown: profile.hometown || '',
            heightCm: profile.height ? String(profile.height) : '',
            exercise: profile.fitness_level || '',
            educationLevel: profile.education_level || profile.education || '',
            drinking: profile.drinker ? String(profile.drinker).replace(/\b\w/g, (m: string) => m.toUpperCase()) : '',
            smoking: profile.smoking_habit
              ? String(profile.smoking_habit).replace(/\b\w/g, (m: string) => m.toUpperCase())
              : (typeof profile.smoker === 'boolean' ? (profile.smoker ? 'Regular' : 'Never') : ''),
            lookingFor: profile.relationship_goal ? normalizeGoalForUi(String(profile.relationship_goal)) : '',
            kids: typeof profile.family_oriented === 'boolean' ? (profile.family_oriented ? 'Want kids' : 'Do not want kids') : '',
            haveKids: profile.have_kids || '',
            starSign: profile.star_sign || '',
            politics: profile.politics || '',
            religion: profile.religion || (typeof profile.spiritual === 'boolean' ? (profile.spiritual ? 'Spiritual' : 'Agnostic') : ''),
          });
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [apiBaseUrl, token]);

  const toggleArrayItem = (key: 'interests' | 'languages' | 'pronouns' | 'communities', item: string, maxItems?: number) => {
    setForm((prev) => {
      const currentArray = prev[key];
      if (currentArray.includes(item)) {
        return { ...prev, [key]: currentArray.filter((i) => i !== item) };
      }
      if (maxItems && currentArray.length >= maxItems) {
        Alert.alert('Limit reached', `You can select up to ${maxItems} options.`);
        return prev;
      }
      return { ...prev, [key]: [...currentArray, item] };
    });
  };

  const filteredLanguages = LANGUAGE_OPTIONS.filter((lang) =>
    lang.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDisplayValue = (items: string[], maxShow = 2) => {
    if (items.length === 0) return 'Add';
    if (items.length <= maxShow) return items.join(', ');
    return `${items.slice(0, maxShow).join(', ')} +${items.length - maxShow}`;
  };

  const currentAge = useMemo(() => ageFromDob(form.dateOfBirth), [form.dateOfBirth]);

  const getFieldValue = (field: MoreAboutField): string => {
    switch (field) {
      case 'age': return currentAge || 'Add';
      case 'work': return form.work || 'Add';
      case 'education': return form.education || 'Add';
      case 'gender': return form.gender || 'Add';
      case 'location': return form.city || 'Add';
      case 'hometown': return form.hometown || 'Add';
      case 'height': return form.heightCm ? `${form.heightCm} cm` : 'Add';
      case 'exercise': return form.exercise || 'Add';
      case 'educationLevel': return form.educationLevel || 'Add';
      case 'drinking': return form.drinking || 'Add';
      case 'smoking': return form.smoking || 'Add';
      case 'lookingFor': return form.lookingFor || 'Add';
      case 'kids': return form.kids || 'Add';
      case 'haveKids': return form.haveKids || 'Add';
      case 'starSign': return form.starSign || 'Add';
      case 'politics': return form.politics || 'Add';
      case 'religion': return form.religion || 'Add';
      default: return 'Add';
    }
  };

  const editableOptionList = (field: MoreAboutField): string[] | null => {
    switch (field) {
      case 'gender': return GENDER_OPTIONS;
      case 'exercise': return EXERCISE_OPTIONS;
      case 'educationLevel': return EDUCATION_LEVEL_OPTIONS;
      case 'drinking': return DRINKING_OPTIONS;
      case 'smoking': return SMOKING_OPTIONS;
      case 'lookingFor': return LOOKING_FOR_OPTIONS;
      case 'kids': return KIDS_OPTIONS;
      case 'haveKids': return HAVE_KIDS_OPTIONS;
      case 'starSign': return STAR_SIGN_OPTIONS;
      case 'politics': return POLITICS_OPTIONS;
      case 'religion': return RELIGION_OPTIONS;
      default: return null;
    }
  };

  const setFieldValue = (field: MoreAboutField, value: string) => {
    setForm((prev) => {
      switch (field) {
        case 'age':
          return { ...prev, dateOfBirth: dobFromAge(value, prev.dateOfBirth) };
        case 'work':
          return { ...prev, work: value };
        case 'education':
          return { ...prev, education: value };
        case 'gender':
          return { ...prev, gender: value };
        case 'location':
          return { ...prev, city: value };
        case 'hometown':
          return { ...prev, hometown: value };
        case 'height':
          return { ...prev, heightCm: value.replace(/[^0-9]/g, '') };
        case 'exercise':
          return { ...prev, exercise: value };
        case 'educationLevel':
          return { ...prev, educationLevel: value };
        case 'drinking':
          return { ...prev, drinking: value };
        case 'smoking':
          return { ...prev, smoking: value };
        case 'lookingFor':
          return { ...prev, lookingFor: value };
        case 'kids':
          return { ...prev, kids: value };
        case 'haveKids':
          return { ...prev, haveKids: value };
        case 'starSign':
          return { ...prev, starSign: value };
        case 'politics':
          return { ...prev, politics: value };
        case 'religion':
          return { ...prev, religion: value };
        default:
          return prev;
      }
    });
  };

  const openMoreField = (field: MoreAboutField) => {
    setSelectedMoreField(field);
    setActiveModal('moreField');
  };

  const moreAboutCompletionCount = useMemo(() => {
    const fields: MoreAboutField[] = [
      'age', 'work', 'education', 'gender', 'location', 'hometown', 'height', 'exercise',
      'educationLevel', 'drinking', 'smoking', 'lookingFor', 'kids', 'haveKids', 'starSign', 'politics', 'religion',
    ];
    return fields.filter((field) => getFieldValue(field) !== 'Add').length;
  }, [form, currentAge]);

  const handleSave = async () => {
    try {
      setSaving(true);

      const snapshotProfile = profileSnapshot?.profile || {};
      const genderApi = normalizeGenderForApi(form.gender);

      await fetch(`${apiBaseUrl}/profile/basic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name,
          city: form.city,
          gender: genderApi,
          date_of_birth: form.dateOfBirth || null,
        }),
      });

      const payload = {
        height: form.heightCm ? Number(form.heightCm) : snapshotProfile.height || null,
        body_type: snapshotProfile.body_type || null,
        interests: form.interests,
        bio: form.bio,
        prompt1: snapshotProfile.prompt1 || null,
        prompt2: snapshotProfile.prompt2 || null,
        prompt3: snapshotProfile.prompt3 || null,
        smoker: form.smoking ? form.smoking.toLowerCase() : (snapshotProfile.smoking_habit || snapshotProfile.smoker),
        drinker: form.drinking ? form.drinking.toLowerCase() : snapshotProfile.drinker || null,
        diet: snapshotProfile.diet || 'balanced',
        fitness_level: form.exercise || snapshotProfile.fitness_level || null,
        education: form.educationLevel || form.education || snapshotProfile.education || null,
        education_level: form.educationLevel || snapshotProfile.education_level || null,
        occupation: form.work || snapshotProfile.occupation || null,
        hometown: form.hometown || snapshotProfile.hometown || null,
        relationship_goal: form.lookingFor ? normalizeGoalForApi(form.lookingFor) : snapshotProfile.relationship_goal || null,
        have_kids: form.haveKids || snapshotProfile.have_kids || null,
        star_sign: form.starSign || snapshotProfile.star_sign || null,
        politics: form.politics || snapshotProfile.politics || null,
        religion: form.religion || snapshotProfile.religion || null,
        family_oriented: form.kids
          ? !(form.kids.toLowerCase().includes('do not'))
          : (typeof snapshotProfile.family_oriented === 'boolean' ? snapshotProfile.family_oriented : null),
        spiritual: form.religion
          ? (form.religion.toLowerCase() === 'spiritual' || form.religion.toLowerCase() === 'religious')
          : (typeof snapshotProfile.spiritual === 'boolean' ? snapshotProfile.spiritual : null),
        open_minded: typeof snapshotProfile.open_minded === 'boolean' ? snapshotProfile.open_minded : true,
        career_focused: typeof snapshotProfile.career_focused === 'boolean' ? snapshotProfile.career_focused : true,
        self_summary: form.bio,
      };

      const response = await fetch(`${apiBaseUrl}/profile/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Unable to save profile');
      Alert.alert('Saved', 'Your profile was updated.');
      onBack();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  // Interests Modal
  const renderInterestsModal = () => (
    <Modal visible={activeModal === 'interests'} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}> 
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}> 
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}> 
            <Feather name="x" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Typography variant="h2" style={{ color: theme.colors.text, flex: 1, textAlign: 'center' }}>
            Interests
          </Typography>
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
            <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>Done</Typography>
          </TouchableOpacity>
        </View>

        <View style={styles.modalSubheader}>
          <Typography variant="h1" style={{ color: theme.colors.text }}>
            Choose up to 5 interests
          </Typography>
          <Typography variant="body" style={{ color: theme.colors.muted, marginTop: 8 }}>
            Select things you enjoy doing
          </Typography>
          <Typography variant="small" style={{ color: theme.colors.neonGreen, marginTop: 8 }}>
            You've chosen {form.interests.length} out of 5 options
          </Typography>
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalScrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {INTEREST_CATEGORIES.map((category) => (
            <View key={category.name} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Typography variant="body" style={{ fontSize: 18 }}>{category.emoji}</Typography>
                <Typography variant="bodyStrong" style={{ color: theme.colors.text, marginLeft: 8 }}>
                  {category.name}
                </Typography>
              </View>
              <View style={styles.chipsWrap}>
                {category.items.map((item) => {
                  const isSelected = form.interests.includes(item);
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.chipWithIcon,
                        {
                          borderColor: isSelected ? theme.colors.secondaryHairline : theme.colors.border,
                          backgroundColor: isSelected ? theme.colors.secondaryHighlight : 'transparent',
                        },
                      ]}
                      onPress={() => toggleArrayItem('interests', item, 5)}
                    >
                      <Typography variant="small" style={{ color: theme.colors.text }}>{item}</Typography>
                      <Feather name={isSelected ? 'check' : 'plus'} size={14} color={isSelected ? theme.colors.neonGreen : theme.colors.muted} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </Modal>
  );

  // Languages Modal
  const renderLanguagesModal = () => (
    <Modal visible={activeModal === 'languages'} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}> 
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}> 
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}> 
            <Feather name="x" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Typography variant="h2" style={{ color: theme.colors.text, flex: 1, textAlign: 'center' }}>
            Your languages
          </Typography>
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
            <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>Done</Typography>
          </TouchableOpacity>
        </View>

        <View style={styles.modalSubheader}>
          <Typography variant="h1" style={{ color: theme.colors.text }}>
            What languages do you know?
          </Typography>
          <Typography variant="body" style={{ color: theme.colors.muted, marginTop: 8 }}>
            We'll show these on your profile and use them to connect you with great matches.
          </Typography>
          <Typography variant="small" style={{ color: theme.colors.neonGreen, marginTop: 8 }}>
            Select up to 5
          </Typography>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}> 
          <Feather name="search" size={18} color={theme.colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search for a language"
            placeholderTextColor={theme.colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalScrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {filteredLanguages.map((lang) => {
            const isSelected = form.languages.includes(lang);
            return (
              <TouchableOpacity
                key={lang}
                style={[styles.listItem, { borderBottomColor: theme.colors.border }]}
                onPress={() => toggleArrayItem('languages', lang, 5)}
              >
                <Typography variant="body" style={{ color: theme.colors.text, flex: 1 }}>{lang}</Typography>
                <View style={[styles.checkbox, { borderColor: isSelected ? theme.colors.neonGreen : theme.colors.border, backgroundColor: isSelected ? theme.colors.neonGreen : 'transparent' }]}> 
                  {isSelected && <Feather name="check" size={14} color={theme.colors.deepBlack} />}
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </Modal>
  );

  // Pronouns Modal
  const renderPronounsModal = () => (
    <Modal visible={activeModal === 'pronouns'} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}> 
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}> 
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}> 
            <Feather name="x" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Typography variant="h2" style={{ color: theme.colors.text, flex: 1, textAlign: 'center' }}>
            Pick your pronouns
          </Typography>
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
            <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>Done</Typography>
          </TouchableOpacity>
        </View>

        <View style={styles.modalSubheader}>
          <View style={[styles.pronounIcon, { backgroundColor: theme.colors.charcoal }]}> 
            <Feather name="users" size={28} color={theme.colors.text} />
          </View>
          <Typography variant="h1" style={{ color: theme.colors.text, marginTop: 16 }}>
            What are your pronouns?
          </Typography>
          <Typography variant="body" style={{ color: theme.colors.muted, marginTop: 8 }}>
            Pick your pronouns and we'll add these to your profile, right next to your name.
          </Typography>
        </View>

        <View style={styles.modalContent}>
          <Typography variant="bodyStrong" style={{ color: theme.colors.text, marginBottom: 8 }}>
            Pick up to 3 pronouns
          </Typography>
          <Typography variant="small" style={{ color: theme.colors.muted, marginBottom: 16 }}>
            You can come back and change or remove these at any time.
          </Typography>

          <View style={styles.chipsWrap}>
            {PRONOUN_OPTIONS.map((pronoun) => {
              const isSelected = form.pronouns.includes(pronoun);
              return (
                <TouchableOpacity
                  key={pronoun}
                  style={[
                    styles.chipWithIcon,
                    {
                      borderColor: isSelected ? theme.colors.secondaryHairline : theme.colors.border,
                      backgroundColor: isSelected ? theme.colors.secondaryHighlight : 'transparent',
                    },
                  ]}
                  onPress={() => toggleArrayItem('pronouns', pronoun, 3)}
                >
                  <Typography variant="small" style={{ color: theme.colors.text }}>{pronoun}</Typography>
                  <Feather name={isSelected ? 'check' : 'plus'} size={14} color={isSelected ? theme.colors.neonGreen : theme.colors.muted} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              );
            })}
          </View>

          {form.pronouns.length > 0 && (
            <View style={[styles.previewBox, { borderColor: theme.colors.border }]}> 
              <Typography variant="small" style={{ color: theme.colors.muted }}>Shown on your profile as:</Typography>
              <Typography variant="body" style={{ color: theme.colors.text, marginTop: 4 }}>
                {form.pronouns.join(', ')}
              </Typography>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  // Communities Modal
  const renderCommunitiesModal = () => (
    <Modal visible={activeModal === 'communities'} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}> 
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}> 
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}> 
            <Feather name="x" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Typography variant="h2" style={{ color: theme.colors.text, flex: 1, textAlign: 'center' }}>
            Causes and communities
          </Typography>
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
            <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>Done</Typography>
          </TouchableOpacity>
        </View>

        <View style={styles.modalSubheader}>
          <Typography variant="h1" style={{ color: theme.colors.text }}>
            Are there causes or communities you care about?
          </Typography>
          <Typography variant="body" style={{ color: theme.colors.muted, marginTop: 8 }}>
            Choose up to 3 options close to your heart.
          </Typography>
          <Typography variant="small" style={{ color: theme.colors.neonGreen, marginTop: 8 }}>
            You've chosen {form.communities.length} out of 3 options
          </Typography>
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalScrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.chipsWrap}>
            {COMMUNITY_OPTIONS.map((community) => {
              const isSelected = form.communities.includes(community);
              return (
                <TouchableOpacity
                  key={community}
                  style={[
                    styles.chipWithIcon,
                    {
                      borderColor: isSelected ? theme.colors.secondaryHairline : theme.colors.border,
                      backgroundColor: isSelected ? theme.colors.secondaryHighlight : 'transparent',
                    },
                  ]}
                  onPress={() => toggleArrayItem('communities', community, 3)}
                >
                  <Typography variant="small" style={{ color: theme.colors.text }}>{community}</Typography>
                  <Feather name={isSelected ? 'check' : 'plus'} size={14} color={isSelected ? theme.colors.neonGreen : theme.colors.muted} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </Modal>
  );

  // Bio Modal
  const renderBioModal = () => (
    <Modal visible={activeModal === 'bio'} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}> 
        <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}> 
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}> 
            <Feather name="x" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Typography variant="h2" style={{ color: theme.colors.text, flex: 1, textAlign: 'center' }}>
            Bio
          </Typography>
          <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalHeaderBtn}>
            <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>Done</Typography>
          </TouchableOpacity>
        </View>

        <View style={styles.modalSubheader}>
          <Typography variant="h1" style={{ color: theme.colors.text }}>
            Tell us about yourself
          </Typography>
          <Typography variant="body" style={{ color: theme.colors.muted, marginTop: 8 }}>
            This is for training our AI so that we can show you the best matches
          </Typography>
        </View>

        <View style={styles.modalContent}>
          <TextInput
            style={[styles.bioInput, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border, color: theme.colors.text }]}
            placeholder="Write a fun and punchy intro..."
            placeholderTextColor={theme.colors.muted}
            value={form.bio}
            onChangeText={(t) => setForm((prev) => ({ ...prev, bio: t }))}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={500}
          />
          <Typography variant="small" style={{ color: theme.colors.muted, textAlign: 'right', marginTop: 8 }}>
            {form.bio.length}/500
          </Typography>
        </View>
      </View>
    </Modal>
  );

  const renderMoreAboutModal = () => {
    const aboutRows: MoreAboutField[] = ['age', 'work', 'education', 'gender', 'location', 'hometown'];
    const moreRows: MoreAboutField[] = ['height', 'exercise', 'educationLevel', 'drinking', 'smoking', 'lookingFor', 'kids', 'haveKids', 'starSign', 'politics', 'religion'];

    return (
      <Modal visible={activeModal === 'moreAbout'} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}> 
          <PageHeader title="More about you" onBack={() => setActiveModal(null)} />

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.moreAboutContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <Typography variant="h2" style={{ color: theme.colors.text, marginBottom: 6 }}>
              About you
            </Typography>
            {aboutRows.map((field) => (
              <TouchableOpacity
                key={field}
                style={[styles.moreRow, { borderBottomColor: theme.colors.border }]}
                onPress={() => openMoreField(field)}
              >
                <View style={styles.moreRowLeft}>
                  {renderFieldIcon(field, theme.colors.muted)}
                  <Typography variant="body" style={{ color: theme.colors.text, marginLeft: 12 }}>
                    {titleForField(field)}
                  </Typography>
                </View>
                <View style={styles.moreRowRight}>
                  <Typography variant="body" style={{ color: theme.colors.muted }} numberOfLines={1}>
                    {getFieldValue(field)}
                  </Typography>
                  <Feather name="chevron-right" size={18} color={theme.colors.muted} />
                </View>
              </TouchableOpacity>
            ))}

            <Typography variant="h2" style={{ color: theme.colors.text, marginTop: 20, marginBottom: 6 }}>
              More about you
            </Typography>
            {moreRows.map((field) => (
              <TouchableOpacity
                key={field}
                style={[styles.moreRow, { borderBottomColor: theme.colors.border }]}
                onPress={() => openMoreField(field)}
              >
                <View style={styles.moreRowLeft}>
                  {renderFieldIcon(field, theme.colors.muted)}
                  <Typography variant="body" style={{ color: theme.colors.text, marginLeft: 12 }}>
                    {titleForField(field)}
                  </Typography>
                </View>
                <View style={styles.moreRowRight}>
                  <Typography variant="body" style={{ color: theme.colors.muted }} numberOfLines={1}>
                    {getFieldValue(field)}
                  </Typography>
                  <Feather name="chevron-right" size={18} color={theme.colors.muted} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderMoreFieldModal = () => {
    if (activeModal !== 'moreField' || !selectedMoreField) return null;

    const field = selectedMoreField;
    const options = editableOptionList(field);
    const title = titleForField(field);
    const value = getFieldValue(field) === 'Add' ? '' : getFieldValue(field).replace(' cm', '');

    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}> 
          <PageHeader title={title} onBack={() => setActiveModal('moreAbout')} />

          {options ? (
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.moreFieldContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {options.map((option) => {
                const selected = value.toLowerCase() === option.toLowerCase();
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.optionRow, { borderBottomColor: theme.colors.border }]}
                    onPress={() => {
                      setFieldValue(field, option);
                      setActiveModal('moreAbout');
                    }}
                  >
                    <Typography variant="body" style={{ color: theme.colors.text, flex: 1 }}>
                      {option}
                    </Typography>
                    {selected ? <Feather name="check" size={18} color={theme.colors.neonGreen} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.moreFieldInputWrap}>
              <Typography variant="small" style={{ color: theme.colors.muted, marginBottom: 10 }}>
                Enter {title.toLowerCase()}
              </Typography>
              <TextInput
                style={[styles.moreFieldInput, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder={`Add ${title.toLowerCase()}`}
                placeholderTextColor={theme.colors.muted}
                value={value}
                onChangeText={(text) => setFieldValue(field, text)}
                keyboardType={field === 'age' || field === 'height' ? 'number-pad' : 'default'}
              />
              <TouchableOpacity
                style={[styles.doneButton, { backgroundColor: theme.colors.neonGreen }]}
                onPress={() => setActiveModal('moreAbout')}
              >
                <Typography variant="bodyStrong" style={{ color: theme.colors.deepBlack }}>
                  Done
                </Typography>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.neonGreen} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <StatusBar barStyle="light-content" />

      <PageHeader title="Edit profile" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.rowItem, { borderBottomColor: theme.colors.border }]}
          onPress={onOpenPhotos}
        >
          <View style={styles.rowLeft}>
            <Feather name="camera" size={20} color={theme.colors.muted} />
            <Typography variant="body" style={{ color: theme.colors.text, marginLeft: 12 }}>
              Photos and videos
            </Typography>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rowItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => setActiveModal('bio')}
        >
          <View style={styles.rowLeft}>
            <Feather name="edit-3" size={20} color={theme.colors.muted} />
            <View style={styles.rowTextContainer}>
              <Typography variant="body" style={{ color: theme.colors.text }}>
                Tell us about yourself
              </Typography>
              <Typography variant="small" style={{ color: theme.colors.muted }} numberOfLines={1}>
                {form.bio || 'Write a fun and punchy intro...'}
              </Typography>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rowItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => setActiveModal('interests')}
        >
          <View style={styles.rowLeft}>
            <Feather name="heart" size={20} color={theme.colors.muted} />
            <View style={styles.rowTextContainer}>
              <Typography variant="body" style={{ color: theme.colors.text }}>
                Interests
              </Typography>
              <Typography variant="small" style={{ color: theme.colors.muted }}>
                {getDisplayValue(form.interests)}
              </Typography>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rowItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => { setSearchQuery(''); setActiveModal('languages'); }}
        >
          <View style={styles.rowLeft}>
            <Feather name="globe" size={20} color={theme.colors.muted} />
            <View style={styles.rowTextContainer}>
              <Typography variant="body" style={{ color: theme.colors.text }}>
                Languages
              </Typography>
              <Typography variant="small" style={{ color: theme.colors.muted }}>
                {getDisplayValue(form.languages)}
              </Typography>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rowItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => setActiveModal('pronouns')}
        >
          <View style={styles.rowLeft}>
            <Feather name="user" size={20} color={theme.colors.muted} />
            <View style={styles.rowTextContainer}>
              <Typography variant="body" style={{ color: theme.colors.text }}>
                Pronouns
              </Typography>
              <Typography variant="small" style={{ color: theme.colors.muted }}>
                {getDisplayValue(form.pronouns)}
              </Typography>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rowItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => setActiveModal('communities')}
        >
          <View style={styles.rowLeft}>
            <Feather name="users" size={20} color={theme.colors.muted} />
            <View style={styles.rowTextContainer}>
              <Typography variant="body" style={{ color: theme.colors.text }}>
                Causes and communities
              </Typography>
              <Typography variant="small" style={{ color: theme.colors.muted }}>
                {getDisplayValue(form.communities)}
              </Typography>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rowItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => setActiveModal('moreAbout')}
        >
          <View style={styles.rowLeft}>
            <Feather name="list" size={20} color={theme.colors.muted} />
            <View style={styles.rowTextContainer}>
              <Typography variant="body" style={{ color: theme.colors.text }}>
                More about you
              </Typography>
              <Typography variant="small" style={{ color: theme.colors.muted }}>
                {moreAboutCompletionCount} details added
              </Typography>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.colors.neonGreen }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.colors.deepBlack} />
          ) : (
            <Typography variant="bodyStrong" style={{ color: theme.colors.deepBlack }}>
              Save changes
            </Typography>
          )}
        </TouchableOpacity>
      </ScrollView>

      {renderInterestsModal()}
      {renderLanguagesModal()}
      {renderPronounsModal()}
      {renderCommunitiesModal()}
      {renderBioModal()}
      {renderMoreAboutModal()}
      {renderMoreFieldModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 120 },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowTextContainer: { marginLeft: 12, flex: 1 },
  saveButton: {
    marginHorizontal: 20,
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },

  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 16,
    paddingBottom: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  modalHeaderBtn: { width: 60, alignItems: 'center', justifyContent: 'center' },
  modalSubheader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  modalScroll: { flex: 1 },
  modalScrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  modalContent: { paddingHorizontal: 20, paddingTop: 16 },
  categorySection: { marginBottom: 24 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chipWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, fontFamily: 'RedHatDisplay_400Regular' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pronounIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  bioInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 150,
    fontFamily: 'RedHatDisplay_400Regular',
  },

  moreAboutContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  moreRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  moreRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '55%',
  },
  moreFieldContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  optionRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  moreFieldInputWrap: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 12,
  },
  moreFieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'RedHatDisplay_400Regular',
  },
  doneButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
  },
});
