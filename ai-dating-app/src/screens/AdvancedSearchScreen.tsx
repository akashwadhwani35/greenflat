import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, TextInput, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeProvider';

export type AdvancedFilters = {
  minAge?: string;
  maxAge?: string;
  minHeight?: string;
  city?: string;
  relationship_goal?: string;
  smoker?: boolean;
  drinker?: string;
  distance_km?: string;
  keywords?: string;
};

type Props = {
  onBack: () => void;
  initialFilters?: AdvancedFilters;
  onApply: (filters: AdvancedFilters) => void;
};

const goalOptions = [
  { value: 'serious', label: 'Serious', icon: 'heart' },
  { value: 'long-term', label: 'Long-term', icon: 'users' },
  { value: 'casual', label: 'Casual', icon: 'coffee' },
  { value: 'friendship', label: 'Friends', icon: 'smile' },
];

const drinkerOptions = [
  { value: 'never', label: 'Never' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'social', label: 'Socially' },
  { value: 'often', label: 'Often' },
];

export const AdvancedSearchScreen: React.FC<Props> = ({ onBack, initialFilters, onApply }) => {
  const theme = useTheme();
  const [filters, setFilters] = useState<AdvancedFilters>(initialFilters || {});

  const update = (key: keyof AdvancedFilters, value: string | boolean | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== undefined && v !== '');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Background gradient */}
      <LinearGradient
        colors={[theme.colors.deepBlack, theme.colors.darkBlack]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: theme.colors.charcoal }]}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h1" style={{ color: theme.colors.text }}>
          Filters
        </Typography>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Age Range Section */}
        <Section title="Age range" icon="calendar">
          <View style={styles.rangeRow}>
            <View style={{ flex: 1 }}>
              <Input
                placeholder="Min"
                keyboardType="numeric"
                value={filters.minAge}
                onChangeText={(text) => update('minAge', text)}
              />
            </View>
            <View style={styles.rangeDivider}>
              <View style={[styles.rangeLine, { backgroundColor: theme.colors.border }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                placeholder="Max"
                keyboardType="numeric"
                value={filters.maxAge}
                onChangeText={(text) => update('maxAge', text)}
              />
            </View>
          </View>
        </Section>

        {/* Location Section */}
        <Section title="Location" icon="map-pin">
          <Input
            placeholder="City or area"
            value={filters.city}
            onChangeText={(text) => update('city', text)}
            leftIcon="search"
          />
          <View style={{ marginTop: 12 }}>
            <Input
              placeholder="Distance (km)"
              keyboardType="numeric"
              value={filters.distance_km}
              onChangeText={(text) => update('distance_km', text)}
              leftIcon="navigation"
            />
          </View>
        </Section>

        {/* Height Section */}
        <Section title="Minimum height" icon="arrow-up">
          <Input
            placeholder="Height in cm"
            keyboardType="numeric"
            value={filters.minHeight}
            onChangeText={(text) => update('minHeight', text)}
          />
        </Section>

        {/* Relationship Goal Section */}
        <Section title="Looking for" icon="target">
          <View style={styles.chipGrid}>
            {goalOptions.map((option) => {
              const selected = filters.relationship_goal === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected
                        ? theme.colors.neonGreen
                        : 'rgba(255, 255, 255, 0.05)',
                      borderColor: selected
                        ? theme.colors.neonGreen
                        : theme.colors.border,
                    },
                  ]}
                  onPress={() => update('relationship_goal', selected ? '' : option.value)}
                  activeOpacity={0.8}
                >
                  <Feather
                    name={option.icon as any}
                    size={16}
                    color={selected ? theme.colors.deepBlack : theme.colors.text}
                  />
                  <Typography
                    variant="body"
                    style={{
                      color: selected ? theme.colors.deepBlack : theme.colors.text,
                      fontWeight: selected ? '600' : '400',
                    }}
                  >
                    {option.label}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        {/* Lifestyle Section */}
        <Section title="Lifestyle" icon="coffee">
          {/* Smoking */}
          <Typography variant="small" style={{ color: theme.colors.muted, marginBottom: 10 }}>
            Smoking
          </Typography>
          <View style={styles.chipRow}>
            <ChipToggle
              label="Non-smoker only"
              icon="slash"
              active={filters.smoker === false}
              onPress={() => update('smoker', filters.smoker === false ? undefined : false)}
            />
            <ChipToggle
              label="Any"
              icon="check"
              active={filters.smoker === undefined}
              onPress={() => update('smoker', undefined)}
            />
          </View>

          {/* Drinking */}
          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 16, marginBottom: 10 }}>
            Drinking
          </Typography>
          <View style={styles.chipGrid}>
            {drinkerOptions.map((option) => {
              const selected = filters.drinker === option.value;
              return (
                <ChipToggle
                  key={option.value}
                  label={option.label}
                  active={selected}
                  onPress={() => update('drinker', selected ? '' : option.value)}
                />
              );
            })}
          </View>
        </Section>

        {/* Keywords Section */}
        <Section title="Personality keywords" icon="zap">
          <Typography variant="small" style={{ color: theme.colors.muted, marginBottom: 12, lineHeight: 20 }}>
            Add traits you're looking for. Our AI will find matches based on these.
          </Typography>
          <Input
            placeholder="e.g., mindful, adventurous, creative"
            value={filters.keywords}
            onChangeText={(text) => update('keywords', text)}
            multiline
            style={{ minHeight: 80, paddingTop: 14 }}
          />
        </Section>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: theme.colors.deepBlack }]}>
        {hasActiveFilters && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setFilters({})}
            activeOpacity={0.8}
          >
            <Feather name="x" size={16} color={theme.colors.muted} />
            <Typography variant="body" style={{ color: theme.colors.muted, marginLeft: 6 }}>
              Clear all
            </Typography>
          </TouchableOpacity>
        )}
        <View style={{ marginTop: hasActiveFilters ? 12 : 0 }}>
          <Button
            label={hasActiveFilters ? 'Apply filters' : 'Show all matches'}
            onPress={() => onApply(filters)}
            fullWidth
          />
        </View>
      </View>
    </View>
  );
};

