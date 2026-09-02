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
  religion?: string | string[];
  relationship_goal?: string | string[];

  ethnicity?: string;
  minHeight?: string;
  maxHeight?: string;
  dating_intentions?: string;
  have_kids?: string | string[];
  drugs?: string | string[];
  smoking_habit?: string | string[];
  marijuana?: string | string[];
  drinker?: string | string[];
  politics?: string;
  education_level?: string;
  // Trait facets from the quiz. Any-of within a facet.
  personality_traits?: string[];
  communication_style?: string[];
  relationship_needs?: string[];
  conflict_style?: string[];
  lifestyle?: string[];

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
  { value: 'hindu', label: 'Hindu' },
  { value: 'muslim', label: 'Muslim' },
  { value: 'christian', label: 'Christian' },
  { value: 'sikh', label: 'Sikh' },
  { value: 'buddhist', label: 'Buddhist' },
  { value: 'jain', label: 'Jain' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'agnostic', label: 'Agnostic' },
  { value: 'atheist', label: 'Atheist' },
  { value: 'other', label: 'Other' },
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

const ETHNICITY_OPTIONS: Option[] = [
  { value: 'south asian', label: 'South Asian' },
  { value: 'east asian', label: 'East Asian' },
  { value: 'southeast asian', label: 'Southeast Asian' },
  { value: 'middle eastern', label: 'Middle Eastern' },
  { value: 'black', label: 'Black / African' },
  { value: 'white', label: 'White / Caucasian' },
  { value: 'hispanic', label: 'Hispanic / Latino' },
  { value: 'native american', label: 'Native American' },
  { value: 'pacific islander', label: 'Pacific Islander' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'other', label: 'Other' },
];

const EDUCATION_OPTIONS: Option[] = [
  { value: 'high school', label: 'High school' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'postgraduate', label: 'Postgraduate' },
  { value: 'phd', label: 'PhD' },
  { value: 'other', label: 'Other' },
];

// Per the board. Free: gender, age, distance, relationship intention, religion,
// children, smoking, drinking, marijuana, drugs. Dating intentions moved to
// free (and is the same thing as relationship type, so it is not shown twice).
const PAID_FILTER_KEYS: Array<keyof AdvancedFilters> = [
  'ethnicity',
  'minHeight',
  'maxHeight',
  'politics',
  'education_level',
  'personality_traits',
  'communication_style',
  'relationship_needs',
  'conflict_style',
  'lifestyle',
];

type MultiKey =
  | 'religion' | 'relationship_goal' | 'have_kids' | 'drugs' | 'smoking_habit' | 'marijuana' | 'drinker'
  | 'personality_traits' | 'communication_style' | 'relationship_needs' | 'conflict_style' | 'lifestyle';

const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : typeof value === 'string' && value ? [value] : [];

