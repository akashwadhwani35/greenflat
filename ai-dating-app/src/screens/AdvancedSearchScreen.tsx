import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeProvider';

export type AdvancedFilters = {
  minAge?: string;
  maxAge?: string;
  distance_km?: string;
  interested_in?: 'male' | 'female' | 'both' | '';
  religion?: string;
  relationship_goal?: string;

  ethnicity?: string;
  minHeight?: string;
  maxHeight?: string;
  dating_intentions?: string;
  have_kids?: string;
  drugs?: string;
  smoking_habit?: string;
  marijuana?: string;
  drinker?: string;
  politics?: string;
  education_level?: string;

  // Kept for AI flow compatibility (not editable in this screen).
  keywords?: string;
  city?: string;
};

type Props = {
  onBack: () => void;
  initialFilters?: AdvancedFilters;
  onApply: (filters: AdvancedFilters) => void;
  token: string;
  apiBaseUrl: string;
  onOpenCheckout?: () => void;
};

type Option = {
  value: string;
  label: string;
  icon?: string;
};

const RELIGION_OPTIONS: Option[] = [
  { value: 'religious', label: 'Religious' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'agnostic', label: 'Agnostic' },
  { value: 'atheist', label: 'Atheist' },
];

const RELATIONSHIP_TYPE_OPTIONS: Option[] = [
  { value: 'long-term', label: 'Long-term', icon: 'users' },
  { value: 'serious', label: 'Serious', icon: 'heart' },
  { value: 'casual', label: 'Casual', icon: 'coffee' },
  { value: 'friendship', label: 'Friendship', icon: 'smile' },
];

