import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { fmtSAR } from '../../src/lib/format';
import { colors, radii, shadows, type as t } from '../../src/lib/theme';

interface Me { id: string; fullName: { en: string }; phone: string; email?: string }
interface OrderRow { _id: string; orderNumber: string; state: string; pricing: { total: number }; createdAt: string }

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

export default function ProfileScreen(): JSX.Element {
  const auth = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    if (!auth.accessToken || !auth.userId) return;
    api.get<Me>('/auth/me', { authorization: `Bearer ${auth.accessToken}` }).then(setMe).catch(() => undefined);
    api.get<{ items: OrderRow[] }>(`/orders?customerId=${auth.userId}&limit=10`, { authorization: `Bearer ${auth.accessToken}` })
      .then((r) => setOrders(r.items))
      .catch(() => undefined);
  }, [auth.accessToken, auth.userId]);

  if (!auth.accessToken) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.signin}>
          <View style={styles.avatar}><Text style={{ fontSize: 30 }}>👤</Text></View>
          <Text style={[t.h1, { marginTop: 16 }]}>Not signed in</Text>
          <Text style={{ color: colors.ink[500], marginTop: 4, textAlign: 'center' }}>
            Sign in to see your orders, save addresses, and earn loyalty.
          </Text>
          <Pressable style={styles.cta} onPress={() => router.push('/auth/phone')}>
            <Text style={styles.ctaText}>Sign in with phone</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: colors.brand[700] }}>
              {(me?.fullName.en?.[0] ?? 'G').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[t.h1, { color: colors.ink[900], fontSize: 24 }]}>{me?.fullName.en ?? 'You'}</Text>
            <Text style={{ color: colors.ink[500] }}>{me?.phone}</Text>
          </View>
        </View>

        <Text style={[t.h2, { marginTop: 24, marginBottom: 12 }]}>Recent orders</Text>
        {orders.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ color: colors.ink[500] }}>No orders yet</Text>
          </View>
        )}
        {orders.map((o) => {
          const pill = STATE_PILL[o.state] ?? STATE_PILL.CREATED!;
          return (
            <Pressable
              key={o._id}
              onPress={() => router.push(`/track/${o._id}`)}
              style={styles.orderRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.orderNum}>{o.orderNumber}</Text>
                <Text style={styles.orderDate}>{new Date(o.createdAt).toLocaleString()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.orderTotal}>{fmtSAR(o.pricing.total)}</Text>
                <Text style={[styles.pill, { backgroundColor: pill.bg, color: pill.fg }]}>{o.state}</Text>
              </View>
            </Pressable>
          );
        })}

        <Pressable onPress={() => auth.clear()} style={[styles.cta, { backgroundColor: '#fef2f2', marginTop: 32 }]}>
          <Text style={[styles.ctaText, { color: '#991b1b' }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  signin: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand[100], alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },

  cta: { backgroundColor: colors.brand[500], marginTop: 24, paddingHorizontal: 26, paddingVertical: 14, borderRadius: radii.pill, alignSelf: 'stretch', alignItems: 'center', ...shadows.glow },
  ctaText: { color: '#fff', fontWeight: '900' },

  empty: { padding: 32, alignItems: 'center', backgroundColor: colors.card, borderRadius: radii.lg },

  orderRow: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.card, borderRadius: radii.lg, marginBottom: 10, ...shadows.card },
  orderNum: { fontWeight: '900', color: colors.ink[900] },
  orderDate: { color: colors.ink[500], fontSize: 11, marginTop: 2 },
  orderTotal: { fontWeight: '900', color: colors.ink[900] },
  pill: { fontSize: 9, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
});
