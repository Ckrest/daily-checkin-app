import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { colors } from '../src/theme';
import { refreshCache } from '../src/data/store';

const isExpoGo = Constants.appOwnership === 'expo';

export default function RootLayout() {
  const router = useRouter();

  // Pre-warm cache on app start so entry screen loads synchronously
  useEffect(() => {
    refreshCache();
  }, []);

  useEffect(() => {
    if (isExpoGo) return;
    let sub: { remove: () => void } | null = null;
    try {
      const Notifications = require('expo-notifications');
      sub = Notifications.addNotificationResponseReceivedListener(() => {
        router.push('/entry');
      });
    } catch {
      // Not available
    }
    return () => sub?.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'none',
        }}
      />
    </GestureHandlerRootView>
  );
}
