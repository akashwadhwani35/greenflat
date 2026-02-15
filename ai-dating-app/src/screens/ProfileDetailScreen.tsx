import React, { useMemo, useState } from 'react';
import { Image, Modal, Platform, ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { MatchCandidate } from './MatchboardScreen';

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
  };

  const name = matchData.name || 'Profile';
  const age = matchData.age;
  const city = matchData.city || 'Location not set';
  const isVerified = Boolean(matchData.is_verified);
  const primaryPhoto = matchData.primary_photo ? { uri: matchData.primary_photo } : fallbackPhoto;
  const photos = toArray(matchData.photos);
  const cardPhotos = [primaryPhoto, ...photos.map((url) => ({ uri: url }))];
  const aboutText = (matchData.bio || matchData.match_reason || '').trim();
  const highlights = (matchData.interests && matchData.interests.length > 0)
    ? matchData.interests
    : (matchData.match_highlights || []);

  const lookingFor = useMemo(() => {
    if (matchData.relationship_goal) return [normalizeLabel(matchData.relationship_goal)];
    return ['Long-term relationship', 'Fun, casual dates'];
  }, [matchData.relationship_goal]);

  const promptCards = useMemo(
    () => buildPromptCards(name, aboutText, highlights),
    [name, aboutText, highlights]
  );

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerIconButton} activeOpacity={0.75}>
            <Feather name="arrow-left" size={20} color="#111111" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.headerIconButton} activeOpacity={0.75}>
            <Feather name="sliders" size={18} color="#111111" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.photoCard}>
            <Image source={primaryPhoto} style={styles.heroPhoto} />
          </View>

          <View style={styles.identityBlock}>
            <Typography variant="h2" style={styles.nameText}>
              {age ? `${name}, ${age}` : name}
            </Typography>
          </View>

          <View style={styles.sectionCard}>
            <Typography variant="bodyStrong" style={styles.sectionTitle}>
              About me
            </Typography>
            <View style={styles.chipRow}>
              {age ? <View style={styles.chip}><Typography variant="small" style={styles.chipText}>{age}</Typography></View> : null}
              <View style={styles.chip}>
                <Typography variant="small" style={styles.chipText}>
                  {isVerified ? 'Verified' : 'Member'}
                </Typography>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Typography variant="bodyStrong" style={styles.sectionTitle}>
              I'm looking for
            </Typography>
            <View style={styles.chipRow}>
              {lookingFor.map((item) => (
                <View key={item} style={styles.chip}>
                  <Typography variant="small" style={styles.chipText}>
                    {item}
                  </Typography>
                </View>
              ))}
            </View>
          </View>

          {highlights.length > 0 ? (
            <View style={styles.sectionCard}>
              <Typography variant="bodyStrong" style={styles.sectionTitle}>
                My interests
              </Typography>
              <View style={styles.chipRow}>
                {highlights.slice(0, 8).map((item) => (
                  <View key={item} style={styles.chip}>
                    <Typography variant="small" style={styles.chipText}>
                      {normalizeLabel(item)}
                    </Typography>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {promptCards.map((card, index) => (
            <View key={`${card.prompt}-${index}`} style={styles.promptCard}>
              <Image source={cardPhotos[index % cardPhotos.length]} style={styles.promptImage} />
              <View style={styles.promptTextBlock}>
                <Typography variant="bodyStrong" style={styles.promptTitle}>
                  {card.prompt}
                </Typography>
                <Typography variant="body" style={styles.promptAnswer}>
                  {card.answer}
                </Typography>
              </View>
              <TouchableOpacity
                style={styles.complimentRow}
                activeOpacity={0.8}
                disabled={!onSendCompliment || sendingComplimentKey === `${card.prompt}-${card.answer}`}
                onPress={() => { void handleCompliment(card.prompt, card.answer); }}
              >
                <Feather name="message-circle" size={14} color="#4D4D4D" />
                <Typography variant="small" style={styles.complimentText}>
                  {sendingComplimentKey === `${card.prompt}-${card.answer}` ? 'Sending...' : 'Compliment'}
                </Typography>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.sectionCard}>
            <Typography variant="bodyStrong" style={styles.sectionTitle}>
              My location
            </Typography>
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={14} color="#4D4D4D" />
              <Typography variant="small" style={styles.locationText}>
                {city}
              </Typography>
            </View>
          </View>

          <View style={styles.actionsWrap}>
            <View style={styles.actionButtons}>
              <TouchableOpacity onPress={onSwipeLeft} style={styles.roundButton} activeOpacity={0.8}>
                <Feather name="x" size={24} color="#222222" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.starButton} activeOpacity={0.8} onPress={onSuperlike}>
                <Feather name="star" size={22} color="#111111" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onSwipeRight} style={styles.roundButton} activeOpacity={0.8}>
                <Feather name="heart" size={22} color="#222222" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity activeOpacity={0.75} onPress={() => onBlock?.(match.id, name)}>
              <Typography variant="small" style={styles.blockText}>Block</Typography>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.75} onPress={() => onReport?.(match.id, name)}>
              <Typography variant="small" style={styles.reportText}>Report</Typography>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 0) + 8,
    paddingHorizontal: 10,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingBottom: 20,
    gap: 8,
  },
  photoCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
  },
  heroPhoto: {
    width: '100%',
    height: 455,
    backgroundColor: '#DDDDDD',
  },
  identityBlock: {
    paddingHorizontal: 6,
    paddingTop: 0,
  },
  nameText: {
    color: '#111111',
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 8,
  },
  sectionTitle: {
    color: '#111111',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F8F8',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chipText: {
    color: '#222222',
  },
  promptCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  promptImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#DDDDDD',
  },
  promptTextBlock: {
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 2,
  },
  promptTitle: {
    color: '#111111',
  },
  promptAnswer: {
    color: '#222222',
    lineHeight: 22,
  },
  complimentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  complimentText: {
    color: '#4D4D4D',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    color: '#222222',
  },
  actionsWrap: {
    marginTop: 4,
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 6,
    gap: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  roundButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9D9D9',
  },
  starButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5D74F',
    borderWidth: 1,
    borderColor: '#E5C53D',
  },
  blockText: {
    color: '#1F1F1F',
  },
  reportText: {
    color: '#A13636',
  },
});
