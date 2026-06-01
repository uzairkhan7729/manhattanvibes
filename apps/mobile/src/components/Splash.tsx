import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors } from '../lib/theme';

/**
 * Branded animated splash. Stays mounted until the parent flips `ready` to
 * true and the fade-out completes. Pulsing pizza emoji + brand mark + radial
 * gradient.
 */
export function Splash({ ready, onHidden }: { ready: boolean; onHidden: () => void }): JSX.Element | null {
  const fade = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }),
      Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 3500, easing: Easing.linear, useNativeDriver: true }),
      ),
      Animated.timing(titleOpacity, { toValue: 1, duration: 600, delay: 250, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 600, delay: 250, useNativeDriver: true }),
    ]).start();
  }, [scale, spin, titleOpacity, slideUp]);

  useEffect(() => {
    if (!ready) return;
    Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => onHidden());
  }, [ready, fade, onHidden]);

  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View pointerEvents={ready ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, { opacity: fade, zIndex: 1000 }]}>
      <LinearGradient
        colors={['#0c0a09', '#1c1410', '#7c2d12']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* radial glow behind pizza */}
      <View style={styles.glow}>
        <LinearGradient
          colors={['rgba(249,115,22,0.55)', 'rgba(249,115,22,0)']}
          style={styles.glowFill}
        />
      </View>

      <View style={styles.content}>
        <Animated.View style={[styles.pizzaWrap, { transform: [{ scale }, { rotate: rotation }] }]}>
          <Text style={styles.pizza}>🍕</Text>
        </Animated.View>

        <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: slideUp }], alignItems: 'center' }}>
          <Text style={styles.brand}>MANHATTAN</Text>
          <Text style={styles.brand2}>VIBES</Text>
          <View style={styles.divider} />
          <Text style={styles.tagline}>Pizza · Burgers · More</Text>
        </Animated.View>
      </View>

      <Animated.Text style={[styles.bottom, { opacity: titleOpacity }]}>
        Crafted in Gujrat · Served hot
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: '32%', left: '20%', width: 280, height: 280 },
  glowFill: { flex: 1, borderRadius: 200 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  pizzaWrap: { marginBottom: 8 },
  pizza: { fontSize: 110 },
  brand: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: 6 },
  brand2: { color: colors.brand[400], fontSize: 36, fontWeight: '900', letterSpacing: 6, marginTop: -6 },
  divider: { width: 60, height: 2, backgroundColor: colors.brand[400], marginTop: 14, marginBottom: 12, borderRadius: 2 },
  tagline: { color: '#d6d3d1', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' as const },
  bottom: { color: '#a8a29e', textAlign: 'center', fontSize: 11, letterSpacing: 2, position: 'absolute', bottom: 50, left: 0, right: 0 },
});
