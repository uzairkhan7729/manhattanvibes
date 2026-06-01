import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Splash } from '../src/components/Splash';
import { colors } from '../src/lib/theme';

// Keep the native splash up until our React-rendered splash takes over.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout(): JSX.Element {
  const [appReady, setAppReady] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAppReady(true), 1500);   // brand moment
    SplashScreen.hideAsync().catch(() => undefined);
    return () => clearTimeout(t);
  }, []);

  const onSplashHidden = useCallback(() => setSplashHidden(true), []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style={splashHidden ? 'dark' : 'light'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: colors.ink[900],
            headerTitleStyle: { fontWeight: '800', fontSize: 17 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="auth/phone" options={{ title: 'Sign in' }} />
          <Stack.Screen name="auth/otp" options={{ title: 'Verify' }} />
          <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
          <Stack.Screen name="product/[id]" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="track/[id]" options={{ title: 'Track order' }} />
        </Stack>

        {!splashHidden && <Splash ready={appReady} onHidden={onSplashHidden} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
