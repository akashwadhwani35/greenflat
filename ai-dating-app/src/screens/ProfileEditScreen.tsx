import React, { useEffect, useState } from 'react';
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
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

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

type ModalType = 'interests' | 'languages' | 'pronouns' | 'communities' | 'bio' | null;

export const ProfileEditScreen: React.FC<Props> = ({ onBack, onOpenPhotos, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [form, setForm] = useState({
    name: '',
    city: '',
    bio: '',
    interests: [] as string[],
    languages: [] as string[],
    pronouns: [] as string[],
    communities: [] as string[],
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${apiBaseUrl}/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setForm({
            name: data.user?.name || '',
            city: data.user?.city || '',
            bio: data.profile?.bio || '',
            interests: Array.isArray(data.profile?.interests) ? data.profile.interests : [],
            languages: Array.isArray(data.profile?.languages) ? data.profile.languages : [],
            pronouns: Array.isArray(data.profile?.pronouns) ? data.profile.pronouns : [],
            communities: Array.isArray(data.profile?.communities) ? data.profile.communities : [],
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
      } else {
        if (maxItems && currentArray.length >= maxItems) {
          Alert.alert('Limit reached', `You can select up to ${maxItems} options.`);
          return prev;
        }
        return { ...prev, [key]: [...currentArray, item] };
      }
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        interests: form.interests,
        bio: form.bio,
        languages: form.languages,
        pronouns: form.pronouns,
        communities: form.communities,
        self_summary: form.bio,
      };

      await fetch(`${apiBaseUrl}/profile/basic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name, city: form.city }),
      });

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

  const getDisplayValue = (items: string[], maxShow = 2) => {
    if (items.length === 0) return 'Add';
    if (items.length <= maxShow) return items.join(', ');
    return `${items.slice(0, maxShow).join(', ')} +${items.length - maxShow}`;
  };

  const filteredLanguages = LANGUAGE_OPTIONS.filter(lang =>
    lang.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
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
                        { borderColor: isSelected ? theme.colors.neonGreen : theme.colors.border,
                          backgroundColor: isSelected ? 'rgba(173, 255, 26, 0.15)' : 'transparent' },
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

        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
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
                    { borderColor: isSelected ? theme.colors.neonGreen : theme.colors.border,
                      backgroundColor: isSelected ? 'rgba(173, 255, 26, 0.15)' : 'transparent' },
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

        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.chipsWrap}>
            {COMMUNITY_OPTIONS.map((community) => {
              const isSelected = form.communities.includes(community);
              return (
                <TouchableOpacity
                  key={community}
                  style={[
                    styles.chipWithIcon,
                    { borderColor: isSelected ? theme.colors.neonGreen : theme.colors.border,
                      backgroundColor: isSelected ? 'rgba(173, 255, 26, 0.15)' : 'transparent' },
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

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.deepBlack }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          <Feather name="chevron-left" size={28} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h2" style={{ color: theme.colors.text, flex: 1, textAlign: 'center' }}>
          Edit profile
        </Typography>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photos */}
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

        {/* Bio */}
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

        {/* Interests */}
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

        {/* Languages */}
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

        {/* Pronouns */}
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

        {/* Communities */}
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

        {/* Save Button */}
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

      {/* Modals */}
      {renderInterestsModal()}
      {renderLanguagesModal()}
      {renderPronounsModal()}
      {renderCommunitiesModal()}
      {renderBioModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 16,
    paddingBottom: 16,
    paddingHorizontal: 8,
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
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
  // Modal styles
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
  modalScroll: { flex: 1, paddingHorizontal: 20 },
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
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
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
  },
});
