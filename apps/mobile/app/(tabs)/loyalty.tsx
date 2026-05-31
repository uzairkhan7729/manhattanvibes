import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { fmtSAR } from '../../src/lib/format';

interface Loyalty { tier: string; pointsBalance: number; lifetimeSpendHalalas: number }

export default function LoyaltyScreen(): JSX.Element {
  const auth = useAuth();
  const [acc, setAcc] = useState<Loyalty | null>(null);

  useEffect(() => {
    if (!auth.accessToken) return;
    api.get<Loyalty>('/loyalty/me', { authorization: `Bearer ${auth.accessToken}` })
      .then(setAcc).catch(() => undefined);
  }, [auth.accessToken]);

  if (!auth.accessToken) {
    return <View style={styles.screen}><Text style={styles.title}>Sign in to view your loyalty balance</Text></View>;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.tier}>{(acc?.tier ?? '—').toUpperCase()}</Text>
        <Text style={styles.points}>{acc?.pointsBalance ?? 0}</Text>
        <Text style={styles.label}>points</Text>
        <Text style={styles.spend}>Lifetime spend: {fmtSAR(acc?.lifetimeSpendHalalas ?? 0)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  title: { textAlign: 'center', marginTop: 32, color: '#475569' },
  card: { backgroundColor: 'white', padding: 28, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  tier: { fontWeight: '700', color: '#c2410c', fontSize: 13, letterSpacing: 2 },
  points: { fontSize: 60, fontWeight: '800', color: '#0f172a', marginTop: 6 },
  label: { color: '#475569', fontSize: 14 },
  spend: { marginTop: 18, color: '#475569', fontSize: 12 },
});
