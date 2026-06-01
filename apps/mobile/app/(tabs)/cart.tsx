import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCart } from '../../src/lib/cart';
import { fmtSAR } from '../../src/lib/format';
import { productImage } from '../../src/lib/images';
import { colors, radii, shadows, type as t } from '../../src/lib/theme';

export default function CartScreen(): JSX.Element {
  const cart = useCart();
  const router = useRouter();
  const subtotal = cart.lines.reduce((s, l) => s + l.estimatedUnitPrice * l.qty, 0);
  const vatInc = Math.round((subtotal * 15) / 115);

  if (cart.lines.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Text style={{ fontSize: 36 }}>🛒</Text>
        </View>
        <Text style={[t.h1, { color: colors.ink[900], marginTop: 16 }]}>Cart is empty</Text>
        <Text style={{ color: colors.ink[500], marginTop: 4, textAlign: 'center' }}>
          Tap "Menu" to start an order.
        </Text>
        <Pressable style={styles.browseBtn} onPress={() => router.push('/menu')}>
          <Text style={styles.browseBtnText}>Browse menu</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 140, gap: 10 }}>
        {cart.lines.map((l) => (
          <View key={l.id} style={styles.row}>
            <Image source={{ uri: productImage(undefined) }} style={styles.img} contentFit="cover" />
            <View style={{ flex: 1, padding: 12 }}>
              <Text style={styles.title}>{l.productName}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                {l.sizeCode && <Text style={styles.meta}>size {l.sizeCode}</Text>}
                {l.crustCode && <Text style={styles.meta}>· {l.crustCode}</Text>}
                {l.toppingIds && l.toppingIds.length > 0 && <Text style={styles.meta}>· {l.toppingIds.length} toppings</Text>}
              </View>

              <View style={styles.foot}>
                <View style={styles.qtyWrap}>
                  <Pressable onPress={() => { cart.setQty(l.id, l.qty - 1); void Haptics.selectionAsync(); }} style={styles.qtyBtn}>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.qtyText}>{l.qty}</Text>
                  <Pressable onPress={() => { cart.setQty(l.id, l.qty + 1); void Haptics.selectionAsync(); }} style={styles.qtyBtn}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </Pressable>
                </View>
                <Text style={styles.price}>{fmtSAR(l.estimatedUnitPrice * l.qty)}</Text>
              </View>
              <Pressable onPress={() => { cart.remove(l.id); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft); }} style={{ marginTop: 8 }}>
                <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 12 }}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={styles.summary}>
          <Text style={[t.h2, { marginBottom: 12 }]}>Summary</Text>
          <Row label="Subtotal" value={fmtSAR(subtotal)} />
          <Row label="VAT (15% inc.)" value={fmtSAR(vatInc)} muted />
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 10 }} />
          <Row label="Total" value={fmtSAR(subtotal)} bold />
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bar}>
        <View style={styles.barInner}>
          <View>
            <Text style={{ color: colors.ink[500], fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>TOTAL</Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink[900] }}>{fmtSAR(subtotal)}</Text>
          </View>
          <Pressable onPress={() => router.push('/checkout')} style={styles.checkoutBtn}>
            <Text style={styles.checkoutBtnText}>Checkout  →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }): JSX.Element {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={{ color: muted ? colors.ink[500] : colors.ink[700], fontWeight: bold ? '800' : '500' }}>{label}</Text>
      <Text style={{ color: colors.ink[900], fontWeight: bold ? '900' : '700', fontSize: bold ? 16 : 14 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bg },
  emptyIcon: { width: 86, height: 86, borderRadius: 43, backgroundColor: colors.brand[50], alignItems: 'center', justifyContent: 'center' },
  browseBtn: { marginTop: 22, backgroundColor: colors.brand[500], paddingHorizontal: 26, paddingVertical: 14, borderRadius: radii.pill, ...shadows.glow },
  browseBtnText: { color: '#fff', fontWeight: '900' },

  row: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radii.lg, overflow: 'hidden', ...shadows.card },
  img: { width: 100, height: 100, backgroundColor: colors.ink[100] },
  title: { fontSize: 15, fontWeight: '800', color: colors.ink[900] },
  meta: { fontSize: 11, color: colors.ink[500] },
  foot: { marginTop: 'auto', paddingTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bg, borderRadius: radii.pill, padding: 4 },
  qtyBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: '900', color: colors.ink[900] },
  qtyText: { width: 24, textAlign: 'center', fontWeight: '900', color: colors.ink[900] },
  price: { fontWeight: '900', fontSize: 16, color: colors.ink[900] },

  summary: { marginTop: 8, padding: 16, backgroundColor: colors.card, borderRadius: radii.lg, ...shadows.card },

  bar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  barInner: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  checkoutBtn: { backgroundColor: colors.brand[500], paddingHorizontal: 22, paddingVertical: 14, borderRadius: radii.pill, ...shadows.glow },
  checkoutBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
