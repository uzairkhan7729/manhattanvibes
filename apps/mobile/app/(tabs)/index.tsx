import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../src/lib/api';
import { useCart } from '../../src/lib/cart';
import { fmtSAR } from '../../src/lib/format';
import { HERO, productImage } from '../../src/lib/images';
import { colors, radii, shadows, type as t } from '../../src/lib/theme';

interface Branch { _id: string; code: string; name: { en: string }; address: { city: string; district: string }; status: string }
interface Category { _id: string; name: { en: string }; slug: string; displayOrder: number }
interface Product { id: string; sku: string; name: { en: string }; effectivePrice: number; isAvailable: boolean; type: string; categoryId: string }

const FEATURED_SKUS = ['PIZ-MV-CLASSIC', 'BUR-MV-DOUBLE', 'PIZ-MV-VEGGIE', 'SID-WINGS'];
const CAT_EMOJI: Record<string, string> = { pizza: '🍕', burgers: '🍔', salads: '🥗', sides: '🍟', drinks: '🥤', desserts: '🍰' };
const W = Dimensions.get('window').width;

export default function HomeScreen(): JSX.Element {
  const router = useRouter();
  const cart = useCart();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [b, c, p] = await Promise.all([
          api.get<{ items: Branch[] }>('/branches'),
          api.get<{ items: Category[] }>('/catalog/categories'),
          api.get<{ items: Product[] }>('/catalog/products?limit=200'),
        ]);
        const active = b.items.find((x) => x.status === 'active') ?? b.items[0];
        if (active) { setBranch(active); cart.setBranch(active._id); }
        setCategories(c.items.sort((x, y) => x.displayOrder - y.displayOrder));
        setProducts(p.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const featured = FEATURED_SKUS.map((sku) => products.find((p) => p.sku === sku)).filter(Boolean) as Product[];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={{ height: 380 }}>
          <Image source={{ uri: HERO.pizza }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
          <LinearGradient
            colors={['rgba(12,10,9,0.1)', 'rgba(12,10,9,0.7)', 'rgba(12,10,9,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={['top']} style={styles.heroInner}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroBrand}>MANHATTAN VIBES</Text>
                <Text style={styles.heroLoc}>
                  📍 {branch?.name.en ?? 'Pick branch'}
                </Text>
              </View>
            </View>
            <View style={{ flex: 1 }} />
            <View style={styles.heroBottom}>
              <Text style={styles.heroTagline}>Hungry?</Text>
              <Text style={styles.heroTitle}>
                Hand-tossed pizza,{'\n'}
                <Text style={{ color: colors.brand[400] }}>delivered hot.</Text>
              </Text>
              <Pressable
                style={styles.heroCta}
                onPress={() => router.push('/menu')}
              >
                <Text style={styles.heroCtaText}>Order now  →</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Couldn't reach the kitchen</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Text style={styles.errorHint}>Make sure your phone and dev laptop are on the same Wi-Fi network.</Text>
          </View>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Text style={t.h2}>What are you craving?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
            >
              {categories.map((c) => (
                <Pressable
                  key={c._id}
                  style={styles.catCard}
                  onPress={() => router.push(`/menu?category=${c.slug}`)}
                >
                  <Text style={{ fontSize: 30 }}>{CAT_EMOJI[c.slug] ?? '🍽️'}</Text>
                  <Text style={styles.catLabel}>{c.name.en}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Special offer banner */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <Pressable style={styles.offerCard} onPress={() => router.push('/menu')}>
            <Image source={{ uri: HERO.burger }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={['rgba(234,88,12,0.85)', 'rgba(124,45,18,0.95)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.offerContent}>
              <Text style={styles.offerBadge}>FAMILY FEAST</Text>
              <Text style={styles.offerTitle}>2 Pizzas + sides{'\n'}79 SAR</Text>
              <Text style={styles.offerCta}>Order now  →</Text>
            </View>
          </Pressable>
        </View>

        {/* Featured */}
        {featured.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Text style={styles.eyebrow}>BEST SELLERS</Text>
                <Text style={t.h2}>Most loved this week</Text>
              </View>
              <Pressable onPress={() => router.push('/menu')}>
                <Text style={{ color: colors.brand[600], fontWeight: '700' }}>See all</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 14 }}
            >
              {featured.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.featuredCard}
                  onPress={() => router.push(`/product/${p.id}`)}
                >
                  <Image source={{ uri: productImage(p.sku) }} style={styles.featuredImg} contentFit="cover" transition={300} />
                  <View style={styles.featuredBody}>
                    <Text style={styles.featuredTitle} numberOfLines={2}>{p.name.en}</Text>
                    <View style={styles.featuredRow}>
                      <Text style={styles.featuredPrice}>{fmtSAR(p.effectivePrice)}</Text>
                      <View style={styles.addBtn}>
                        <Text style={{ color: '#fff', fontWeight: '900' }}>+</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Why us */}
        <View style={styles.whyStrip}>
          <View style={styles.whyItem}>
            <Text style={{ fontSize: 22 }}>⏱️</Text>
            <Text style={styles.whyTitle}>&lt; 12 min</Text>
            <Text style={styles.whySub}>kitchen time</Text>
          </View>
          <View style={styles.whyItem}>
            <Text style={{ fontSize: 22 }}>🚀</Text>
            <Text style={styles.whyTitle}>Free</Text>
            <Text style={styles.whySub}>delivery &gt;75 SAR</Text>
          </View>
          <View style={styles.whyItem}>
            <Text style={{ fontSize: 22 }}>⭐</Text>
            <Text style={styles.whyTitle}>4.9</Text>
            <Text style={styles.whySub}>app rating</Text>
          </View>
        </View>

        {loading && (
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ color: colors.ink[500] }}>Loading menu…</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroInner: { flex: 1, paddingHorizontal: 16 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  heroBrand: { color: '#fff', fontWeight: '900', letterSpacing: 3, fontSize: 11 },
  heroLoc: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },
  heroBottom: { paddingBottom: 24 },
  heroTagline: { color: colors.brand[300], fontWeight: '900', letterSpacing: 4, fontSize: 11, marginBottom: 6 },
  heroTitle: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1, lineHeight: 38 },
  heroCta: { backgroundColor: colors.brand[500], alignSelf: 'flex-start', marginTop: 18, paddingVertical: 14, paddingHorizontal: 26, borderRadius: radii.pill, ...shadows.glow },
  heroCtaText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  errorBanner: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, margin: 16, padding: 14, borderRadius: radii.lg },
  errorTitle: { color: '#991b1b', fontWeight: '800', fontSize: 14 },
  errorBody: { color: '#7f1d1d', fontSize: 12, marginTop: 4, fontFamily: 'monospace' },
  errorHint: { color: '#7f1d1d', fontSize: 11, marginTop: 6 },

  eyebrow: { color: colors.brand[600], fontWeight: '900', letterSpacing: 2, fontSize: 10, marginBottom: 4 },

  catCard: {
    width: 86, height: 96, backgroundColor: colors.card, borderRadius: radii.lg,
    alignItems: 'center', justifyContent: 'center', gap: 6, ...shadows.card,
  },
  catLabel: { fontSize: 12, fontWeight: '700', color: colors.ink[700] },

  offerCard: {
    height: 160, borderRadius: radii.xl, overflow: 'hidden', ...shadows.glow,
  },
  offerContent: { flex: 1, padding: 20, justifyContent: 'flex-end' },
  offerBadge: { color: '#fff', fontWeight: '900', letterSpacing: 2.5, fontSize: 10, marginBottom: 8 },
  offerTitle: { color: '#fff', fontSize: 24, fontWeight: '900', lineHeight: 28 },
  offerCta: { color: '#fff', fontWeight: '700', marginTop: 8 },

  featuredCard: { width: W * 0.55, backgroundColor: colors.card, borderRadius: radii.lg, overflow: 'hidden', ...shadows.card },
  featuredImg: { width: '100%', height: 130, backgroundColor: colors.ink[100] },
  featuredBody: { padding: 12, gap: 8 },
  featuredTitle: { fontSize: 14, fontWeight: '700', color: colors.ink[900] },
  featuredRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featuredPrice: { fontSize: 15, fontWeight: '900', color: colors.ink[900] },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand[500], alignItems: 'center', justifyContent: 'center', ...shadows.glow },

  whyStrip: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, padding: 18, backgroundColor: colors.card, borderRadius: radii.xl, ...shadows.card },
  whyItem: { flex: 1, alignItems: 'center', gap: 4 },
  whyTitle: { fontSize: 14, fontWeight: '800', color: colors.ink[900] },
  whySub: { fontSize: 11, color: colors.ink[500] },
});
