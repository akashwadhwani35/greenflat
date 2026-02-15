import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
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

export const AdminDashboardScreen: React.FC<Props> = ({ onBack, token, apiBaseUrl }) => {
  const theme = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/admin/stats`, { headers });
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/admin/reports?limit=20`, { headers });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch {}
  }, []);

  const fetchUsers = useCallback(async (q = '') => {
    try {
      const qs = q ? `?q=${encodeURIComponent(q)}&limit=20` : '?limit=20';
      const res = await fetch(`${apiBaseUrl}/admin/users${qs}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([fetchStats(), fetchReports(), fetchUsers()]).finally(() => setLoading(false));
  }, []);

  const updateReport = async (reportId: number, status: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed');
      await fetchReports();
      await fetchStats();
    } catch {
      Alert.alert('Error', 'Could not update report.');
    }
  };

  const toggleBan = async (userId: number, currentlyBanned: boolean) => {
    const action = currentlyBanned ? 'unban' : 'ban';
    Alert.alert(
      `Confirm ${action}`,
      `Are you sure you want to ${action} this user?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: currentlyBanned ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${apiBaseUrl}/admin/users/${userId}/ban`, { method: 'POST', headers });
              if (!res.ok) throw new Error('Failed');
              await fetchUsers(userSearch);
            } catch {
              Alert.alert('Error', 'Could not toggle ban.');
            }
          },
        },
      ]
    );
  };

  const statusColor = (s: string) => {
    if (s === 'pending') return '#E8A838';
    if (s === 'reviewed') return '#3B82F6';
    return '#22C55E';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <PageHeader title="Admin" onBack={onBack} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PageHeader title="Admin" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        {stats && (
          <View style={styles.statsRow}>
            {[
              { label: 'Users', value: stats.total_users },
              { label: 'Reports', value: stats.pending_reports },
              { label: 'Matches', value: stats.total_matches },
              { label: 'Messages', value: stats.total_messages },
            ].map((s) => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.border }]}>
                <Typography variant="h2">{s.value}</Typography>
                <Typography variant="tiny" muted>{s.label}</Typography>
              </View>
            ))}
          </View>
        )}

        {/* Reports */}
        <Typography variant="h2" style={{ marginTop: 8 }}>Reports</Typography>
        {reports.length === 0 && <Typography variant="small" muted>No reports yet.</Typography>}
        {reports.map((r) => (
          <View key={r.id} style={[styles.card, { borderColor: theme.colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="bodyStrong">{r.reporter_name} reported {r.reported_name}</Typography>
              <View style={[styles.badge, { backgroundColor: statusColor(r.status) }]}>
                <Typography variant="tiny" style={{ color: '#fff' }}>{r.status}</Typography>
              </View>
            </View>
            <Typography variant="small" muted>{r.reason}</Typography>
            {r.status === 'pending' && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Button label="Review" variant="secondary" onPress={() => updateReport(r.id, 'reviewed')} />
                <Button label="Resolve" onPress={() => updateReport(r.id, 'resolved')} />
              </View>
            )}
            {r.status === 'reviewed' && (
              <Button label="Resolve" onPress={() => updateReport(r.id, 'resolved')} />
            )}
          </View>
        ))}

        {/* Users */}
        <Typography variant="h2" style={{ marginTop: 16 }}>Users</Typography>
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
              {u.is_banned && (
                <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
                  <Typography variant="tiny" style={{ color: '#fff' }}>Banned</Typography>
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              {u.is_verified && <Typography variant="tiny" muted>Verified</Typography>}
              {u.is_premium && <Typography variant="tiny" muted>Premium</Typography>}
              {u.report_count > 0 && <Typography variant="tiny" style={{ color: '#E8A838' }}>{u.report_count} report(s)</Typography>}
            </View>
            <TouchableOpacity
              onPress={() => toggleBan(u.id, u.is_banned)}
              style={[styles.banButton, { borderColor: u.is_banned ? theme.colors.brand : '#EF4444' }]}
            >
              <Typography variant="small" style={{ color: u.is_banned ? theme.colors.brand : '#EF4444' }}>
                {u.is_banned ? 'Unban' : 'Ban user'}
              </Typography>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 2,
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
  banButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
});
