import React, { useEffect, useState } from 'react';
import { Alert, Image, Keyboard, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { MatchCandidate } from './MatchboardScreen';
import { PixelFlag } from '../components/PixelFlag';
import type { ViewerProfile } from '../hooks/useViewerProfile';
import { NoticeModal, type Notice } from '../components/NoticeModal';

type ProfileDetailScreenProps = {
  match: MatchCandidate | null;
  visible: boolean;
  onClose: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSuperlike?: () => void;
  onSendCompliment?: (targetUserId: number, content: string, photoUrl?: string | null) => Promise<boolean | void> | boolean | void;
  onBlock?: (targetUserId: number, name: string) => void;
  onReport?: (targetUserId: number, name: string) => void;
  onHeaderRightPress?: () => void;
  headerRightIcon?: React.ComponentProps<typeof Feather>['name'];
  headerRightAccessibilityLabel?: string;
  embedded?: boolean;
  hideActionButtons?: boolean;
  /** Like / Green Flag already sent from this account: those buttons go quiet. */
  alreadyLiked?: boolean;
  /** One First Move per person; the composer stays closed after it. */
  alreadyComplimented?: boolean;
  /** For the AI Match briefing (fetched per profile). */
  token?: string | null;
  apiBaseUrl?: string;
  /**
   * 'respond': opened from the Likes inbox after they liked / Green Flagged
   * you. Only Reject and Like, no First Move, no Green Flag.
   */
  actionMode?: 'full' | 'respond';
  /**
   * The signed-in user's own answers. When supplied, any detail the two people
   * share is rendered in green. Omitted when someone is previewing their own
   * profile, where highlighting everything would say nothing.
   */
  viewer?: ViewerProfile | null;
};

const fallbackPhoto = require('../../assets/icon.png');

const normalizeLabel = (value: string) =>
  value
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());

const toArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
};

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value && typeof value === 'object') {
    const candidate = (value as { label?: unknown; name?: unknown; value?: unknown });
    if (typeof candidate.label === 'string' || typeof candidate.label === 'number') {
      return String(candidate.label).trim();
    }
    if (typeof candidate.name === 'string' || typeof candidate.name === 'number') {
      return String(candidate.name).trim();
    }
    if (typeof candidate.value === 'string' || typeof candidate.value === 'number') {
      return String(candidate.value).trim();
    }
  }
  return '';
};

const toTextArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => toText(item))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return [trimmed];
  }

  return [];
};


