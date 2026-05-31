import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useCart } from '../../src/lib/cart';
import { fmtSAR } from '../../src/lib/format';

export default function CartScreen(): JSX.Element {
  const cart = useCart();
  const router = useRouter();
  const subtotal = cart.lines.reduce((s, l) => s + l.estimatedUnitPrice * l.qty, 0);

  if (cart.lines.length === 0) {
    return (
      <View style={[styles.screen, { padding: 24, alignItems: 'center' }]}>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>Your cart is empty</Text>
        <Link href="/menu" style={styles.cta}><Text style={styles.ctaText}>Browse menu</Text></Link>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {cart.lines.map((l) => (
          <View key={l.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{l.productName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <Pressable style={styles.qtyBtn} onPress={() => cart.setQty(l.id, l.qty - 1)}><Text style={styles.qtyBtnText}>−</Text></Pressable>
                <Text style={styles.qty}>{l.qty}</Text>
                <Pressable style={styles.qtyBtn} onPress={() => cart.setQty(l.id, l.qty + 1)}><Text style={styles.qtyBtnText}>+</Text></Pressable>
                <Pressable style={{ marginLeft: 12 }} onPress={() => cart.remove(l.id)}><Text style={{ color: '#ef4444' }}>Remove</Text></Pressable>
              </View>
            </View>
            <Text style={styles.price}>{fmtSAR(l.estimatedUnitPrice * l.qty)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ fontWeight: '600' }}>Estimated total</Text>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>{fmtSAR(subtotal)}</Text>
        </View>
        <Pressable style={styles.cta} onPress={() => router.push('/checkout')}>
          <Text style={styles.ctaText}>Continue to checkout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  row: { backgroundColor: 'white', padding: 14, borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  title: { fontWeight: '700' },
  qtyBtn: { borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 4 },
  qtyBtnText: { fontSize: 16, fontWeight: '700' },
  qty: { paddingHorizontal: 10, fontWeight: '600' },
  price: { fontWeight: '700' },
  footer: { backgroundColor: 'white', padding: 14, borderTopWidth: 1, borderColor: '#e2e8f0' },
  cta: { backgroundColor: '#f97316', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  ctaText: { color: 'white', fontWeight: '700' },
});
