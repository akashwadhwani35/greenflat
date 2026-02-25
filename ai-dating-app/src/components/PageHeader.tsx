import React from 'react';
import { Platform, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from './Typography';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
};

export const PageHeader: React.FC<Props> = ({ title, onBack, right }) => {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={[styles.backButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
        accessibilityRole="button"
        activeOpacity={0.8}
      >
        <Feather name="arrow-left" size={22} color={theme.colors.text} />
      </TouchableOpacity>
      <Typography variant="h1" style={[styles.title, { color: theme.colors.text }]}>
        {title}
      </Typography>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'ios' ? 58 : (StatusBar.currentHeight || 0) + 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {},
  right: {
    marginLeft: 'auto',
  },
});
