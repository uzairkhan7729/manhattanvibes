import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '../../src/lib/api';
import { useCart } from '../../src/lib/cart';
import { fmtSAR } from '../../src/lib/format';
import { CATEGORY_IMAGES, productImage } from '../../src/lib/images';
import { colors, radii, shadows, type as t } from '../../src/lib/theme';

interface Category { _id: string; name: { en: string }; slug: string; displayOrder: number }
interface Product {
  id: string; sku: string; name: { en: string }; description?: { en?: string };
  effectivePrice: number; isAvailable: boolean;
  type: 'simple' | 'configurable' | 'combo';
  categoryId: string; isVeg?: boolean; spicyLevel?: number;
}

export default function MenuScreen(): JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const cart = useCart();
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useRef(new Animated.Value(0)).current;
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [c, p] = await Promise.all([
          api.get<{ items: Category[] }>('/catalog/categories'),
          api.get<{ items: Product[] }>(`/catalog/products?limit=200${cart.branchId ? `&branchId=${cart.branchId}` : ''}`),
        ]);
        const sorted = c.items.sort((a, b) => a.displayOrder - b.displayOrder);
        setCats(sorted);
        setProducts(p.items);
        const initial = params.category
          ? sorted.find((x) => x.slug === params.category)?._id ?? sorted[0]?._id ?? ''
          : sorted[0]?._id ?? '';
        setActiveCat(initial);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load menu');
      } finally {
        setLoading(false);
      }
    })();
  }, [cart.branchId, params.category]);

  const items = useMemo(() => {
    let xs = products;
    if (activeCat) xs = xs.filter((p) => p.categoryId === activeCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      xs = xs.filter((p) => p.name.en.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    return xs;
  }, [products, activeCat, search]);

  function add(p: Product): void {
    if (p.type !== 'simple') {
      router.push(`/product/${p.id}`);
      return;
    }
    cart.add({ productId: p.id, productSku: p.sku, productName: p.name.en, qty: 1, estimatedUnitPrice: p.effectivePrice });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(`${p.name.en} added`);
  }

  function showToast(msg: string): void {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toast, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toast, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }

  const activeCategory = cats.find((c) => c._id === activeCat);
  const heroImage = activeCategory ? CATEGORY_IMAGES[activeCategory.slug] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View style={styles.header}>
          <Text style={styles.title}>Menu</Text>
          <Text style={styles.subtitle}>{products.length} dishes · prices include 15% VAT</Text>

          <View style={styles.searchWrap}>
            <Text style={{ fontSize: 14, paddingLeft: 12 }}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search pizza, burgers…"
              placeholderTextColor={colors.ink[300]}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
          style={styles.catBar}
        >
          {cats.map((c) => {
            const active = c._id === activeCat;
            return (
              <Pressable
                key={c._id}
                onPress={() => { setActiveCat(c._id); void Haptics.selectionAsync(); }}
                style={[styles.catChip, active && styles.catChipActive]}
              >
                <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{c.name.en}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {error && (
        <View style={styles.errBanner}>
          <Text style={{ color: '#991b1b', fontWeight: '700' }}>{error}</Text>
          <Text style={{ color: '#7f1d1d', fontSize: 11, marginTop: 4 }}>
            Pull-down to retry or check that the API is reachable.
          </Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 100, gap: 12 }}
        ListHeaderComponent={heroImage ? (
          <View style={styles.catHero}>
            <Image source={{ uri: heroImage }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
            <View style={styles.catHeroOverlay} />
            <Text style={styles.catHeroText}>{activeCategory?.name.en}</Text>
          </View>
        ) : null}
        renderItem={({ item: p }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/product/${p.id}`)}
            android_ripple={{ color: colors.ink[100] }}
          >
            <Image source={{ uri: productImage(p.sku) }} style={styles.rowImg} contentFit="cover" transition={250} />
            <View style={styles.rowBody}>
              <View style={styles.badgeRow}>
                {p.isVeg && <Text style={[styles.badge, styles.badgeVeg]}>VEG</Text>}
                {p.spicyLevel && p.spicyLevel > 0 ? <Text style={[styles.badge, styles.badgeSpicy]}>🌶 SPICY</Text> : null}
                {p.type === 'configurable' && <Text style={[styles.badge, styles.badgeBuild]}>BUILD</Text>}
              </View>
              <Text style={styles.rowTitle} numberOfLines={2}>{p.name.en}</Text>
              {p.description?.en && <Text style={styles.rowDesc} numberOfLines={1}>{p.description.en}</Text>}
              <View style={styles.rowFoot}>
                <Text style={styles.rowPrice}>{fmtSAR(p.effectivePrice)}</Text>
                <Pressable
                  onPress={() => add(p)}
                  hitSlop={8}
                  style={styles.rowAdd}
                >
                  <Text style={styles.rowAddText}>{p.type === 'simple' ? '+ Add' : 'Customize'}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: colors.ink[500] }}>Loading menu…</Text>
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 28 }}>🍽️</Text>
              <Text style={{ color: colors.ink[500], marginTop: 8 }}>Nothing matches that search</Text>
            </View>
          )
        }
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          {
            opacity: toast,
            transform: [{ translateY: toast.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
          },
        ]}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>✓  {toastMsg}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  title: { ...t.h1, color: colors.ink[900] },
  subtitle: { color: colors.ink[500], marginTop: 2, fontSize: 12 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 6,
    backgroundColor: colors.bg, borderRadius: radii.pill, borderColor: colors.border, borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingLeft: 8, paddingRight: 14, color: colors.ink[900] },
  catBar: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 },
  catChipActive: { backgroundColor: colors.brand[500], borderColor: colors.brand[500] },
  catChipText: { fontWeight: '700', color: colors.ink[700] },
  catChipTextActive: { color: '#fff' },

  errBanner: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, margin: 14, padding: 14, borderRadius: radii.md },

  catHero: { height: 130, borderRadius: radii.lg, overflow: 'hidden', marginBottom: 14, justifyContent: 'flex-end', padding: 16 },
  catHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,10,9,0.35)' },
  catHeroText: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },

  row: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radii.lg, ...shadows.card, overflow: 'hidden' },
  rowImg: { width: 116, height: 116, backgroundColor: colors.ink[100] },
  rowBody: { flex: 1, padding: 12 },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  badge: { fontSize: 9, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  badgeVeg: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeSpicy: { backgroundColor: '#fee2e2', color: '#991b1b' },
  badgeBuild: { backgroundColor: colors.brand[50], color: colors.brand[700] },
  rowTitle: { fontWeight: '800', color: colors.ink[900], fontSize: 15 },
  rowDesc: { color: colors.ink[500], fontSize: 12, marginTop: 2 },
  rowFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8 },
  rowPrice: { fontSize: 16, fontWeight: '900', color: colors.ink[900] },
  rowAdd: { backgroundColor: colors.brand[500], paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill },
  rowAddText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  toast: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: colors.ink[900], paddingHorizontal: 18, paddingVertical: 10, borderRadius: radii.pill, ...shadows.glow },
});
