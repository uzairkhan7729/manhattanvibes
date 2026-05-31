import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { api, ApiError } from '../../src/lib/api';

export default function PhoneScreen(): JSX.Element {
  const router = useRouter();
  const [phone, setPhone] = useState('+966555000099');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(): Promise<void> {
    setBusy(true); setError(null);
    try {
      await api.post('/auth/otp/request', { phone, purpose: 'login' });
      router.push({ pathname: '/auth/otp', params: { phone } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Sign in with phone</Text>
      <Text style={styles.subtitle}>We'll text you a code.</Text>
      <TextInput
        style={styles.input}
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        placeholder="+966..."
        autoFocus
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.cta, busy && { opacity: 0.5 }]} onPress={() => void send()} disabled={busy}>
        <Text style={styles.ctaText}>{busy ? 'Sending…' : 'Send code'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, backgroundColor: '#f8fafc' },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#475569', marginTop: 4, marginBottom: 24 },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#cbd5e1', padding: 14, borderRadius: 8, fontSize: 16 },
  error: { color: '#dc2626', marginTop: 8 },
  cta: { backgroundColor: '#f97316', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 18 },
  ctaText: { color: 'white', fontWeight: '700' },
});
