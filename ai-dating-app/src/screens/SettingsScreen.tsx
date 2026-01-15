import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';

type Props = {
  onBack: () => void;
  onOpenProfileEdit?: () => void;
  onOpenPhotos?: () => void;
  onOpenVerification?: () => void;
  onOpenPrivacy?: () => void;
  onOpenHelp?: () => void;
  onOpenTerms?: () => void;
  onOpenCheckout?: () => void;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
  onOpenLikesInbox?: () => void;
  onOpenMatches?: () => void;
  onOpenConversations?: () => void;
  onOpenAISearch?: () => void;
  onOpenAdvancedSearch?: () => void;
  onOpenWallet?: () => void;
  onLogout?: () => void;
};

export const SettingsScreen: React.FC<Props> = ({
  onBack,
  onOpenProfileEdit,
  onOpenPhotos,
  onOpenVerification,
  onOpenPrivacy,
  onOpenHelp,
  onOpenTerms,
  onOpenCheckout,
  onOpenNotifications,
  onOpenProfile,
  onOpenLikesInbox,
  onOpenMatches,
  onOpenConversations,
  onOpenAISearch,
  onOpenAdvancedSearch,
  onOpenWallet,
  onLogout,
}) => {
  const theme = useTheme();

  const menuItems = [
    { title: 'Your profile', subtitle: 'Preview how your profile looks', icon: 'user', action: onOpenProfile },
    { title: 'Profile & prompts', subtitle: 'Edit bio, interests, prompts', icon: 'user', action: onOpenProfileEdit },
    { title: 'Photos', subtitle: 'Add, reorder, set primary', icon: 'image', action: onOpenPhotos },
    { title: 'Verification', subtitle: 'Photo / selfie verification', icon: 'shield', action: onOpenVerification },
    { title: 'Privacy & safety', subtitle: 'Visibility, block/report, incognito', icon: 'eye', action: onOpenPrivacy },
    { title: 'Notifications', subtitle: 'Manage pushes and device settings', icon: 'bell', action: onOpenNotifications },
    { title: 'Support', subtitle: 'FAQ, contact, policies', icon: 'help-circle', action: onOpenHelp },
    { title: 'Plans', subtitle: 'Upgrade, tokens, boosts', icon: 'credit-card', action: onOpenCheckout },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.iconButton, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}
          accessibilityRole="button"
        >
          <Feather name="arrow-left" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h1">Settings</Typography>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={[styles.row, { borderColor: theme.colors.border }]}
            onPress={item.action}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <View style={[styles.iconPill, { backgroundColor: theme.colors.successTint }]}>
              <Feather name={item.icon as any} size={18} color={theme.colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="bodyStrong">{item.title}</Typography>
              <Typography variant="small" muted>
                {item.subtitle}
              </Typography>
            </View>
            <Feather name="chevron-right" size={18} color={theme.colors.muted} />
          </TouchableOpacity>
        ))}

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <Typography variant="body">Hide distance</Typography>
            <Feather name="toggle-right" size={32} color={theme.colors.brand} />
          </View>
          <View style={styles.toggleRow}>
            <Typography variant="body">Incognito mode</Typography>
            <Feather name="toggle-left" size={32} color={theme.colors.muted} />
          </View>
          <View style={styles.toggleRow}>
            <Typography variant="body">Cool down</Typography>
            <Feather name="toggle-left" size={32} color={theme.colors.muted} />
          </View>
        </View>

        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
          <Typography variant="h2">QA shortcuts</Typography>
          <Typography variant="small" muted>
            Jump to screens to validate UI quickly.
          </Typography>
          <View style={{ gap: 10, marginTop: 6 }}>
            {onOpenLikesInbox ? <Button label="Open Likes inbox" variant="secondary" onPress={onOpenLikesInbox} fullWidth /> : null}
            {onOpenMatches ? <Button label="Open Matches" variant="secondary" onPress={onOpenMatches} fullWidth /> : null}
            {onOpenConversations ? <Button label="Open Chats" variant="secondary" onPress={onOpenConversations} fullWidth /> : null}
            {onOpenAISearch ? <Button label="Open AI Search" variant="secondary" onPress={onOpenAISearch} fullWidth /> : null}
            {onOpenAdvancedSearch ? <Button label="Open Filters" variant="secondary" onPress={onOpenAdvancedSearch} fullWidth /> : null}
            {onOpenWallet ? <Button label="Open Wallet" variant="secondary" onPress={onOpenWallet} fullWidth /> : null}
            {onOpenNotifications ? <Button label="Open Notifications" variant="secondary" onPress={onOpenNotifications} fullWidth /> : null}
          </View>
        </View>

        <Button label="Log out" variant="secondary" onPress={onLogout || onBack} fullWidth />
        <Button label="Delete account" onPress={onBack} fullWidth />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