const FACETS: { key: MultiKey; title: string }[] = [
  { key: 'personality_traits', title: 'Personality traits' },
  { key: 'communication_style', title: 'Communication style' },
  { key: 'relationship_needs', title: 'Relationship needs' },
  { key: 'conflict_style', title: 'Conflict style' },
  { key: 'lifestyle', title: 'Lifestyle' },
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
  // Age defaults to the full range rather than blank, per the board.
  const [filters, setFilters] = useState<AdvancedFilters>({ minAge: '18', maxAge: '100', ...(initialFilters || {}) });
  // The trait labels the quiz produces, grouped by facet. Same source as the
  // quiz mappings, so a chip can never name a trait nobody has.
  const [vocab, setVocab] = useState<Record<string, string[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/personality/questions`);
        const data = await response.json().catch(() => ({}));
        if (!cancelled && data?.trait_vocabulary) setVocab(data.trait_vocabulary);
      } catch {
        // Facet chips simply don't render; everything else still works.
      }
    })();
    return () => { cancelled = true; };
  }, [apiBaseUrl]);
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

  // Free filters allow several picks; a list means any-of.
  // How many picks a field allows. Smoking, drinking and the like are one
  // answer each; three of the trait facets cap at two; the rest are open.
  const SELECTION_LIMIT: Partial<Record<MultiKey, number>> = {
    religion: 1, have_kids: 1, smoking_habit: 1, drinker: 1, marijuana: 1, drugs: 1,
    relationship_needs: 2, conflict_style: 2, lifestyle: 2,
  };

  const toggleMulti = (key: MultiKey, value: string, isPaidFilter = false) => {
    if (isPaidFilter && !hasPaidPlan) {
      Alert.alert('Paid filter', 'This filter is available on paid plans only.');
      return;
    }
    const limit = SELECTION_LIMIT[key];
    setFilters((prev) => {
      const current = asList(prev[key]);
      if (current.includes(value)) return { ...prev, [key]: current.filter((v) => v !== value) };
      if (limit === 1) return { ...prev, [key]: [value] };
      if (limit && current.length >= limit) return prev;
      return { ...prev, [key]: [...current, value] };
    });
  };
  const isPicked = (key: MultiKey, value: string) => asList(filters[key]).includes(value);

  const renderMulti = (title: string, key: MultiKey, options: Option[], isPaidFilter = false) => (
    <>
      <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>{title}</Typography>
      <View style={styles.chipGrid}>
        {options.map((option) => (
          <ChipToggle
            key={`${key}-${option.value}`}
            label={option.label}
            icon={(option as any).icon}
            active={isPicked(key, option.value)}
            disabled={isPaidFilter && !hasPaidPlan}
            onPress={() => toggleMulti(key, option.value, isPaidFilter)}
          />
        ))}
      </View>
    </>
  );

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
        <Section title="Basic filters" icon="unlock">
          <Typography variant="small" style={{ color: theme.colors.muted }}>
            Available on all plans. Pick as many as you like.
          </Typography>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 12 }}>Interested in gender</Typography>
          <View style={styles.chipGrid}>
            {([['male', 'Men', 'user'], ['female', 'Women', 'user'], ['both', 'Everyone', 'users']] as const).map(([value, label, icon]) => (
              <ChipToggle key={value} label={label} icon={icon} active={filters.interested_in === value}
                onPress={() => update('interested_in', filters.interested_in === value ? '' : value)} />
            ))}
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Age</Typography>
          <View style={styles.rangeRow}>
            <View style={{ flex: 1 }}>
              <Input placeholder="18" keyboardType="numeric" value={filters.minAge} onChangeText={(text) => update('minAge', text)} />
            </View>
            <View style={styles.rangeDivider}><View style={[styles.rangeLine, { backgroundColor: theme.colors.border }]} /></View>
            <View style={{ flex: 1 }}>
              <Input placeholder="100" keyboardType="numeric" value={filters.maxAge} onChangeText={(text) => update('maxAge', text)} />
            </View>
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Max distance (km)</Typography>
          <Input placeholder="e.g. 25" keyboardType="numeric" leftIcon="navigation" value={filters.distance_km} onChangeText={(text) => update('distance_km', text)} />

          {renderMulti('Relationship intention', 'relationship_goal', RELATIONSHIP_TYPE_OPTIONS)}
          {renderMulti('Religion', 'religion', RELIGION_OPTIONS)}
          {renderMulti('Children', 'have_kids', CHILDREN_OPTIONS)}
          {renderMulti('Smoking', 'smoking_habit', SMOKING_OPTIONS)}
          {renderMulti('Drinking', 'drinker', DRINKING_OPTIONS)}
          {renderMulti('Marijuana', 'marijuana', USAGE_OPTIONS)}
          {renderMulti('Drugs', 'drugs', USAGE_OPTIONS)}
        </Section>

        <Section title="Advanced filters" icon="lock">
          {loadingPlan ? (
            <View style={styles.planLoaderRow}>
              <ActivityIndicator size="small" color={theme.colors.neonGreen} />
              <Typography variant="small" style={{ color: theme.colors.muted, marginLeft: 8 }}>Checking plan access...</Typography>
            </View>
          ) : !hasPaidPlan ? (
            <TouchableOpacity onPress={onPressPaidLocked} activeOpacity={0.85} style={[styles.lockCard, { backgroundColor: theme.colors.secondaryHighlight, borderColor: theme.colors.secondaryHairline }]}>
              <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>Upgrade to unlock paid filters</Typography>
              <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 4 }}>
                Height, ethnicity, education, politics, and how someone actually is: personality, communication, needs, conflict style, lifestyle.
              </Typography>
            </TouchableOpacity>
          ) : null}

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Height (cm)</Typography>
          <View style={styles.rangeRow}>
            <View style={{ flex: 1 }}>
              <Input placeholder="Min" keyboardType="numeric" value={filters.minHeight} disabled={!hasPaidPlan} onLockedPress={onPressPaidLocked} onChangeText={(text) => update('minHeight', text, true)} />
            </View>
            <View style={styles.rangeDivider}><View style={[styles.rangeLine, { backgroundColor: theme.colors.border }]} /></View>
            <View style={{ flex: 1 }}>
              <Input placeholder="Max" keyboardType="numeric" value={filters.maxHeight} disabled={!hasPaidPlan} onLockedPress={onPressPaidLocked} onChangeText={(text) => update('maxHeight', text, true)} />
            </View>
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Ethnicity</Typography>
          <View style={styles.chipGrid}>
            {ETHNICITY_OPTIONS.map((option) => (
              <ChipToggle key={option.value} label={option.label} active={filters.ethnicity === option.value} disabled={!hasPaidPlan}
                onPress={() => update('ethnicity', filters.ethnicity === option.value ? '' : option.value, true)} />
            ))}
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Education</Typography>
          <View style={styles.chipGrid}>
            {EDUCATION_OPTIONS.map((option) => (
              <ChipToggle key={option.value} label={option.label} active={filters.education_level === option.value} disabled={!hasPaidPlan}
                onPress={() => update('education_level', filters.education_level === option.value ? '' : option.value, true)} />
            ))}
          </View>

          <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 14 }}>Politics</Typography>
          <View style={styles.chipGrid}>
            {POLITICS_OPTIONS.map((option) => (
              <ChipToggle key={option.value} label={option.label} active={filters.politics === option.value} disabled={!hasPaidPlan}
                onPress={() => update('politics', filters.politics === option.value ? '' : option.value, true)} />
            ))}
          </View>

          {FACETS.map((facet) =>
            vocab?.[facet.key]?.length
              ? <React.Fragment key={facet.key}>{renderMulti(facet.title, facet.key, vocab[facet.key].map((label) => ({ value: label, label })), true)}</React.Fragment>
              : null
          )}
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
    paddingBottom: 220,
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
    // Sits above the bottom nav rather than underneath it.
    paddingBottom: Platform.OS === 'ios' ? 110 : 96,
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
