import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, radius } from '../src/theme';
import { useSettings } from '../src/hooks/useSettings';
import { pickDataFolder } from '../src/data/store';
import { requestPermissions, scheduleDaily, cancelAll } from '../src/notifications/scheduler';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, update, loading } = useSettings();
  const [pickingFolder, setPickingFolder] = useState(false);

  const handleFolderPick = useCallback(async () => {
    setPickingFolder(true);
    const result = await pickDataFolder();
    setPickingFolder(false);
    if (result) {
      Alert.alert('Folder Selected', 'Your data will be saved to the selected folder.');
    }
  }, []);

  const handleToggleNotifications = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        const granted = await requestPermissions();
        if (!granted) {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings.'
          );
          return;
        }
        await scheduleDaily(settings.notificationHour, settings.notificationMinute);
      } else {
        await cancelAll();
      }
      await update({ notificationsEnabled: enabled });
    },
    [settings, update]
  );

  const handleTimeChange = useCallback(
    async (hour: number, minute: number) => {
      await update({ notificationHour: hour, notificationMinute: minute });
      if (settings.notificationsEnabled) {
        await scheduleDaily(hour, minute);
      }
    },
    [settings, update]
  );

  const formatTime = (h: number, m: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Storage */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Storage</Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleFolderPick}
          disabled={pickingFolder}
          activeOpacity={0.7}
        >
          <Text style={styles.actionBtnText}>
            {pickingFolder ? 'Selecting...' : settings.dataFolderUri ? 'Change Folder' : 'Select Syncthing Folder'}
          </Text>
        </TouchableOpacity>
        {settings.dataFolderUri && (
          <Text style={styles.detail} numberOfLines={2}>
            {decodeURIComponent(settings.dataFolderUri)}
          </Text>
        )}
      </View>

      {/* Notifications */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Daily Reminder</Text>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: colors.surfaceLight, true: colors.accentDim }}
            thumbColor={settings.notificationsEnabled ? colors.accent : colors.textDim}
          />
        </View>

        {settings.notificationsEnabled && (
          <View style={styles.timeSection}>
            <Text style={styles.label}>
              Notification at{' '}
              <Text style={styles.timeHighlight}>
                {formatTime(settings.notificationHour, settings.notificationMinute)}
              </Text>
            </Text>

            <View style={styles.timePickerRow}>
              <Text style={styles.timePickerLabel}>Hour</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timePicker}>
                {HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.timeBubble,
                      settings.notificationHour === h && styles.timeBubbleSelected,
                    ]}
                    onPress={() => handleTimeChange(h, settings.notificationMinute)}
                  >
                    <Text
                      style={[
                        styles.timeBubbleText,
                        settings.notificationHour === h && styles.timeBubbleTextSelected,
                      ]}
                    >
                      {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.timePickerRow}>
              <Text style={styles.timePickerLabel}>Min</Text>
              <View style={styles.minuteRow}>
                {MINUTES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.timeBubble,
                      settings.notificationMinute === m && styles.timeBubbleSelected,
                    ]}
                    onPress={() => handleTimeChange(settings.notificationHour, m)}
                  >
                    <Text
                      style={[
                        styles.timeBubbleText,
                        settings.notificationMinute === m && styles.timeBubbleTextSelected,
                      ]}
                    >
                      :{String(m).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  backBtn: { width: 60 },
  backText: { color: colors.accent, fontSize: fontSize.md, fontWeight: '600' },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  label: { color: colors.text, fontSize: fontSize.md },
  detail: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.sm },
  actionBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  actionBtnText: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  timeSection: { marginTop: spacing.sm },
  timeHighlight: { color: colors.accent, fontWeight: '700' },
  timePickerRow: { marginTop: spacing.md },
  timePickerLabel: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  timePicker: { flexGrow: 0 },
  minuteRow: { flexDirection: 'row', gap: spacing.sm },
  timeBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLight,
    marginRight: spacing.sm,
  },
  timeBubbleSelected: {
    backgroundColor: colors.accent,
  },
  timeBubbleText: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  timeBubbleTextSelected: {
    color: colors.text,
  },
});
