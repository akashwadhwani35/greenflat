import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';

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
  onOpenAdmin?: () => void;
  isAdmin?: boolean;
  onLogout?: () => void;
  token?: string;
  apiBaseUrl?: string;
  onAccountDeleted?: () => void;
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
  onOpenAdmin,
  isAdmin,
  onLogout,
  token,
  apiBaseUrl,
  onAccountDeleted,
}) => {
  const theme = useTheme();
  const [deleting, setDeleting] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    hide_distance: false,
    incognito_mode: false,
    show_online_status: true,
  });

  useEffect(() => {
    if (!token || !apiBaseUrl) return;
    fetch(`${apiBaseUrl}/privacy/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setPrivacySettings((prev) => ({ ...prev, ...data.settings }));
        }
      })
      .catch((err) => console.warn('Failed to load privacy settings:', err));
  }, [token, apiBaseUrl]);

  const updateToggle = async (key: keyof typeof privacySettings, value: boolean) => {
    if (!token || !apiBaseUrl) return;
    const previous = privacySettings;
    setPrivacySettings((prev) => ({ ...prev, [key]: value }));
    try {
      const response = await fetch(`${apiBaseUrl}/privacy/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [key]: value }),
      });
      if (!response.ok) {
        throw new Error('Update failed');
      }
    } catch {
      setPrivacySettings(previous);
      Alert.alert('Error', 'Could not update setting. Please try again.');
    }
  };

  const menuItems = [
    ...(isAdmin ? [{ title: 'Admin dashboard', subtitle: 'Moderate users and reports', icon: 'shield', action: onOpenAdmin }] : []),
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
      <PageHeader title="Settings" onBack={onBack} />

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
            <Switch
              value={privacySettings.hide_distance}
              onValueChange={(v) => updateToggle('hide_distance', v)}
              trackColor={{ false: theme.colors.muted, true: theme.colors.brand }}
            />
          </View>
          <View style={styles.toggleRow}>
            <Typography variant="body">Incognito mode</Typography>
            <Switch
              value={privacySettings.incognito_mode}
              onValueChange={(v) => updateToggle('incognito_mode', v)}
              trackColor={{ false: theme.colors.muted, true: theme.colors.brand }}
            />
          </View>
          <View style={styles.toggleRow}>
            <Typography variant="body">Show online status</Typography>
            <Switch
              value={privacySettings.show_online_status}
              onValueChange={(v) => updateToggle('show_online_status', v)}
              trackColor={{ false: theme.colors.muted, true: theme.colors.brand }}
            />
          </View>
        </View>

        {__DEV__ && (
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
        )}

        <Button label="Log out" variant="secondary" onPress={onLogout || onBack} fullWidth />
        <Button
          label="Delete account"
          loading={deleting}
          onPress={() => {
            if (!token || !apiBaseUrl) return;
            Alert.alert(
              'Delete account',
              'This permanently deletes your profile, matches, and messages.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setDeleting(true);
                      const response = await fetch(`${apiBaseUrl}/profile/me`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const body = await response.json().catch(() => ({}));
                      if (!response.ok) {
                        throw new Error(body.error || 'Unable to delete account');
                      }
                      onAccountDeleted?.();
                    } catch (error: any) {
                      Alert.alert('Delete failed', error?.message || 'Please try again.');
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ]
            );
          }}
          fullWidth
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
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
