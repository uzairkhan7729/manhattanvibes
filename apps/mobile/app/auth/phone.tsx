import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '../../src/lib/api';
import { colors, radii, shadows, type as t } from '../../src/lib/theme';

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <LinearGradient
          colors={['#0c0a09', '#7c2d12']}
          style={styles.hero}
        >
          <SafeAreaView edges={['top']}>
            <Text style={styles.eyebrow}>SIGN IN</Text>
            <Text style={styles.title}>What's your phone number?</Text>
            <Text style={styles.subtitle}>We'll send a 6-digit code via SMS.</Text>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Phone number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoFocus
            placeholder="+966555..."
            placeholderTextColor={colors.ink[300]}
          />
          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable onPress={() => void send()} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
            <Text style={styles.ctaText}>{busy ? 'Sending…' : 'Continue'}</Text>
          </Pressable>

          <Text style={styles.legal}>
            By continuing you agree to our Terms and Privacy Policy.
          </Text>
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
  fieldLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: colors.ink[500] },
  input: { fontSize: 22, fontWeight: '700', color: colors.ink[900], paddingVertical: 10, borderBottomColor: colors.brand[500], borderBottomWidth: 2, marginTop: 4 },
  error: { color: '#991b1b', marginTop: 8, fontWeight: '600' },
  cta: { backgroundColor: colors.brand[500], marginTop: 22, paddingVertical: 14, borderRadius: radii.pill, alignItems: 'center', ...shadows.glow },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  legal: { color: colors.ink[500], fontSize: 11, marginTop: 14, textAlign: 'center' },
});
