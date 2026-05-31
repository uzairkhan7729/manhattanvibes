import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { fmtSAR } from '../../src/lib/format';

const STEPS = [
  { key: 'CONFIRMED',        label: 'Confirmed' },
  { key: 'PREPARING',        label: 'Preparing' },
  { key: 'BAKING',           label: 'Baking' },
  { key: 'READY',            label: 'Ready' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { key: 'DELIVERED',        label: 'Delivered' },
];

interface Order { _id: string; orderNumber: string; state: string; type: string; pricing: { total: number } }

export default function TrackScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!id || !auth.accessToken) return;
    const fetch = (): void => {
      api.get<Order>(`/orders/${id}`, { authorization: `Bearer ${auth.accessToken!}` })
        .then(setOrder).catch(() => undefined);
    };
    fetch();
    const t = setInterval(fetch, 5_000);
    return () => clearInterval(t);
  }, [id, auth.accessToken]);

  if (!order) return <View style={styles.screen}><Text style={styles.muted}>Loading…</Text></View>;
  const steps = order.type === 'delivery' ? STEPS : STEPS.filter((s) => s.key !== 'OUT_FOR_DELIVERY');
  const currentIdx = steps.findIndex((s) => s.key === order.state);

  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>{order.orderNumber}</Text>
      <Text style={styles.muted}>{order.type} · {fmtSAR(order.pricing.total)}</Text>

      <View style={styles.timeline}>
        {steps.map((s, i) => {
          const reached = i <= currentIdx;
          const now = i === currentIdx;
          return (
            <View key={s.key} style={styles.step}>
              <View style={[styles.dot, reached && styles.dotActive, now && styles.dotNow]} />
              <Text style={[styles.stepLabel, reached && { color: '#0f172a', fontWeight: '700' }]}>{s.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, backgroundColor: '#f8fafc' },
  h1: { fontSize: 22, fontWeight: '800' },
  muted: { color: '#64748b', marginTop: 4, marginBottom: 18 },
  timeline: { backgroundColor: 'white', padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  step: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#e2e8f0', marginRight: 14 },
  dotActive: { backgroundColor: '#f97316' },
  dotNow: { transform: [{ scale: 1.3 }] },
  stepLabel: { fontSize: 15, color: '#94a3b8' },
});
