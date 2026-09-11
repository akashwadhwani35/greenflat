import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PageHeader } from '../components/PageHeader';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  onBack: () => void;
  token: string;
  apiBaseUrl: string;
};

type Kind = 'likes' | 'greenflags' | 'compliments';

const ROWS: Array<{ key: Kind; label: string; icon: React.ComponentProps<typeof Feather>['name'] }> = [
  { key: 'likes', label: 'Likes', icon: 'heart' },
  { key: 'greenflags', label: 'Green Flags', icon: 'flag' },
  { key: 'compliments', label: 'First Moves', icon: 'message-circle' },
];

/** One, not zero: switching a kind off entirely is what the master toggle is for. */
const MIN = 1;
const MAX = 100;

/**
 * Settings → My Boundaries.
 *
 * How much attention a person is willing to receive in a day. Nobody else can
 * see any of it: a profile looks completely normal to whoever is browsing it,
 * and someone who runs into a limit is told the person is unavailable, never
 * that a limit exists or what it is set to.
 */
export const BoundariesScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  // Held as text so the field can be empty mid-edit without snapping to 0.
  const [values, setValues] = useState<Record<Kind, string>>({ likes: '10', greenflags: '10', compliments: '10' });
  const [remaining, setRemaining] = useState<Record<Kind, number> | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/boundaries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not load your boundaries.');
      const b = data.boundaries;
      setEnabled(Boolean(b.enabled));
      setValues({
        likes: String(b.likes),
        greenflags: String(b.greenflags),
        compliments: String(b.compliments),
      });
      setRemaining(b.remaining || null);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Could not load your boundaries.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, token]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Saves whatever is on screen. Out-of-range numbers are refused by the server. */
  const save = useCallback(
    async (next: Partial<{ enabled: boolean } & Record<Kind, number>>) => {
      try {
        setSaving(true);
        const response = await fetch(`${apiBaseUrl}/boundaries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(next),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || 'Could not save.');
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Could not save.');
        // Put the saved values back rather than leaving a lie on screen.
        void load();
      } finally {
        setSaving(false);
      }
    },
    [apiBaseUrl, token, load]
  );

  const commit = (key: Kind) => {
    const raw = values[key].trim();
    const n = Number(raw);
    if (raw === '' || !Number.isInteger(n) || n < MIN || n > MAX) {
      setError(`A daily limit must be a whole number between ${MIN} and ${MAX}.`);
      void load();
      return;
    }
    void save({ [key]: n } as any);
  };

  const step = (key: Kind, delta: number) => {
    const current = Number(values[key]) || 0;
    const next = Math.max(MIN, Math.min(MAX, current + delta));
    setValues((prev) => ({ ...prev, [key]: String(next) }));
    void save({ [key]: next } as any);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centre, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.neonGreen} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="My Boundaries" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Typography variant="body" style={{ color: theme.colors.muted, lineHeight: 22 }}>
          Decide how much reaches you in a day. Nobody can see these numbers, and
          your profile looks exactly the same to everyone else.
        </Typography>

        {/* Master toggle */}
        <View style={[styles.card, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Typography variant="bodyStrong" style={{ color: theme.colors.text }}>
                Limit what I receive
              </Typography>
              <Typography variant="tiny" style={{ color: theme.colors.muted, marginTop: 4, lineHeight: 18 }}>
                {enabled
                  ? 'On. Once a daily limit is used up, nothing more of that kind reaches you until tomorrow.'
                  : 'Off. Everything reaches you, with no daily cap.'}
              </Typography>
            </View>
            <Switch
              value={enabled}
              onValueChange={(next) => {
                setEnabled(next);
                void save({ enabled: next });
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.neonGreen }}
              thumbColor={theme.colors.surface}
            />
          </View>
        </View>

        {enabled ? (
          <>
            <Typography variant="small" style={{ color: theme.colors.muted, marginTop: 20, marginBottom: 8 }}>
              Daily limits ({MIN}–{MAX} each)
            </Typography>

            {ROWS.map(({ key, label, icon }) => (
              <View
                key={key}
                style={[styles.card, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border, marginTop: 10 }]}
              >
                <View style={styles.rowBetween}>
                  <View style={styles.labelBlock}>
                    <Feather name={icon} size={16} color={theme.colors.neonGreen} />
                    <Typography variant="bodyStrong" style={{ color: theme.colors.text, marginLeft: 10, flex: 1 }}>
                      {label}
                    </Typography>
                  </View>

                  <View style={styles.stepper}>
                    <Pressable
                      style={({ pressed }) => [styles.stepButton, { borderColor: theme.colors.border }, pressed && { opacity: 0.6 }]}
                      onPress={() => step(key, -1)}
                      accessibilityLabel={`One fewer ${label} per day`}
                    >
                      <Feather name="minus" size={16} color={theme.colors.text} />
                    </Pressable>
                    <TextInput
                      value={values[key]}
                      onChangeText={(text) =>
                        setValues((prev) => ({ ...prev, [key]: text.replace(/[^0-9]/g, '').slice(0, 3) }))
                      }
                      onBlur={() => commit(key)}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      onSubmitEditing={() => commit(key)}
                      style={[styles.stepInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                      accessibilityLabel={`${label} per day`}
                    />
                    <Pressable
                      style={({ pressed }) => [styles.stepButton, { borderColor: theme.colors.border }, pressed && { opacity: 0.6 }]}
                      onPress={() => step(key, 1)}
                      accessibilityLabel={`One more ${label} per day`}
                    >
                      <Feather name="plus" size={16} color={theme.colors.text} />
                    </Pressable>
                  </View>
                </View>

                {remaining ? (
                  <Typography variant="tiny" style={{ color: theme.colors.muted, marginTop: 10 }}>
                    {remaining[key]} left today
                  </Typography>
                ) : null}
              </View>
            ))}

            <Typography variant="tiny" style={{ color: theme.colors.muted, marginTop: 16, lineHeight: 18 }}>
              Once a limit is reached, anyone who tries is simply told you are not
              available right now, and is never charged for it.
            </Typography>
          </>
        ) : null}

        {error ? (
          <Typography variant="small" style={{ color: theme.colors.error, marginTop: 16 }}>
            {error}
          </Typography>
        ) : null}
        {saving ? (
          <Typography variant="tiny" style={{ color: theme.colors.muted, marginTop: 12 }}>
            Saving…
          </Typography>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centre: { alignItems: 'center', justifyContent: 'center' },
  // The bottom nav floats over the last 60px and phones add a gesture inset on
  // top of that, which was clipping the closing paragraph.
  content: { padding: 20, paddingBottom: 160 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    paddingRight: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInput: {
    width: 52,
    height: 34,
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 8,
    textAlign: 'center',
    fontFamily: 'RedHatDisplay_600SemiBold',
    fontSize: 15,
    paddingVertical: 0,
  },
});
