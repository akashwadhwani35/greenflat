import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Animated,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

type Message = {
  id: string;
  type: 'user' | 'ai';
  text: string;
  timestamp: Date;
};

type SearchHistoryItem = {
  id: string;
  prompt: string;
  createdAt: string;
};

type AISearchScreenProps = {
  onBack?: () => void;
  onApplySearchQuery?: (query: string) => void;
  token?: string;
  apiBaseUrl?: string;
  userName?: string;
  userProfile?: {
    relationshipGoal?: string;
    interests?: string[];
    age?: number;
  };
};

const AI_HISTORY_KEY = '@greenflag_ai_prompt_history_v1';

const SEARCH_KEYWORDS = [
  'funny', 'ambitious', 'adventurous', 'creative', 'caring',
  'intelligent', 'spontaneous', 'romantic', 'confident',
  'kind', 'outgoing', 'calm', 'passionate', 'honest',
  'family-oriented', 'fitness lover', 'foodie', 'traveler', 'bookworm',
];

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const theme = useTheme();
  const isUser = message.type === 'user';
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View
      style={[
        styles.messageRow,
        isUser ? styles.userMessageRow : styles.aiMessageRow,
        { opacity: fadeAnim },
      ]}
    >
      <View style={{ maxWidth: '100%' }}>
        <View
          style={[
            styles.messageBubble,
            isUser
              ? { backgroundColor: theme.colors.neonGreen }
              : { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
          ]}
        >
          <Typography
            variant="small"
            style={{ color: isUser ? theme.colors.deepBlack : theme.colors.text }}
          >
            {message.text}
          </Typography>
        </View>
      </View>
    </Animated.View>
  );
};

const TypingIndicator: React.FC = () => {
  const theme = useTheme();
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {
            toValue: 1,
            duration: 500,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animate(dot1, 0);
    animate(dot2, 170);
    animate(dot3, 330);
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingContainer}>
      <Animated.View style={[styles.typingDot, { backgroundColor: theme.colors.neonGreen, opacity: dot1 }]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: theme.colors.neonGreen, opacity: dot2 }]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: theme.colors.neonGreen, opacity: dot3 }]} />
    </View>
  );
};

const normalizeSpaces = (input: string) => input.replace(/\s+/g, ' ').trim();

const hasMeaningfulKeyword = (input: string) => {
  // Require at least one real word token (2+ letters), not only punctuation/symbols.
  return /[A-Za-z]{2,}/.test(input);
};

const OFF_TOPIC_PATTERNS: RegExp[] = [
  /\b(poem|poetry|shayari)\b/i,
  /\b(song|lyrics|sing)\b/i,
  /\b(joke|funny joke|meme)\b/i,
  /\b(story|short story)\b/i,
  /\b(quote|caption)\b/i,
  /\b(code|program|debug)\b/i,
  /\b(translate|translation)\b/i,
  /\b(weather|forecast|temperature)\b/i,
  /\b(news|headline)\b/i,
  /\b(math|solve|equation)\b/i,
];

const isOffTopicPrompt = (input: string) => OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(input));

const summarizePrompt = (input: string) => {
  const cleaned = normalizeSpaces(input);
  if (cleaned.length <= 90) return cleaned;
  return `${cleaned.slice(0, 87)}...`;
};

