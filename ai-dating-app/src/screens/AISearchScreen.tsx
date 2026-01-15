import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { PixelFlag } from '../components/PixelFlag';

const AI_CHAT_STORAGE_KEY = '@greenflag_ai_chat_messages';
const AI_CHAT_QUERY_KEY = '@greenflag_ai_pending_query';

type Message = {
  id: string;
  type: 'user' | 'ai';
  text: string;
  timestamp: Date;
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

// Keyword chips for quick selection
const SEARCH_KEYWORDS = [
  'funny', 'ambitious', 'adventurous', 'creative', 'caring',
  'intelligent', 'spontaneous', 'romantic', 'loyal', 'confident',
  'kind', 'outgoing', 'calm', 'passionate', 'honest',
  'family-oriented', 'fitness lover', 'foodie', 'traveler', 'bookworm',
];

// Message Bubble Component
const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const theme = useTheme();
  const isUser = message.type === 'user';
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

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

// Minimal typing indicator
const TypingIndicator: React.FC = () => {
  const theme = useTheme();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {
            toValue: 1,
            duration: 600,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);

  return (
    <View style={styles.typingContainer}>
      <Animated.View style={[styles.typingDot, { backgroundColor: theme.colors.neonGreen, opacity: dot1 }]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: theme.colors.neonGreen, opacity: dot2 }]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: theme.colors.neonGreen, opacity: dot3 }]} />
    </View>
  );
};

