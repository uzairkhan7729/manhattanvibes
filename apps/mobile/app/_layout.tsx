import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout(): JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: '#f97316' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/phone" options={{ title: 'Sign in' }} />
        <Stack.Screen name="auth/otp" options={{ title: 'Verify' }} />
        <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
        <Stack.Screen name="track/[id]" options={{ title: 'Track order' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
