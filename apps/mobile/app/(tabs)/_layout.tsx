import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ label }: { label: string }): JSX.Element {
  return <Text style={{ fontSize: 22 }}>{label}</Text>;
}

export default function TabsLayout(): JSX.Element {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#f97316', headerStyle: { backgroundColor: '#f97316' }, headerTintColor: '#fff' }}>
      <Tabs.Screen name="index"   options={{ title: 'Home',    tabBarIcon: () => <TabIcon label="🏠" /> }} />
      <Tabs.Screen name="menu"    options={{ title: 'Menu',    tabBarIcon: () => <TabIcon label="🍕" /> }} />
      <Tabs.Screen name="cart"    options={{ title: 'Cart',    tabBarIcon: () => <TabIcon label="🛒" /> }} />
      <Tabs.Screen name="loyalty" options={{ title: 'Loyalty', tabBarIcon: () => <TabIcon label="⭐" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: () => <TabIcon label="👤" /> }} />
    </Tabs>
  );
}