export const ProfileDetailScreen: React.FC<ProfileDetailScreenProps> = ({
  match,
  visible,
  onClose,
  onSwipeLeft,
  onSwipeRight,
  onSendCompliment,
  onSuperlike,
  onBlock,
  onReport,
  onHeaderRightPress,
  headerRightIcon,
  headerRightAccessibilityLabel,
  embedded = false,
  hideActionButtons = false,
  alreadyLiked = false,
  alreadyComplimented = false,
  token = null,
  apiBaseUrl,
  actionMode = 'full',
  viewer = null,
}) => {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  // The photo the First Move is being sent from, shown in the popup and sent along.
  const [composerPhoto, setComposerPhoto] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingFailed, setBriefingFailed] = useState(false);
  const [sendingCompliment, setSendingCompliment] = useState(false);
  const [sentThisSession, setSentThisSession] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Which of their photos the hero shows; a tap moves to the next one.
  const [photoIndex, setPhotoIndex] = useState(0);
  // The Modal does not resize for the keyboard on Android, so the composer
  // shifts itself up by the keyboard's height and stays centred otherwise.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s1 = Keyboard.addListener(showEvt, (e) => setKeyboardHeight(e.endCoordinates?.height || 0));
    const s2 = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => { s1.remove(); s2.remove(); };
  }, []);
  const complimentDone = alreadyComplimented || sentThisSession;

  // Everything about the previous profile goes when a new one opens. The
  // "already sent" state used to follow the person from profile to profile.
  useEffect(() => {
    setSentThisSession(false);
    setComposerOpen(false);
    setComposerText('');
    setComposerPhoto(null);
    setPhotoIndex(0);
    setBriefing(null);
    setBriefingFailed(false);
  }, [match?.id]);

  // Full profile from the server. Cards opened from the Likes inbox or a chat
  // only carried a name, age, city and one photo; this fills in the rest,
  // including how far away they are.
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    setDetails(null);
    if (!match || !token || !apiBaseUrl || embedded) return;
    let cancelled = false;
    fetch(`${apiBaseUrl}/matches/user/${match.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.user) return;
        const photos: string[] = Array.isArray(data.photos)
          ? data.photos.map((p: any) => p?.photo_url).filter((u: unknown): u is string => typeof u === 'string' && u.length > 0)
          : [];
        const primary = Array.isArray(data.photos) ? data.photos.find((p: any) => p?.is_primary)?.photo_url : undefined;
        const next: Record<string, unknown> = {};
        Object.entries(data.user as Record<string, unknown>).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') next[key] = value;
        });
        if (photos.length > 0) next.photos = photos;
        if (typeof primary === 'string' && primary) next.primary_photo = primary;
        setDetails(next);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [match?.id, token, apiBaseUrl, embedded]);

  // AI Match briefing: what you two have in common, from both sets of answers.
  useEffect(() => {
    if (!match || !token || !apiBaseUrl || embedded) return;
    let cancelled = false;
    fetch(`${apiBaseUrl}/matches/${match.id}/briefing`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.briefing) setBriefing(String(data.briefing));
        else setBriefingFailed(true);
      })
      .catch(() => { if (!cancelled) setBriefingFailed(true); });
    return () => { cancelled = true; };
  }, [match?.id, token, apiBaseUrl, embedded]);

  if (!match) {
    if (embedded) return null;
    return (
      <Modal visible={visible} animationType="none" statusBarTranslucent onRequestClose={onClose}>
        <View style={[styles.container, { backgroundColor: '#101D13' }]} />
      </Modal>
    );
  }

  const matchData = { ...match, ...(details || {}) } as MatchCandidate & {
    bio?: string;
    gender?: string;
    relationship_goal?: string;
    interests?: string[];
    photos?: string[];
    is_verified?: boolean;
    personality_summary?: string;
    top_traits?: string[];
    personality_traits?: string[];
    pronouns?: string[];
    height?: number | string;
    body_type?: string;
    smoker?: boolean | string;
    smoking_habit?: string;
    drinker?: string;
    drugs?: string;
    diet?: string;
    fitness_level?: string;
    distance_km?: number;
  };

  const name = matchData.name || 'Profile';
  const age = matchData.age;
  const city = matchData.city || 'Location not set';
  const isVerified = Boolean(matchData.is_verified);
  const primaryPhoto = matchData.primary_photo ? { uri: matchData.primary_photo } : fallbackPhoto;
  // The primary photo is also in the photos list; without this it showed twice.
  const photoUrls = Array.from(
    new Set([matchData.primary_photo, ...toArray(matchData.photos)].filter((u): u is string => typeof u === 'string' && u.length > 0))
  );
  const cardPhotos = photoUrls.length > 0 ? photoUrls.map((url) => ({ uri: url })) : [primaryPhoto];
  const currentPhotoUrl = photoUrls[photoIndex % Math.max(1, photoUrls.length)] || null;
  const aboutText = toText(matchData.bio || matchData.match_reason || '');
  const interests = toTextArray(matchData.interests);
  const matchHighlights = toTextArray(matchData.match_highlights);
  const highlights = interests.length > 0 ? interests : matchHighlights;
  // Top traits first, then everything else the ten answers resolved to.
  // Three chips said very little about a person.
  const personalityTopTraits = Array.from(
    new Set([...toTextArray(matchData.top_traits), ...toTextArray(matchData.personality_traits)].map((t) => t.trim()).filter(Boolean))
  ).slice(0, 8);

  const relationshipGoal = toText(matchData.relationship_goal);
  const lookingFor = relationshipGoal
    ? [normalizeLabel(relationshipGoal)]
    : ['Long-term relationship', 'Fun, casual dates'];

  const pronouns = toTextArray(matchData.pronouns);

  /**
   * Green means "you two said the same thing".
   *
   * It is the one colour the brand spends, so it has to carry meaning rather
   * than decorate: a green bubble is always a shared answer, never emphasis.
   */
  const sharesAttribute = (key: string, value: string): boolean => {
    if (!viewer || !value) return false;
    const mine = viewer.attributes[key];
    return Boolean(mine) && mine === value.trim().toLowerCase();
  };

  const viewerInterestSet = new Set(
    (viewer?.interests || []).map((item) => item.trim().toLowerCase())
  );
  const viewerTraitSet = new Set((viewer?.traits || []).map((item) => item.trim().toLowerCase()));

  const sharesInterest = (value: string) => viewerInterestSet.has(value.trim().toLowerCase());
  const sharesTrait = (value: string) => viewerTraitSet.has(value.trim().toLowerCase());

  const smokingValue = toText(
    matchData.smoking_habit ||
      (typeof matchData.smoker === 'boolean'
        ? matchData.smoker
          ? 'regular'
          : 'never'
        : matchData.smoker)
  );

  const heightValue = matchData.height ? String(matchData.height) : '';
  // Miles, per the board ("would say mile mein hi rakhiyega").
  const distanceValue =
    typeof matchData.distance_km === 'number' && Number.isFinite(matchData.distance_km)
      ? `${Math.max(1, Math.round(matchData.distance_km * 0.621371))} mi away`
      : '';

  // Section 2 of the card, in the order the design board sets out: location,
  // distance, exercise, smoking, drinking, height.
  const basics: { key: string; label: string; value: string; shared: boolean }[] = [
    { key: 'city', label: 'Lives in', value: matchData.city || '', shared: sharesAttribute('city', matchData.city || '') },
    { key: 'distance', label: 'Distance', value: distanceValue, shared: false },
    { key: 'fitness_level', label: 'Exercise', value: toText(matchData.fitness_level), shared: sharesAttribute('fitness_level', toText(matchData.fitness_level)) },
    { key: 'smoker', label: 'Smoking', value: smokingValue, shared: sharesAttribute('smoker', smokingValue) },
    { key: 'drinker', label: 'Drinking', value: toText(matchData.drinker), shared: sharesAttribute('drinker', toText(matchData.drinker)) },
    { key: 'height', label: 'Height', value: heightValue, shared: false },
  ].filter((row) => row.value.length > 0);

  // Section 5, "add rest": anything else worth saying, once the ordered ones are done.
  const extras: { key: string; label: string; value: string; shared: boolean }[] = [
    { key: 'body_type', label: 'Body type', value: toText(matchData.body_type), shared: false },
    { key: 'diet', label: 'Diet', value: toText(matchData.diet), shared: sharesAttribute('diet', toText(matchData.diet)) },
    { key: 'drugs', label: 'Drugs', value: toText(matchData.drugs), shared: sharesAttribute('drugs', toText(matchData.drugs)) },
  ].filter((row) => row.value.length > 0);

  const bubbleStyle = (shared: boolean) => ({
    borderColor: shared ? theme.colors.neonGreen : theme.colors.secondaryHairline,
    backgroundColor: shared ? 'rgba(173, 255, 26, 0.14)' : theme.colors.secondaryHighlight,
  });

  const bubbleTextColor = (shared: boolean) =>
    shared ? theme.colors.neonGreen : theme.colors.textDark;

  // Nothing is sent until the person has written something. The First Move
  // button used to fire a canned line straight away.
  const openComposer = (seed = '', photoUrl: string | null = null) => {
    if (!onSendCompliment || sendingCompliment) return;
    if (complimentDone) {
      setNotice({ title: 'Already made', message: `You have already made your First Move with ${name}.`, icon: 'message-circle' });
      return;
    }
    setComposerText(seed);
    setComposerPhoto(photoUrl);
    setComposerOpen(true);
  };

  const handleQuickMessage = () => openComposer('');

  const submitCompliment = async () => {
    const text = composerText.trim().replace(/\s+/g, ' ');
    if (!onSendCompliment || sendingCompliment || complimentDone) return;
    if (text.length < 2) {
      setNotice({ title: 'Write something first', message: 'A First Move needs a few words.', tone: 'error', icon: 'edit-3' });
      return;
    }
    setSendingCompliment(true);
    try {
      const result = await onSendCompliment(match.id, text.slice(0, 300), composerPhoto);
      if (result !== false) {
        setSentThisSession(true);
        setComposerOpen(false);
        setComposerText('');
        setComposerPhoto(null);
      }
    } finally {
      setSendingCompliment(false);
    }
  };

  const handleSafetyMenu = () => {
    if (!onBlock && !onReport) {
      return;
    }
    const actions: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }> = [];
    if (onBlock) {
      actions.push({
        text: 'Block',
        style: 'destructive',
        onPress: () => onBlock(match.id, name),
      });
    }
    if (onReport) {
      actions.push({
        text: 'Report',
        style: 'destructive',
        onPress: () => onReport(match.id, name),
      });
    }
    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Safety', `Manage your interaction with ${name}.`, actions);
  };

  const showSafetyButton = !hideActionButtons && Boolean(onBlock || onReport);
  const showCustomRightButton = Boolean(onHeaderRightPress && headerRightIcon);

  const content = (
    <View style={[styles.container, { backgroundColor: theme.colors.background }, embedded ? null : { height: windowHeight }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { backgroundColor: theme.colors.deepBlack, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={onClose}
          style={[styles.headerIconButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
          activeOpacity={0.75}
        >
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {showCustomRightButton ? (
          <TouchableOpacity
            style={[styles.headerIconButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
            activeOpacity={0.75}
            onPress={onHeaderRightPress}
            accessibilityRole="button"
            accessibilityLabel={headerRightAccessibilityLabel || 'Header action'}
          >
            <Feather name={headerRightIcon as any} size={18} color={theme.colors.text} />
          </TouchableOpacity>
        ) : showSafetyButton ? (
          <TouchableOpacity
            style={[styles.headerIconButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
            activeOpacity={0.75}
            onPress={handleSafetyMenu}
          >
            <Feather name="sliders" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerIconSpacer} />
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        nestedScrollEnabled
        bounces
      >
        {/* Every photo lives here. Tap anywhere on it for the next one. */}
        <Pressable
          style={[styles.photoCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}
          onPress={() => setPhotoIndex((i) => (cardPhotos.length ? (i + 1) % cardPhotos.length : 0))}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Photo ${photoIndex + 1} of ${cardPhotos.length}, tap for next`}
        >
          <Image source={cardPhotos[photoIndex % Math.max(1, cardPhotos.length)] || primaryPhoto} style={styles.heroPhoto} />
          {!hideActionButtons && actionMode === 'full' && onSendCompliment ? (
            <Pressable
              style={({ pressed }) => [
                styles.photoFirstMove,
                { backgroundColor: complimentDone ? 'rgba(16, 29, 19, 0.85)' : theme.colors.neonGreen, borderColor: complimentDone ? theme.colors.neonGreen : theme.colors.neonGreen },
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => openComposer('', currentPhotoUrl)}
              accessibilityLabel="First Move on this photo"
            >
              <Feather name="message-circle" size={14} color={complimentDone ? theme.colors.neonGreen : theme.colors.deepBlack} />
              <Typography variant="tiny" style={{ color: complimentDone ? theme.colors.neonGreen : theme.colors.deepBlack, fontFamily: 'RedHatDisplay_700Bold', fontSize: 12 }}>
                {complimentDone ? 'First Move sent' : 'First Move'}
              </Typography>
            </Pressable>
          ) : null}
          {cardPhotos.length > 1 ? (
            <View style={styles.photoDots} pointerEvents="none">
              {cardPhotos.map((_, i) => (
                <View
                  key={`dot-${i}`}
                  style={[
                    styles.photoDot,
                    { backgroundColor: i === photoIndex % cardPhotos.length ? theme.colors.neonGreen : 'rgba(255,255,255,0.45)' },
                    i === photoIndex % cardPhotos.length ? styles.photoDotActive : null,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </Pressable>

        <View style={styles.identityBlock}>
          <View style={styles.identityRow}>
            <Typography variant="h1" style={[styles.nameText, { color: theme.colors.text }]}>
              {name}
              {age ? <Typography variant="h2" style={{ color: theme.colors.muted }}>{`, ${age}`}</Typography> : null}
            </Typography>
            {pronouns.length > 0 ? (
              <View style={[styles.pronounChip, { borderColor: theme.colors.secondaryHairline, backgroundColor: theme.colors.secondaryHighlight }]}>
                <Typography variant="small" style={{ color: theme.colors.textDark }}>{pronouns[0]}</Typography>
              </View>
            ) : null}
          </View>
        </View>

        {!embedded && !hideActionButtons && actionMode === 'full' && token && !briefingFailed ? (
          <View style={[styles.briefingCard, { borderColor: 'rgba(173, 255, 26, 0.35)', backgroundColor: 'rgba(173, 255, 26, 0.06)' }]}>
            <View style={styles.sectionHeaderRow}>
              <PixelFlag size={14} color={theme.colors.neonGreen} />
              <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>AI Match briefing</Typography>
            </View>
            <Typography variant="body" style={{ color: theme.colors.text, lineHeight: 22 }}>
              {briefing || 'Reading both of your answers...'}
            </Typography>
            {onSendCompliment ? (
              <Pressable
                style={({ pressed }) => [styles.briefingButton, { backgroundColor: complimentDone ? theme.colors.secondaryHighlight : theme.colors.neonGreen }, pressed && { opacity: 0.85 }]}
                onPress={() => openComposer('')}
              >
                <Feather name="message-circle" size={15} color={complimentDone ? theme.colors.muted : theme.colors.deepBlack} />
                <Typography variant="bodyStrong" style={{ color: complimentDone ? theme.colors.muted : theme.colors.deepBlack }}>
                  {complimentDone ? 'First Move sent' : 'Make your First Move'}
                </Typography>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {aboutText ? (
          <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
            <Typography variant="bodyStrong" style={[styles.sectionTitle, { color: theme.colors.text }]}>
              About {name}
            </Typography>
            <Typography variant="body" style={{ color: theme.colors.textDark, lineHeight: 22 }}>
              {aboutText}
            </Typography>
          </View>
        ) : null}


        {/* 1 — relationship type */}
        <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
          <Typography variant="bodyStrong" style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Looking for
          </Typography>
          <View style={styles.chipRow}>
            {lookingFor.map((item) => {
              const shared = sharesAttribute('relationship_goal', item);
              return (
                <View key={item} style={[styles.chip, bubbleStyle(shared)]}>
                  <Typography variant="small" style={[styles.chipText, { color: bubbleTextColor(shared) }]}>
                    {item}
                  </Typography>
                </View>
              );
            })}
            <View style={[styles.chip, { borderColor: theme.colors.secondaryHairline, backgroundColor: theme.colors.secondaryHighlight }]}>
              <Typography variant="small" style={[styles.chipText, { color: theme.colors.textDark }]}>
                {isVerified ? 'Verified' : 'Member'}
              </Typography>
            </View>
          </View>
        </View>

        {/* 2 — location, distance, exercise, smoking, drinking, height */}
        {basics.length > 0 ? (
          <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
            <Typography variant="bodyStrong" style={[styles.sectionTitle, { color: theme.colors.text }]}>
              The basics
            </Typography>
            <View style={styles.chipRow}>
              {basics.map((row) => (
                <View key={row.key} style={[styles.chip, bubbleStyle(row.shared)]}>
                  <Typography variant="small" style={[styles.chipText, { color: bubbleTextColor(row.shared) }]}>
                    {row.key === 'city' || row.key === 'distance' || row.key === 'height'
                      ? row.value
                      : `${row.label}: ${normalizeLabel(row.value)}`}
                  </Typography>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* 3 — interests */}
        {highlights.length > 0 ? (
          <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
            <Typography variant="bodyStrong" style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Interests
            </Typography>
            <View style={styles.chipRow}>
              {highlights.slice(0, 8).map((item) => {
                const shared = sharesInterest(item);
                return (
                  <View key={`interest-${item}`} style={[styles.chip, bubbleStyle(shared)]}>
                    <Typography variant="small" style={[styles.chipText, { color: bubbleTextColor(shared) }]}>
                      {normalizeLabel(item)}
                    </Typography>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* 4 — personality snapshot: keyword bubbles only, no generated prose */}
        {personalityTopTraits.length > 0 ? (
          <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
            <View style={styles.sectionHeaderRow}>
              <Feather name="star" size={16} color={theme.colors.neonGreen} />
              <Typography variant="bodyStrong" style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Personality snapshot
              </Typography>
            </View>
            <View style={styles.chipRow}>
              {personalityTopTraits.map((trait) => {
                const shared = sharesTrait(trait);
                return (
                  <View key={`personality-trait-${trait}`} style={[styles.chip, bubbleStyle(shared)]}>
                    <Typography variant="small" style={[styles.chipText, { color: bubbleTextColor(shared) }]}>
                      {normalizeLabel(trait)}
                    </Typography>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* 5 — the rest */}
        {extras.length > 0 ? (
          <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
            <Typography variant="bodyStrong" style={[styles.sectionTitle, { color: theme.colors.text }]}>
              More about {name}
            </Typography>
            <View style={styles.chipRow}>
              {extras.map((row) => (
                <View key={row.key} style={[styles.chip, bubbleStyle(row.shared)]}>
                  <Typography variant="small" style={[styles.chipText, { color: bubbleTextColor(row.shared) }]}>
                    {`${row.label}: ${normalizeLabel(row.value)}`}
                  </Typography>
                </View>
              ))}
            </View>
          </View>
        ) : null}


        <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
          <Typography variant="bodyStrong" style={[styles.sectionTitle, { color: theme.colors.text }]}>
            My location
          </Typography>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={14} color={theme.colors.muted} />
            <Typography variant="small" style={[styles.locationText, { color: theme.colors.textDark }]}>
              {city}
            </Typography>
            {distanceValue ? (
              <View style={[styles.chip, styles.distanceBubble, bubbleStyle(false)]}>
                <Feather name="navigation" size={11} color={bubbleTextColor(false)} />
                <Typography variant="tiny" style={{ color: bubbleTextColor(false) }}>
                  {distanceValue}
                </Typography>
              </View>
            ) : null}
          </View>
        </View>

      </ScrollView>
        {!hideActionButtons && actionMode === 'respond' ? (
          <View style={styles.actionsFixed} pointerEvents="box-none">
            <View style={styles.actionButtons}>
              <TouchableOpacity
                onPress={onSwipeLeft}
                style={[styles.respondButton, { backgroundColor: 'rgba(16, 29, 19, 0.92)', borderColor: theme.colors.secondaryHairline }]}
                activeOpacity={0.8}
                accessibilityLabel="Reject"
              >
                <Feather name="x" size={28} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSwipeRight}
                style={[styles.respondButton, { backgroundColor: theme.colors.neonGreen, borderColor: theme.colors.neonGreen }]}
                activeOpacity={0.8}
                accessibilityLabel="Like"
              >
                <Feather name="heart" size={28} color={theme.colors.deepBlack} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        {!hideActionButtons && actionMode === 'full' ? (
          <View style={styles.actionsFixed} pointerEvents="box-none">
            <View style={styles.actionButtons}>
              <TouchableOpacity
                onPress={onSwipeLeft}
                style={[styles.circleActionButton, { backgroundColor: 'rgba(16, 29, 19, 0.92)', borderColor: theme.colors.secondaryHairline }]}
                activeOpacity={0.8}
                accessibilityLabel="Pass"
              >
                <Feather name="x" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.circleActionButton,
                  { backgroundColor: 'rgba(16, 29, 19, 0.92)', borderColor: complimentDone ? theme.colors.neonGreen : theme.colors.secondaryHairline },
                ]}
                activeOpacity={0.8}
                onPress={handleQuickMessage}
                disabled={!onSendCompliment || sendingCompliment}
                accessibilityLabel="First Move"
              >
                <Feather name="message-circle" size={22} color={complimentDone ? theme.colors.neonGreen : theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.centerFlagButton,
                  { backgroundColor: theme.colors.neonGreen, borderColor: theme.colors.neonGreen },
                  alreadyLiked ? styles.actionUsed : null,
                ]}
                activeOpacity={0.8}
                onPress={onSuperlike}
                disabled={alreadyLiked}
                accessibilityLabel="Green Flag"
              >
                <PixelFlag size={34} color={theme.colors.deepBlack} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSwipeRight}
                style={[
                  styles.circleActionButton,
                  { backgroundColor: 'rgba(16, 29, 19, 0.92)', borderColor: alreadyLiked ? theme.colors.neonGreen : theme.colors.secondaryHairline },
                  alreadyLiked ? styles.actionUsed : null,
                ]}
                activeOpacity={0.8}
                disabled={alreadyLiked}
                accessibilityLabel="Like"
              >
                <Feather name="heart" size={24} color={theme.colors.neonGreen} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {composerOpen ? (
          <View style={[styles.composerBackdrop, { paddingBottom: keyboardHeight }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => !sendingCompliment && setComposerOpen(false)} />
            <View style={[styles.composerCard, { backgroundColor: theme.colors.surface }]}>
              <Pressable style={styles.composerClose} onPress={() => !sendingCompliment && setComposerOpen(false)} hitSlop={8}>
                <Feather name="x" size={22} color={theme.colors.muted} />
              </Pressable>
              <View style={[styles.composerIcon, { backgroundColor: theme.colors.neonGreen }]}>
                <Feather name="message-circle" size={26} color={theme.colors.deepBlack} />
              </View>
              <Typography variant="h2" style={[styles.composerTitle, { color: theme.colors.text }]}>
                First Move
              </Typography>
              {composerPhoto ? (
                <View style={[styles.composerPhotoRow, { borderColor: theme.colors.secondaryHairline, backgroundColor: theme.colors.background }]}>
                  <Image source={{ uri: composerPhoto }} style={styles.composerPhoto} />
                  <Typography variant="small" style={{ color: theme.colors.muted, flex: 1 }}>
                    About this photo of {name}. It goes with your message.
                  </Typography>
                </View>
              ) : null}
              <Typography variant="small" style={[styles.composerBody, { color: theme.colors.muted }]}>
                Tell them what caught your attention.
              </Typography>
              <TextInput
                style={[
                  styles.composerInput,
                  { color: theme.colors.text, borderColor: theme.colors.secondaryHairline, backgroundColor: theme.colors.background },
                ]}
                value={composerText}
                onChangeText={(t) => setComposerText(t.slice(0, 300))}
                placeholder={composerPhoto ? 'Say something about this photo...' : `What caught your attention about ${name}?`}
                placeholderTextColor={theme.colors.muted}
                multiline
                maxLength={300}
                autoFocus
                textAlignVertical="top"
                editable={!sendingCompliment}
              />
              <Typography variant="tiny" style={{ color: theme.colors.muted, alignSelf: 'flex-end', marginTop: 6 }}>
                {composerText.length}/300
              </Typography>
              <Pressable
                style={({ pressed }) => [
                  styles.composerButton,
                  { backgroundColor: theme.colors.neonGreen },
                  (pressed || sendingCompliment || composerText.trim().length < 2) && { opacity: 0.6 },
                ]}
                onPress={() => { void submitCompliment(); }}
                disabled={sendingCompliment || composerText.trim().length < 2}
              >
                <Typography variant="bodyStrong" style={{ color: '#000', fontSize: 17 }}>
                  {sendingCompliment ? 'Sending...' : 'Send First Move'}
                </Typography>
              </Pressable>
            </View>
          </View>
        ) : null}
        <NoticeModal notice={notice} onClose={() => setNotice(null)} />
    </View>
  );

  if (embedded) {
    return content;
  }

  // No dialog animation: on Android the animated Modal left the profile unable
  // to fling-scroll afterwards (slow drags worked, flicks did nothing). Checked
  // on a Pixel 9 emulator on 2026-09-02: "slide" and "fade" both misbehaved,
  // "none" flings normally.
  return (
    <Modal
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 0) + 8,
    paddingHorizontal: 10,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerIconSpacer: {
    width: 38,
    height: 38,
  },
  scrollView: {
    flex: 1,
  },
  // Narrower cards with more air around them: the board asked for a more
  // minimal look than edge-to-edge boxes.
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 120 : 104,
    paddingTop: 8,
    flexGrow: 1,
    gap: 10,
  },
  photoCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  heroPhoto: {
    width: '100%',
    height: 440,
  },
  identityBlock: {
    paddingHorizontal: 4,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  pronounChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  briefingCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  distanceBubble: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  briefingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 12,
    marginTop: 2,
  },
  photoFirstMove: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  respondButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  composerPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
  },
  composerPhoto: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  nameText: {
    lineHeight: 38,
    fontFamily: 'RedHatDisplay_700Bold',
  },
  photoDots: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  photoDotActive: {
    width: 18,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  sectionTitle: {},
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {},
  promptCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  promptImage: {
    width: '100%',
    height: 300,
  },
  promptTextBlock: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 4,
  },
  promptTitle: {},
  promptAnswer: {
    lineHeight: 22,
  },
  complimentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  complimentText: {},
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {},
  // Pinned to the bottom of the screen so the like / Green Flag / pass buttons
  // are reachable without scrolling to the end of a long profile. No bar
  // behind them: the buttons float over the profile.
  actionsFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 26 : 16,
    backgroundColor: 'transparent',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  circleActionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  centerFlagButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  actionUsed: {
    opacity: 0.4,
  },
  // Compliment composer: same shape as the welcome popup.
  // Centred in whatever space the keyboard leaves (paddingBottom is set to
  // the keyboard height at runtime), a little below the middle when closed.
  composerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
    zIndex: 50,
  },
  composerCard: {
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  composerClose: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  composerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 12,
  },
  composerTitle: {
    textAlign: 'center',
    marginBottom: 6,
  },
  composerBody: {
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  composerInput: {
    width: '100%',
    minHeight: 96,
    maxHeight: 150,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: 'RedHatDisplay_400Regular',
  },
  composerButton: {
    marginTop: 14,
    borderRadius: 999,
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
  },
});
