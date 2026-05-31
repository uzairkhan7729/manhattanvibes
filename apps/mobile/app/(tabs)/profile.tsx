import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { fmtSAR } from '../../src/lib/format';

interface Me { id: string; fullName: { en: string }; phone: string; email?: string }
interface OrderRow { _id: string; orderNumber: string; state: string; pricing: { total: number } }

export default function ProfileScreen(): JSX.Element {
  const auth = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    if (!auth.accessToken || !auth.userId) return;
    api.get<Me>('/auth/me', { authorization: `Bearer ${auth.accessToken}` }).then(setMe).catch(() => undefined);
    api.get<{ items: OrderRow[] }>(`/orders?customerId=${auth.userId}&limit=10`, { authorization: `Bearer ${auth.accessToken}` })
      .then((r) => setOrders(r.items)).catch(() => undefined);
  }, [auth.accessToken, auth.userId]);

  if (!auth.accessToken) {
    return (
      <View style={[styles.screen, { padding: 24 }]}>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>Not signed in</Text>
        <Link href="/auth/phone" style={styles.cta}><Text style={styles.ctaText}>Sign in with phone</Text></Link>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>Hi {me?.fullName.en ?? 'there'}</Text>
      <Text style={styles.muted}>{me?.phone}</Text>

      <Text style={styles.h2}>Recent orders</Text>
      {orders.length === 0 && <Text style={styles.muted}>No orders yet</Text>}
      {orders.map((o) => (
        <Pressable key={o._id} style={styles.row} onPress={() => router.push(`/track/${o._id}`)}>
          <View>
            <Text style={styles.orderNum}>{o.orderNumber}</Text>
            <Text style={styles.muted}>{o.state}</Text>
          </View>
          <Text style={styles.price}>{fmtSAR(o.pricing.total)}</Text>
        </Pressable>
      ))}

      <Pressable style={[styles.cta, { backgroundColor: '#94a3b8' }]} onPress={() => auth.clear()}>
        <Text style={styles.ctaText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  h1: { fontSize: 22, fontWeight: '800' },
  h2: { fontSize: 16, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  muted: { color: '#64748b', fontSize: 13, marginTop: 2 },
  row: { backgroundColor: 'white', padding: 14, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  orderNum: { fontWeight: '700' },
  price: { fontWeight: '700' },
  cta: { backgroundColor: '#f97316', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 24 },
  ctaText: { color: 'white', fontWeight: '700' },
});
