import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { fmtSAR } from '../src/lib/format';
import { colors, radii, shadows, type as t } from '../src/lib/theme';

interface OrderRow { _id: string; orderNumber: string; state: string; type: string; pricing: { total: number }; createdAt: string }

const ACTIVE = new Set(['CREATED', 'CONFIRMED', 'PREPARING', 'BAKING', 'READY', 'OUT_FOR_DELIVERY']);
const STATE_PILL: Record<string, { bg: string; fg: string }> = {
  CREATED:           { bg: '#f1f5f9', fg: '#334155' },
  CONFIRMED:         { bg: '#dbeafe', fg: '#1e40af' },
  PREPARING:         { bg: '#fef3c7', fg: '#92400e' },
  BAKING:            { bg: '#ffedd5', fg: '#9a3412' },
  READY:             { bg: '#d1fae5', fg: '#065f46' },
  OUT_FOR_DELIVERY:  { bg: '#ede9fe', fg: '#5b21b6' },
  DELIVERED:         { bg: '#dcfce7', fg: '#166534' },
  CLOSED:            { bg: '#e7e5e4', fg: '#44403c' },
  CANCELLED:         { bg: '#fee2e2', fg: '#991b1b' },
};

export default function OrdersScreen(): JSX.Element {
  const auth = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (): Promise<void> => {
    if (!auth.accessToken) return;
    try {
      const r = await api.get<{ items: OrderRow[] }>('/orders?limit=50', { authorization: `Bearer ${auth.accessToken}` });
      setOrders(r.items);
    } catch { /* keep what we had */ }
  };

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.accessToken]);

  if (!auth.accessToken) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}><Text style={{ fontSize: 32 }}>🧾</Text></View>
        <Text style={[t.h1, { marginTop: 16 }]}>Sign in to see orders</Text>
        <Pressable style={styles.signInBtn} onPress={() => router.push('/auth/phone')}>
          <Text style={{ color: '#fff', fontWeight: '900' }}>Sign in with phone</Text>
        </Pressable>
      </View>
    );
  }

  const active = orders.filter((o) => ACTIVE.has(o.state));
  const past   = orders.filter((o) => !ACTIVE.has(o.state));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.brand[500]} />}
    >
      {active.length > 0 && (
        <>
          <Text style={styles.eyebrow}>LIVE</Text>
          <Text style={t.h2}>Active</Text>
          <View style={{ marginTop: 10, gap: 10, marginBottom: 22 }}>
            {active.map((o) => <OrderCard key={o._id} order={o} onPress={() => router.push(`/track/${o._id}`)} />)}
          </View>
        </>
      )}

      <Text style={[styles.eyebrow, { marginTop: active.length === 0 ? 4 : 0 }]}>HISTORY</Text>
      <Text style={t.h2}>Past orders</Text>

      <View style={{ marginTop: 10, gap: 10 }}>
        {past.map((o) => <OrderCard key={o._id} order={o} onPress={() => router.push(`/track/${o._id}`)} />)}
        {past.length === 0 && !loading && (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 28 }}>🍕</Text>
            <Text style={{ color: colors.ink[700], fontWeight: '700', marginTop: 6 }}>No past orders yet</Text>
            <Text style={{ color: colors.ink[500], fontSize: 12, marginTop: 4, textAlign: 'center' }}>
              Your order history will live here once you place a few.
            </Text>
          </View>
        )}
        {loading && past.length === 0 && (
          <Text style={{ color: colors.ink[500], textAlign: 'center', padding: 16 }}>Loading…</Text>
        )}
      </View>
    </ScrollView>
  );
}

function OrderCard({ order, onPress }: { order: OrderRow; onPress: () => void }): JSX.Element {
  const pill = STATE_PILL[order.state] ?? STATE_PILL.CREATED!;
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.num}>{order.orderNumber}</Text>
        <Text style={styles.date}>{new Date(order.createdAt).toLocaleString()} · {order.type}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text style={styles.total}>{fmtSAR(order.pricing.total)}</Text>
        <Text style={[styles.pill, { backgroundColor: pill.bg, color: pill.fg }]}>{order.state.replace(/_/g, ' ')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.brand[600], fontWeight: '900', letterSpacing: 2, fontSize: 10, marginBottom: 4 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bg },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brand[50], alignItems: 'center', justifyContent: 'center' },
  signInBtn: { marginTop: 22, backgroundColor: colors.brand[500], paddingHorizontal: 26, paddingVertical: 14, borderRadius: radii.pill, ...shadows.glow },

  emptyCard: { alignItems: 'center', padding: 28, backgroundColor: colors.card, borderRadius: radii.lg, ...shadows.card },

  card: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.card, borderRadius: radii.lg, ...shadows.card },
  num: { fontWeight: '900', color: colors.ink[900], fontSize: 15 },
  date: { color: colors.ink[500], fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  total: { fontWeight: '900', color: colors.ink[900] },
  pill: { fontSize: 9, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
});
