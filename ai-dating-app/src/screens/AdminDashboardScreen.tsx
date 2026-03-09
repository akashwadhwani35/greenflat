import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator, Pressable, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeProvider';
import { PageHeader } from '../components/PageHeader';

type Props = {
  onBack: () => void;
  token: string;
  apiBaseUrl: string;
};

type Stats = {
  total_users: number;
  users_today: number;
  pending_reports: number;
  total_matches: number;
  total_messages: number;
};

type Report = {
  id: number;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reporter_id: number;
  reporter_name: string;
  reported_id: number;
  reported_name: string;
};

type User = {
  id: number;
  email: string;
  name: string;
  gender: string;
  city: string;
  is_verified: boolean;
  is_premium: boolean;
  is_banned: boolean;
  is_admin: boolean;
  created_at: string;
  report_count: number;
};

// Backend response shapes — mapped to friendly accessors below
type RevenueRaw = Record<string, any>;
type TokenRaw = Record<string, any>;
type EngagementRaw = Record<string, any>;
type GrowthRaw = Record<string, any>;

// Safe accessors
const rev = (r: RevenueRaw | null) => ({
  total: Number(r?.total_token_revenue ?? r?.revenue_lifetime ?? 0),
  today: Number(r?.revenue_today ?? 0),
  d7: Number(r?.revenue_7d ?? 0),
  d30: Number(r?.revenue_30d ?? 0),
  activePro: Number(r?.active_pro_users ?? r?.active_pro ?? 0),
  activePremium: Number(r?.active_premium_users ?? r?.active_premium ?? 0),
  freeToPaid: Number(r?.free_to_paid_conversion ?? r?.free_to_paid_rate ?? 0) / 100,
  arpu: Number(r?.arpu ?? 0),
});

const tok = (t: TokenRaw | null) => ({
  purchased: Number(t?.total_tokens_purchased ?? t?.total_purchased ?? 0),
  spent: Number(t?.total_tokens_spent ?? t?.total_spent ?? 0),
  avgPerUser: Number(t?.avg_spent_per_user ?? 0),
  bf: {
    ai_search: Number(t?.spend_by_feature?.ai_search ?? t?.by_feature?.ai_search ?? 0),
    super_like: Number(t?.spend_by_feature?.super_like ?? t?.by_feature?.super_like ?? 0),
    compliment: Number(t?.spend_by_feature?.compliment ?? t?.by_feature?.compliment ?? 0),
    boost: Number(t?.spend_by_feature?.boost ?? t?.by_feature?.boost ?? 0),
  },
  mostUsed: String(t?.most_used_feature ?? t?.most_used ?? '—'),
  mostProfitable: String(t?.most_profitable_feature ?? t?.most_profitable ?? '—'),
});

const eng = (e: EngagementRaw | null) => ({
  complimentReply: Number(e?.compliment_reply_rate ?? 0) / 100,
  gfMatch: Number(e?.green_flag_match_rate ?? e?.greenflag_match_rate ?? 0) / 100,
  boost: Number(e?.boost_effectiveness ?? 0) / 100,
  likeMatch: Number(e?.like_to_match_conversion ?? e?.like_match_conversion ?? 0) / 100,
  avgReply: Number(e?.avg_time_to_first_reply_minutes ?? e?.avg_time_to_first_reply_mins ?? 0),
});

const gro = (g: GrowthRaw | null) => ({
  dau: Number(g?.dau ?? 0),
  mau: Number(g?.mau ?? 0),
  stickiness: g?.mau ? (g.dau || 0) / g.mau : 0,
  retD1: Number(g?.retention_day_1 ?? g?.retention_d1 ?? 0) / 100,
  retD7: Number(g?.retention_day_7 ?? g?.retention_d7 ?? 0) / 100,
  retD30: Number(g?.retention_day_30 ?? g?.retention_d30 ?? 0) / 100,
  newByDay: (g?.new_users_by_day || []) as { date: string; count: number }[],
});

type AdminTab = 'overview' | 'tokens' | 'engagement' | 'users' | 'reports' | 'safety';

