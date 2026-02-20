import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

function getNotifications(): typeof import('expo-notifications') | null {
  if (isExpoGo) return null;
  try {
    const mod = require('expo-notifications');
    return mod;
  } catch {
    return null;
  }
}

export async function requestPermissions(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications || !Device.isDevice) return false;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Daily Check-In',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleDaily(hour: number, minute: number): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Check-In',
        body: 'Time to log your day. Tap to open.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch {
    // Notifications not supported in this environment
  }
}

export async function cancelAll(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Notifications not supported
  }
}
