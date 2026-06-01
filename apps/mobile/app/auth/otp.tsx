import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { colors, radii, shadows } from '../../src/lib/theme';

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <LinearGradient
          colors={['#0c0a09', '#7c2d12']}
          style={styles.hero}
        >
          <SafeAreaView edges={['top']}>
            <Text style={styles.eyebrow}>VERIFY</Text>
            <Text style={styles.title}>Enter the code</Text>
            <Text style={styles.subtitle}>Sent to {phone}</Text>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.card}>
          <TextInput
            style={styles.code}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="••••••"
            placeholderTextColor={colors.ink[300]}
            autoFocus
          />
          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={() => void verify()}
            disabled={busy || code.length !== 6}
            style={[styles.cta, (busy || code.length !== 6) && { opacity: 0.5 }]}
          >
            <Text style={styles.ctaText}>{busy ? 'Verifying…' : 'Verify'}</Text>
          </Pressable>

          <Pressable onPress={() => router.back()}>
            <Text style={styles.alt}>← Use a different phone</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  eyebrow: { color: 'rgba(255,255,255,0.85)', fontWeight: '900', letterSpacing: 3, fontSize: 11, marginTop: 8 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 12 },
  subtitle: { color: 'rgba(255,255,255,0.85)', marginTop: 8 },

  card: { backgroundColor: colors.card, marginHorizontal: 16, marginTop: -16, padding: 20, borderRadius: radii.xl, ...shadows.card },
  code: { fontSize: 36, fontWeight: '900', letterSpacing: 14, textAlign: 'center', paddingVertical: 16, color: colors.ink[900], borderBottomColor: colors.brand[500], borderBottomWidth: 2 },
  error: { color: '#991b1b', marginTop: 8, fontWeight: '600', textAlign: 'center' },
  cta: { backgroundColor: colors.brand[500], marginTop: 22, paddingVertical: 14, borderRadius: radii.pill, alignItems: 'center', ...shadows.glow },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  alt: { textAlign: 'center', color: colors.brand[600], marginTop: 16, fontWeight: '700' },
});
