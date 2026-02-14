import React from 'react';
import { Platform, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from './Typography';

type Props = {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
};

export const PageHeader: React.FC<Props> = ({ title, onBack, right }) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton} accessibilityRole="button" activeOpacity={0.8}>
        <Feather name="arrow-left" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <Typography variant="h1" style={styles.title}>
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
    backgroundColor: '#1B2920',
    borderWidth: 1,
    borderColor: '#4D4D4D',
  },
  title: {
    color: '#FFFFFF',
  },
  right: {
    marginLeft: 'auto',
  },
});