const TAB_ITEMS: { id: AdminTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Revenue', icon: 'trending-up' },
  { id: 'tokens', label: 'Tokens', icon: 'zap' },
  { id: 'engagement', label: 'Performance', icon: 'bar-chart-2' },
  { id: 'users', label: 'Users', icon: 'users' },
  { id: 'reports', label: 'Reports', icon: 'flag' },
  { id: 'safety', label: 'Safety', icon: 'shield' },
];

const fmt = (n: number, decimals = 0) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return decimals ? n.toFixed(decimals) : String(n);
};

const fmtUsd = (n: number) => `$${n.toFixed(2)}`;

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

// Simple horizontal bar component
const HBar: React.FC<{ value: number; max: number; color: string; bg: string }> = ({ value, max, color, bg }) => (
  <View style={[barStyles.track, { backgroundColor: bg }]}>
    <View style={[barStyles.fill, { width: `${Math.min(100, max > 0 ? (value / max) * 100 : 0)}%`, backgroundColor: color }]} />
  </View>
);

export const AdminDashboardScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);

  // Core data
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // Analytics data (raw from API)
  const [revenue, setRevenue] = useState<RevenueRaw | null>(null);
  const [tokenData, setTokenData] = useState<TokenRaw | null>(null);
  const [engagement, setEngagement] = useState<EngagementRaw | null>(null);
  const [growth, setGrowth] = useState<GrowthRaw | null>(null);

  // User action modal
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [tokenAmount, setTokenAmount] = useState('');
  const [subPlan, setSubPlan] = useState<'pro' | 'premium'>('pro');
  const [subDays, setSubDays] = useState('30');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const safeFetch = async <T,>(url: string, fallback: T): Promise<T> => {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return await res.json();
      return fallback;
    } catch {
      return fallback;
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [s, rev, tok, eng, gr, rep, usr] = await Promise.all([
      safeFetch<Stats | null>(`${apiBaseUrl}/admin/stats`, null),
      safeFetch<RevenueData | null>(`${apiBaseUrl}/admin/analytics/revenue`, null),
      safeFetch<TokenData | null>(`${apiBaseUrl}/admin/analytics/tokens`, null),
      safeFetch<EngagementData | null>(`${apiBaseUrl}/admin/analytics/engagement`, null),
      safeFetch<GrowthData | null>(`${apiBaseUrl}/admin/analytics/growth`, null),
      safeFetch<{ reports: Report[] }>(`${apiBaseUrl}/admin/reports?limit=20`, { reports: [] }),
      safeFetch<{ users: User[] }>(`${apiBaseUrl}/admin/users?limit=20`, { users: [] }),
    ]);
    setStats(s);
    setRevenue(rev);
    setTokenData(tok);
    setEngagement(eng);
    setGrowth(gr);
    setReports(rep.reports);
    setUsers(usr.users);
    setLoading(false);
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchUsers = async (q = '') => {
    const qs = q ? `?q=${encodeURIComponent(q)}&limit=20` : '?limit=20';
    const data = await safeFetch<{ users: User[] }>(`${apiBaseUrl}/admin/users${qs}`, { users: [] });
    setUsers(data.users);
  };

  const updateReport = async (reportId: number, status: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed');
      const rep = await safeFetch<{ reports: Report[] }>(`${apiBaseUrl}/admin/reports?limit=20`, { reports: [] });
      setReports(rep.reports);
    } catch {
      Alert.alert('Error', 'Could not update report.');
    }
  };

  const toggleBan = (userId: number, banned: boolean) => {
    const action = banned ? 'unban' : 'ban';
    Alert.alert(`Confirm ${action}`, `Are you sure?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action.charAt(0).toUpperCase() + action.slice(1),
        style: banned ? 'default' : 'destructive',
        onPress: async () => {
          await fetch(`${apiBaseUrl}/admin/users/${userId}/ban`, { method: 'POST', headers });
          fetchUsers(userSearch);
        },
      },
    ]);
  };

  const toggleShadowBan = (userId: number) => {
    Alert.alert('Shadow Ban', 'Toggle shadow ban for this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          await fetch(`${apiBaseUrl}/admin/users/${userId}/shadow-ban`, { method: 'POST', headers });
          fetchUsers(userSearch);
          Alert.alert('Done', 'Shadow ban toggled.');
        },
      },
    ]);
  };

  const grantTokens = async (userId: number, amount: number, action: 'grant' | 'remove') => {
    try {
      const res = await fetch(`${apiBaseUrl}/admin/users/${userId}/tokens`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount, action }),
      });
      if (!res.ok) throw new Error('Failed');
      Alert.alert('Done', `${action === 'grant' ? 'Granted' : 'Removed'} ${amount} tokens.`);
      setSelectedUser(null);
    } catch {
      Alert.alert('Error', 'Token update failed.');
    }
  };

  const grantSubscription = async (userId: number, plan: string, days: number) => {
    try {
      const res = await fetch(`${apiBaseUrl}/admin/users/${userId}/subscription`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ plan, duration_days: days }),
      });
      if (!res.ok) throw new Error('Failed');
      Alert.alert('Done', `Granted ${plan} for ${days} days.`);
      setSelectedUser(null);
    } catch {
      Alert.alert('Error', 'Subscription grant failed.');
    }
  };

  const statusColor = (s: string) => {
    if (s === 'pending') return '#E8A838';
    if (s === 'reviewed') return '#3B82F6';
    return '#22C55E';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <PageHeader title="Admin Dashboard" onBack={onBack} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.brand} />
        </View>
      </View>
    );
  }

  // ─── Section renderers ──────────────────────────────────────

  const renderSummaryBar = () => {
    const r = rev(revenue);
    return (
    <View style={styles.summaryRow}>
      {[
        { label: 'Revenue', value: fmtUsd(r.total), color: theme.colors.neonGreen },
        { label: 'Paying', value: fmt(r.activePro + r.activePremium), color: '#3B82F6' },
        { label: 'ARPU', value: fmtUsd(r.arpu), color: '#A78BFA' },
        { label: 'Users', value: fmt(stats?.total_users || 0), color: '#F59E0B' },
        { label: 'Matches', value: fmt(stats?.total_matches || 0), color: '#EF4444' },
      ].map((item) => (
        <View key={item.label} style={[styles.summaryPill, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
          <Typography variant="tiny" style={{ color: item.color, fontSize: 9 }}>{item.label}</Typography>
          <Typography variant="bodyStrong" style={{ color: theme.colors.text, fontSize: 13 }}>{item.value}</Typography>
        </View>
      ))}
    </View>
  );};

  const renderRevenueTab = () => {
    const r = rev(revenue);
    return (
    <View style={styles.section}>
      <Typography variant="h1" style={{ marginBottom: 12 }}>Revenue & Monetization</Typography>

      {/* Revenue by period */}
      <View style={styles.gridRow}>
        {[
          { label: 'Today', value: fmtUsd(r.today) },
          { label: '7 Days', value: fmtUsd(r.d7) },
          { label: '30 Days', value: fmtUsd(r.d30) },
          { label: 'Lifetime', value: fmtUsd(r.total) },
        ].map((item) => (
          <View key={item.label} style={[styles.metricCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Typography variant="tiny" muted>{item.label}</Typography>
            <Typography variant="h2" style={{ color: theme.colors.neonGreen }}>{item.value}</Typography>
          </View>
        ))}
      </View>

      {/* Subscription stats */}
      <Typography variant="bodyStrong" style={{ marginTop: 16, marginBottom: 8 }}>Subscriptions</Typography>
      <View style={styles.gridRow}>
        {[
          { label: 'Active Pro', value: String(r.activePro), color: '#3B82F6' },
          { label: 'Active Premium', value: String(r.activePremium), color: '#A78BFA' },
          { label: 'Free → Paid', value: fmtPct(r.freeToPaid), color: '#22C55E' },
          { label: 'ARPU', value: fmtUsd(r.arpu), color: '#F59E0B' },
        ].map((item) => (
          <View key={item.label} style={[styles.metricCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Typography variant="tiny" muted>{item.label}</Typography>
            <Typography variant="h2" style={{ color: item.color }}>{item.value}</Typography>
          </View>
        ))}
      </View>
    </View>
  );};

  const renderTokensTab = () => {
    const t = tok(tokenData);
    const bf = t.bf;
    const featureMax = Math.max(
      bf.ai_search || 0,
      bf.super_like || 0,
      bf.compliment || 0,
      bf.boost || 0,
      1
    );

    return (
      <View style={styles.section}>
        <Typography variant="h1" style={{ marginBottom: 12 }}>Token Economy</Typography>

        <View style={styles.gridRow}>
          {[
            { label: 'Purchased', value: fmt(t.purchased) },
            { label: 'Spent', value: fmt(t.spent) },
            { label: 'Avg/User', value: fmt(t.avgPerUser, 1) },
          ].map((item) => (
            <View key={item.label} style={[styles.metricCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border, flexBasis: '30%' }]}>
              <Typography variant="tiny" muted>{item.label}</Typography>
              <Typography variant="h2" style={{ color: theme.colors.neonGreen }}>{item.value}</Typography>
            </View>
          ))}
        </View>

        <Typography variant="bodyStrong" style={{ marginTop: 16, marginBottom: 8 }}>Spend by Feature</Typography>
        {[
          { label: 'AI Search', value: bf.ai_search || 0, cost: 1, color: '#3B82F6' },
          { label: 'Green Flag', value: bf.super_like || 0, cost: 4, color: theme.colors.neonGreen },
          { label: 'Compliment', value: bf.compliment || 0, cost: 6, color: '#A78BFA' },
          { label: 'Boost', value: bf.boost || 0, cost: 20, color: '#F59E0B' },
        ].map((f) => (
          <View key={f.label} style={[styles.featureRow, { borderColor: theme.colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Typography variant="small" style={{ color: theme.colors.text }}>{f.label} ({f.cost} tok)</Typography>
              <Typography variant="small" style={{ color: f.color }}>{fmt(f.value)} uses</Typography>
            </View>
            <HBar value={f.value} max={featureMax} color={f.color} bg={theme.colors.charcoal} />
          </View>
        ))}

        <View style={[styles.infoRow, { borderColor: theme.colors.border }]}>
          <View>
            <Typography variant="tiny" muted>Most Used</Typography>
            <Typography variant="bodyStrong" style={{ color: theme.colors.neonGreen }}>{t.mostUsed}</Typography>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Typography variant="tiny" muted>Most Profitable</Typography>
            <Typography variant="bodyStrong" style={{ color: '#F59E0B' }}>{t.mostProfitable}</Typography>
          </View>
        </View>
      </View>
    );
  };

  const renderEngagementTab = () => {
    const e = eng(engagement);
    const g = gro(growth);
    return (
    <View style={styles.section}>
      <Typography variant="h1" style={{ marginBottom: 12 }}>Feature Performance</Typography>

      {[
        { label: 'Compliment Reply Rate', value: fmtPct(e.complimentReply), color: '#A78BFA' },
        { label: 'Green Flag → Match Rate', value: fmtPct(e.gfMatch), color: theme.colors.neonGreen },
        { label: 'Boost Effectiveness', value: fmtPct(e.boost), color: '#F59E0B' },
        { label: 'Like → Match Conversion', value: fmtPct(e.likeMatch), color: '#3B82F6' },
        { label: 'Avg Time to First Reply', value: `${e.avgReply.toFixed(0)} min`, color: '#EF4444' },
      ].map((item) => (
        <View key={item.label} style={[styles.performanceCard, { borderColor: theme.colors.border }]}>
          <Typography variant="body" style={{ color: theme.colors.text, flex: 1 }}>{item.label}</Typography>
          <Typography variant="h2" style={{ color: item.color }}>{item.value}</Typography>
        </View>
      ))}

      {/* Growth section */}
      <Typography variant="h1" style={{ marginTop: 24, marginBottom: 12 }}>User Growth & Retention</Typography>

      <View style={styles.gridRow}>
        {[
          { label: 'DAU', value: fmt(g.dau), color: '#3B82F6' },
          { label: 'MAU', value: fmt(g.mau), color: '#A78BFA' },
          { label: 'Stickiness', value: fmtPct(g.stickiness), color: theme.colors.neonGreen },
          { label: 'New Today', value: fmt(stats?.users_today || 0), color: '#F59E0B' },
        ].map((item) => (
          <View key={item.label} style={[styles.metricCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Typography variant="tiny" muted>{item.label}</Typography>
            <Typography variant="h2" style={{ color: item.color }}>{item.value}</Typography>
          </View>
        ))}
      </View>

      <Typography variant="bodyStrong" style={{ marginTop: 16, marginBottom: 8 }}>Retention</Typography>
      <View style={styles.gridRow}>
        {[
          { label: 'Day 1', value: fmtPct(g.retD1), color: '#22C55E' },
          { label: 'Day 7', value: fmtPct(g.retD7), color: '#F59E0B' },
          { label: 'Day 30', value: fmtPct(g.retD30), color: '#EF4444' },
        ].map((item) => (
          <View key={item.label} style={[styles.metricCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border, flexBasis: '30%' }]}>
            <Typography variant="tiny" muted>{item.label}</Typography>
            <Typography variant="h2" style={{ color: item.color }}>{item.value}</Typography>
          </View>
        ))}
      </View>

      {/* Mini chart: new users by day */}
      {g.newByDay.length > 0 && (
        <>
          <Typography variant="bodyStrong" style={{ marginTop: 16, marginBottom: 8 }}>New Users (Last 30 Days)</Typography>
          <View style={[styles.miniChart, { borderColor: theme.colors.border }]}>
            {(() => {
              const maxCount = Math.max(...g.newByDay.map((d) => d.count), 1);
              return g.newByDay.slice(-14).map((d) => (
                <View key={d.date} style={styles.chartBarCol}>
                  <View style={[styles.chartBar, { height: Math.max(2, (d.count / maxCount) * 60), backgroundColor: theme.colors.neonGreen }]} />
                  <Typography variant="tiny" muted style={{ fontSize: 8, marginTop: 2 }}>{d.date.slice(5)}</Typography>
                </View>
              ));
            })()}
          </View>
        </>
      )}
    </View>
  );};

  const renderUsersTab = () => (
    <View style={styles.section}>
      <Typography variant="h1" style={{ marginBottom: 12 }}>User Management</Typography>
      <View style={[styles.searchBox, { borderColor: theme.colors.border }]}>
        <Feather name="search" size={18} color={theme.colors.muted} />
        <TextInput
          placeholder="Search by name or email"
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholderTextColor={theme.colors.muted}
          value={userSearch}
          onChangeText={setUserSearch}
          onSubmitEditing={() => fetchUsers(userSearch)}
          returnKeyType="search"
        />
      </View>
      {users.map((u) => (
        <View key={u.id} style={[styles.card, { borderColor: theme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Typography variant="bodyStrong">{u.name}</Typography>
              <Typography variant="tiny" muted>{u.email} - {u.city}</Typography>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {u.is_banned && (
                <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
                  <Typography variant="tiny" style={{ color: '#fff' }}>Banned</Typography>
                </View>
              )}
              {u.is_premium && (
                <View style={[styles.badge, { backgroundColor: '#A78BFA' }]}>
                  <Typography variant="tiny" style={{ color: '#fff' }}>Premium</Typography>
                </View>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            {u.is_verified && <Typography variant="tiny" style={{ color: '#22C55E' }}>Verified</Typography>}
            {u.report_count > 0 && <Typography variant="tiny" style={{ color: '#E8A838' }}>{u.report_count} report(s)</Typography>}
            <Typography variant="tiny" muted>Joined {new Date(u.created_at).toLocaleDateString()}</Typography>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <TouchableOpacity
              onPress={() => toggleBan(u.id, u.is_banned)}
              style={[styles.actionBtn, { borderColor: u.is_banned ? theme.colors.brand : '#EF4444' }]}
            >
              <Typography variant="tiny" style={{ color: u.is_banned ? theme.colors.brand : '#EF4444' }}>
                {u.is_banned ? 'Unban' : 'Ban'}
              </Typography>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleShadowBan(u.id)}
              style={[styles.actionBtn, { borderColor: '#E8A838' }]}
            >
              <Typography variant="tiny" style={{ color: '#E8A838' }}>Shadow Ban</Typography>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setSelectedUser(u); setTokenAmount(''); }}
              style={[styles.actionBtn, { borderColor: theme.colors.neonGreen }]}
            >
              <Typography variant="tiny" style={{ color: theme.colors.neonGreen }}>Tokens</Typography>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setSelectedUser(u); setSubPlan('pro'); setSubDays('30'); }}
              style={[styles.actionBtn, { borderColor: '#3B82F6' }]}
            >
              <Typography variant="tiny" style={{ color: '#3B82F6' }}>Grant Sub</Typography>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderReportsTab = () => (
    <View style={styles.section}>
      <Typography variant="h1" style={{ marginBottom: 12 }}>Reports ({reports.length})</Typography>
      {reports.length === 0 && <Typography variant="small" muted>No reports yet.</Typography>}
      {reports.map((r) => (
        <View key={r.id} style={[styles.card, { borderColor: theme.colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Typography variant="bodyStrong">{r.reporter_name} → {r.reported_name}</Typography>
            </View>
            <View style={[styles.badge, { backgroundColor: statusColor(r.status) }]}>
              <Typography variant="tiny" style={{ color: '#fff' }}>{r.status}</Typography>
            </View>
          </View>
          <Typography variant="small" muted>{r.reason}</Typography>
          <Typography variant="tiny" muted>{new Date(r.created_at).toLocaleDateString()}</Typography>
          {r.status === 'pending' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <Button label="Review" variant="secondary" onPress={() => updateReport(r.id, 'reviewed')} />
              <Button label="Resolve" onPress={() => updateReport(r.id, 'resolved')} />
            </View>
          )}
          {r.status === 'reviewed' && (
            <Button label="Resolve" onPress={() => updateReport(r.id, 'resolved')} />
          )}
        </View>
      ))}
    </View>
  );

  const renderSafetyTab = () => (
    <View style={styles.section}>
      <Typography variant="h1" style={{ marginBottom: 12 }}>Safety & Abuse Monitoring</Typography>
      <Typography variant="body" muted style={{ marginBottom: 16 }}>
        Flagged accounts and abuse indicators. Use User Management tab for actions.
      </Typography>

      <View style={styles.gridRow}>
        {[
          { label: 'Pending Reports', value: String(stats?.pending_reports || 0), color: '#E8A838' },
          { label: 'Total Reports', value: String(reports.length), color: '#EF4444' },
        ].map((item) => (
          <View key={item.label} style={[styles.metricCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <Typography variant="tiny" muted>{item.label}</Typography>
            <Typography variant="h2" style={{ color: item.color }}>{item.value}</Typography>
          </View>
        ))}
      </View>

      <Typography variant="bodyStrong" style={{ marginTop: 16, marginBottom: 8 }}>Users with Reports</Typography>
      {users.filter((u) => u.report_count > 0).length === 0 && (
        <Typography variant="small" muted>No flagged users found.</Typography>
      )}
      {users.filter((u) => u.report_count > 0).sort((a, b) => b.report_count - a.report_count).map((u) => (
        <View key={u.id} style={[styles.card, { borderColor: '#EF4444' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Typography variant="bodyStrong">{u.name}</Typography>
            <Typography variant="small" style={{ color: '#EF4444' }}>{u.report_count} report(s)</Typography>
          </View>
          <Typography variant="tiny" muted>{u.email}</Typography>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <TouchableOpacity
              onPress={() => toggleBan(u.id, u.is_banned)}
              style={[styles.actionBtn, { borderColor: '#EF4444' }]}
            >
              <Typography variant="tiny" style={{ color: '#EF4444' }}>{u.is_banned ? 'Unban' : 'Suspend'}</Typography>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleShadowBan(u.id)}
              style={[styles.actionBtn, { borderColor: '#E8A838' }]}
            >
              <Typography variant="tiny" style={{ color: '#E8A838' }}>Shadow Ban</Typography>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return renderRevenueTab();
      case 'tokens': return renderTokensTab();
      case 'engagement': return renderEngagementTab();
      case 'users': return renderUsersTab();
      case 'reports': return renderReportsTab();
      case 'safety': return renderSafetyTab();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Admin Dashboard" onBack={onBack} />

      {/* Summary bar */}
      {renderSummaryBar()}

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TAB_ITEMS.map((tab) => (
          <Pressable
            key={tab.id}
            style={[
              styles.tabPill,
              activeTab === tab.id
                ? { backgroundColor: theme.colors.neonGreen }
                : { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border, borderWidth: 1 },
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Feather
              name={tab.icon as any}
              size={12}
              color={activeTab === tab.id ? '#000' : theme.colors.muted}
            />
            <Typography
              variant="tiny"
              style={{
                color: activeTab === tab.id ? '#000' : theme.colors.text,
                fontFamily: 'RedHatDisplay_600SemiBold',
                fontSize: 10,
              }}
            >
              {tab.label}
            </Typography>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {renderContent()}
      </ScrollView>

      {/* User Action Modal */}
      <Modal visible={!!selectedUser} transparent animationType="fade" onRequestClose={() => setSelectedUser(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Typography variant="h2">Actions for {selectedUser?.name}</Typography>
              <TouchableOpacity onPress={() => setSelectedUser(null)}>
                <Feather name="x" size={22} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Grant/Remove Tokens */}
            <Typography variant="bodyStrong" style={{ marginBottom: 6 }}>Tokens</Typography>
            <View style={[styles.searchBox, { borderColor: theme.colors.border, marginBottom: 8 }]}>
              <TextInput
                placeholder="Amount"
                keyboardType="numeric"
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholderTextColor={theme.colors.muted}
                value={tokenAmount}
                onChangeText={setTokenAmount}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.colors.neonGreen }]}
                onPress={() => selectedUser && grantTokens(selectedUser.id, Number(tokenAmount) || 0, 'grant')}
              >
                <Typography variant="small" style={{ color: '#000', fontFamily: 'RedHatDisplay_600SemiBold' }}>Grant</Typography>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: '#EF4444' }]}
                onPress={() => selectedUser && grantTokens(selectedUser.id, Number(tokenAmount) || 0, 'remove')}
              >
                <Typography variant="small" style={{ color: '#fff', fontFamily: 'RedHatDisplay_600SemiBold' }}>Remove</Typography>
              </Pressable>
            </View>

            {/* Grant Subscription */}
            <Typography variant="bodyStrong" style={{ marginBottom: 6 }}>Grant Subscription</Typography>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Pressable
                style={[styles.subToggle, subPlan === 'pro' && { backgroundColor: theme.colors.neonGreen }]}
                onPress={() => setSubPlan('pro')}
              >
                <Typography variant="tiny" style={{ color: subPlan === 'pro' ? '#000' : theme.colors.text }}>Pro</Typography>
              </Pressable>
              <Pressable
                style={[styles.subToggle, subPlan === 'premium' && { backgroundColor: '#A78BFA' }]}
                onPress={() => setSubPlan('premium')}
              >
                <Typography variant="tiny" style={{ color: subPlan === 'premium' ? '#000' : theme.colors.text }}>Premium</Typography>
              </Pressable>
            </View>
            <View style={[styles.searchBox, { borderColor: theme.colors.border, marginBottom: 8 }]}>
              <TextInput
                placeholder="Days"
                keyboardType="numeric"
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholderTextColor={theme.colors.muted}
                value={subDays}
                onChangeText={setSubDays}
              />
            </View>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: '#3B82F6', alignSelf: 'stretch' }]}
              onPress={() => selectedUser && grantSubscription(selectedUser.id, subPlan, Number(subDays) || 30)}
            >
              <Typography variant="small" style={{ color: '#fff', fontFamily: 'RedHatDisplay_600SemiBold' }}>Grant {subPlan} for {subDays} days</Typography>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const barStyles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  summaryPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  section: {
    gap: 8,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  featureRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 8,
  },
  performanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    height: 100,
  },
  chartBarCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBar: {
    width: 8,
    borderRadius: 4,
    minHeight: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  subToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
});