export const AISearchScreen: React.FC<AISearchScreenProps> = ({
  onBack,
  onApplySearchQuery,
  token,
  apiBaseUrl,
  userName = 'there',
  userProfile,
}) => {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('I am looking for ');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted messages on mount
  useEffect(() => {
    const loadPersistedChat = async () => {
      try {
        const [savedMessages, savedQuery] = await Promise.all([
          AsyncStorage.getItem(AI_CHAT_STORAGE_KEY),
          AsyncStorage.getItem(AI_CHAT_QUERY_KEY),
        ]);
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          // Convert timestamp strings back to Date objects
          const messagesWithDates = parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
          setMessages(messagesWithDates);
        }
        if (savedQuery) {
          setPendingQuery(savedQuery);
        }
      } catch (error) {
        console.warn('Failed to load AI chat history:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadPersistedChat();
  }, []);

  // Save messages whenever they change
  useEffect(() => {
    if (!isLoaded) return; // Don't save until initial load is complete
    const saveMessages = async () => {
      try {
        await AsyncStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(messages));
      } catch (error) {
        console.warn('Failed to save AI chat history:', error);
      }
    };
    saveMessages();
  }, [messages, isLoaded]);

  // Save pending query when it changes
  useEffect(() => {
    if (!isLoaded) return;
    const saveQuery = async () => {
      try {
        if (pendingQuery) {
          await AsyncStorage.setItem(AI_CHAT_QUERY_KEY, pendingQuery);
        } else {
          await AsyncStorage.removeItem(AI_CHAT_QUERY_KEY);
        }
      } catch (error) {
        console.warn('Failed to save pending query:', error);
      }
    };
    saveQuery();
  }, [pendingQuery, isLoaded]);

  // Generate personalized greeting based on user profile
  const getPersonalizedGreeting = () => {
    const firstName = userName.split(' ')[0];
    const relationshipGoal = userProfile?.relationshipGoal || 'meaningful connections';

    return {
      greeting: `Hey ${firstName} 👋`,
      intro: `I'm here to help you find your`,
      highlight: `GreenFlag`,
      question: `What qualities matter most to you in a match right now?`,
    };
  };

  const personalizedText = getPersonalizedGreeting();

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const trimmed = text.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);
    setPendingQuery(trimmed);

    const fallback = () => {
      const reply =
        `Okay, I’m with you.\n\n` +
        `Quick 2 questions so I don’t miss:\n` +
        `1) What vibe do you want (calm, playful, ambitious, artsy)?\n` +
        `2) Any hard filters (age range / city / long-term vs casual)?`;
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), type: 'ai', text: reply, timestamp: new Date() },
      ]);
      setSuggestedPrompts([
        'Emotionally mature and consistent — long-term.',
        'Playful + adventurous, loves travel & hikes.',
        'Someone calm, kind, and good at communication.',
      ]);
      setIsTyping(false);
    };

    try {
      if (!token || !apiBaseUrl) {
        fallback();
      } else {
        const body = {
          messages: [...messages, userMessage].map((m) => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
        };
        const resp = await fetch(`${apiBaseUrl}/ai/sidekick`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          fallback();
          return;
        }

        const data = await resp.json();
        const reply = typeof data.reply === 'string' ? data.reply : null;
        const inferred = typeof data.inferred_search_query === 'string' ? data.inferred_search_query : null;
        const shouldRefresh = Boolean(data.should_refresh);
        const suggestions = Array.isArray(data.suggested_prompts)
          ? data.suggested_prompts.filter((p: any) => typeof p === 'string')
          : [];

        setSuggestedPrompts(suggestions.slice(0, 6));
        if (reply) {
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + 1).toString(), type: 'ai', text: reply, timestamp: new Date() },
          ]);
        }
        if (inferred) setPendingQuery(inferred);
        if (shouldRefresh && inferred) {
          // Nudge user with the CTA; user still taps "Show my AI matches" to apply.
          setPendingQuery(inferred);
        }
        setIsTyping(false);
      }
    } catch {
      fallback();
    }

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Only show empty state after loading is complete and there are no messages
  const isEmpty = isLoaded && messages.length === 0;
  const hasMessages = isLoaded && messages.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Minimal Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Feather name="x" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.messagesContent,
            (isEmpty || !isLoaded) && { flexGrow: 1, justifyContent: 'center' },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {!isLoaded ? (
            <View style={styles.emptyState}>
              <Typography variant="body" muted align="center">
                Loading...
              </Typography>
            </View>
          ) : isEmpty ? (
            <View style={styles.emptyState}>
              {/* Personalized Greeting */}
              <View style={styles.greetingContainer}>
                {/* 3D GF Logo */}
                <View style={styles.logoContainer}>
                  <View style={[styles.logoCircle, { backgroundColor: 'rgba(173, 255, 26, 0.1)' }]}>
                    <PixelFlag size={60} color={theme.colors.neonGreen} />
                  </View>
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

                {/* Hint */}
                <View style={styles.hintContainer}>
                  <Feather name="info" size={14} color={theme.colors.neonGreen} />
                  <Typography variant="tiny" muted style={{ marginLeft: 6 }}>
                    The more you share, the better I can help.
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

        {/* Keyword chips + apply CTA */}
        {!isLoaded ? null : isEmpty ? (
          <View style={styles.keywordsSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.keywordsContainer}
            >
              {SEARCH_KEYWORDS.map((keyword) => (
                <TouchableOpacity
                  key={keyword}
                  style={[styles.keywordChip, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}
                  onPress={() => {
                    // Add keyword to input text
                    setInputText((prev) => {
                      const trimmed = prev.trim();
                      if (trimmed.endsWith(',') || trimmed === 'I am looking for') {
                        return `${trimmed} ${keyword}`;
                      }
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
        ) : pendingQuery ? (
          <View style={[styles.applyBar, { borderTopColor: 'rgba(255, 255, 255, 0.06)' }]}>
            <Button
              label="Show my AI matches"
              onPress={() => {
                onApplySearchQuery?.(pendingQuery);
                onBack?.();
              }}
              fullWidth
            />
            {suggestedPrompts.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionChips}
                style={{ marginTop: 12 }}
              >
                {suggestedPrompts.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.suggestionChip, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}
                    onPress={() => handleSendMessage(p)}
                    activeOpacity={0.85}
                  >
                    <Typography variant="tiny" style={{ color: theme.colors.textDark }}>
                      {p}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
            <Typography variant="tiny" muted align="center" style={{ marginTop: 10 }}>
              Updates your AI Match (on-grid) feed.
            </Typography>
          </View>
        ) : null}

        {/* Input - only show when loaded */}
        {isLoaded && (
        <View style={[styles.inputContainer, { borderTopColor: 'rgba(255, 255, 255, 0.06)' }]}>
          <View style={[styles.inputWrapper, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Share what you're looking for..."
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
    justifyContent: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 16,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
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
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
  applyBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
  },
  suggestionChips: {
    gap: 10,
    paddingRight: 10,
  },
  suggestionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
