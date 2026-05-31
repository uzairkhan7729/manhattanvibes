import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { api, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';

export default function OtpScreen(): JSX.Element {
  const router = useRouter();
  const auth = useAuth();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(): Promise<void> {
    if (!phone) return;
    setBusy(true); setError(null);
    try {
      const r = await api.post<{ user: { id: string }; accessToken: string; refreshToken: string }>(
        '/auth/otp/verify',
        { phone, code, purpose: 'login' },
      );
      auth.setSession(r.user.id, r.accessToken, r.refreshToken);
      router.replace('/(tabs)/profile');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Enter the 6-digit code</Text>
      <Text style={styles.subtitle}>Sent to {phone}</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        placeholder="••••••"
        autoFocus
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.cta, busy && { opacity: 0.5 }]} onPress={() => void verify()} disabled={busy || code.length !== 6}>
        <Text style={styles.ctaText}>{busy ? 'Verifying…' : 'Verify'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, backgroundColor: '#f8fafc' },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#475569', marginTop: 4, marginBottom: 24 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#cbd5e1', padding: 14, borderRadius: 8, fontSize: 28, textAlign: 'center', letterSpacing: 10 },
  error: { color: '#dc2626', marginTop: 8 },
  cta: { backgroundColor: '#f97316', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 18 },
  ctaText: { color: 'white', fontWeight: '700' },
});
