import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { useCart } from '../../src/lib/cart';
import { fmtSAR } from '../../src/lib/format';

interface Category { _id: string; name: { en: string }; slug: string; displayOrder: number }
interface Product { id: string; sku: string; name: { en: string }; effectivePrice: number; isAvailable: boolean; type: string; categoryId: string }

export default function MenuScreen(): JSX.Element {
  const cart = useCart();
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [active, setActive] = useState<string>('');

  useEffect(() => {
    void (async () => {
      const [c, p] = await Promise.all([
        api.get<{ items: Category[] }>('/catalog/categories'),
        api.get<{ items: Product[] }>(`/catalog/products?limit=200${cart.branchId ? `&branchId=${cart.branchId}` : ''}`),
      ]);
      const sorted = c.items.sort((a, b) => a.displayOrder - b.displayOrder);
      setCats(sorted);
      setProducts(p.items);
      setActive(sorted[0]?._id ?? '');
    })();
  }, [cart.branchId]);

  const items = useMemo(() => products.filter((p) => p.categoryId === active), [products, active]);

  return (
    <View style={styles.screen}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {cats.map((c) => (
          <Pressable key={c._id} onPress={() => setActive(c._id)}
                     style={[styles.tab, active === c._id && styles.tabActive]}>
            <Text style={[styles.tabLabel, active === c._id && styles.tabLabelActive]}>{c.name.en}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {items.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{p.name.en}</Text>
              <Text style={styles.meta}>{p.sku}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.price}>{fmtSAR(p.effectivePrice)}</Text>
              <Pressable
                onPress={() => cart.add({ productId: p.id, productName: p.name.en, qty: 1, estimatedUnitPrice: p.effectivePrice })}
                style={styles.addBtn}
                disabled={!p.isAvailable}
              >
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {items.length === 0 && <Text style={styles.empty}>No items in this category</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  tabRow: { flexGrow: 0, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  tab: { paddingHorizontal: 12, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderColor: '#f97316' },
  tabLabel: { color: '#475569', fontWeight: '600' },
  tabLabelActive: { color: '#c2410c' },
  card: { backgroundColor: 'white', padding: 14, borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  title: { fontWeight: '700', fontSize: 15 },
  meta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  price: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  addBtn: { backgroundColor: '#f97316', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6, marginTop: 6 },
  addBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
  empty: { textAlign: 'center', color: '#64748b', padding: 24 },
});
