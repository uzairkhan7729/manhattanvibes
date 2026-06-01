import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../src/lib/api';
import { requestLog, subscribeLog, type LogEntry } from '../src/lib/api';
import { AUTO_DETECTED, clearApiBaseOverride, diagnostics, setApiBaseOverride, useApiBase } from '../src/lib/config';
import { colors, radii, shadows, type as t } from '../src/lib/theme';

export default function SettingsScreen(): JSX.Element {
  const router = useRouter();
  const current = useApiBase();
  const [draft, setDraft] = useState(current);
  const [log, setLog] = useState<LogEntry[]>([...requestLog]);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);

  useEffect(() => setDraft(current), [current]);
  useEffect(() => {
    const unsub = subscribeLog(() => setLog([...requestLog]));
    return unsub;
  }, []);

  async function save(): Promise<void> {
    let v = draft.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//.test(v)) v = `http://${v}`;
    await setApiBaseOverride(v);
    Alert.alert('Saved', `API base set to ${v}`);
  }

  async function reset(): Promise<void> {
    await clearApiBaseOverride();
    Alert.alert('Reset', `Back to auto-detected: ${AUTO_DETECTED}`);
  }

  async function ping(): Promise<void> {
    setPinging(true); setPingResult(null);
    try {
      const r = await fetch(`${current}/health/ready`, { method: 'GET' });
      const body = await r.text();
      setPingResult(`HTTP ${r.status} — ${body.slice(0, 200)}`);
    } catch (err: unknown) {
      setPingResult(`✗ ${err instanceof Error ? err.message : 'failed'}`);
    } finally {
      setPinging(false);
    }
  }

  const diag = diagnostics();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#fff' }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={{ fontSize: 22, color: colors.brand[600] }}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Debug · Settings</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {/* API URL section */}
        <View style={styles.card}>
          <Text style={styles.sec}>API URL</Text>
          <Text style={styles.curUrl}>{current}</Text>
          {current !== AUTO_DETECTED && (
            <Text style={styles.hint}>Currently overridden. Auto-detected would be {AUTO_DETECTED}.</Text>
          )}
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Override (e.g. http://192.168.1.50:8088)</Text>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="http://YOUR-LAN-IP:8088"
            placeholderTextColor={colors.ink[300]}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable style={styles.primaryBtn} onPress={() => void save()}>
              <Text style={styles.primaryBtnText}>Save & use</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => void reset()}>
              <Text style={styles.secondaryBtnText}>Reset</Text>
            </Pressable>
          </View>
        </View>

        {/* Health probe */}
        <View style={styles.card}>
          <Text style={styles.sec}>Health probe</Text>
          <Text style={styles.fieldLabel}>Hits {current}/health/ready</Text>
          <Pressable style={styles.primaryBtn} onPress={() => void ping()}>
            <Text style={styles.primaryBtnText}>{pinging ? 'Pinging…' : 'Ping now'}</Text>
          </Pressable>
          {pingResult && <Text style={[styles.pre, { marginTop: 10 }]}>{pingResult}</Text>}
        </View>

        {/* Diagnostics */}
        <View style={styles.card}>
          <Text style={styles.sec}>Diagnostics</Text>
          {Object.entries(diag).map(([k, v]) => (
            <View key={k} style={styles.kvRow}>
              <Text style={styles.kvKey}>{k}</Text>
              <Text style={styles.kvVal}>{v ?? '—'}</Text>
            </View>
          ))}
        </View>

        {/* Request log */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sec}>Recent requests ({log.length})</Text>
          </View>
          {log.length === 0 && (
            <Text style={{ color: colors.ink[500], paddingTop: 6 }}>No requests yet. Try the menu screen.</Text>
          )}
          {log.map((e) => (
            <View key={e.id} style={styles.logRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[
                  styles.statusPill,
                  e.error ? { backgroundColor: '#fee2e2', color: '#991b1b' } :
                  e.ok ? { backgroundColor: '#dcfce7', color: '#166534' } :
                  { backgroundColor: '#fef3c7', color: '#92400e' },
                ]}>
                  {e.error ? 'ERR' : e.status}
                </Text>
                <Text style={styles.logMethod}>{e.method}</Text>
                {typeof e.durationMs === 'number' && <Text style={{ color: colors.ink[500], fontSize: 11 }}>{e.durationMs}ms</Text>}
              </View>
              <Text style={styles.logUrl} numberOfLines={1}>{e.url}</Text>
              {e.error && <Text style={styles.logErr}>{e.error}</Text>}
              {e.response && <Text style={styles.logResp} numberOfLines={3}>{e.response}</Text>}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { ...t.h2, color: colors.ink[900] },

  card: { backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, ...shadows.card },
  sec: { fontWeight: '900', letterSpacing: 2, fontSize: 11, color: colors.ink[700], marginBottom: 10 },
  fieldLabel: { fontSize: 11, color: colors.ink[500] },
  curUrl: { fontFamily: 'monospace', backgroundColor: colors.bg, padding: 10, borderRadius: radii.md, color: colors.ink[900], fontSize: 13 },
  hint: { fontSize: 11, color: colors.brand[600], marginTop: 6 },

  input: { backgroundColor: colors.bg, padding: 12, borderRadius: radii.md, marginTop: 4, fontFamily: 'monospace', color: colors.ink[900], borderColor: colors.border, borderWidth: 1 },

  primaryBtn: { flex: 1, backgroundColor: colors.brand[500], paddingVertical: 10, borderRadius: radii.pill, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.pill, alignItems: 'center', borderColor: colors.border, borderWidth: 1 },
  secondaryBtnText: { color: colors.ink[700], fontWeight: '700' },

  pre: { fontFamily: 'monospace', color: colors.ink[700], fontSize: 12, backgroundColor: colors.bg, padding: 10, borderRadius: radii.md },

  kvRow: { paddingVertical: 4 },
  kvKey: { fontSize: 11, color: colors.ink[500], fontWeight: '700' },
  kvVal: { fontFamily: 'monospace', color: colors.ink[900], fontSize: 12, marginTop: 2 },

  logRow: { paddingVertical: 10, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, gap: 4 },
  statusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 10, fontWeight: '900', overflow: 'hidden' },
  logMethod: { fontWeight: '900', color: colors.ink[900], fontSize: 12 },
  logUrl: { fontFamily: 'monospace', fontSize: 11, color: colors.ink[700] },
  logErr: { color: '#991b1b', fontSize: 11 },
  logResp: { color: colors.ink[500], fontSize: 10, fontFamily: 'monospace' },
});
