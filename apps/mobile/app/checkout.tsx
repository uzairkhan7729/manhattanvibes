import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api, ApiError } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { useCart } from '../src/lib/cart';
import { fmtSAR } from '../src/lib/format';

type Method = 'cash' | 'mada' | 'visa' | 'mastercard' | 'applepay' | 'stcpay';

export default function CheckoutScreen(): JSX.Element {
  const cart = useCart();
  const auth = useAuth();
  const router = useRouter();
  const [type, setType] = useState<'pickup' | 'delivery'>('pickup');
  const [method, setMethod] = useState<Method>('cash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function place(): Promise<void> {
    setBusy(true); setError(null);
    try {
      if (!auth.accessToken) {
        router.push('/auth/phone');
        return;
      }
      const order = await api.post<{ _id: string; pricing: { total: number } }>('/orders', {
        branchId: cart.branchId,
        channel: 'mobile',
        type,
        items: cart.lines.map((l) => ({ productId: l.productId, qty: l.qty, sizeCode: l.sizeCode, crustCode: l.crustCode, toppingIds: l.toppingIds, sauceIds: l.sauceIds })),
        customerId: auth.userId,
      }, { authorization: `Bearer ${auth.accessToken}` });
      await api.post('/payments/intent', { orderId: order._id, method, amount: order.pricing.total }, { authorization: `Bearer ${auth.accessToken}` });
      cart.clear();
      router.replace(`/track/${order._id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not place order');
    } finally {
      setBusy(false);
    }
  }

  const subtotal = cart.lines.reduce((s, l) => s + l.estimatedUnitPrice * l.qty, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Section title="Order type">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['pickup', 'delivery'] as const).map((t) => (
            <Chip key={t} active={type === t} onPress={() => setType(t)} label={t} />
          ))}
        </View>
      </Section>

      <Section title="Payment method">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['cash', 'mada', 'visa', 'mastercard', 'applepay', 'stcpay'] as Method[]).map((m) => (
            <Chip key={m} active={method === m} onPress={() => setMethod(m)} label={m} />
          ))}
        </View>
      </Section>

      <View style={styles.totalCard}>
        <Text style={{ fontWeight: '600' }}>Total (est.)</Text>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>{fmtSAR(subtotal)}</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.cta, busy && { opacity: 0.5 }]} onPress={() => void place()} disabled={busy || cart.lines.length === 0}>
        <Text style={styles.ctaText}>{busy ? 'Placing…' : 'Place order'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.h2}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }): JSX.Element {
  return (
    <Pressable onPress={onPress}
               style={[styles.chip, active && { backgroundColor: '#f97316', borderColor: '#f97316' }]}>
      <Text style={[styles.chipLabel, active && { color: 'white' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  h2: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 8, textTransform: 'uppercase' },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: 'white', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  chipLabel: { color: '#0f172a', textTransform: 'capitalize' },
  totalCard: { backgroundColor: 'white', padding: 14, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginTop: 8 },
  error: { color: '#dc2626', marginTop: 12 },
  cta: { backgroundColor: '#f97316', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  ctaText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
