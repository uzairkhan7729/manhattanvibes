import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { useCart } from '../src/lib/cart';
import { fmtSAR } from '../src/lib/format';
import { colors, radii, shadows, type as t } from '../src/lib/theme';

type OrderType = 'pickup' | 'delivery';
type PayMethod = 'cash' | 'visa';

const PAY: Array<{ key: PayMethod; label: string; icon: string }> = [
  { key: 'cash', label: 'Cash',        icon: '💵' },
  { key: 'visa', label: 'Credit Card', icon: '💳' },
];

export default function CheckoutScreen(): JSX.Element {
  const cart = useCart();
  const auth = useAuth();
  const router = useRouter();
  const [type, setType] = useState<OrderType>('pickup');
  const [method, setMethod] = useState<PayMethod>('cash');
  const [phone, setPhone] = useState('+923001000099');
  const [name, setName] = useState('Guest');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = cart.lines.reduce((s, l) => s + l.estimatedUnitPrice * l.qty, 0);

  async function place(): Promise<void> {
    setBusy(true); setError(null);
    try {
      // Recover branchId if home never loaded it (e.g. user fixed API URL
      // mid-flow and went straight to menu without revisiting home).
      let branchId = cart.branchId;
      if (!branchId) {
        const r = await api.get<{ items: Array<{ _id: string; status: string }> }>('/branches');
        const active = r.items.find((b) => b.status === 'active') ?? r.items[0];
        if (!active) throw new Error('No active branch found.');
        cart.setBranch(active._id);
        branchId = active._id;
      }
      if (cart.lines.length === 0) throw new Error('Your cart is empty.');

      let token = auth.accessToken;
      let userId = auth.userId;

      // OTP-bootstrap login if needed
      if (!token) {
        const otp = await api.post<{ devCode?: string }>('/auth/otp/request', { phone, purpose: 'login' });
        const v = await api.post<{ accessToken: string; refreshToken: string; user: { id: string } }>(
          '/auth/otp/verify',
          { phone, code: otp.devCode ?? '000000', purpose: 'login' },
        );
        auth.setSession(v.user.id, v.accessToken, v.refreshToken);
        token = v.accessToken;
        userId = v.user.id;
      }

      const order = await api.post<{ _id: string; pricing: { total: number } }>(
        '/orders',
        {
          branchId,
          channel: 'mobile',
          type,
          items: cart.lines.map((l) => ({ productId: l.productId, qty: l.qty, sizeCode: l.sizeCode, crustCode: l.crustCode, toppingIds: l.toppingIds, sauceIds: l.sauceIds })),
          customerId: userId,
          guestInfo: { name, phone },
        },
        { authorization: `Bearer ${token}` },
      );
      await api.post('/payments/intent', { orderId: order._id, method, amount: order.pricing.total }, { authorization: `Bearer ${token}` });

      cart.clear();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/track/${order._id}`);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err instanceof ApiError) {
        const fieldMsgs = err.fields
          ? Object.entries(err.fields).map(([k, v]) => `${k}: ${v}`).join('\n')
          : '';
        setError(fieldMsgs ? `${err.message}\n\n${fieldMsgs}` : err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Could not place order');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Text style={[t.h1, { color: colors.ink[900] }]}>Almost there</Text>
        <Text style={{ color: colors.ink[500], marginTop: 2 }}>Review and confirm your order.</Text>

        {/* Order type */}
        <Text style={styles.sec}>HOW TO GET IT</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Tile active={type === 'pickup'} icon="🏪" title="Pickup" desc="Ready in 12 min" onPress={() => setType('pickup')} />
          <Tile active={type === 'delivery'} icon="🛵" title="Delivery" desc="25–35 min · Rs 250" onPress={() => setType('delivery')} />
        </View>

        {/* Contact */}
        <Text style={styles.sec}>CONTACT</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
        </View>
        <View style={[styles.field, { marginTop: 10 }]}>
          <Text style={styles.fieldLabel}>Phone (E.164)</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </View>

        {/* Payment */}
        <Text style={styles.sec}>PAYMENT</Text>
        <View style={styles.payGrid}>
          {PAY.map((m) => {
            const sel = method === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => { setMethod(m.key); void Haptics.selectionAsync(); }}
                style={[styles.payTile, sel && styles.payTileActive]}
              >
                <Text style={{ fontSize: 24 }}>{m.icon}</Text>
                <Text style={[styles.payLabel, sel && { color: '#fff' }]}>{m.label}</Text>
                {sel && <Text style={styles.payCheck}>✓</Text>}
              </Pressable>
            );
          })}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={{ color: '#991b1b', fontWeight: '700' }}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bar}>
        <View style={styles.barInner}>
          <View>
            <Text style={{ color: colors.ink[500], fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>TOTAL</Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink[900] }}>{fmtSAR(subtotal)}</Text>
          </View>
          <Pressable
            onPress={() => void place()}
            disabled={busy}
            style={[styles.placeBtn, busy && { opacity: 0.5 }]}
          >
            <Text style={styles.placeBtnText}>{busy ? 'Placing…' : 'Place order'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Tile({ active, icon, title, desc, onPress }: { active: boolean; icon: string; title: string; desc: string; onPress: () => void }): JSX.Element {
  return (
    <Pressable onPress={onPress} style={[styles.typeTile, active && styles.typeTileActive]}>
      <View style={[styles.typeIcon, active && { backgroundColor: colors.brand[500] }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <Text style={[styles.typeTitle, active && { color: colors.brand[700] }]}>{title}</Text>
      <Text style={styles.typeDesc}>{desc}</Text>
      {active && <Text style={styles.payCheck}>✓</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sec: { color: colors.ink[700], fontWeight: '900', letterSpacing: 2, fontSize: 11, marginTop: 24, marginBottom: 10 },

  typeTile: { flex: 1, backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, borderColor: colors.border, borderWidth: 1, ...shadows.card },
  typeTileActive: { borderColor: colors.brand[500], backgroundColor: colors.brand[50] },
  typeIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.ink[100], alignItems: 'center', justifyContent: 'center' },
  typeTitle: { fontWeight: '900', color: colors.ink[900], marginTop: 8, fontSize: 15 },
  typeDesc: { color: colors.ink[500], fontSize: 11, marginTop: 2 },

  field: { backgroundColor: colors.card, borderRadius: radii.md, padding: 12, borderColor: colors.border, borderWidth: 1 },
  fieldLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: colors.ink[500] },
  input: { fontSize: 16, paddingVertical: 4, color: colors.ink[900] },

  payGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  payTile: { width: '31%', backgroundColor: colors.card, borderRadius: radii.md, padding: 12, alignItems: 'center', borderColor: colors.border, borderWidth: 1 },
  payTileActive: { backgroundColor: colors.brand[500], borderColor: colors.brand[500] },
  payLabel: { fontSize: 12, fontWeight: '800', color: colors.ink[900], marginTop: 4 },
  payCheck: { position: 'absolute', top: 6, right: 8, color: '#fff', fontWeight: '900' },

  errorBox: { marginTop: 16, padding: 12, backgroundColor: '#fef2f2', borderRadius: radii.md, borderColor: '#fecaca', borderWidth: 1 },

  bar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  barInner: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  placeBtn: { backgroundColor: colors.brand[500], paddingHorizontal: 24, paddingVertical: 14, borderRadius: radii.pill, ...shadows.glow },
  placeBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
