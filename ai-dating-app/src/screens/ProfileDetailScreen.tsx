import React, { useState } from 'react';
import { Alert, Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { MatchCandidate } from './MatchboardScreen';
import { PixelFlag } from '../components/PixelFlag';

type ProfileDetailScreenProps = {
  match: MatchCandidate | null;
  visible: boolean;
  onClose: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSuperlike?: () => void;
  onSendCompliment?: (targetUserId: number, content: string) => Promise<void> | void;
  onBlock?: (targetUserId: number, name: string) => void;
  onReport?: (targetUserId: number, name: string) => void;
  embedded?: boolean;
  hideActionButtons?: boolean;
};

const fallbackPhoto = require('../../assets/icon.png');

type PromptCard = {
  prompt: string;
  answer: string;
};

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

const toSecondPersonSummary = (value: string): string => {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';

  let summary = trimmed
    .replace(/^(the individual|this individual|the user|this person)\s+/i, '')
    .replace(/^(they|he|she)\s+(are|is)\s+/i, '');

  if (!/^you\b/i.test(summary)) {
    if (/^(are|have|tend|show|value|prefer|communicate|approach|bring)\b/i.test(summary)) {
      summary = `You ${summary}`;
    } else {
      summary = `You are ${summary.charAt(0).toLowerCase()}${summary.slice(1)}`;
    }
  }

  summary = summary
    .replace(/^you\s+is\b/i, 'You are')
    .replace(/^you\s+has\b/i, 'You have');

  return `${summary.charAt(0).toUpperCase()}${summary.slice(1)}`;
};

const buildPromptCards = (name: string, about: string, highlights: string[]): PromptCard[] => {
  const first = highlights[0] || 'slow evenings';
  const second = highlights[1] || 'coffee chats';
  const third = highlights[2] || 'weekend plans';

  return [
    {
      prompt: "I'm happiest when",
      answer: about || `${name.split(' ')[0]} enjoys meaningful conversations and calm moments.`,
    },
    {
      prompt: 'My perfect Sunday includes',
      answer: `A mix of ${first}, ${second}, and unhurried time together.`,
    },
    {
      prompt: 'My real-life superpower is',
      answer: `Showing up with empathy, curiosity, and a good plan for ${third}.`,
    },
  ];
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
  embedded = false,
  hideActionButtons = false,
}) => {
  const theme = useTheme();
  const [sendingComplimentKey, setSendingComplimentKey] = useState<string | null>(null);

  if (!match) return null;

  const matchData = match as MatchCandidate & {
    bio?: string;
    gender?: string;
    relationship_goal?: string;
    interests?: string[];
    photos?: string[];
    is_verified?: boolean;
    personality_summary?: string;
    top_traits?: string[];
  };

  const name = matchData.name || 'Profile';
  const age = matchData.age;
  const city = matchData.city || 'Location not set';
  const isVerified = Boolean(matchData.is_verified);
  const primaryPhoto = matchData.primary_photo ? { uri: matchData.primary_photo } : fallbackPhoto;
  const photos = toArray(matchData.photos);
  const cardPhotos = [primaryPhoto, ...photos.map((url) => ({ uri: url }))];
  const aboutText = toText(matchData.bio || matchData.match_reason || '');
  const interests = toTextArray(matchData.interests);
  const matchHighlights = toTextArray(matchData.match_highlights);
  const highlights = interests.length > 0 ? interests : matchHighlights;
  const personalitySummary = toSecondPersonSummary(toText(matchData.personality_summary));
  const personalityTopTraits = toTextArray(matchData.top_traits);

  const relationshipGoal = toText(matchData.relationship_goal);
  const lookingFor = relationshipGoal
    ? [normalizeLabel(relationshipGoal)]
    : ['Long-term relationship', 'Fun, casual dates'];
  const promptCards = buildPromptCards(name, aboutText, highlights);

  const handleCompliment = async (prompt: string, answer: string) => {
    if (!onSendCompliment) return;
    const key = `${prompt}-${answer}`;
    if (sendingComplimentKey) return;
    setSendingComplimentKey(key);
    try {
      const preview = answer.trim().replace(/\s+/g, ' ').slice(0, 110);
      const compliment = `Loved your "${prompt}" answer${preview ? `: ${preview}` : ''}`;
      await onSendCompliment(match.id, compliment);
    } finally {
      setSendingComplimentKey(null);
    }
  };

  const handleQuickMessage = () => {
    if (!onSendCompliment || sendingComplimentKey || promptCards.length === 0) return;
    const firstCard = promptCards[0];
    void handleCompliment(firstCard.prompt, firstCard.answer);
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

  const content = (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
        {showSafetyButton ? (
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
        bounces
      >
        <View style={[styles.photoCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
          <Image source={primaryPhoto} style={styles.heroPhoto} />
        </View>

        <View style={styles.identityBlock}>
          <Typography variant="h2" style={[styles.nameText, { color: theme.colors.text }]}>
            {age ? `${name}, ${age}` : name}
          </Typography>
        </View>

        <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
          <Typography variant="bodyStrong" style={[styles.sectionTitle, { color: theme.colors.text }]}>
            About me
          </Typography>
          <View style={styles.chipRow}>
            {age ? (
              <View style={[styles.chip, { borderColor: theme.colors.secondaryHairline, backgroundColor: theme.colors.secondaryHighlight }]}>
                <Typography variant="small" style={[styles.chipText, { color: theme.colors.textDark }]}>
                  {age}
                </Typography>
              </View>
            ) : null}
            <View style={[styles.chip, { borderColor: theme.colors.secondaryHairline, backgroundColor: theme.colors.secondaryHighlight }]}>
              <Typography variant="small" style={[styles.chipText, { color: theme.colors.textDark }]}>
                {isVerified ? 'Verified' : 'Member'}
              </Typography>
            </View>
          </View>
        </View>

        <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
          <Typography variant="bodyStrong" style={[styles.sectionTitle, { color: theme.colors.text }]}>
            I'm looking for
          </Typography>
          <View style={styles.chipRow}>
            {lookingFor.map((item) => (
              <View key={item} style={[styles.chip, { borderColor: theme.colors.secondaryHairline, backgroundColor: theme.colors.secondaryHighlight }]}>
                <Typography variant="small" style={[styles.chipText, { color: theme.colors.textDark }]}>
                  {item}
                </Typography>
              </View>
            ))}
          </View>
        </View>

        {highlights.length > 0 ? (
          <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
            <Typography variant="bodyStrong" style={[styles.sectionTitle, { color: theme.colors.text }]}>
              My interests
            </Typography>
            <View style={styles.chipRow}>
              {highlights.slice(0, 8).map((item) => (
                <View key={`interest-${item}`} style={[styles.chip, { borderColor: theme.colors.secondaryHairline, backgroundColor: theme.colors.secondaryHighlight }]}>
                  <Typography variant="small" style={[styles.chipText, { color: theme.colors.textDark }]}>
                    {normalizeLabel(item)}
                  </Typography>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {personalitySummary ? (
          <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
            <View style={styles.sectionHeaderRow}>
              <Feather name="star" size={16} color={theme.colors.neonGreen} />
              <Typography variant="bodyStrong" style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Personality snapshot
              </Typography>
            </View>
            <Typography variant="body" style={{ color: theme.colors.textDark, lineHeight: 22 }}>
              {personalitySummary}
            </Typography>
            {personalityTopTraits.length > 0 ? (
              <View style={styles.chipRow}>
                {personalityTopTraits.slice(0, 6).map((trait) => (
                  <View
                    key={`personality-trait-${trait}`}
                    style={[styles.chip, { borderColor: theme.colors.secondaryHairline, backgroundColor: theme.colors.secondaryHighlight }]}
                  >
                    <Typography variant="small" style={[styles.chipText, { color: theme.colors.textDark }]}>
                      {normalizeLabel(trait)}
                    </Typography>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {promptCards.map((card, index) => (
          <View key={`${card.prompt}-${index}`} style={[styles.promptCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
            <Image source={cardPhotos[index % cardPhotos.length]} style={styles.promptImage} />
            <View style={styles.promptTextBlock}>
              <Typography variant="bodyStrong" style={[styles.promptTitle, { color: theme.colors.text }]}>
                {card.prompt}
              </Typography>
              <Typography variant="body" style={[styles.promptAnswer, { color: theme.colors.textDark }]}>
                {card.answer}
              </Typography>
            </View>
            <TouchableOpacity
              style={[styles.complimentRow, { borderTopColor: theme.colors.border }]}
              activeOpacity={0.8}
              disabled={!onSendCompliment || sendingComplimentKey === `${card.prompt}-${card.answer}`}
              onPress={() => { void handleCompliment(card.prompt, card.answer); }}
            >
              <Feather name="message-circle" size={14} color={theme.colors.muted} />
              <Typography variant="small" style={[styles.complimentText, { color: theme.colors.muted }]}>
                {sendingComplimentKey === `${card.prompt}-${card.answer}` ? 'Sending...' : 'Compliment'}
              </Typography>
            </TouchableOpacity>
          </View>
        ))}

        <View style={[styles.sectionCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
          <Typography variant="bodyStrong" style={[styles.sectionTitle, { color: theme.colors.text }]}>
            My location
          </Typography>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={14} color={theme.colors.muted} />
            <Typography variant="small" style={[styles.locationText, { color: theme.colors.textDark }]}>
              {city}
            </Typography>
          </View>
        </View>

        {!hideActionButtons ? (
          <View style={styles.actionsWrap}>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                onPress={onSwipeLeft}
                style={[styles.circleActionButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
                activeOpacity={0.8}
              >
                <Feather name="x" size={36} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.circleActionButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
                activeOpacity={0.8}
                onPress={handleQuickMessage}
                disabled={!onSendCompliment || Boolean(sendingComplimentKey)}
              >
                <Feather name="message-circle" size={30} color={theme.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.centerFlagButton, { backgroundColor: theme.colors.neonGreen, borderColor: theme.colors.neonGreen }]}
                activeOpacity={0.8}
                onPress={onSuperlike}
              >
                <PixelFlag size={52} color={theme.colors.deepBlack} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSwipeRight}
                style={[styles.circleActionButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
                activeOpacity={0.8}
              >
                <Feather name="heart" size={34} color={theme.colors.neonGreen} />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );

  if (embedded) {
    return content;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
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
  scrollContent: {
    paddingHorizontal: 8,
    paddingBottom: Platform.OS === 'ios' ? 150 : 126,
    paddingTop: 8,
    flexGrow: 1,
    gap: 8,
  },
  photoCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  heroPhoto: {
    width: '100%',
    height: 500,
  },
  identityBlock: {
    paddingHorizontal: 8,
  },
  nameText: {
    lineHeight: 32,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
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
    paddingVertical: 6,
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
  actionsWrap: {
    marginTop: 8,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  circleActionButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  centerFlagButton: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