const DATING_INTENTION_OPTIONS: Option[] = [
  { value: 'long-term', label: 'Long-term' },
  { value: 'serious', label: 'Serious' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendship', label: 'Friendship' },
];

const CHILDREN_OPTIONS: Option[] = [
  { value: 'no', label: 'No children' },
  { value: 'have kids', label: 'Have children' },
  { value: 'want kids', label: 'Want children' },
];

const SMOKING_OPTIONS: Option[] = [
  { value: 'never', label: 'Never' },
  { value: 'social', label: 'Socially' },
  { value: 'regular', label: 'Regularly' },
];

const DRINKING_OPTIONS: Option[] = [
  { value: 'never', label: 'Never' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'social', label: 'Socially' },
  { value: 'often', label: 'Often' },
];

const USAGE_OPTIONS: Option[] = [
  { value: 'never', label: 'Never' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'often', label: 'Often' },
];

const POLITICS_OPTIONS: Option[] = [
  { value: 'liberal', label: 'Liberal' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'conservative', label: 'Conservative' },
  { value: 'apolitical', label: 'Apolitical' },
];

const EDUCATION_OPTIONS: Option[] = [
  { value: 'high school', label: 'High school' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'postgraduate', label: 'Postgraduate' },
  { value: 'phd', label: 'PhD' },
  { value: 'other', label: 'Other' },
];

const PAID_FILTER_KEYS: Array<keyof AdvancedFilters> = [
  'ethnicity',
  'minHeight',
  'maxHeight',
  'dating_intentions',
  'have_kids',
  'drugs',
  'smoking_habit',
  'marijuana',
  'drinker',
  'politics',
  'education_level',
];

const isNonEmptyValue = (value: unknown) => {
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
};

export const AdvancedSearchScreen: React.FC<Props> = ({
  onBack,
  initialFilters,
  onApply,
  token,
  apiBaseUrl,
  onOpenCheckout,
}) => {
  const theme = useTheme();
  const [filters, setFilters] = useState<AdvancedFilters>(initialFilters || {});
  const [hasPaidPlan, setHasPaidPlan] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(true);

  useEffect(() => {
    const loadPlanStatus = async () => {
      try {
        setLoadingPlan(true);
        const response = await fetch(`${apiBaseUrl}/profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          setHasPaidPlan(false);
          return;
        }

        const data = await response.json();
        const user = data?.user || {};
        const premiumExpiresAt = user.premium_expires_at ? new Date(user.premium_expires_at).getTime() : null;
        const activePaidPlan = Boolean(user.is_premium) && (premiumExpiresAt === null || premiumExpiresAt > Date.now());
        setHasPaidPlan(activePaidPlan);
      } catch {
        setHasPaidPlan(false);
      } finally {
        setLoadingPlan(false);
      }
    };

    void loadPlanStatus();
  }, [apiBaseUrl, token]);

  const update = (key: keyof AdvancedFilters, value: string | undefined, isPaidFilter = false) => {
    if (isPaidFilter && !hasPaidPlan) {
      Alert.alert('Paid filter', 'This filter is available on paid plans only.');
      return;
    }

    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const hasActiveVisibleFilters = useMemo(
    () =>
      Object.entries(filters).some(([key, value]) => {
        if (key === 'keywords') return false;
        return isNonEmptyValue(value);
      }),
    [filters]
  );

  const clearVisibleFilters = () => {
    setFilters((prev) => ({
      keywords: prev.keywords,
    }));
  };

  const applyFilters = () => {
    const nextFilters: AdvancedFilters = { ...filters };
    delete nextFilters.city;
    if (!hasPaidPlan) {
      PAID_FILTER_KEYS.forEach((key) => {
        delete (nextFilters as any)[key];
      });
    }
    onApply(nextFilters);
  };

  const onPressPaidLocked = () => {
    if (hasPaidPlan) return;
    if (onOpenCheckout) {
      onOpenCheckout();
      return;
    }
    Alert.alert('Paid filters', 'Upgrade to a paid plan to unlock these filters.');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[theme.colors.deepBlack, theme.colors.darkBlack]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Typography variant="h1" style={{ color: theme.colors.text }}>
          Filters
        </Typography>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="Free filters" icon="unlock">
          <Typography variant="small" style={{ color: theme.colors.muted }}>
            Available on all plans
          </Typography>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 12 }}>Interested in gender</Typography>
          <View style={styles.chipGrid}>
            <ChipToggle
              label="Men"
              icon="user"
              active={filters.interested_in === 'male'}
              onPress={() => update('interested_in', filters.interested_in === 'male' ? '' : 'male')}
            />
            <ChipToggle
              label="Women"
              icon="user"
              active={filters.interested_in === 'female'}
              onPress={() => update('interested_in', filters.interested_in === 'female' ? '' : 'female')}
            />
            <ChipToggle
              label="Everyone"
              icon="users"
              active={filters.interested_in === 'both'}
              onPress={() => update('interested_in', filters.interested_in === 'both' ? '' : 'both')}
            />
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Max distance (km)</Typography>
          <Input
            placeholder="e.g. 25"
            keyboardType="numeric"
            value={filters.distance_km}
            onChangeText={(text) => update('distance_km', text)}
            leftIcon="navigation"
          />

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Age group</Typography>
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

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Religion</Typography>
          <View style={styles.chipGrid}>
            {RELIGION_OPTIONS.map((option) => {
              const selected = filters.religion?.toLowerCase() === option.value;
              return (
                <ChipToggle
                  key={option.value}
                  label={option.label}
                  active={selected}
                  onPress={() => update('religion', selected ? '' : option.value)}
                />
              );
            })}
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Relationship type</Typography>
          <View style={styles.chipGrid}>
            {RELATIONSHIP_TYPE_OPTIONS.map((option) => {
              const selected = filters.relationship_goal === option.value;
              return (
                <ChipToggle
                  key={option.value}
                  label={option.label}
                  icon={option.icon}
                  active={selected}
                  onPress={() => update('relationship_goal', selected ? '' : option.value)}
                />
              );
            })}
          </View>
        </Section>

        <Section title="Paid plan filters" icon="lock">
          {loadingPlan ? (
            <View style={styles.planLoaderRow}>
              <ActivityIndicator size="small" color={theme.colors.neonGreen} />
              <Typography variant="small" style={{ color: theme.colors.muted, marginLeft: 8 }}>
                Checking plan access...
              </Typography>
            </View>
          ) : !hasPaidPlan ? (
            <View style={[styles.lockCard, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}> 
              <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
                Upgrade to unlock paid filters
              </Typography>
              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 6 }}>
                Ethnicity, height, intentions, children, lifestyle and education filters are paid-plan only.
              </Typography>
              <View style={{ marginTop: 12 }}>
                <Button label="View plans" onPress={onPressPaidLocked} fullWidth />
              </View>
            </View>
          ) : null}

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 10 }}>Ethnicity</Typography>
          <Input
            placeholder="e.g. South Asian"
            value={filters.ethnicity}
            onChangeText={(text) => update('ethnicity', text, true)}
            disabled={!hasPaidPlan}
            onLockedPress={onPressPaidLocked}
          />

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Height (cm)</Typography>
          <View style={styles.rangeRow}>
            <View style={{ flex: 1 }}>
              <Input
                placeholder="Min"
                keyboardType="numeric"
                value={filters.minHeight}
                onChangeText={(text) => update('minHeight', text, true)}
                disabled={!hasPaidPlan}
                onLockedPress={onPressPaidLocked}
              />
            </View>
            <View style={styles.rangeDivider}>
              <View style={[styles.rangeLine, { backgroundColor: theme.colors.border }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                placeholder="Max"
                keyboardType="numeric"
                value={filters.maxHeight}
                onChangeText={(text) => update('maxHeight', text, true)}
                disabled={!hasPaidPlan}
                onLockedPress={onPressPaidLocked}
              />
            </View>
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Dating intentions</Typography>
          <View style={styles.chipGrid}>
            {DATING_INTENTION_OPTIONS.map((option) => {
              const selected = filters.dating_intentions === option.value;
              return (
                <ChipToggle
                  key={option.value}
                  label={option.label}
                  active={selected}
                  disabled={!hasPaidPlan}
                  onPress={() => update('dating_intentions', selected ? '' : option.value, true)}
                />
              );
            })}
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Children</Typography>
          <View style={styles.chipGrid}>
            {CHILDREN_OPTIONS.map((option) => {
              const selected = filters.have_kids?.toLowerCase() === option.value;
              return (
                <ChipToggle
                  key={option.value}
                  label={option.label}
                  active={selected}
                  disabled={!hasPaidPlan}
                  onPress={() => update('have_kids', selected ? '' : option.value, true)}
                />
              );
            })}
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Drugs</Typography>
          <View style={styles.chipGrid}>
            {USAGE_OPTIONS.map((option) => {
              const selected = filters.drugs === option.value;
              return (
                <ChipToggle
                  key={`drugs-${option.value}`}
                  label={option.label}
                  active={selected}
                  disabled={!hasPaidPlan}
                  onPress={() => update('drugs', selected ? '' : option.value, true)}
                />
              );
            })}
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Smoking</Typography>
          <View style={styles.chipGrid}>
            {SMOKING_OPTIONS.map((option) => {
              const selected = filters.smoking_habit === option.value;
              return (
                <ChipToggle
                  key={`smoke-${option.value}`}
                  label={option.label}
                  active={selected}
                  disabled={!hasPaidPlan}
                  onPress={() => update('smoking_habit', selected ? '' : option.value, true)}
                />
              );
            })}
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Marijuana</Typography>
          <View style={styles.chipGrid}>
            {USAGE_OPTIONS.map((option) => {
              const selected = filters.marijuana === option.value;
              return (
                <ChipToggle
                  key={`mj-${option.value}`}
                  label={option.label}
                  active={selected}
                  disabled={!hasPaidPlan}
                  onPress={() => update('marijuana', selected ? '' : option.value, true)}
                />
              );
            })}
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Drinking</Typography>
          <View style={styles.chipGrid}>
            {DRINKING_OPTIONS.map((option) => {
              const selected = filters.drinker === option.value;
              return (
                <ChipToggle
                  key={`drink-${option.value}`}
                  label={option.label}
                  active={selected}
                  disabled={!hasPaidPlan}
                  onPress={() => update('drinker', selected ? '' : option.value, true)}
                />
              );
            })}
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Politics</Typography>
          <View style={styles.chipGrid}>
            {POLITICS_OPTIONS.map((option) => {
              const selected = filters.politics === option.value;
              return (
                <ChipToggle
                  key={`politics-${option.value}`}
                  label={option.label}
                  active={selected}
                  disabled={!hasPaidPlan}
                  onPress={() => update('politics', selected ? '' : option.value, true)}
                />
              );
            })}
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Education</Typography>
          <View style={styles.chipGrid}>
            {EDUCATION_OPTIONS.map((option) => {
              const selected = filters.education_level === option.value;
              return (
                <ChipToggle
                  key={`edu-${option.value}`}
                  label={option.label}
                  active={selected}
                  disabled={!hasPaidPlan}
                  onPress={() => update('education_level', selected ? '' : option.value, true)}
                />
              );
            })}
          </View>
        </Section>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.deepBlack }]}> 
        {hasActiveVisibleFilters ? (
          <TouchableOpacity style={styles.clearButton} onPress={clearVisibleFilters} activeOpacity={0.8}>
            <Feather name="x" size={16} color={theme.colors.muted} />
            <Typography variant="body" style={{ color: theme.colors.muted, marginLeft: 6 }}>
              Clear filters
            </Typography>
          </TouchableOpacity>
        ) : null}

        <View style={{ marginTop: hasActiveVisibleFilters ? 12 : 0 }}>
          <Button
            label={hasActiveVisibleFilters ? 'Apply filters' : 'Show all matches'}
            onPress={applyFilters}
            fullWidth
          />
        </View>
      </View>
    </View>
  );
};

const Section: React.FC<{ title: string; icon: string; children: React.ReactNode }> = ({ title, icon, children }) => {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconCircle, { backgroundColor: 'rgba(188, 246, 65, 0.1)' }]}>
          <Feather name={icon as any} size={18} color={theme.colors.neonGreen} />
        </View>
        <Typography variant="h2" style={{ color: theme.colors.text }}>
          {title}
        </Typography>
      </View>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
};

const Input: React.FC<TextInput['props'] & { leftIcon?: string; disabled?: boolean; onLockedPress?: () => void }> = ({
  leftIcon,
  disabled,
  onLockedPress,
  ...restProps
}) => {
  const theme = useTheme();

  return (
    <View style={styles.inputContainer}>
      {leftIcon ? <Feather name={leftIcon as any} size={18} color={theme.colors.muted} style={styles.inputIcon} /> : null}
      <TextInput
        {...restProps}
        editable={!disabled}
        style={[
          styles.input,
          {
            borderColor: theme.colors.border,
            color: disabled ? theme.colors.muted : theme.colors.text,
            backgroundColor: disabled ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.03)',
            paddingLeft: leftIcon ? 42 : 16,
            opacity: disabled ? 0.65 : 1,
          },
          'style' in restProps ? restProps.style : undefined,
        ]}
        placeholderTextColor={theme.colors.muted}
      />
      {disabled && onLockedPress ? (
        <TouchableOpacity style={styles.inputLockOverlay} onPress={onLockedPress} activeOpacity={1} />
      ) : null}
    </View>
  );
};

const ChipToggle: React.FC<{
  label: string;
  icon?: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}> = ({ label, icon, active, disabled = false, onPress }) => {
  const theme = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.colors.secondaryHighlight : 'rgba(255, 255, 255, 0.05)',
          borderColor: active ? theme.colors.secondaryHairline : theme.colors.border,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
      activeOpacity={0.8}
    >
      {icon ? (
        <Feather
          name={icon as any}
          size={14}
          color={active ? theme.colors.neonGreen : theme.colors.muted}
        />
      ) : null}
      <Typography variant="body" style={{ color: theme.colors.text }}>
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
    borderWidth: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planLoaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  lockCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
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
    fontFamily: 'RedHatDisplay_400Regular',
  },
  inputLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
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
