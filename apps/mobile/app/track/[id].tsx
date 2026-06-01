import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, type Socket } from 'socket.io-client';

import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { getApiBase } from '../../src/lib/config';
import { fmtSAR } from '../../src/lib/format';
import { colors, radii, shadows, type as t } from '../../src/lib/theme';

const STEPS: Array<{ key: string; label: string; icon: string }> = [
  { key: 'CONFIRMED',        label: 'Confirmed',         icon: '✓' },
  { key: 'PREPARING',        label: 'Preparing',         icon: '👨‍🍳' },
  { key: 'BAKING',           label: 'Baking',            icon: '🔥' },
  { key: 'READY',            label: 'Ready',             icon: '📦' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery',  icon: '🛵' },
  { key: 'DELIVERED',        label: 'Delivered',         icon: '🎉' },
];

const PREP_TARGET_MIN = 30;
const PREP_TARGET_MS  = PREP_TARGET_MIN * 60 * 1000;

interface Transition { from: string; to: string; ts: string }
interface Order {
  _id: string; orderNumber: string; state: string; type: string;
  pricing: { total: number }; createdAt: string;
  audit?: { transitions?: Transition[] };
}

/**
 * Find when the order was first CONFIRMED (kitchen accepted). Falls back to
 * createdAt if there's no transition record (e.g. seed data).
 */
function confirmedAtMs(order: Order): number {
  const tr = order.audit?.transitions?.find((x) => x.to === 'CONFIRMED');
  if (tr?.ts) return new Date(tr.ts).getTime();
  return new Date(order.createdAt).getTime();
}

export default function TrackScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [now, setNow] = useState(Date.now());
  const pulse = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id || !auth.accessToken) return;
    const fetchOnce = (): void => {
      api.get<Order>(`/orders/${id}`, { authorization: `Bearer ${auth.accessToken!}` })
        .then(setOrder)
        .catch(() => undefined);
    };
    fetchOnce();
    const poll = setInterval(fetchOnce, 5_000);

    let sock: Socket | null = null;
    try {
      sock = io(`${getApiBase()}/tracking`, { transports: ['websocket'], reconnection: true });
      sock.on('connect', () => sock?.emit('join', { orderId: id }));
      sock.on('order.state_changed', () => fetchOnce());
    } catch { /* fall back to polling */ }

    return () => { clearInterval(poll); sock?.disconnect(); };
  }, [id, auth.accessToken]);

  // 1s ticker for the live countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  // Smoothly animate the progress bar width to its computed target
  const progress = useMemo(() => {
    if (!order) return 0;
    const isPostKitchen = ['READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED'].includes(order.state);
    if (isPostKitchen) return 1;
    if (order.state === 'CREATED' || order.state === 'CANCELLED') return 0;
    const elapsed = now - confirmedAtMs(order);
    return Math.max(0, Math.min(1, elapsed / PREP_TARGET_MS));
  }, [order, now]);

  useEffect(() => {
    Animated.timing(barAnim, { toValue: progress, duration: 600, useNativeDriver: false }).start();
  }, [progress, barAnim]);

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.ink[500] }}>Loading…</Text>
      </View>
    );
  }

  const visible = order.type === 'delivery' ? STEPS : STEPS.filter((s) => s.key !== 'OUT_FOR_DELIVERY');
  const isWaiting = order.state === 'CREATED';
  const isCancelled = order.state === 'CANCELLED';
  const isComplete = order.state === 'CLOSED' || order.state === 'DELIVERED';
  const currentIdx = isComplete ? visible.length - 1 : visible.findIndex((s) => s.key === order.state);

  // ETA text
  const showEta = !isWaiting && !isCancelled && !isComplete && order.state !== 'READY';
  const minsLeft = Math.max(0, Math.ceil((confirmedAtMs(order) + PREP_TARGET_MS - now) / 60000));
  const etaLabel = (() => {
    if (order.state === 'READY') return 'Ready for pickup';
    if (order.state === 'OUT_FOR_DELIVERY') return 'On the way';
    if (minsLeft === 0) return 'Almost ready';
    if (minsLeft === 1) return 'Ready in ~1 min';
    return `Ready in ~${minsLeft} min`;
  })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={isCancelled ? ['#0c0a09', '#7f1d1d'] : ['#0c0a09', '#7c2d12']}
        style={styles.heroGrad}
      >
        <SafeAreaView edges={['top']} style={styles.heroInner}>
          <Text style={styles.eyebrow}>ORDER {order.orderNumber}</Text>
          <Text style={styles.title}>
            {isWaiting ? 'Waiting for the kitchen…' :
             isCancelled ? 'Order cancelled' :
             isComplete
               ? (order.type === 'delivery' ? 'Delivered  🎉' : 'Enjoy!  🎉')
               : visible[currentIdx]?.label ?? 'In progress'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{order.type.toUpperCase()}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)' }}>·</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{fmtSAR(order.pricing.total)}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* ETA card */}
      {showEta && (
        <View style={styles.etaCard}>
          <View style={styles.etaTop}>
            <View>
              <Text style={styles.etaEyebrow}>YOUR ORDER</Text>
              <Text style={styles.etaLabel}>{etaLabel}</Text>
            </View>
            <View style={styles.etaMins}>
              <Text style={styles.etaMinsNum}>{minsLeft}</Text>
              <Text style={styles.etaMinsUnit}>min</Text>
            </View>
          </View>
          <View style={styles.barBg}>
            <Animated.View
              style={[
                styles.barFill,
                {
                  width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
              ]}
            >
              <LinearGradient
                colors={[colors.brand[400], colors.brand[600]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
          <View style={styles.barTicks}>
            <Text style={styles.barTickText}>Confirmed</Text>
            <Text style={styles.barTickText}>~30 min target</Text>
          </View>
        </View>
      )}

      <View style={[styles.card, showEta ? { marginTop: 12 } : undefined]}>
        {isWaiting && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Restaurant hasn't accepted yet — usually takes &lt;1 min.</Text>
          </View>
        )}
        {isCancelled && (
          <View style={[styles.banner, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
            <Text style={[styles.bannerText, { color: '#991b1b' }]}>
              This order was cancelled. If charged, refund arrives in 3–5 business days.
            </Text>
          </View>
        )}

        {visible.map((s, i) => {
          const reached = i <= currentIdx;
          const active = i === currentIdx && !isCancelled && !isComplete;
          return (
            <View key={s.key} style={styles.step}>
              <View style={styles.stepLeft}>
                <Animated.View
                  style={[
                    styles.dot,
                    reached && styles.dotReached,
                    active && {
                      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
                    },
                  ]}
                >
                  <Text style={{ fontSize: 16 }}>{reached ? s.icon : '·'}</Text>
                </Animated.View>
                {i < visible.length - 1 && <View style={[styles.line, reached && styles.lineReached]} />}
              </View>
              <View style={{ flex: 1, paddingBottom: 28 }}>
                <Text style={[styles.stepLabel, reached && { color: colors.ink[900] }]}>{s.label}</Text>
                {active && <Text style={styles.stepHint}>In progress…</Text>}
              </View>
            </View>
          );
        })}
      </View>

      <Text style={styles.footer}>
        {isComplete ? 'Thanks for ordering with Manhattan Vibes ❤️' :
         isCancelled ? '' :
         'Updates live — no need to refresh.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroGrad: { paddingBottom: 30, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroInner: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  eyebrow: { color: 'rgba(255,255,255,0.85)', fontWeight: '900', letterSpacing: 3, fontSize: 11 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 8, letterSpacing: -0.5 },

  // ETA card
  etaCard: { marginHorizontal: 16, marginTop: -18, backgroundColor: colors.card, borderRadius: radii.xl, padding: 18, ...shadows.card },
  etaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  etaEyebrow: { color: colors.brand[600], fontWeight: '900', letterSpacing: 2, fontSize: 10 },
  etaLabel: { fontSize: 18, fontWeight: '900', color: colors.ink[900], marginTop: 4 },
  etaMins: { alignItems: 'flex-end' },
  etaMinsNum: { fontSize: 36, fontWeight: '900', color: colors.brand[600], lineHeight: 36 },
  etaMinsUnit: { fontSize: 11, color: colors.ink[500], fontWeight: '700', letterSpacing: 1.5 },
  barBg: { height: 10, borderRadius: 5, backgroundColor: colors.ink[100], overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5, overflow: 'hidden' },
  barTicks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  barTickText: { fontSize: 10, color: colors.ink[500], fontWeight: '700' },

  card: { marginHorizontal: 16, marginTop: -18, backgroundColor: colors.card, borderRadius: radii.xl, padding: 20, ...shadows.card },
  banner: { backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, padding: 12, borderRadius: radii.md, marginBottom: 16 },
  bannerText: { color: '#92400e', fontSize: 12 },

  step: { flexDirection: 'row', gap: 14 },
  stepLeft: { alignItems: 'center', width: 36 },
  dot: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ink[100], alignItems: 'center', justifyContent: 'center' },
  dotReached: { backgroundColor: colors.brand[500], ...shadows.glow },
  line: { flex: 1, width: 2, backgroundColor: colors.ink[100], minHeight: 24 },
  lineReached: { backgroundColor: colors.brand[500] },
  stepLabel: { fontSize: 14, fontWeight: '700', color: colors.ink[300], marginTop: 8 },
  stepHint: { fontSize: 11, color: colors.brand[600], marginTop: 2, fontWeight: '700' },

  footer: { textAlign: 'center', color: colors.ink[500], fontSize: 12, marginTop: 16 },
});
