import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { colors, radii, shadows } from '../../src/lib/theme';

interface Me { id: string; fullName: { en: string; ar?: string }; phone: string; email?: string }

export default function SignupScreen(): JSX.Element {
  const router = useRouter();
  const auth = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!auth.accessToken) return;
    api.get<Me>('/auth/me', { authorization: `Bearer ${auth.accessToken}` })
      .then((m) => {
        setMe(m);
        if (m.fullName.en && m.fullName.en !== 'Guest') setFullName(m.fullName.en);
        if (m.email) setEmail(m.email);
      })
      .catch(() => undefined);
  }, [auth.accessToken]);

  async function save(): Promise<void> {
    if (!auth.userId || !auth.accessToken) return;
    setBusy(true); setError(null);
    try {
      const { getApiBase } = await import('../../src/lib/config');
      const r = await fetch(`${getApiBase()}/api/v1/customers/${auth.userId}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${auth.accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: { en: fullName.trim() },
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new ApiError(r.status, (body as { code?: string }).code ?? 'error', (body as { detail?: string }).detail ?? `HTTP ${r.status}`);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
      setTimeout(() => router.back(), 1000);
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const valid = fullName.trim().length >= 2;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={['#0c0a09', '#7c2d12']} style={styles.hero}>
          <SafeAreaView edges={['top']}>
            <Text style={styles.eyebrow}>{me?.fullName.en === 'Guest' || !me ? 'CLAIM YOUR ACCOUNT' : 'EDIT PROFILE'}</Text>
            <Text style={styles.title}>{me?.fullName.en === 'Guest' || !me ? 'Tell us who you are' : 'Update your details'}</Text>
            <Text style={styles.subtitle}>
              We'll keep your loyalty points, addresses, and order history tied to this phone.
            </Text>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.card}>
          <Field label="Phone (verified)">
            <Text style={[styles.input, { color: colors.ink[500] }]}>{me?.phone ?? '…'}</Text>
          </Field>

          <Field label="Full name">
            <TextInput
              style={styles.inputField}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Ahmed Khan"
              placeholderTextColor={colors.ink[300]}
              autoFocus
              autoCapitalize="words"
            />
          </Field>

          <Field label="Email (optional)">
            <TextInput
              style={styles.inputField}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.ink[300]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          {error && <Text style={styles.error}>{error}</Text>}
          {success && <Text style={styles.success}>✓ Saved. Returning to profile…</Text>}

          <Pressable
            onPress={() => void save()}
            disabled={busy || !valid}
            style={[styles.cta, (busy || !valid) && { opacity: 0.5 }]}
          >
            <Text style={styles.ctaText}>{busy ? 'Saving…' : 'Save & continue'}</Text>
          </Pressable>

          <Text style={styles.legal}>You can change these later from Profile.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  eyebrow: { color: 'rgba(255,255,255,0.85)', fontWeight: '900', letterSpacing: 3, fontSize: 11, marginTop: 8 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 12 },
  subtitle: { color: 'rgba(255,255,255,0.85)', marginTop: 8, lineHeight: 18 },

  card: { backgroundColor: colors.card, marginHorizontal: 16, marginTop: -16, padding: 20, borderRadius: radii.xl, ...shadows.card },
  fieldLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: colors.ink[500] },
  input: { fontSize: 18, fontWeight: '700', color: colors.ink[900], paddingVertical: 10, borderBottomColor: colors.border, borderBottomWidth: 1, marginTop: 4 },
  inputField: { fontSize: 18, fontWeight: '700', color: colors.ink[900], paddingVertical: 10, borderBottomColor: colors.brand[500], borderBottomWidth: 2, marginTop: 4 },

  error: { color: '#991b1b', marginTop: 12, fontWeight: '600' },
  success: { color: '#166534', marginTop: 12, fontWeight: '700' },

  cta: { backgroundColor: colors.brand[500], marginTop: 22, paddingVertical: 14, borderRadius: radii.pill, alignItems: 'center', ...shadows.glow },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 15 },

  legal: { color: colors.ink[500], fontSize: 11, marginTop: 14, textAlign: 'center' },
});