const Section: React.FC<{ title: string; icon?: string; children: React.ReactNode }> = ({
  title,
  icon,
  children
}) => {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon && (
          <View style={[styles.sectionIconCircle, { backgroundColor: 'rgba(188, 246, 65, 0.1)' }]}>
            <Feather name={icon as any} size={18} color={theme.colors.neonGreen} />
          </View>
        )}
        <Typography variant="h2" style={{ color: theme.colors.text }}>
          {title}
        </Typography>
      </View>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
};

const Input: React.FC<TextInput['props'] & { leftIcon?: string }> = (props) => {
  const theme = useTheme();
  const { leftIcon, ...restProps } = props;

  return (
    <View style={styles.inputContainer}>
      {leftIcon && (
        <Feather
          name={leftIcon as any}
          size={18}
          color={theme.colors.muted}
          style={styles.inputIcon}
        />
      )}
      <TextInput
        {...restProps}
        style={[
          styles.input,
          {
            borderColor: theme.colors.border,
            color: theme.colors.text,
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            paddingLeft: leftIcon ? 42 : 16,
          },
          'style' in restProps ? restProps.style : undefined,
        ]}
        placeholderTextColor={theme.colors.muted}
      />
    </View>
  );
};

const ChipToggle: React.FC<{
  label: string;
  icon?: string;
  active: boolean;
  onPress: () => void;
}> = ({ label, icon, active, onPress }) => {
  const theme = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active
            ? 'rgba(188, 246, 65, 0.15)'
            : 'rgba(255, 255, 255, 0.05)',
          borderColor: active
            ? theme.colors.neonGreen
            : theme.colors.border,
        },
      ]}
      activeOpacity={0.8}
    >
      {icon && (
        <Feather
          name={icon as any}
          size={14}
          color={active ? theme.colors.neonGreen : theme.colors.muted}
        />
      )}
      <Typography
        variant="body"
        style={{
          color: active ? theme.colors.neonGreen : theme.colors.text,
          fontWeight: active ? '600' : '400',
        }}
      >
        {label}
      </Typography>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rangeDivider: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeLine: {
    width: 12,
    height: 2,
    borderRadius: 1,
  },
  inputContainer: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    top: 16,
    zIndex: 1,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '400',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
});
