import React, { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StatusBar, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

type Message = {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: Date;
};

type MessagesScreenProps = {
  matchName: string;
  onBack: () => void;
};

export const MessagesScreen: React.FC<MessagesScreenProps> = ({ matchName, onBack }) => {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: `Hey! It's great to match with you 💚`,
      sender: 'them',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        text: inputText.trim(),
        sender: 'me',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, newMessage]);
      setInputText('');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender === 'me';
    return (
      <View style={[styles.messageBubbleContainer, isMe && styles.myMessageContainer]}>
        <View
          style={[
            styles.messageBubble,
            isMe
              ? { backgroundColor: theme.colors.brand }
              : { backgroundColor: theme.colors.surface },
          ]}
        >
          <Typography
            variant="body"
            style={[styles.messageText, isMe && { color: '#FFFFFF' }]}
          >
            {item.text}
          </Typography>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Feather name="arrow-left" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h2" style={styles.headerTitle}>
          {matchName}
        </Typography>
        <View style={{ width: 40 }} />
      </View>

      {/* Messages List */}
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: theme.colors.surface }]}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, { color: theme.colors.text }]}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          onPress={handleSend}
          style={[
            styles.sendButton,
            { backgroundColor: inputText.trim() ? theme.colors.brand : theme.colors.border },
          ]}
          activeOpacity={0.8}
          disabled={!inputText.trim()}
        >
          <Feather name="send" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageBubbleContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  myMessageContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  messageText: {
    lineHeight: 20,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'RedHatDisplay_400Regular',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
