import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../src/lib/theme';

function Icon({ glyph, focused }: { glyph: string; focused: boolean }): JSX.Element {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={{ fontSize: focused ? 22 : 20 }}>{glyph}</Text>
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
        options={{ title: 'Cart', tabBarIcon: ({ focused }) => <Icon glyph="🛒" focused={focused} /> }}
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
});
