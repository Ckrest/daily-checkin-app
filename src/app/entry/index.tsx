import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
  Keyboard,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors, spacing, fontSize, radius } from '../../src/theme';
import { prevDay, nextDay, todayStr, isToday } from '../../src/data/dateUtils';
import { loadSettings } from '../../src/data/store';
import { useEntry } from '../../src/hooks/useEntry';
import { DateNav } from '../../src/components/DateNav';
import { RatingRow } from '../../src/components/RatingRow';
import { SleepTimeBar, DEFAULT_SLEEP_TIME, DEFAULT_WAKE_TIME } from '../../src/components/SleepTimeBar';

export default function EntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentDate, setCurrentDate] = useState(todayStr());

  const { entry, updateField, saveNow, loading } = useEntry(currentDate);
  const [hasFolder, setHasFolder] = useState(true);

  // Blur text inputs when keyboard is manually dismissed (e.g. Android back button)
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      Keyboard.dismiss();
    });
    return () => sub.remove();
  }, []);

  // Re-check folder status every time screen gains focus (e.g. returning from settings)
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const settings = await loadSettings();
        setHasFolder(!!settings.dataFileUri);
      })();
    }, [])
  );

  const handleSleepChange = useCallback(
    (sleepTime: string, wakeTime: string) => {
      updateField('sleep_time', sleepTime);
      updateField('wake_time', wakeTime);
    },
    [updateField]
  );

  const goToPrev = useCallback(async () => {
    Keyboard.dismiss();
    await saveNow();
    setCurrentDate(prevDay(currentDate));
  }, [currentDate, saveNow]);

  const goToNext = useCallback(async () => {
    if (!isToday(currentDate)) {
      Keyboard.dismiss();
      await saveNow();
      setCurrentDate(nextDay(currentDate));
    }
  }, [currentDate, saveNow]);

  // Swipe gestures for day navigation (instant switch, no animation)
  const flingRight = Gesture.Fling()
    .direction(Directions.RIGHT)
    .onEnd(() => {
      runOnJS(goToPrev)();
    });

  const flingLeft = Gesture.Fling()
    .direction(Directions.LEFT)
    .onEnd(() => {
      runOnJS(goToNext)();
    });

  const swipeGesture = Gesture.Simultaneous(flingLeft, flingRight);

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={[styles.flex, { paddingTop: Math.max(insets.top - 6, 0) }]}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            {!hasFolder && (
              <TouchableOpacity
                style={styles.banner}
                onPress={() => router.push('/settings')}
                activeOpacity={0.7}
              >
                <Text style={styles.bannerText}>
                  Tap to select a storage folder for your data
                </Text>
              </TouchableOpacity>
            )}

            <DateNav
              date={currentDate}
              onPrev={goToPrev}
              onNext={goToNext}
              onLongPress={() => router.push('/settings')}
            />

            <View style={styles.section}>
              <RatingRow
                label="Sleep Quality"
                value={entry.sleep_quality ?? null}
                onChange={(v) => { Keyboard.dismiss(); updateField('sleep_quality', v); }}
              />
              <RatingRow
                label="Alertness"
                value={entry.alertness ?? null}
                onChange={(v) => { Keyboard.dismiss(); updateField('alertness', v); }}
              />
              <RatingRow
                label="Mood"
                value={entry.mood ?? null}
                onChange={(v) => { Keyboard.dismiss(); updateField('mood', v); }}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.inputLabel}>Dreams</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Any dreams last night?"
                placeholderTextColor={colors.textMuted}
                value={entry.dreams ?? ''}
                onChangeText={(t) => updateField('dreams', t)}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Any notes from this morning?"
                placeholderTextColor={colors.textMuted}
                value={entry.notes ?? ''}
                onChangeText={(t) => updateField('notes', t)}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.sleepToggleRow}>
              <Text style={styles.sleepToggleLabel}>Override Sleep Time</Text>
              <Switch
                value={entry.sleep_time != null}
                onValueChange={(checked) => {
                  Keyboard.dismiss();
                  if (checked) {
                    updateField('sleep_time', DEFAULT_SLEEP_TIME);
                    updateField('wake_time', DEFAULT_WAKE_TIME);
                  } else {
                    updateField('sleep_time', null);
                    updateField('wake_time', null);
                  }
                }}
                trackColor={{ false: colors.surfaceLight, true: colors.accent + '60' }}
                thumbColor={entry.sleep_time != null ? colors.accent : colors.textMuted}
              />
            </View>
            {entry.sleep_time != null && (
              <SleepTimeBar
                sleepTime={entry.sleep_time}
                wakeTime={entry.wake_time ?? DEFAULT_WAKE_TIME}
                onChange={handleSleepChange}
              />
            )}

            <View style={{ height: insets.bottom }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: spacing.lg,
  },
  banner: {
    backgroundColor: colors.warning + '20',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  bannerText: {
    color: colors.warning,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.sm,
  },
  inputLabel: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: fontSize.md,
    padding: spacing.md,
    minHeight: 80,
    marginBottom: spacing.lg,
  },
  sleepToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  sleepToggleLabel: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
