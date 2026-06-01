import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { fmtSAR } from '../../src/lib/format';
import { colors, radii, shadows, type as t } from '../../src/lib/theme';

interface Loyalty { tier: 'bronze' | 'silver' | 'gold' | 'platinum'; pointsBalance: number; lifetimeSpendHalalas: number }

const TIER_CONFIG = {
  bronze:   { label: 'BRONZE',   colors: ['#92400e', '#b45309', '#d97706'] as const, next: 'silver',   nextAt: 150_000 },
  silver:   { label: 'SILVER',   colors: ['#475569', '#64748b', '#94a3b8'] as const, next: 'gold',     nextAt: 400_000 },
  gold:     { label: 'GOLD',     colors: ['#b45309', '#d97706', '#f59e0b'] as const, next: 'platinum', nextAt: 1_000_000 },
  platinum: { label: 'PLATINUM', colors: ['#1e1b4b', '#3730a3', '#6366f1'] as const, next: null,       nextAt: 0 },
};

export default function LoyaltyScreen(): JSX.Element {
  const auth = useAuth();
  const router = useRouter();
  const [acc, setAcc] = useState<Loyalty | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.accessToken) return;
    api.get<Loyalty>('/loyalty/me', { authorization: `Bearer ${auth.accessToken}` })
      .then(setAcc)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load'));
  }, [auth.accessToken]);

  if (!auth.accessToken) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <Text style={[t.h1, { marginTop: 24, paddingHorizontal: 16 }]}>Rewards</Text>
        <View style={styles.signin}>
          <Text style={{ fontSize: 36 }}>⭐</Text>
          <Text style={[t.h2, { marginTop: 12, textAlign: 'center' }]}>Earn on every order</Text>
          <Text style={{ color: colors.ink[500], marginTop: 8, textAlign: 'center' }}>
            Sign in to start earning points. Redeem at checkout.
          </Text>
          <Pressable style={styles.cta} onPress={() => router.push('/auth/phone')}>
            <Text style={styles.ctaText}>Sign in with phone</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const cfg = acc ? TIER_CONFIG[acc.tier] : TIER_CONFIG.bronze;
  const progressRatio = acc && cfg.next ? Math.min(1, acc.lifetimeSpendHalalas / cfg.nextAt) : 1;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={[t.h1, { color: colors.ink[900] }]}>Rewards</Text>
        <Text style={{ color: colors.ink[500], marginTop: 2 }}>Your loyalty card</Text>

        <LinearGradient
          colors={cfg.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.cardTop}>
            <Text style={styles.cardBrand}>MANHATTAN VIBES</Text>
            <Text style={styles.cardTier}>{cfg.label}</Text>
          </View>
          <Text style={styles.points}>{acc?.pointsBalance ?? 0}</Text>
          <Text style={styles.pointsLabel}>POINTS</Text>

          {cfg.next ? (
            <View style={{ marginTop: 16 }}>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {fmtSAR(cfg.nextAt - (acc?.lifetimeSpendHalalas ?? 0))} more spend to {cfg.next}
              </Text>
            </View>
          ) : (
            <Text style={styles.progressText}>You're at the top tier ✨</Text>
          )}
        </LinearGradient>

        <View style={styles.stat}>
          <Text style={{ color: colors.ink[500], fontSize: 11, letterSpacing: 1.5, fontWeight: '700' }}>LIFETIME SPEND</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink[900] }}>
            {fmtSAR(acc?.lifetimeSpendHalalas ?? 0)}
          </Text>
        </View>

        <View style={styles.howTo}>
          <Text style={[t.h2, { marginBottom: 12 }]}>How it works</Text>
          <Step icon="🍕" title="Order & enjoy" desc="Earn 1 point per SAR spent on every paid order." />
          <Step icon="🎁" title="Redeem at checkout" desc="100 points = 1 SAR off. Up to 50% of your order." />
          <Step icon="🎂" title="Birthday bonus" desc="Free dessert on your birthday — auto-issued." />
          <Step icon="🤝" title="Referral bonus" desc="You and your friend each get 50 points on their first order." />
        </View>

        {error && <Text style={{ color: '#991b1b', marginTop: 16 }}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({ icon, title, desc }: { icon: string; title: string; desc: string }): JSX.Element {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIcon}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  signin: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  cta: { backgroundColor: colors.brand[500], marginTop: 24, paddingHorizontal: 26, paddingVertical: 14, borderRadius: radii.pill, ...shadows.glow },
  ctaText: { color: '#fff', fontWeight: '900' },

  card: { padding: 24, borderRadius: radii.xl, marginTop: 20, ...shadows.glow, minHeight: 230 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBrand: { color: 'rgba(255,255,255,0.85)', fontWeight: '900', letterSpacing: 3, fontSize: 11 },
  cardTier: { color: '#fff', fontWeight: '900', letterSpacing: 4, fontSize: 12 },
  points: { color: '#fff', fontSize: 64, fontWeight: '900', marginTop: 24 },
  pointsLabel: { color: 'rgba(255,255,255,0.8)', fontWeight: '900', letterSpacing: 3, fontSize: 11, marginTop: -4 },
  progressBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  progressText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 8, fontWeight: '600' },

  stat: { marginTop: 18, padding: 16, backgroundColor: colors.card, borderRadius: radii.lg, ...shadows.card },

  howTo: { marginTop: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: colors.card, borderRadius: radii.lg, marginBottom: 10, ...shadows.card },
  stepIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.brand[50], alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 14, fontWeight: '800', color: colors.ink[900] },
  stepDesc: { fontSize: 12, color: colors.ink[500], marginTop: 2 },
});
