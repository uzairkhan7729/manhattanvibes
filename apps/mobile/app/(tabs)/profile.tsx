import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { colors, radii, shadows, type as t } from '../../src/lib/theme';

interface Me { id: string; fullName: { en: string; ar?: string }; phone: string; email?: string }

export default function ProfileScreen(): JSX.Element {
  const auth = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!auth.accessToken) return;
    api.get<Me>('/auth/me', { authorization: `Bearer ${auth.accessToken}` })
      .then(setMe)
      .catch(() => undefined);
  }, [auth.accessToken]);

  if (!auth.accessToken) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.signin}>
          <View style={styles.avatar}><Text style={{ fontSize: 30 }}>👤</Text></View>
          <Text style={[t.h1, { marginTop: 16 }]}>Not signed in</Text>
          <Text style={{ color: colors.ink[500], marginTop: 4, textAlign: 'center' }}>
            Sign in to see your orders, save addresses, and earn loyalty.
          </Text>
          <Pressable style={styles.cta} onPress={() => router.push('/auth/phone')}>
            <Text style={styles.ctaText}>Sign in with phone</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Guest = OTP-bootstrapped session with a placeholder name and no email.
  const isGuest = !!me && (me.fullName.en === 'Guest' || !me.fullName.en) && !me.email;
  const guestTag = (auth.userId ?? '').slice(-6).toUpperCase();
  const displayName = isGuest ? 'Guest' : me?.fullName.en ?? 'You';
  const initial = isGuest ? 'G' : (me?.fullName.en?.[0] ?? 'Y').toUpperCase();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Identity header */}
        <View style={styles.header}>
          <View style={[styles.avatar, isGuest && { backgroundColor: colors.ink[100] }]}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: isGuest ? colors.ink[500] : colors.brand[700] }}>
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[t.h1, { color: colors.ink[900], fontSize: 24 }]}>{displayName}</Text>
            <Text style={{ color: colors.ink[500] }}>{me?.phone ?? ''}</Text>
            {isGuest && (
              <Text style={styles.guestTag}>GUEST · {guestTag}</Text>
            )}
            {!isGuest && me?.email && (
              <Text style={{ color: colors.ink[500], fontSize: 12, marginTop: 2 }}>{me.email}</Text>
            )}
          </View>
        </View>

        {/* Guest CTA — claim the account */}
        {isGuest && (
          <View style={styles.guestCard}>
            <Text style={styles.guestCardTitle}>You're shopping as a guest</Text>
            <Text style={styles.guestCardBody}>
              Add your name and email so we can email receipts, save loyalty points, and recover this account on a new phone.
            </Text>
            <Pressable style={styles.guestCta} onPress={() => router.push('/auth/signup')}>
              <Text style={styles.guestCtaText}>Sign up & save</Text>
            </Pressable>
          </View>
        )}

        {/* Actions */}
        <Pressable style={styles.row} onPress={() => router.push('/orders')}>
          <View style={[styles.rowIcon, { backgroundColor: colors.brand[50] }]}>
            <Text style={{ fontSize: 22 }}>🧾</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>My orders</Text>
            <Text style={styles.rowSub}>Recent & past</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={() => router.push('/(tabs)/loyalty')}>
          <View style={[styles.rowIcon, { backgroundColor: '#fef3c7' }]}>
            <Text style={{ fontSize: 22 }}>⭐</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Loyalty</Text>
            <Text style={styles.rowSub}>Tier & points</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>

        {!isGuest && (
          <Pressable style={styles.row} onPress={() => router.push('/auth/signup')}>
            <View style={[styles.rowIcon, { backgroundColor: colors.ink[100] }]}>
              <Text style={{ fontSize: 22 }}>✏️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Edit profile</Text>
              <Text style={styles.rowSub}>Name, email</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        )}

        <Pressable onPress={() => auth.clear()} style={[styles.cta, { backgroundColor: '#fef2f2', marginTop: 24 }]}>
          <Text style={[styles.ctaText, { color: '#991b1b' }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  signin: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand[100], alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },

  guestTag: { color: colors.ink[500], fontWeight: '900', letterSpacing: 2, fontSize: 10, marginTop: 4 },

  cta: { backgroundColor: colors.brand[500], paddingHorizontal: 26, paddingVertical: 14, borderRadius: radii.pill, alignSelf: 'stretch', alignItems: 'center', ...shadows.glow },
  ctaText: { color: '#fff', fontWeight: '900' },

  guestCard: { marginTop: 22, padding: 18, backgroundColor: colors.card, borderRadius: radii.lg, borderColor: colors.brand[200], borderWidth: 1, ...shadows.card },
  guestCardTitle: { fontWeight: '900', fontSize: 16, color: colors.ink[900] },
  guestCardBody: { color: colors.ink[500], fontSize: 13, marginTop: 4, lineHeight: 18 },
  guestCta: { marginTop: 14, backgroundColor: colors.brand[500], paddingVertical: 12, borderRadius: radii.pill, alignItems: 'center', ...shadows.glow },
  guestCtaText: { color: '#fff', fontWeight: '900' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, backgroundColor: colors.card, borderRadius: radii.lg, marginTop: 10, ...shadows.card },
  rowIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontWeight: '900', color: colors.ink[900], fontSize: 15 },
  rowSub: { color: colors.ink[500], fontSize: 12, marginTop: 2 },
  chev: { fontSize: 22, color: colors.ink[300], fontWeight: '700' },
});
