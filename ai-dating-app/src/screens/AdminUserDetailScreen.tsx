import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PageHeader } from '../components/PageHeader';
import { Typography } from '../components/Typography';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  userId: number;
  token: string;
  apiBaseUrl: string;
  onBack: () => void;
};

type Detail = Record<string, any>;

/** Media is stored as a bare object name; the API serves it from /media. */
const mediaUrl = (apiBaseUrl: string, value?: string | null): string | null => {
  if (!value) return null;
  if (/^https?:\/\//.test(value)) return value;
  return `${apiBaseUrl}/media/${value}`;
};

const fmt = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  const s = String(value);
  // Timestamps read better as a local date than as an ISO string.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s).toLocaleString();
  return s;
};

/**
 * One account, everything the platform holds about it.
 *
 * Built for moderating a report: identity, photos, what the verification selfie
 * actually looked like, who they contacted and what they wrote, and the money
 * and token history. Everything here is admin-only.
 */
export const AdminUserDetailScreen: React.FC<Props> = ({ userId, token, apiBaseUrl, onBack }) => {
  const theme = useTheme();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ identity: true, photos: true, verification: true });
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/admin/users/${userId}/detail`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Could not load this account.');
      setDetail(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Could not load this account.');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, token, userId]);

  useEffect(() => { void load(); }, [load]);

  const toggle = (key: string) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const Section: React.FC<{ id: string; title: string; count?: number; children: React.ReactNode }> = ({
    id, title, count, children,
  }) => (
    <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.charcoal }]}>
      <Pressable style={styles.cardHead} onPress={() => toggle(id)}>
        <Typography variant="bodyStrong" style={{ color: theme.colors.text, flex: 1 }}>
          {title}{count !== undefined ? ` (${count})` : ''}
        </Typography>
        <Feather name={open[id] ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.muted} />
      </Pressable>
      {open[id] ? <View style={{ marginTop: 10 }}>{children}</View> : null}
    </View>
  );

  const Rows: React.FC<{ data: Record<string, any> | null; skip?: string[] }> = ({ data, skip = [] }) => {
    if (!data) return <Typography variant="tiny" style={{ color: theme.colors.muted }}>Nothing recorded.</Typography>;
    return (
      <>
        {Object.entries(data)
          .filter(([k]) => !skip.includes(k))
          .map(([k, v]) => (
            <View key={k} style={styles.row}>
              <Typography variant="tiny" style={{ color: theme.colors.muted, flex: 1 }}>{k.replace(/_/g, ' ')}</Typography>
              <Typography variant="tiny" style={{ color: theme.colors.text, flex: 1.4, textAlign: 'right' }}>{fmt(v)}</Typography>
            </View>
          ))}
      </>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centre, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.neonGreen} />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <PageHeader title="Account" onBack={onBack} />
        <View style={styles.centre}>
          <Typography variant="body" style={{ color: theme.colors.error, textAlign: 'center' }}>{error}</Typography>
        </View>
      </View>
    );
  }

  const u = detail.user || {};
  const selfie = mediaUrl(apiBaseUrl, detail.verification?.selfie_url);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title={u.name || 'Account'} onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section id="identity" title="Identity and account">
          <Rows data={u} />
        </Section>

        <Section id="photos" title="Photos" count={detail.photos?.length || 0}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(detail.photos || []).map((p: any) => {
              const url = mediaUrl(apiBaseUrl, p.photo_url);
              return url ? (
                <Pressable key={p.id} onPress={() => setLightbox(url)}>
                  <Image source={{ uri: url }} style={styles.thumb} />
                </Pressable>
              ) : null;
            })}
            {(detail.photos || []).length === 0 ? (
              <Typography variant="tiny" style={{ color: theme.colors.muted }}>No photos.</Typography>
            ) : null}
          </ScrollView>
        </Section>

        <Section id="verification" title="Verification">
          {selfie ? (
            <Pressable onPress={() => setLightbox(selfie)} style={{ marginBottom: 10 }}>
              <Image source={{ uri: selfie }} style={styles.selfie} />
              <Typography variant="tiny" style={{ color: theme.colors.muted, marginTop: 4 }}>
                Verification selfie — tap to enlarge
              </Typography>
            </Pressable>
          ) : (
            <Typography variant="tiny" style={{ color: theme.colors.muted, marginBottom: 8 }}>
              No selfie stored. Only verifications done after this release keep the image.
            </Typography>
          )}
          <Rows data={detail.verification} skip={['selfie_url']} />
        </Section>

        <Section id="profile" title="Profile">
          <Rows data={detail.profile} />
        </Section>

        <Section id="personality" title="Personality and AI persona">
          <Rows data={detail.personality} />
          <View style={{ height: 8 }} />
          <Rows data={detail.ai_persona} />
        </Section>

        <Section id="messages" title="Chats" count={detail.messages?.length || 0}>
          {(detail.messages || []).map((m: any) => (
            <View key={m.id} style={[styles.msg, { borderColor: theme.colors.border }]}>
              <Typography variant="tiny" style={{ color: theme.colors.neonGreen }}>
                {m.sender_name} → {m.recipient_name || '—'}
                <Typography variant="tiny" style={{ color: theme.colors.muted }}>  {fmt(m.created_at)}</Typography>
              </Typography>
              <Typography variant="small" style={{ color: theme.colors.text, marginTop: 2 }}>
                {m.message_type && m.message_type !== 'text' ? `[${m.message_type}] ` : ''}{m.content}
              </Typography>
            </View>
          ))}
          {(detail.messages || []).length === 0 ? (
            <Typography variant="tiny" style={{ color: theme.colors.muted }}>No messages.</Typography>
          ) : null}
        </Section>

        <Section id="matches" title="Matches" count={detail.matches?.length || 0}>
          {(detail.matches || []).map((m: any) => (
            <View key={m.id} style={styles.row}>
              <Typography variant="tiny" style={{ color: theme.colors.text, flex: 1 }}>
                {m.user1_name} + {m.user2_name}
              </Typography>
              <Typography variant="tiny" style={{ color: theme.colors.muted }}>{m.status}</Typography>
            </View>
          ))}
        </Section>

        <Section id="likes" title="Likes sent / received" count={(detail.likes_sent?.length || 0) + (detail.likes_received?.length || 0)}>
          {(detail.likes_sent || []).map((l: any) => (
            <View key={`s${l.id}`} style={styles.row}>
              <Typography variant="tiny" style={{ color: theme.colors.muted, flex: 1 }}>sent →</Typography>
              <Typography variant="tiny" style={{ color: theme.colors.text }}>{l.target_name}</Typography>
            </View>
          ))}
          {(detail.likes_received || []).map((l: any) => (
            <View key={`r${l.id}`} style={styles.row}>
              <Typography variant="tiny" style={{ color: theme.colors.muted, flex: 1 }}>received ←</Typography>
              <Typography variant="tiny" style={{ color: theme.colors.text }}>{l.liker_name}</Typography>
            </View>
          ))}
        </Section>

        <Section id="money" title="Tokens, plans and purchases" count={(detail.credit_ledger?.length || 0) + (detail.subscriptions?.length || 0)}>
          {(detail.credit_ledger || []).slice(0, 40).map((t: any) => (
            <View key={t.id} style={styles.row}>
              <Typography variant="tiny" style={{ color: theme.colors.muted, flex: 1 }}>{t.reason}</Typography>
              <Typography variant="tiny" style={{ color: theme.colors.text }}>{t.amount}</Typography>
            </View>
          ))}
          {(detail.subscriptions || []).map((s: any) => (
            <View key={`sub${s.id}`} style={styles.row}>
              <Typography variant="tiny" style={{ color: theme.colors.muted, flex: 1 }}>plan</Typography>
              <Typography variant="tiny" style={{ color: theme.colors.text }}>{fmt(s.product_id || s.plan)} {fmt(s.status)}</Typography>
            </View>
          ))}
        </Section>

        <Section id="boundaries" title="My Boundaries and limits">
          <Rows data={detail.boundaries} />
          <View style={{ height: 8 }} />
          <Rows data={detail.activity_limits} />
        </Section>

        <Section id="safety" title="Reports, blocks and support" count={(detail.reports_against?.length || 0) + (detail.reports_made?.length || 0) + (detail.support_messages?.length || 0)}>
          {(detail.reports_against || []).map((r: any) => (
            <View key={`ra${r.id}`} style={styles.row}>
              <Typography variant="tiny" style={{ color: '#E8A838', flex: 1 }}>reported by {r.reporter_name}</Typography>
              <Typography variant="tiny" style={{ color: theme.colors.text }}>{fmt(r.reason)}</Typography>
            </View>
          ))}
          {(detail.blocks || []).map((b: any) => (
            <View key={`b${b.id}`} style={styles.row}>
              <Typography variant="tiny" style={{ color: theme.colors.muted, flex: 1 }}>blocked</Typography>
              <Typography variant="tiny" style={{ color: theme.colors.text }}>{b.blocked_name}</Typography>
            </View>
          ))}
          {(detail.support_messages || []).map((s: any) => (
            <View key={`sm${s.id}`} style={[styles.msg, { borderColor: theme.colors.border }]}>
              <Typography variant="tiny" style={{ color: theme.colors.muted }}>{fmt(s.status)} · {fmt(s.created_at)}</Typography>
              <Typography variant="small" style={{ color: theme.colors.text }}>{s.message}</Typography>
            </View>
          ))}
        </Section>

        <Section id="privacy" title="Privacy and notifications">
          <Rows data={detail.privacy} />
          <View style={{ height: 8 }} />
          <Rows data={detail.notifications} />
        </Section>
      </ScrollView>

      <Modal visible={Boolean(lightbox)} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <Pressable style={styles.lightbox} onPress={() => setLightbox(null)}>
          {lightbox ? <Image source={{ uri: lightbox }} style={styles.lightboxImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, paddingBottom: 160 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', paddingVertical: 3, gap: 10 },
  msg: { borderWidth: 1, borderRadius: 10, padding: 8, marginBottom: 6 },
  thumb: { width: 80, height: 100, borderRadius: 8, marginRight: 8 },
  selfie: { width: 120, height: 120, borderRadius: 10 },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '92%', height: '80%' },
});
