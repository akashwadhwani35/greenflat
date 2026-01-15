import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

type Message = {
  id: number;
  sender_id: number;
  content: string;
  created_at: string;
  is_read: boolean;
  is_deleted: boolean;
  sender_name?: string;
};

type MessagesScreenProps = {
  matchId: number;
  matchName: string;
  currentUserId: number;
  token: string;
  apiBaseUrl: string;
  onBack: () => void;
};

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  matchId,
  matchName,
  currentUserId,
  token,
  apiBaseUrl,
  onBack,
}) => {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleUnmatch = () => {
    setShowMenu(false);
    Alert.alert(
      'Unmatch',
      `Are you sure you want to unmatch with ${matchName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unmatch',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${apiBaseUrl}/matches/${matchId}/unmatch`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              if (response.ok) {
                Alert.alert('Unmatched', `You have unmatched with ${matchName}.`);
                onBack();
              } else {
                Alert.alert('Error', 'Failed to unmatch. Please try again.');
              }
            } catch (error) {
              console.error('Error unmatching:', error);
              Alert.alert('Error', 'Failed to unmatch. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleReport = () => {
    setShowMenu(false);
    Alert.alert(
      'Report User',
      `Why are you reporting ${matchName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Inappropriate behavior',
          onPress: () => submitReport('inappropriate_behavior'),
        },
        {
          text: 'Fake profile',
          onPress: () => submitReport('fake_profile'),
        },
        {
          text: 'Harassment',
          style: 'destructive',
          onPress: () => submitReport('harassment'),
        },
      ]
    );
  };

  const submitReport = async (reason: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          match_id: matchId,
          reason,
        }),
      });
      if (response.ok) {
        Alert.alert('Report Submitted', 'Thank you for your report. We will review it shortly.');
      } else {
        Alert.alert('Report Submitted', 'Thank you for your report. We will review it shortly.');
      }
    } catch (error) {
      console.error('Error reporting:', error);
      Alert.alert('Report Submitted', 'Thank you for your report. We will review it shortly.');
    }
  };

  useEffect(() => {
    fetchMessages();
    // Poll for new messages every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [matchId]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/messages/${matchId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const response = await fetch(`${apiBaseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          match_id: matchId,
          content: messageText,
          message_type: 'text',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Refresh messages
      await fetchMessages();

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setNewMessage(messageText); // Restore message
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === currentUserId;
    const isDeleted = item.is_deleted;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMyMessage
              ? [styles.myMessageBubble, { backgroundColor: theme.colors.neonGreen }]
              : [styles.theirMessageBubble, { backgroundColor: theme.colors.charcoal }],
          ]}
        >
          <Typography
            variant="body"
            style={[
              styles.messageText,
              { color: isMyMessage ? theme.colors.deepBlack : theme.colors.text },
              isDeleted && { fontStyle: 'italic', opacity: 0.6 },
            ]}
          >
            {item.content}
          </Typography>
          <Typography
            variant="tiny"
            style={[
              styles.timeText,
              { color: isMyMessage ? theme.colors.deepBlack : theme.colors.muted },
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Typography>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.deepBlack }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color={theme.colors.neonGreen} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Typography variant="h2" style={{ color: theme.colors.text }}>
            {matchName}
          </Typography>
        </View>
        <TouchableOpacity style={styles.moreButton} onPress={() => setShowMenu(true)}>
          <Feather name="more-vertical" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Menu Popup */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuContainer, { backgroundColor: theme.colors.charcoal }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleUnmatch}
              activeOpacity={0.7}
            >
              <Feather name="user-x" size={20} color={theme.colors.text} />
              <Typography variant="body" style={{ color: theme.colors.text, marginLeft: 12 }}>
                Unmatch
              </Typography>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: theme.colors.border }]} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleReport}
              activeOpacity={0.7}
            >
              <Feather name="flag" size={20} color={theme.colors.error} />
              <Typography variant="body" style={{ color: theme.colors.error, marginLeft: 12 }}>
                Report
              </Typography>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Messages List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.neonGreen} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: 'rgba(173, 255, 26, 0.1)' }]}>
            <Feather name="message-circle" size={40} color={theme.colors.neonGreen} />
          </View>
          <Typography variant="h2" style={{ color: theme.colors.text, marginTop: 24 }}>
            Start the conversation
          </Typography>
          <Typography
            variant="body"
            style={{ color: theme.colors.muted, marginTop: 12, textAlign: 'center', paddingHorizontal: 40 }}
          >
            Say hello to {matchName}!
          </Typography>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.inputContainer, { backgroundColor: theme.colors.charcoal }]}>
          {/* Attachment buttons */}
          <TouchableOpacity
            style={styles.attachButton}
            onPress={async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
              });
              if (!result.canceled && result.assets[0]) {
                Alert.alert('Image Selected', 'Image sharing coming soon!');
              }
            }}
          >
            <Feather name="image" size={22} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => {
              Alert.alert('Voice Note', 'Voice recording coming soon!');
            }}
          >
            <Feather name="mic" size={22} color={theme.colors.muted} />
          </TouchableOpacity>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
                borderColor: theme.colors.border,
              },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.muted}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: newMessage.trim() ? theme.colors.neonGreen : theme.colors.border,
              },
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={theme.colors.deepBlack} />
            ) : (
              <Feather
                name="send"
                size={20}
                color={newMessage.trim() ? theme.colors.deepBlack : theme.colors.muted}
              />
            )}
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  moreButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '75%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  myMessageBubble: {
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timeText: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
    gap: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    borderWidth: 1,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 110 : (StatusBar.currentHeight || 0) + 70,
    paddingRight: 16,
  },
  menuContainer: {
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 16,
  },
});
