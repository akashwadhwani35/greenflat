import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from './Typography';
import { useTheme } from '../theme/ThemeProvider';
import { PixelFlag } from './PixelFlag';

export type TabId = 'explore' | 'likes' | 'ai' | 'messages' | 'profile';

type BottomNavProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  likesCount?: number;
  messagesCount?: number;
};

type TabItem = {
  id: TabId;
  label: string;
  icon: string;
  activeIcon?: string;
  isCenter?: boolean;
};

const tabs: TabItem[] = [
  { id: 'explore', label: 'Discover', icon: 'compass', activeIcon: 'compass' },
  { id: 'likes', label: 'Likes', icon: 'heart', activeIcon: 'heart' },
  { id: 'ai', label: 'AI Search', icon: 'zap', activeIcon: 'zap', isCenter: true },
  { id: 'messages', label: 'Chats', icon: 'message-circle', activeIcon: 'message-circle' },
  { id: 'profile', label: 'Profile', icon: 'user', activeIcon: 'user' },
];

// AI Flag Icon Component with microanimation (matching PostOnboardingScreen)
const AIFlagIcon: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.5],
  });

  return (
    <Animated.View
      style={[
        styles.aiFlagContainer,
        {
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      {/* Glow effect */}
      {isActive && (
        <Animated.View
          style={[
            styles.aiGlow,
            {
              opacity: glowOpacity,
            },
          ]}
        />
      )}

      {/* Flag icon - Option 1: inactive has dark bg with green flag, active has green bg with black flag */}
      <View style={[
        styles.aiFlagIcon,
        {
          backgroundColor: isActive ? '#ADFF1A' : '#1A1A1A',
          borderWidth: isActive ? 0 : 2,
          borderColor: '#ADFF1A',
        }
      ]}>
        <PixelFlag size={22} color={isActive ? '#000000' : '#ADFF1A'} />
      </View>
    </Animated.View>
  );
};

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  likesCount = 0,
  messagesCount = 0,
}) => {
  const theme = useTheme();

  const getBadgeCount = (tabId: TabId): number => {
    switch (tabId) {
      case 'likes':
        return likesCount;
      case 'messages':
        return messagesCount;
      default:
        return 0;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.deepBlack }]}>
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const badgeCount = getBadgeCount(tab.id);
          const isCenter = tab.isCenter;

          // Center AI button with special styling
          if (isCenter) {
            return (
              <TouchableOpacity
                key={tab.id}
                style={styles.centerTab}
                onPress={() => onTabChange(tab.id)}
                activeOpacity={0.85}
              >
                <AIFlagIcon isActive={isActive} />
              </TouchableOpacity>
            );
          }

          // Regular tabs - icons only, no labels (like Bumble/Hinge)
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.7}
            >
              {/* Icon with badge */}
              <View style={styles.iconContainer}>
                <Feather
                  name={isActive ? (tab.activeIcon || tab.icon) : tab.icon as any}
                  size={24}
                  color={isActive ? theme.colors.neonGreen : theme.colors.muted}
                  style={styles.icon}
                />
                {badgeCount > 0 && (
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: theme.colors.error },
                    ]}
                  >
                    <Typography
                      variant="tiny"
                      style={[
                        styles.badgeText,
                        { color: theme.colors.text },
                      ]}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount.toString()}
                    </Typography>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    flex: 1,
  },
  centerTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconContainer: {
    position: 'relative',
  },
  icon: {
    // No additional styles needed
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#000000',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  // AI Flag Icon styles (matching PostOnboardingScreen)
  aiFlagContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiGlow: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ADFF1A',
    shadowColor: '#ADFF1A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  aiFlagIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ADFF1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
    position: 'relative',
  },
});
