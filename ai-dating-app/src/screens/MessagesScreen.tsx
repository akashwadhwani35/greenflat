import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
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
import { Audio } from 'expo-av';
import type { Socket } from 'socket.io-client';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { NoticeModal, type Notice } from '../components/NoticeModal';
import { PixelFlag } from '../components/PixelFlag';
import { ProfileDetailScreen } from './ProfileDetailScreen';
import { useViewerProfile } from '../hooks/useViewerProfile';
import { MatchCandidate } from './MatchboardScreen';

type Message = {
  id: number;
  sender_id: number;
  content: string;
  message_type?: 'text' | 'image' | 'voice';
  /** 'first_move' / 'first_move_photo' for the messages a First Move creates. */
  kind?: string | null;
  reply_to_message_id?: number | null;
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
  socket: Socket | null;
  onBack: () => void;
  /** A compliment request: read-only until the receiver accepts. */
  status?: 'active' | 'pending';
  requestedBy?: number | null;
  onRequestResolved?: (matchId: number, outcome: 'accepted' | 'declined') => void;
};

type ProfileDetailCandidate = MatchCandidate & {
  bio?: string;
  relationship_goal?: string;
  interests?: string[];
  photos?: string[];
  personality_summary?: string;
  top_traits?: string[];
};

// 'gcs' and 'local' both post a data URL to /media/upload-local; the server
// decides where the bytes actually land. Only Cloudinary needs a different path.
type MediaUploadProvider = 'gcs' | 'cloudinary' | 'local' | 'none';

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  matchId,
  matchName,
  targetUserId,
  currentUserId,
  token,
  apiBaseUrl,
  socket,
  onBack,
  status = 'active',
  requestedBy = null,
  onRequestResolved,
}) => {
  // Compliment request state, kept locally so Accept flips the screen at once.
  const [requestStatus, setRequestStatus] = useState<'active' | 'pending'>(status);
  const [resolvingRequest, setResolvingRequest] = useState(false);
  const [requestNotice, setRequestNotice] = useState<Notice | null>(null);
  useEffect(() => { setRequestStatus(status); }, [status]);
  const awaitingMyAnswer = requestStatus === 'pending' && requestedBy !== currentUserId;
  const awaitingTheirAnswer = requestStatus === 'pending' && requestedBy === currentUserId;

  const resolveRequest = async (outcome: 'accepted' | 'declined') => {
    if (resolvingRequest) return;
    setResolvingRequest(true);
    try {
      const response = await fetch(`${apiBaseUrl}/matches/${matchId}/${outcome === 'accepted' ? 'accept' : 'decline'}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Please try again.');
      if (outcome === 'accepted') setRequestStatus('active');
      onRequestResolved?.(matchId, outcome);
    } catch (error: any) {
      setRequestNotice({ title: outcome === 'accepted' ? "Couldn't accept" : "Couldn't do that", message: error.message, tone: 'error' });
    } finally {
      setResolvingRequest(false);
    }
  };

  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // Full-screen image viewer, instead of handing the URL to the browser.
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  // The message being replied to, shown above the composer until sent.
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  // Voice notes: press-and-hold recording with expo-av, and inline playback.
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  // Drives the green shared-answer highlighting on the profile card.
  const viewerProfile = useViewerProfile(token, apiBaseUrl);
  const [profileData, setProfileData] = useState<any | null>(null);
  // Short read on the person under the header: who they are, in a glance.
  const [snapshot, setSnapshot] = useState<{ age?: number | null; city?: string; interests: string[]; goal?: string | null } | null>(null);
  useEffect(() => {
    if (!targetUserId) return;
    let cancelled = false;
    fetch(`${apiBaseUrl}/matches/user/${targetUserId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.user) return;
        const u = data.user;
        const dob = u.date_of_birth ? new Date(u.date_of_birth) : null;
        const age = typeof u.age === 'number' ? u.age : dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
        setSnapshot({
          age,
          city: u.city,
          interests: Array.isArray(u.interests) ? u.interests.slice(0, 4) : [],
          goal: u.relationship_goal || null,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [targetUserId, apiBaseUrl, token]);
  // AI summary of the two of you, same text as on the profile card, cached per
  // pair on the server. Sits at the top of the chat so an incoming First Move
  // arrives with context.
  const [briefing, setBriefing] = useState<string | null>(null);
  useEffect(() => {
    if (!targetUserId) return;
    let cancelled = false;
    setBriefing(null);
    fetch(`${apiBaseUrl}/matches/${targetUserId}/briefing`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.briefing) setBriefing(String(data.briefing));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [targetUserId, apiBaseUrl, token]);
  const [androidKeyboardOffset, setAndroidKeyboardOffset] = useState(0);
  const [mediaUploadProvider, setMediaUploadProvider] = useState<MediaUploadProvider>('local');
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);

  const openProfile = async () => {
    setShowMenu(false);
    if (!targetUserId) {
      Alert.alert('Profile unavailable', 'We could not load this profile right now.');
      return;
    }

    try {
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
    }
  };

  const fullProfileMatch: ProfileDetailCandidate | null = (() => {
    const user = profileData?.user;
    if (!user) return null;

    const photos = Array.isArray(profileData?.photos) ? profileData.photos : [];
    const primaryPhoto = photos.find((photo: any) => photo?.is_primary) || photos[0];
    const interests = Array.isArray(user?.interests) ? user.interests : [];

    return {
      id: Number(user.id || targetUserId || 0),
      name: user.name || matchName,
      age: typeof user.age === 'number' ? user.age : undefined,
      city: user.city || 'Unknown city',
      match_percentage: 0,
      match_reason: typeof user.bio === 'string' ? user.bio : '',
      match_highlights: interests.slice(0, 3),
      suggested_openers: [],
      primary_photo: typeof primaryPhoto?.photo_url === 'string' ? primaryPhoto.photo_url : undefined,
      is_verified: Boolean(user.is_verified),
      bio: typeof user.bio === 'string' ? user.bio : '',
      relationship_goal: typeof user.relationship_goal === 'string' ? user.relationship_goal : undefined,
      interests,
      photos: photos
        .map((photo: any) => photo?.photo_url)
        .filter((url: unknown): url is string => typeof url === 'string' && url.length > 0),
      personality_summary: typeof user.personality_summary === 'string' ? user.personality_summary : undefined,
      top_traits: Array.isArray(user.top_traits) ? user.top_traits : undefined,
    };
  })();

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
        const body = await response.json().catch(() => ({}));
        Alert.alert('Report Failed', body.error || 'Unable to submit your report. Please try again.');
      }
    } catch (error) {
      Alert.alert('Report Failed', 'Something went wrong. Please check your connection and try again.');
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchMediaCapabilities();
  }, [matchId]);

  // Socket event listeners — replace polling
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { message: Message; matchId: number }) => {
      if (data.matchId !== matchId) return;
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === data.message.id)) return prev;
        return [...prev, data.message];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const handleMessageDeleted = (data: { messageId: number; matchId: number }) => {
      if (data.matchId !== matchId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, content: '[Message deleted]', is_deleted: true } : m
        )
      );
    };

    const handleMessagesRead = (data: { matchId: number; readBy: number }) => {
      if (data.matchId !== matchId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.sender_id === currentUserId && !m.is_read ? { ...m, is_read: true } : m
        )
      );
    };

    const handleTyping = (data: { matchId: number; userId: number; isTyping: boolean }) => {
      if (data.matchId !== matchId || data.userId === currentUserId) return;
      setPeerTyping(data.isTyping);
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('messages:read', handleMessagesRead);
    socket.on('typing', handleTyping);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('messages:read', handleMessagesRead);
      socket.off('typing', handleTyping);
    };
  }, [socket, matchId, currentUserId]);

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
        return;
      }
      const body = await response.json();
      const provider = body?.capabilities?.upload_provider;
      if (provider === 'cloudinary' || provider === 'local') {
        setMediaUploadProvider(provider);
      } else {
        setMediaUploadProvider('none');
      }
    } catch {
      // Keep best-effort local fallback when capability endpoint is unavailable.
    }
  };

  // GIFs survive the picker only when nothing re-encodes them, so they are
  // detected by type or extension and sent through as they are.
  const isGifAsset = (asset: ImagePicker.ImagePickerAsset) =>
    asset.mimeType === 'image/gif' || /\.gif($|\?)/i.test(asset.uri || '') || /\.gif$/i.test(asset.fileName || '');

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Unable to encode media payload'));
      };
      reader.onerror = () => reject(new Error('Unable to read media payload'));
      reader.readAsDataURL(blob);
    });

  const buildLocalDataUrl = async (
    asset: ImagePicker.ImagePickerAsset,
    mediaType: 'image' | 'voice'
  ): Promise<string> => {
    const fallbackMimeType = mediaType === 'image' ? 'image/jpeg' : 'video/mp4';
    const gif = isGifAsset(asset);
    const mimeType = gif ? 'image/gif' : (asset.mimeType || fallbackMimeType);

    if (mediaType === 'image' && asset.base64) {
      return `data:${mimeType};base64,${asset.base64}`;
    }

    const fileResponse = await fetch(asset.uri);
    if (!fileResponse.ok) {
      throw new Error('Failed to read selected media');
    }
    const blob = await fileResponse.blob();
    const dataUrl = await blobToDataUrl(blob);
    // The blob reader guesses a type from the file, sometimes octet-stream.
    return gif ? dataUrl.replace(/^data:[^;]*;/, 'data:image/gif;') : dataUrl;
  };

  const uploadViaLocal = async (
    asset: ImagePicker.ImagePickerAsset,
    mediaType: 'image' | 'voice'
  ): Promise<string> => {
    const dataUrl = await buildLocalDataUrl(asset, mediaType);
    const response = await fetch(`${apiBaseUrl}/media/upload-local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        data_url: dataUrl,
        media_type: mediaType,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body?.url !== 'string') {
      throw new Error(body?.error || 'Failed to upload media');
    }
    return body.url as string;
  };

  const uploadViaCloudinary = async (
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
    const gif = mediaType === 'image' && isGifAsset(asset);
    const extension = mediaType === 'image' ? (gif ? 'gif' : 'jpg') : 'mp4';
    const fileType = mediaType === 'image'
      ? (gif ? 'image/gif' : (asset.mimeType || 'image/jpeg'))
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

  const uploadMediaAsset = async (
    asset: ImagePicker.ImagePickerAsset,
    mediaType: 'image' | 'voice'
  ): Promise<string> => {
    const firstAttempt = mediaUploadProvider === 'cloudinary' ? uploadViaCloudinary : uploadViaLocal;
    const secondAttempt = mediaUploadProvider === 'cloudinary' ? uploadViaLocal : uploadViaCloudinary;

    try {
      return await firstAttempt(asset, mediaType);
    } catch (primaryError) {
      try {
        return await secondAttempt(asset, mediaType);
      } catch (secondaryError: any) {
        throw new Error(
          secondaryError?.message ||
          (primaryError as any)?.message ||
          'Media upload is not available right now'
        );
      }
    }
  };

  /**
   * Voice notes are recorded as audio. The previous button opened the video
   * camera and sent an 8-second clip labelled "voice note".
   */
  const startRecording = async () => {
    if (isRecording || sending) return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone needed', 'Allow microphone access to send voice notes.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (error: any) {
      Alert.alert('Could not record', error?.message || 'Please try again.');
    }
  };

  const stopRecordingAndSend = async () => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      if (!uri) return;
      const status = await recording.getStatusAsync();
      // A tap rather than a hold produces a fraction of a second of silence.
      if ((status.durationMillis || 0) < 700) return;
      setSending(true);
      const content = await uploadMediaAsset({ uri } as unknown as ImagePicker.ImagePickerAsset, 'voice');
      await sendMessage({ content, message_type: 'voice' });
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Could not send the voice note.');
    } finally {
      setSending(false);
    }
  };

  const togglePlayback = async (uri: string) => {
    try {
      const wasPlayingThis = playingUri === uri;
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); } catch {}
        try { await soundRef.current.unloadAsync(); } catch {}
        soundRef.current = null;
        setPlayingUri(null);
        if (wasPlayingThis) return; // second tap on the same note stops it
      }
      // Recording leaves the session in record mode; put it back to playback
      // every time, or the second play after a recording comes out silent.
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingUri(uri);
      sound.setOnPlaybackStatusUpdate((st) => {
        if ('didJustFinish' in st && st.didJustFinish) {
          setPlayingUri(null);
          void sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (error: any) {
      Alert.alert('Could not play', error?.message || 'Please try again.');
    }
  };

  const sendMessage = async (payload?: { content: string; message_type: 'text' | 'image' | 'voice' }) => {
    const fallbackText = newMessage.trim();
    const messageText = payload?.content ?? fallbackText;
    const messageType = payload?.message_type ?? 'text';
    if (!messageText) return;

    if (messageType === 'text') {
      setNewMessage('');
      // Stop typing indicator on send
      if (socket && targetUserId && isTypingRef.current) {
        isTypingRef.current = false;
        socket.emit('typing:stop', { matchId, recipientId: targetUserId });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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
          reply_to_message_id: replyTo?.id ?? null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const body = await response.json().catch(() => ({}));
      setReplyTo(null);
      if (body.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === body.data.id)) return prev;
          return [...prev, body.data];
        });
      }

      // Jump straight to the latest message. Animated used to play a visible
      // top-to-bottom scroll every time a conversation opened.
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 50);
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
        <Pressable
          onLongPress={() => { if (!isDeleted) setReplyTo(item); }}
          delayLongPress={250}
          style={[
            styles.messageBubble,
            isMyMessage
              ? [styles.myMessageBubble, { backgroundColor: theme.colors.neonGreen }]
              : [styles.theirMessageBubble, { backgroundColor: theme.colors.charcoal }],
          ]}
        >
          {item.reply_to_message_id ? (() => {
            const quoted = messages.find((m) => m.id === item.reply_to_message_id);
            if (!quoted) return null;
            const text = quoted.message_type === 'image' ? 'Photo' : quoted.message_type === 'voice' ? 'Voice note' : quoted.content;
            return (
              <View style={[styles.quoteBlock, { borderLeftColor: isMyMessage ? '#0B1410' : theme.colors.neonGreen }]}>
                <Typography variant="tiny" numberOfLines={2} style={{ color: isMyMessage ? '#0B1410' : theme.colors.textDark, opacity: 0.8 }}>
                  {text}
                </Typography>
              </View>
            );
          })() : null}
          {item.kind === 'first_move' ? (
            <Typography variant="tiny" style={{ color: isMyMessage ? 'rgba(16,29,19,0.7)' : theme.colors.neonGreen, marginBottom: 4, fontFamily: 'RedHatDisplay_700Bold', letterSpacing: 0.4 }}>
              {isMyMessage ? 'YOUR FIRST MOVE' : 'FIRST MOVE'}
            </Typography>
          ) : null}
          {item.message_type === 'image' ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                if (item.content) setViewerUri(item.content);
              }}
              onLongPress={() => setReplyTo(item)}
            >
              <Image source={{ uri: item.content }} style={item.kind === 'first_move_photo' ? styles.messageImageSmall : styles.messageImage} />
            </TouchableOpacity>
          ) : item.message_type === 'voice' ? (
            <TouchableOpacity
              style={styles.voiceNote}
              onPress={() => {
                if (item.content) void togglePlayback(item.content);
              }}
              onLongPress={() => setReplyTo(item)}
              activeOpacity={0.8}
            >
              <Feather name={playingUri === item.content ? 'pause-circle' : 'play-circle'} size={22} color={isMyMessage ? theme.colors.deepBlack : theme.colors.text} />
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
        </Pressable>
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

      {/* AI summary first, then the person in a glance, then the conversation. */}
      {snapshot || briefing ? (
        <TouchableOpacity style={[styles.snapshot, { backgroundColor: theme.colors.deepBlack, borderBottomColor: theme.colors.border }]} onPress={openProfile} activeOpacity={0.85}>
          {briefing ? (
            <View style={[styles.briefingCard, { borderColor: 'rgba(173, 255, 26, 0.35)', backgroundColor: 'rgba(173, 255, 26, 0.06)' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PixelFlag size={14} color={theme.colors.neonGreen} />
                <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>
                  AI Summary
                </Typography>
              </View>
              <Typography variant="small" style={{ color: theme.colors.textDark, lineHeight: 21 }}>
                {briefing}
              </Typography>
            </View>
          ) : null}
          {snapshot ? (
          <Typography variant="small" style={{ color: theme.colors.muted }}>
            {[snapshot.age ? `${snapshot.age}` : null, snapshot.city || null, snapshot.goal ? `Looking for ${String(snapshot.goal).replace(/[_-]/g, ' ')}` : null].filter(Boolean).join(' · ')}
          </Typography>
          ) : null}
          {snapshot && snapshot.interests.length > 0 ? (
            <View style={styles.snapshotChips}>
              {snapshot.interests.map((i) => (
                <View key={`snap-${i}`} style={[styles.snapshotChip, { borderColor: theme.colors.secondaryHairline, backgroundColor: theme.colors.secondaryHighlight }]}>
                  <Typography variant="tiny" style={{ color: theme.colors.textDark }}>{String(i).replace(/[_-]/g, ' ')}</Typography>
                </View>
              ))}
            </View>
          ) : null}
          <Typography variant="small" style={{ color: theme.colors.neonGreen }}>
            This could be the start of something great.
          </Typography>
        </TouchableOpacity>
      ) : null}

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

      <ProfileDetailScreen
        match={fullProfileMatch}
        viewer={viewerProfile}
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onSwipeLeft={() => setShowProfile(false)}
        onSwipeRight={() => setShowProfile(false)}
        onSuperlike={() => setShowProfile(false)}
        onBlock={() => {
          setShowProfile(false);
          handleBlock();
        }}
        onReport={() => {
          setShowProfile(false);
          handleReport();
        }}
      />

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
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          // With the keyboard open, the first touch on the list only dismissed
          // the keyboard, so a long-press never reached the bubble and Reply
          // needed the keyboard closed first.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        />
      )}

      {replyTo ? (
        <View style={[styles.replyStrip, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
          <View style={{ flex: 1 }}>
            <Typography variant="tiny" style={{ color: theme.colors.neonGreen }}>
              Replying to {replyTo.sender_id === currentUserId ? 'yourself' : matchName}
            </Typography>
            <Typography variant="small" numberOfLines={1} style={{ color: theme.colors.textDark }}>
              {replyTo.message_type === 'image' ? 'Photo' : replyTo.message_type === 'voice' ? 'Voice note' : replyTo.content}
            </Typography>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} accessibilityLabel="Cancel reply">
            <Feather name="x" size={18} color={theme.colors.muted} />
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal visible={Boolean(viewerUri)} transparent animationType="fade" onRequestClose={() => setViewerUri(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUri(null)}>
          {viewerUri ? <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>

      {/* Typing indicator */}
      {peerTyping && (
        <View style={[styles.typingContainer, { backgroundColor: theme.colors.background }]}>
          <Typography variant="small" style={{ color: theme.colors.muted, fontStyle: 'italic' }}>
            {matchName} is typing...
          </Typography>
        </View>
      )}

      {/* Compliment request: answer it before anything else */}
      {awaitingMyAnswer ? (
        <View style={[styles.requestPanel, { backgroundColor: theme.colors.charcoal, borderTopColor: theme.colors.border }]}>
          <Typography variant="bodyStrong" style={{ color: theme.colors.text, textAlign: 'center' }}>
            Would you want to accept this?
          </Typography>
          <Typography variant="small" style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 4 }}>
            {matchName} made a First Move. Accept to start chatting.
          </Typography>
          <View style={styles.requestButtons}>
            <TouchableOpacity
              style={[styles.requestButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
              onPress={() => { void resolveRequest('declined'); }}
              disabled={resolvingRequest}
              activeOpacity={0.8}
            >
              <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>Not my type</Typography>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.requestButton, styles.requestButtonPrimary, { backgroundColor: theme.colors.neonGreen, borderColor: theme.colors.neonGreen }]}
              onPress={() => { void resolveRequest('accepted'); }}
              disabled={resolvingRequest}
              activeOpacity={0.8}
            >
              <Typography variant="bodyStrong" style={{ color: theme.colors.deepBlack }}>{resolvingRequest ? 'Please wait' : 'Accept'}</Typography>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {awaitingTheirAnswer ? (
        <View style={[styles.requestPanel, { backgroundColor: theme.colors.charcoal, borderTopColor: theme.colors.border }]}>
          <Typography variant="small" style={{ color: theme.colors.muted, textAlign: 'center' }}>
            Waiting for {matchName} to accept your First Move. You can chat once they do.
          </Typography>
        </View>
      ) : null}
      <NoticeModal notice={requestNotice} onClose={() => setRequestNotice(null)} />

      {/* Input Area */}
      {requestStatus === 'pending' ? null : (
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
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                // The crop step re-encodes the picture, which turned every GIF
                // into a still JPEG. Chat photos do not need cropping.
                allowsEditing: false,
                quality: 0.5,
                base64: true,
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
            <Feather name="image" size={22} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.attachButton, isRecording && { backgroundColor: 'rgba(255,77,138,0.25)', borderRadius: 999 }]}
            onPressIn={() => { void startRecording(); }}
            onPressOut={() => { void stopRecordingAndSend(); }}
            disabled={sending}
            accessibilityLabel={isRecording ? 'Recording, release to send' : 'Hold to record a voice note'}
          >
            <Feather name="mic" size={22} color={isRecording ? '#FF4D8A' : theme.colors.text} />
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
            onChangeText={(text) => {
              setNewMessage(text);
              if (socket && targetUserId) {
                if (text.length > 0 && !isTypingRef.current) {
                  isTypingRef.current = true;
                  socket.emit('typing:start', { matchId, recipientId: targetUserId });
                }
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => {
                  if (isTypingRef.current) {
                    isTypingRef.current = false;
                    socket.emit('typing:stop', { matchId, recipientId: targetUserId });
                  }
                }, 2000);
              }
            }}
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  requestPanel: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    borderTopWidth: 1,
  },
  requestButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  requestButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestButtonPrimary: {
    flex: 1.4,
  },
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
  quoteBlock: {
    borderLeftWidth: 2,
    paddingLeft: 8,
    marginBottom: 6,
    opacity: 0.9,
  },
  replyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#ADFF1A',
  },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '80%' },
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
  // The photo a First Move was sent from: a small reference, not a full photo.
  messageImageSmall: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: '#0f0f0f',
  },
  snapshot: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  snapshotChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  snapshotChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  briefingCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    marginBottom: 2,
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
  typingContainer: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
