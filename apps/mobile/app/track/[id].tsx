import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

interface Order { _id: string; orderNumber: string; state: string; type: string; pricing: { total: number }; createdAt: string }

export default function TrackScreen(): JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!id || !auth.accessToken) return;
    const fetchOnce = (): void => {
      api.get<Order>(`/orders/${id}`, { authorization: `Bearer ${auth.accessToken!}` })
        .then(setOrder)
        .catch(() => undefined);
    };
    fetchOnce();
    const poll = setInterval(fetchOnce, 5_000);

    // Socket.IO live updates
    let sock: Socket | null = null;
    try {
      sock = io(`${getApiBase()}/tracking`, { transports: ['websocket'], reconnection: true });
      sock.on('connect', () => sock?.emit('join', { orderId: id }));
      sock.on('order.state_changed', () => fetchOnce());
    } catch { /* fall back to polling only */ }

    return () => { clearInterval(poll); sock?.disconnect(); };
  }, [id, auth.accessToken]);

  // Pulsing animation for the in-progress step
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.ink[500] }}>Loading…</Text>
      </View>
    );
  }

  const visible = order.type === 'delivery' ? STEPS : STEPS.filter((s) => s.key !== 'OUT_FOR_DELIVERY');
  const currentIdx = visible.findIndex((s) => s.key === order.state);
  const isWaiting = order.state === 'CREATED';
  const isCancelled = order.state === 'CANCELLED';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header gradient */}
      <LinearGradient
        colors={['#0c0a09', '#7c2d12']}
        style={styles.heroGrad}
      >
        <SafeAreaView edges={['top']} style={styles.heroInner}>
          <Text style={styles.eyebrow}>ORDER {order.orderNumber}</Text>
          <Text style={styles.title}>
            {isWaiting ? 'Waiting for the kitchen…' :
             isCancelled ? 'Order cancelled' :
             currentIdx === visible.length - 1 ? 'Enjoy! 🎉' :
             visible[currentIdx]?.label ?? 'In progress'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{order.type.toUpperCase()}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)' }}>·</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{fmtSAR(order.pricing.total)}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.card}>
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
          const active = i === currentIdx && !isCancelled;
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

      <Text style={styles.footer}>Updates live — no need to refresh.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroGrad: { paddingBottom: 30, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroInner: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  eyebrow: { color: 'rgba(255,255,255,0.85)', fontWeight: '900', letterSpacing: 3, fontSize: 11 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 8, letterSpacing: -0.5 },

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
