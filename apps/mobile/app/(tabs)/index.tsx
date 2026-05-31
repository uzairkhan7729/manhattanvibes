import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '../../src/lib/api';

interface Branch { _id: string; code: string; name: { en: string }; address: { city: string; district: string }; status: string }

export default function HomeScreen(): JSX.Element {
  const [branches, setBranches] = useState<Branch[]>([]);
  useEffect(() => { api.get<{ items: Branch[] }>('/branches').then((r) => setBranches(r.items)).catch(() => undefined); }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Manhattan-style pizza,{'\n'}delivered hot.</Text>
        <Text style={styles.heroSub}>Order in seconds. Track in real time.</Text>
        <Link href="/menu" style={styles.cta}><Text style={styles.ctaText}>Browse menu</Text></Link>
      </View>

      <Text style={styles.h2}>Locations ({branches.length})</Text>
      {branches.map((b) => (
        <View key={b._id} style={styles.card}>
          <Text style={styles.cardCode}>{b.code}</Text>
          <Text style={styles.cardTitle}>{b.name.en}</Text>
          <Text style={styles.cardMeta}>{b.address.district}, {b.address.city}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  hero: { backgroundColor: '#fff7ed', padding: 20, borderRadius: 12, marginBottom: 24 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  heroSub: { fontSize: 14, color: '#475569', marginTop: 6 },
  cta: { backgroundColor: '#f97316', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, marginTop: 14, alignSelf: 'flex-start' },
  ctaText: { color: 'white', fontWeight: '600' },
  h2: { fontSize: 18, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  card: { backgroundColor: 'white', padding: 14, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  cardCode: { fontSize: 11, fontWeight: '700', color: '#c2410c' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  cardMeta: { color: '#64748b', fontSize: 13, marginTop: 2 },
});
