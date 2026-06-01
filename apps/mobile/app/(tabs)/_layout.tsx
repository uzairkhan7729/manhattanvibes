import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { useCart } from '../../src/lib/cart';
import { colors, shadows } from '../../src/lib/theme';

function Icon({ glyph, focused }: { glyph: string; focused: boolean }): JSX.Element {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={{ fontSize: focused ? 22 : 20 }}>{glyph}</Text>
    </View>
  );
}

/**
 * Cart icon with a live count badge. Subscribes to the cart store so the
 * number updates the moment something is added/removed. Pops in with a
 * spring on every change so the user sees the cart "react".
 */
function CartIcon({ focused }: { focused: boolean }): JSX.Element {
  const count = useCart((s) => s.lines.reduce((sum, l) => sum + l.qty, 0));
  const scale = useRef(new Animated.Value(count > 0 ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: count > 0 ? 1 : 0,
      useNativeDriver: true,
      friction: 5,
      tension: 180,
    }).start();
  }, [count, scale]);

  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={{ fontSize: focused ? 22 : 20 }}>🛒</Text>
      <Animated.View
        pointerEvents="none"
        style={[styles.badge, { transform: [{ scale }] }]}
      >
        <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
      </Animated.View>
    </View>
  );
}

export default function TabsLayout(): JSX.Element {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand[600],
        tabBarInactiveTintColor: colors.ink[500],
        tabBarStyle: {
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#fff',
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 6,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarBackground: Platform.OS === 'ios'
          ? () => <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          : undefined,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: -2 },
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: colors.ink[900],
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', fontSize: 17 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', headerShown: false, tabBarIcon: ({ focused }) => <Icon glyph="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="menu"
        options={{ title: 'Menu', headerShown: false, tabBarIcon: ({ focused }) => <Icon glyph="🍕" focused={focused} /> }}
      />
      <Tabs.Screen
        name="cart"
        options={{ title: 'Cart', tabBarIcon: ({ focused }) => <CartIcon focused={focused} /> }}
      />
      <Tabs.Screen
        name="loyalty"
        options={{ title: 'Rewards', headerShown: false, tabBarIcon: ({ focused }) => <Icon glyph="⭐" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', headerShown: false, tabBarIcon: ({ focused }) => <Icon glyph="👤" focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { width: 36, height: 30, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: colors.brand[50] },

  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#fff',
    borderWidth: 1.5,
    ...shadows.glow,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0 },
});