export const AISearchScreen: React.FC<AISearchScreenProps> = ({
  onBack,
  onApplySearchQuery,
  token,
  apiBaseUrl,
  userName = 'there',
}) => {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [availableKeywords, setAvailableKeywords] = useState<string[]>(SEARCH_KEYWORDS);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const raw = await AsyncStorage.getItem(AI_HISTORY_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as SearchHistoryItem[];
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      } catch {
        setHistory([]);
      }
    };

    loadHistory().catch((err) => console.warn('Failed to load search history:', err));
  }, []);

  const saveHistory = async (next: SearchHistoryItem[]) => {
    try {
      await AsyncStorage.setItem(AI_HISTORY_KEY, JSON.stringify(next));
    } catch {
      // Ignore persistence failure in UI flow.
    }
  };

  const addHistoryItem = (prompt: string) => {
    const normalized = normalizeSpaces(prompt);
    if (!normalized) return;

    setHistory((prev) => {
      const deduped = prev.filter((item) => item.prompt.toLowerCase() !== normalized.toLowerCase());
      const next: SearchHistoryItem[] = [
        {
          id: `${Date.now()}`,
          prompt: normalized,
          createdAt: new Date().toISOString(),
        },
        ...deduped,
      ].slice(0, 40);

      void saveHistory(next);
      return next;
    });
  };

  const resetFreshPage = () => {
    setMessages([]);
    setInputText('');
    setIsTyping(false);
    setShowHistory(false);
    setAvailableKeywords(SEARCH_KEYWORDS);
  };

  const personalizedText = useMemo(() => {
    const firstName = userName.split(' ')[0];

    return {
      greeting: `Hey ${firstName} 👋`,
      intro: `I'm here to help you find your`,
      highlight: `match`,
      question: `Tell me clearly what kind of person you're looking for.`,
    };
  }, [userName]);

  const handleInvalidPrompt = (trimmed: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-invalid`,
        type: 'ai',
        text: "I couldn't understand that search. Please type clearly who you're looking for (for example: kind, happy, adventurous).",
        timestamp: new Date(),
      },
    ]);
    setIsTyping(false);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 80);
  };

  const handleOffTopicPrompt = () => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-offtopic`,
        type: 'ai',
        text: "I'm here to help you find the best possible match. Tell me what you're looking for in a partner.",
        timestamp: new Date(),
      },
    ]);
    setIsTyping(false);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 80);
  };

  const handleValidPrompt = async (trimmed: string, transcript: Message[]) => {
    setIsTyping(true);

    if (token && apiBaseUrl) {
      try {
        const response = await fetch(`${apiBaseUrl}/ai/sidekick`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: transcript.map((msg) => ({
              role: msg.type === 'user' ? 'user' : 'assistant',
              content: msg.text,
            })),
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body.error || 'Unable to process AI search');
        }

        const aiReply = typeof body.reply === 'string' ? body.reply : `Got it. Looking for ${summarizePrompt(trimmed)}.`;
        setMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-valid`, type: 'ai', text: aiReply, timestamp: new Date() },
        ]);

        if (Array.isArray(body.suggested_prompts) && body.suggested_prompts.length > 0) {
          setAvailableKeywords(body.suggested_prompts.slice(0, 12));
        }

        if (body.should_refresh && typeof body.inferred_search_query === 'string' && body.inferred_search_query.trim().length > 0) {
          const query = body.inferred_search_query.trim();
          addHistoryItem(query);
          onApplySearchQuery?.(query);
          resetFreshPage();
        } else {
          addHistoryItem(trimmed);
        }
      } catch (error: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-valid`,
            type: 'ai',
            text: error?.message || 'I hit a snag. Try rephrasing what you want in a partner.',
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsTyping(false);
      }
      return;
    }

    const summary = summarizePrompt(trimmed);
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-valid`,
        type: 'ai',
        text: `Gotcha, you're looking for ${summary}.\n\nI can run this once your account is connected.`,
        timestamp: new Date(),
      },
    ]);
    setIsTyping(false);
    addHistoryItem(trimmed);
  };

  const handleSendMessage = (text: string) => {
    const trimmed = normalizeSpaces(text);
    if (!trimmed) return;

    setShowHistory(false);

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      type: 'user',
      text: trimmed,
      timestamp: new Date(),
    };

    const transcript = [...messages, userMessage];
    setMessages(transcript);
    setInputText('');

    if (!hasMeaningfulKeyword(trimmed)) {
      handleInvalidPrompt(trimmed);
      return;
    }

    if (isOffTopicPrompt(trimmed)) {
      handleOffTopicPrompt();
      return;
    }

    void handleValidPrompt(trimmed, transcript);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 80);
  };

  const isEmpty = messages.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerIconButton} activeOpacity={0.7}>
          <Feather name="x" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
          {showHistory ? 'History' : 'AI Search'}
        </Typography>

        <TouchableOpacity
          onPress={() => setShowHistory((prev) => !prev)}
          style={styles.headerIconButton}
          activeOpacity={0.7}
        >
          <Feather name="clock" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {showHistory ? (
          <ScrollView contentContainerStyle={styles.historyContent} showsVerticalScrollIndicator={false}>
            {history.length === 0 ? (
              <View style={styles.historyEmptyState}>
                <Typography variant="body" muted align="center">
                  No previous prompts yet.
                </Typography>
              </View>
            ) : (
              history.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.historyCapsule, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
                  activeOpacity={0.85}
                  onPress={() => handleSendMessage(item.prompt)}
                >
                  <View style={[styles.historyIconPill, { backgroundColor: theme.colors.successTint }]}>
                    <Feather name="clock" size={15} color={theme.colors.neonGreen} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Typography variant="bodyStrong" style={{ color: theme.colors.text }} numberOfLines={1}>
                      {item.prompt}
                    </Typography>
                    <Typography variant="tiny" style={{ color: theme.colors.muted }}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Typography>
                  </View>
                  <Feather name="chevron-right" size={16} color={theme.colors.muted} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        ) : (
          <>
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={[
                styles.messagesContent,
                isEmpty && { flexGrow: 1, justifyContent: 'center' },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {isEmpty ? (
                <View style={styles.emptyState}>
                  <View style={styles.greetingContainer}>
                    <View style={styles.logoContainer}>
                      <Image
                        source={require('../../assets/3d-gf-logo.png')}
                        style={styles.logo3d}
                        resizeMode="contain"
                      />
                    </View>

                    <Typography
                      variant="small"
                      muted
                      align="center"
                      style={{ marginBottom: 12, marginTop: 24 }}
                    >
                      {personalizedText.greeting}
                    </Typography>

                    <Typography
                      variant="display"
                      align="center"
                      style={{ marginBottom: 20 }}
                    >
                      {personalizedText.intro}{'\n'}
                      <Typography
                        variant="display"
                        style={{ color: theme.colors.neonGreen }}
                      >
                        {personalizedText.highlight}
                      </Typography>
                    </Typography>

                    <Typography
                      variant="body"
                      muted
                      align="center"
                      style={{ paddingHorizontal: 24, marginBottom: 16 }}
                    >
                      {personalizedText.question}
                    </Typography>

                    <View style={styles.hintContainer}>
                      <Feather name="info" size={14} color={theme.colors.neonGreen} />
                      <Typography variant="tiny" muted style={{ marginLeft: 6 }}>
                        Example: "Kind, happy, emotionally mature, long-term, Bangalore"
                      </Typography>
                    </View>
                  </View>
                </View>
              ) : (
                <>
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}

                  {isTyping && (
                    <View style={[styles.messageRow, styles.aiMessageRow]}>
                      <View style={[styles.messageBubble, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}>
                        <TypingIndicator />
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {isEmpty ? (
              <View style={styles.keywordsSection}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.keywordsContainer}
                >
                  {availableKeywords.map((keyword) => (
                    <TouchableOpacity
                      key={keyword}
                      style={[styles.keywordChip, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}
                      onPress={() => {
                        setAvailableKeywords((prev) => prev.filter((item) => item !== keyword));
                        setInputText((prev) => {
                          const trimmed = prev.trim();
                          if (!trimmed) return keyword;
                          if (trimmed.endsWith(',')) return `${trimmed} ${keyword}`;
                          return `${trimmed}, ${keyword}`;
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <Typography variant="small" style={{ color: theme.colors.text }}>
                        {keyword}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={[styles.inputContainer, { borderTopColor: 'rgba(255, 255, 255, 0.06)' }]}>
              <View style={[styles.inputWrapper, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}>
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Describe your ideal match clearly..."
                  placeholderTextColor={theme.colors.muted}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={500}
                />
                {inputText.trim() ? (
                  <TouchableOpacity
                    style={[styles.sendButton, { backgroundColor: theme.colors.neonGreen }]}
                    onPress={() => handleSendMessage(inputText)}
                    activeOpacity={0.8}
                  >
                    <Feather name="arrow-up" size={20} color={theme.colors.deepBlack} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 16,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 12,
  },
  historyEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  historyCapsule: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyIconPill: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  greetingContainer: {
    alignItems: 'center',
    marginBottom: 8,
    paddingTop: 20,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo3d: {
    width: 140,
    height: 140,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },
  keywordsSection: {
    paddingVertical: 12,
  },
  keywordsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  keywordChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  messageRow: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  userMessageRow: {
    alignItems: 'flex-end',
  },
  aiMessageRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 120,
    paddingVertical: 10,
    paddingRight: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
