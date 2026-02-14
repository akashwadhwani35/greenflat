import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
  message_type?: 'text' | 'image' | 'voice';
  created_at: string;
  is_read: boolean;
  is_deleted: boolean;
  sender_name?: string;
};

type MessagesScreenProps = {
  matchId: number;
  matchName: string;
  targetUserId?: number;
  currentUserId: number;
  token: string;
  apiBaseUrl: string;
  onBack: () => void;
};

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  matchId,
  matchName,
  targetUserId,
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
  const [showProfile, setShowProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [androidKeyboardOffset, setAndroidKeyboardOffset] = useState(0);
  const [mediaUploadReady, setMediaUploadReady] = useState<boolean>(true);
  const flatListRef = useRef<FlatList>(null);

  const openProfile = async () => {
    setShowMenu(false);
    if (!targetUserId) {
      Alert.alert('Profile unavailable', 'We could not load this profile right now.');
      return;
    }

    try {
      setProfileLoading(true);
      const response = await fetch(`${apiBaseUrl}/matches/user/${targetUserId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const data = await response.json();
      setProfileData(data);
      setShowProfile(true);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Unable to open profile right now.');
    } finally {
      setProfileLoading(false);
    }
  };

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

  const handleBlock = () => {
    setShowMenu(false);
    if (!targetUserId) {
      Alert.alert('Unable to block', 'User details are unavailable.');
      return;
    }

    Alert.alert(
      'Block user',
      `Block ${matchName}? You will both lose access to this chat and profile visibility.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${apiBaseUrl}/privacy/block`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ target_user_id: targetUserId }),
              });
              const body = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(body.error || 'Unable to block user');
              }
              Alert.alert('Blocked', `${matchName} has been blocked.`);
              onBack();
            } catch (error: any) {
              Alert.alert('Block failed', error?.message || 'Please try again.');
            }
          },
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
    fetchMediaCapabilities();
    return () => clearInterval(interval);
  }, [matchId]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setAndroidKeyboardOffset(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardOffset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

  const fetchMediaCapabilities = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/media/capabilities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setMediaUploadReady(false);
        return;
      }
      const body = await response.json();
      setMediaUploadReady(body?.capabilities?.upload_provider === 'cloudinary');
    } catch {
      setMediaUploadReady(false);
    }
  };

  const uploadMediaAsset = async (
    asset: ImagePicker.ImagePickerAsset,
    mediaType: 'image' | 'voice'
  ): Promise<string> => {
    const signatureResponse = await fetch(`${apiBaseUrl}/media/upload-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const signatureBody = await signatureResponse.json().catch(() => ({}));
    if (!signatureResponse.ok || !signatureBody?.upload) {
      throw new Error(signatureBody?.error || 'Media upload is not available');
    }

    const upload = signatureBody.upload;
    const extension = mediaType === 'image' ? 'jpg' : 'mp4';
    const fileType = mediaType === 'image'
      ? (asset.mimeType || 'image/jpeg')
      : (asset.mimeType || 'video/mp4');

    const formData = new FormData();
    formData.append('file', {
      uri: asset.uri,
      type: fileType,
      name: `message-${Date.now()}.${extension}`,
    } as any);
    formData.append('api_key', upload.api_key);
    formData.append('timestamp', String(upload.timestamp));
    formData.append('signature', upload.signature);
    formData.append('folder', upload.folder);

    const uploadResponse = await fetch(upload.upload_url, {
      method: 'POST',
      body: formData,
    });
    const uploadBody = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok || !uploadBody?.secure_url) {
      throw new Error(uploadBody?.error?.message || 'Failed to upload media');
    }

    return uploadBody.secure_url as string;
  };

  const sendMessage = async (payload?: { content: string; message_type: 'text' | 'image' | 'voice' }) => {
    const fallbackText = newMessage.trim();
    const messageText = payload?.content ?? fallbackText;
    const messageType = payload?.message_type ?? 'text';
    if (!messageText) return;

    if (messageType === 'text') {
      setNewMessage('');
    }
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
          message_type: messageType,
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
      if (messageType === 'text') {
        setNewMessage(messageText);
      }
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
          {item.message_type === 'image' ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                if (item.content) {
                  Linking.openURL(item.content).catch(() => {});
                }
              }}
            >
              <Image source={{ uri: item.content }} style={styles.messageImage} />
            </TouchableOpacity>
          ) : item.message_type === 'voice' ? (
            <TouchableOpacity
              style={styles.voiceNote}
              onPress={() => {
                if (item.content) {
                  Linking.openURL(item.content).catch(() => {});
                }
              }}
              activeOpacity={0.8}
            >
              <Feather name="play-circle" size={18} color={isMyMessage ? theme.colors.deepBlack : theme.colors.text} />
              <Typography
                variant="body"
                style={[
                  styles.messageText,
                  { color: isMyMessage ? theme.colors.deepBlack : theme.colors.text, marginLeft: 8 },
                ]}
              >
                Voice note
              </Typography>
            </TouchableOpacity>
          ) : (
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
          )}
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
        <TouchableOpacity style={styles.headerInfo} onPress={openProfile} activeOpacity={0.75}>
          <Typography variant="h2" style={{ color: theme.colors.text }}>
            {matchName}
          </Typography>
        </TouchableOpacity>
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
              onPress={openProfile}
              activeOpacity={0.7}
            >
              <Feather name="user" size={20} color={theme.colors.text} />
              <Typography variant="body" style={{ color: theme.colors.text, marginLeft: 12 }}>
                Profile
              </Typography>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: theme.colors.border }]} />
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
            <View style={[styles.menuDivider, { backgroundColor: theme.colors.border }]} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleBlock}
              activeOpacity={0.7}
            >
              <Feather name="slash" size={20} color={theme.colors.error} />
              <Typography variant="body" style={{ color: theme.colors.error, marginLeft: 12 }}>
                Block
              </Typography>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showProfile}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProfile(false)}
      >
        <View style={styles.profileOverlay}>
          <View style={[styles.profileSheet, { backgroundColor: theme.colors.deepBlack, borderColor: theme.colors.border }]}>
            <View style={styles.profileHeaderRow}>
              <Typography variant="h2" style={{ color: theme.colors.text }}>
                {profileData?.user?.name || matchName}
              </Typography>
              <TouchableOpacity onPress={() => setShowProfile(false)} style={styles.profileCloseButton}>
                <Feather name="x" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {profileLoading ? (
              <View style={styles.profileLoadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.neonGreen} />
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.profileContent} showsVerticalScrollIndicator={false}>
                <Image
                  source={profileData?.photos?.[0]?.photo_url ? { uri: profileData.photos[0].photo_url } : require('../../assets/icon.png')}
                  style={styles.profileHeroImage}
                />

                <Typography variant="small" style={{ color: theme.colors.muted }}>
                  {profileData?.user?.city || 'Unknown city'} {profileData?.user?.age ? `• ${profileData.user.age}` : ''}
                </Typography>

                {profileData?.user?.bio ? (
                  <Typography variant="body" style={{ color: theme.colors.text, marginTop: 12 }}>
                    {profileData.user.bio}
                  </Typography>
                ) : null}

                {Array.isArray(profileData?.user?.interests) && profileData.user.interests.length > 0 ? (
                  <View style={styles.profileTagWrap}>
                    {profileData.user.interests.slice(0, 10).map((interest: string) => (
                      <View key={interest} style={[styles.profileTag, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
                        <Typography variant="tiny" style={{ color: theme.colors.text }}>
                          {interest}
                        </Typography>
                      </View>
                    ))}
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.profileActionButton, { backgroundColor: theme.colors.neonGreen }]}
                  onPress={() => setShowProfile(false)}
                  activeOpacity={0.85}
                >
                  <Typography variant="bodyStrong" style={{ color: theme.colors.deepBlack }}>
                    Back to chat
                  </Typography>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
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
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.colors.charcoal,
              marginBottom: Platform.OS === 'android' ? androidKeyboardOffset : 0,
            },
          ]}
        >
          {/* Attachment buttons */}
          <TouchableOpacity
            style={styles.attachButton}
            onPress={async () => {
              if (!mediaUploadReady) {
                Alert.alert('Media unavailable', 'Media upload is not configured right now.');
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.5,
              });
              if (!result.canceled && result.assets[0]) {
                try {
                  setSending(true);
                  const content = await uploadMediaAsset(result.assets[0], 'image');
                  await sendMessage({ content, message_type: 'image' });
                } catch (error: any) {
                  Alert.alert('Upload failed', error?.message || 'Could not upload image.');
                } finally {
                  setSending(false);
                }
              }
            }}
            disabled={sending}
          >
            <Feather name="image" size={22} color={theme.colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.attachButton}
            onPress={async () => {
              if (!mediaUploadReady) {
                Alert.alert('Media unavailable', 'Media upload is not configured right now.');
                return;
              }
              const permission = await ImagePicker.requestCameraPermissionsAsync();
              if (!permission.granted) {
                Alert.alert('Camera required', 'Allow camera access to capture a quick voice/video note.');
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: false,
                videoMaxDuration: 20,
                quality: 0.4,
              });
              if (!result.canceled && result.assets[0]) {
                try {
                  setSending(true);
                  const content = await uploadMediaAsset(result.assets[0], 'voice');
                  await sendMessage({ content, message_type: 'voice' });
                } catch (error: any) {
                  Alert.alert('Upload failed', error?.message || 'Could not upload voice note.');
                } finally {
                  setSending(false);
                }
              }
            }}
            disabled={sending}
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
            onPress={() => { void sendMessage(); }}
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
  messageImage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#0f0f0f',
  },
  voiceNote: {
    flexDirection: 'row',
    alignItems: 'center',
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
  profileOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  profileSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  profileCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileLoadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileContent: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 10,
  },
  profileHeroImage: {
    width: '100%',
    height: 260,
    borderRadius: 18,
    backgroundColor: '#222',
  },
  profileTagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  profileTag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  profileActionButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
});
