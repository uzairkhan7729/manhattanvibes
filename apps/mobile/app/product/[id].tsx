import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../src/lib/api';
import { useCart } from '../../src/lib/cart';
import { fmtSAR } from '../../src/lib/format';
import { productImage } from '../../src/lib/images';
import { colors, radii, shadows, type as t } from '../../src/lib/theme';

interface Product {
  _id?: string; id?: string; sku: string; name: { en: string; ar?: string };
  description?: { en?: string }; effectivePrice: number; isAvailable: boolean;
  type: 'simple' | 'configurable' | 'combo';
  sizes?: Array<{ code: 'S' | 'M' | 'L' | 'XL'; priceDelta: number; maxToppings?: number }>;
  crusts?: Array<{ code: string; name: { en: string }; priceDelta: number }>;
  isVeg?: boolean; spicyLevel?: number;
}
interface Topping { _id: string; name: { en: string }; category: 'sauce' | 'cheese' | 'meat' | 'veg'; basePrice: number }
interface ProductResponse { product: Product; effectivePrice: number; isAvailable: boolean }

export default function ProductDetail(): JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const cart = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [sizeCode, setSizeCode] = useState<'S' | 'M' | 'L' | 'XL' | undefined>();
  const [crustCode, setCrustCode] = useState<string | undefined>();
  const [sauceIds, setSauceIds] = useState<string[]>([]);
  const [toppingIds, setToppingIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const r = await api.get<ProductResponse>(`/catalog/products/${id}${cart.branchId ? `?branchId=${cart.branchId}` : ''}`);
        setProduct(r.product);
        setUnitPrice(r.effectivePrice);
        if (r.product.type === 'configurable') {
          setSizeCode((r.product.sizes?.[0]?.code as 'S' | 'M' | 'L' | 'XL') ?? 'M');
          setCrustCode(r.product.crusts?.[0]?.code);
          const tps = await api.get<{ items: Topping[] }>('/catalog/toppings');
          setToppings(tps.items);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load');
      }
    })();
  }, [id, cart.branchId]);

  // Live price quote for configurable products
  useEffect(() => {
    if (!product || product.type !== 'configurable') return;
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const r = await api.post<{ unitPrice: number }>('/catalog/products/price', {
            productId: id,
            branchId: cart.branchId,
            qty: 1,
            sizeCode, crustCode, toppingIds, sauceIds,
          });
          setUnitPrice(r.unitPrice);
        } catch { /* keep last good price */ }
      })();
    }, 250);
    return () => clearTimeout(handle);
  }, [product, id, cart.branchId, sizeCode, crustCode, toppingIds, sauceIds]);

  const maxToppings = useMemo(
    () => product?.sizes?.find((s) => s.code === sizeCode)?.maxToppings ?? 5,
    [product, sizeCode],
  );

  function toggle(arr: string[], v: string): string[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  function addToCart(): void {
    if (!product) return;
    const pid = product._id ?? product.id;
    if (!pid) return;
    cart.add({
      productId: pid,
      productName: product.name.en,
      qty,
      sizeCode, crustCode, sauceIds, toppingIds,
      estimatedUnitPrice: unitPrice,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 24, backgroundColor: colors.bg }}>
        <Text style={{ color: '#991b1b' }}>{error}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.brand[600], marginTop: 16 }}>← Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.ink[500] }}>Loading…</Text>
      </View>
    );
  }

  const sauces = toppings.filter((x) => x.category === 'sauce');
  const meats = toppings.filter((x) => x.category === 'meat');
  const cheeses = toppings.filter((x) => x.category === 'cheese');
  const veg = toppings.filter((x) => x.category === 'veg');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Hero */}
        <View style={{ height: 320 }}>
          <Image source={{ uri: productImage(product.sku) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={['top']} style={styles.heroBar}>
            <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={10}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink[900] }}>×</Text>
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
              {product.isVeg && <Text style={[styles.badge, styles.badgeVeg]}>VEGETARIAN</Text>}
              {product.spicyLevel && product.spicyLevel > 0 ? <Text style={[styles.badge, styles.badgeSpicy]}>🌶 SPICY</Text> : null}
            </View>
            <Text style={[t.h1, { color: colors.ink[900] }]}>{product.name.en}</Text>
            {product.description?.en && <Text style={{ color: colors.ink[500], marginTop: 8, lineHeight: 20 }}>{product.description.en}</Text>}
          </View>

          {product.type === 'configurable' && (
            <>
              {product.sizes && product.sizes.length > 0 && (
                <Section title="Size">
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {product.sizes.map((s) => (
                      <Pressable
                        key={s.code}
                        onPress={() => { setSizeCode(s.code); void Haptics.selectionAsync(); }}
                        style={[styles.sizeChip, sizeCode === s.code && styles.sizeChipActive]}
                      >
                        <Text style={[styles.sizeChipLabel, sizeCode === s.code && { color: '#fff' }]}>{s.code}</Text>
                        <Text style={[styles.sizeChipDelta, sizeCode === s.code && { color: 'rgba(255,255,255,0.85)' }]}>+{fmtSAR(s.priceDelta)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Section>
              )}

              {product.crusts && product.crusts.length > 0 && (
                <Section title="Crust">
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {product.crusts.map((c) => (
                      <Pressable
                        key={c.code}
                        onPress={() => { setCrustCode(c.code); void Haptics.selectionAsync(); }}
                        style={[styles.pillChip, crustCode === c.code && styles.pillChipActive]}
                      >
                        <Text style={[styles.pillChipText, crustCode === c.code && { color: '#fff' }]}>
                          {c.name.en}{c.priceDelta > 0 ? ` +${fmtSAR(c.priceDelta)}` : ''}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Section>
              )}

              {sauces.length > 0 && (
                <Section title="Sauce">
                  <ToggleGroup items={sauces} selected={sauceIds} onToggle={(i) => setSauceIds(toggle(sauceIds, i))} />
                </Section>
              )}

              <Section title={`Toppings  ·  ${toppingIds.length}/${maxToppings}`}>
                <Group label="Meats" items={meats} selected={toppingIds} max={maxToppings} onToggle={(i) => setToppingIds(toggle(toppingIds, i))} />
                <Group label="Cheeses" items={cheeses} selected={toppingIds} max={maxToppings} onToggle={(i) => setToppingIds(toggle(toppingIds, i))} />
                <Group label="Veggies" items={veg} selected={toppingIds} max={maxToppings} onToggle={(i) => setToppingIds(toggle(toppingIds, i))} />
              </Section>
            </>
          )}

          {/* Qty */}
          <Section title="Quantity">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
              <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} style={styles.qtyBtn}>
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <Text style={{ fontSize: 22, fontWeight: '900', minWidth: 28, textAlign: 'center' }}>{qty}</Text>
              <Pressable onPress={() => setQty((q) => q + 1)} style={styles.qtyBtn}>
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
            </View>
          </Section>
        </View>
      </ScrollView>

      {/* Sticky add-to-cart bar */}
      <SafeAreaView edges={['bottom']} style={styles.bar}>
        <View style={styles.barInner}>
          <View>
            <Text style={{ color: colors.ink[500], fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>TOTAL</Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink[900] }}>{fmtSAR(unitPrice * qty)}</Text>
          </View>
          <Pressable onPress={addToCart} style={styles.addBtn}>
            <Text style={styles.addBtnText}>Add to cart  →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 22 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ToggleGroup({ items, selected, onToggle }: { items: Topping[]; selected: string[]; onToggle: (id: string) => void }): JSX.Element {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((it) => {
        const active = selected.includes(it._id);
        return (
          <Pressable
            key={it._id}
            onPress={() => { onToggle(it._id); void Haptics.selectionAsync(); }}
            style={[styles.pillChip, active && styles.pillChipActive]}
          >
            <Text style={[styles.pillChipText, active && { color: '#fff' }]}>
              {it.name.en}{it.basePrice > 0 ? ` +${fmtSAR(it.basePrice)}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Group({ label, items, selected, onToggle, max }: { label: string; items: Topping[]; selected: string[]; onToggle: (id: string) => void; max: number }): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 2, color: colors.ink[500], marginBottom: 8 }}>
        {label.toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((it) => {
          const active = selected.includes(it._id);
          const disabled = !active && selected.length >= max;
          return (
            <Pressable
              key={it._id}
              disabled={disabled}
              onPress={() => { onToggle(it._id); void Haptics.selectionAsync(); }}
              style={[styles.pillChip, active && styles.pillChipActive, disabled && { opacity: 0.4 }]}
            >
              <Text style={[styles.pillChipText, active && { color: '#fff' }]}>
                {it.name.en}{it.basePrice > 0 ? ` +${fmtSAR(it.basePrice)}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroBar: { flexDirection: 'row', justifyContent: 'flex-end', padding: 12 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },

  sheet: { backgroundColor: colors.bg, marginTop: -24, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8 },
  handle: { width: 36, height: 4, borderRadius: 4, backgroundColor: colors.ink[100], alignSelf: 'center', marginBottom: 4 },

  badge: { fontSize: 9, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  badgeVeg: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeSpicy: { backgroundColor: '#fee2e2', color: '#991b1b' },

  sectionTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: colors.ink[700], marginBottom: 12 },

  sizeChip: { flex: 1, paddingVertical: 12, borderRadius: radii.lg, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, alignItems: 'center' },
  sizeChipActive: { backgroundColor: colors.brand[500], borderColor: colors.brand[500], ...shadows.glow },
  sizeChipLabel: { fontWeight: '900', fontSize: 18, color: colors.ink[900] },
  sizeChipDelta: { fontSize: 11, color: colors.ink[500], marginTop: 2 },

  pillChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
  pillChipActive: { backgroundColor: colors.brand[500], borderColor: colors.brand[500] },
  pillChipText: { fontWeight: '700', color: colors.ink[700], fontSize: 13 },

  qtyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 22, fontWeight: '900' },

  bar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  barInner: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: { backgroundColor: colors.brand[500], paddingHorizontal: 22, paddingVertical: 14, borderRadius: radii.pill, ...shadows.glow },
  addBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
});
