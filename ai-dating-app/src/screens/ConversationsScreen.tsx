import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Image, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/PageHeader';

type Conversation = {
  match_id: number;
  user_id: number;
  name: string;
  photo: string | null;
  is_verified: boolean;
  last_message: string | null;
  last_message_time: string | null;
  last_message_sender_id: number | null;
  unread_count: number;
  matched_at: string;
};

type Props = {
  onBack: () => void;
  onOpenConversation: (matchId: number, matchName: string, targetUserId: number) => void;
  token: string;
  apiBaseUrl: string;
  currentUserId: number;
};

export const ConversationsScreen: React.FC<Props> = ({
  onBack,
  onOpenConversation,
  token,
  apiBaseUrl,
  currentUserId
}) => {
  const theme = useTheme();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConversations = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);

      const response = await fetch(`${apiBaseUrl}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err: any) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConversations();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => fetchConversations(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations(true);
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredConversations = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return conversations;

    return conversations.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const message = (item.last_message || '').toLowerCase();
      return name.includes(needle) || message.includes(needle);
    });
  }, [conversations, searchQuery]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Messages" onBack={onBack} />

      {loading && conversations.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.neonGreen} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: 'rgba(173, 255, 26, 0.1)' }]}>
            <Feather name="message-circle" size={40} color={theme.colors.neonGreen} />
          </View>
          <Typography variant="h2" style={{ color: theme.colors.text, marginTop: 24 }}>
            No conversations yet
          </Typography>
          <Typography variant="body" style={{ color: theme.colors.muted, marginTop: 12, textAlign: 'center', paddingHorizontal: 40 }}>
            Start matching to begin conversations
          </Typography>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.neonGreen}
              colors={[theme.colors.neonGreen]}
            />
          }
        >
          <View style={[styles.searchContainer, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Feather name="search" size={18} color={theme.colors.muted} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search messages"
              placeholderTextColor={theme.colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {filteredConversations.length === 0 ? (
            <View style={[styles.row, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <Typography variant="small" style={{ color: theme.colors.muted }}>
                No conversations found for "{searchQuery}".
              </Typography>
            </View>
          ) : null}

          {filteredConversations.map((item) => {
            const isUnread = item.unread_count > 0;
            const isLastMessageFromMe = item.last_message_sender_id === currentUserId;

            return (
              <TouchableOpacity
                key={item.match_id}
                style={[styles.row, {
                  borderColor: isUnread ? theme.colors.secondaryHairline : theme.colors.border,
                  backgroundColor: isUnread ? theme.colors.secondaryHighlight : theme.colors.surface,
                }]}
                onPress={() => onOpenConversation(item.match_id, item.name, item.user_id)}
                activeOpacity={0.7}
              >
                <View style={styles.photoContainer}>
                  <Image
                    source={item.photo ? { uri: item.photo } : require('../../assets/icon.png')}
                    style={styles.photo}
                  />
                  {item.is_verified && (
                    <View style={[styles.verifiedBadge, { backgroundColor: '#3B82F6' }]}>
                      <Feather name="check" size={10} color="#FFF" />
                    </View>
                  )}
                  {isUnread && (
                    <View style={[styles.unreadDot, { backgroundColor: theme.colors.neonGreen }]} />
                  )}
                </View>

                <View style={styles.messageInfo}>
                  <View style={styles.nameRow}>
                    <Typography
                      variant="bodyStrong"
                      style={{
                        color: theme.colors.text,
                        fontWeight: isUnread ? '700' : '600',
                      }}
                    >
                      {item.name}
                    </Typography>
                    {item.last_message_time && (
                      <Typography
                        variant="tiny"
                        style={{ color: isUnread ? theme.colors.neonGreen : theme.colors.muted }}
                      >
                        {formatTime(item.last_message_time)}
                      </Typography>
                    )}
                  </View>

                  <View style={styles.lastMessageRow}>
                    <Typography
                      variant="small"
                      style={{
                        color: isUnread ? theme.colors.text : theme.colors.muted,
                        fontWeight: isUnread ? '500' : '400',
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {isLastMessageFromMe ? 'You: ' : ''}
                      {item.last_message || 'Start the conversation'}
                    </Typography>

                    {isUnread && item.unread_count > 0 && (
                      <View style={[styles.unreadBadge, { backgroundColor: theme.colors.neonGreen }]}>
                        <Typography
                          variant="tiny"
                          style={{ color: theme.colors.deepBlack, fontWeight: '700', fontSize: 11 }}
                        >
                          {item.unread_count > 9 ? '9+' : item.unread_count}
                        </Typography>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    fontFamily: 'RedHatDisplay_400Regular',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E8E8E8',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#000',
  },
  messageInfo: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
