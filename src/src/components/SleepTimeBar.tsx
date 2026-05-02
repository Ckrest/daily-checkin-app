import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import { colors, spacing, fontSize, radius } from '../theme';

// Time range: 6 PM (18:00) to 6 PM next day (18:00 = 42:00).
const RANGE_START = 18;
const RANGE_END = 42;
const TOTAL_HOURS = RANGE_END - RANGE_START; // 24 hours
const MIN_DURATION_HOURS = 0.25;
const MIN_GAP_POS = MIN_DURATION_HOURS / TOTAL_HOURS;
// Downstream manual sleep times are HH:MM only. Noon and later bed times are
// treated as previous-day starts, so keep the sleep handle before noon.
const LATEST_SLEEP_START_HOUR = 35.75; // 11:45 AM next day
const LATEST_SLEEP_START_POS = (LATEST_SLEEP_START_HOUR - RANGE_START) / TOTAL_HOURS;

function timeToPosition(timeStr: string, preferEnd: boolean): number {
  'worklet';
  const parts = timeStr.split(':');
  let hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (hour < RANGE_START || (preferEnd && hour === RANGE_START)) hour += 24;
  const total = hour + minute / 60;
  return Math.max(0, Math.min(1, (total - RANGE_START) / TOTAL_HOURS));
}

function positionToTime(position: number): string {
  'worklet';
  const totalHours = position * TOTAL_HOURS + RANGE_START;
  let hour = Math.floor(totalHours) % 24;
  const rawMin = (totalHours % 1) * 60;
  const minute = Math.round(rawMin / 15) * 15;
  if (minute === 60) {
    hour = (hour + 1) % 24;
    return `${String(hour).padStart(2, '0')}:00`;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatTimeLabel(timeStr: string): string {
  const [hourRaw, minute] = timeStr.split(':');
  const hour = parseInt(hourRaw, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${period}`;
}

function formatDurationLabel(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

function clamp(val: number, min: number, max: number): number {
  'worklet';
  return Math.max(min, Math.min(max, val));
}

function clampSleepPosition(pos: number, wakePosition: number): number {
  'worklet';
  const maxSleep = Math.max(0, Math.min(LATEST_SLEEP_START_POS, wakePosition - MIN_GAP_POS));
  return clamp(pos, 0, maxSleep);
}

function clampWakePosition(pos: number, sleepPosition: number): number {
  'worklet';
  return clamp(pos, sleepPosition + MIN_GAP_POS, 1);
}

function snapPosition(pos: number): number {
  'worklet';
  // Snap a raw position to the nearest 15-min grid position
  const totalHours = pos * TOTAL_HOURS + RANGE_START;
  const hour = Math.floor(totalHours);
  const rawMin = (totalHours - hour) * 60;
  const snappedMin = Math.round(rawMin / 15) * 15;
  const snappedTotal = hour + snappedMin / 60;
  return Math.max(0, Math.min(1, (snappedTotal - RANGE_START) / TOTAL_HOURS));
}

interface Props {
  sleepTime: string | null;
  wakeTime: string | null;
  onChange: (sleepTime: string, wakeTime: string) => void;
}

export const DEFAULT_SLEEP_TIME = '23:00';
export const DEFAULT_WAKE_TIME = '07:00';

const HANDLE_SIZE = 28;
const BAR_HEIGHT = 6;
const TRACK_H = 56;

export function SleepTimeBar({ sleepTime, wakeTime, onChange }: Props) {
  const defaultSleepPos = timeToPosition(DEFAULT_SLEEP_TIME, false);
  const defaultWakePos = timeToPosition(DEFAULT_WAKE_TIME, true);

  const barWidth = useSharedValue(300);
  const sleepPos = useSharedValue(sleepTime ? timeToPosition(sleepTime, false) : defaultSleepPos);
  const wakePos = useSharedValue(wakeTime ? timeToPosition(wakeTime, true) : defaultWakePos);

  // Sync shared values when props change (e.g. navigating between days)
  useEffect(() => {
    let nextSleepPos = sleepTime ? timeToPosition(sleepTime, false) : defaultSleepPos;
    let nextWakePos = wakeTime ? timeToPosition(wakeTime, true) : defaultWakePos;
    nextSleepPos = clamp(nextSleepPos, 0, LATEST_SLEEP_START_POS);
    nextWakePos = clampWakePosition(nextWakePos, nextSleepPos);
    nextSleepPos = clampSleepPosition(nextSleepPos, nextWakePos);
    sleepPos.value = nextSleepPos;
    wakePos.value = nextWakePos;
  }, [sleepTime, wakeTime]);

  const emitChange = useCallback(
    (sPos: number, wPos: number) => {
      const s = positionToTime(sPos);
      const w = positionToTime(wPos);
      onChange(s, w);
    },
    [onChange]
  );

  const sleepStartX = useSharedValue(0);
  const sleepGesture = Gesture.Pan()
    .onBegin(() => {
      sleepStartX.value = sleepPos.value;
    })
    .onUpdate((e) => {
      const delta = e.translationX / barWidth.value;
      sleepPos.value = clampSleepPosition(sleepStartX.value + delta, wakePos.value);
    })
    .onEnd(() => {
      sleepPos.value = snapPosition(sleepPos.value);
      runOnJS(emitChange)(sleepPos.value, wakePos.value);
    })
    .hitSlop({ top: 20, bottom: 20, left: 10, right: 10 });

  const wakeStartX = useSharedValue(0);
  const wakeGesture = Gesture.Pan()
    .onBegin(() => {
      wakeStartX.value = wakePos.value;
    })
    .onUpdate((e) => {
      const delta = e.translationX / barWidth.value;
      wakePos.value = clampWakePosition(wakeStartX.value + delta, sleepPos.value);
    })
    .onEnd(() => {
      wakePos.value = snapPosition(wakePos.value);
      runOnJS(emitChange)(sleepPos.value, wakePos.value);
    })
    .hitSlop({ top: 20, bottom: 20, left: 10, right: 10 });

  const fillStyle = useAnimatedStyle(() => ({
    left: sleepPos.value * barWidth.value,
    width: (wakePos.value - sleepPos.value) * barWidth.value,
  }));

  const sleepHandleStyle = useAnimatedStyle(() => ({
    left: sleepPos.value * barWidth.value - HANDLE_SIZE / 2,
  }));

  const wakeHandleStyle = useAnimatedStyle(() => ({
    left: wakePos.value * barWidth.value - HANDLE_SIZE / 2,
  }));

  // Use regular state for text labels, bridged from UI thread
  const initSleep = sleepTime ?? DEFAULT_SLEEP_TIME;
  const initWake = wakeTime ?? DEFAULT_WAKE_TIME;
  const [sleepLabel, setSleepLabel] = useState(() => formatTimeLabel(initSleep));
  const [wakeLabel, setWakeLabel] = useState(() => formatTimeLabel(initWake));
  const [durationLabel, setDurationLabel] = useState(() => {
    const hours = ((wakeTime ? timeToPosition(wakeTime, true) : defaultWakePos) - (sleepTime ? timeToPosition(sleepTime, false) : defaultSleepPos)) * TOTAL_HOURS;
    return formatDurationLabel(hours);
  });

  const updateLabels = useCallback((sPos: number, wPos: number) => {
    const sTime = positionToTime(sPos);
    const wTime = positionToTime(wPos);
    setSleepLabel(formatTimeLabel(sTime));
    setWakeLabel(formatTimeLabel(wTime));
    // Duration from snapped positions so it matches displayed times
    const sSnapped = timeToPosition(sTime, false);
    const wSnapped = timeToPosition(wTime, true);
    const hours = (wSnapped - sSnapped) * TOTAL_HOURS;
    setDurationLabel(formatDurationLabel(hours));
  }, []);

  useAnimatedReaction(
    () => ({ s: sleepPos.value, w: wakePos.value }),
    (current) => {
      runOnJS(updateLabels)(current.s, current.w);
    }
  );

  return (
    <View style={styles.container}>
      <Text style={styles.duration}>{durationLabel}</Text>

      <View style={styles.labelsRow}>
        <Text style={styles.timeLabel}>{sleepLabel}</Text>
        <Text style={styles.timeLabel}>{wakeLabel}</Text>
      </View>

      <View
        style={styles.trackArea}
        onLayout={(e) => {
          barWidth.value = e.nativeEvent.layout.width;
        }}
      >
        {/* Background track */}
        <View style={styles.track} />

        {/* Fill between handles */}
        <Animated.View style={[styles.fill, fillStyle]} />

        {/* Sleep handle */}
        <GestureDetector gesture={sleepGesture}>
          <Animated.View style={[styles.handle, sleepHandleStyle]} />
        </GestureDetector>

        {/* Wake handle */}
        <GestureDetector gesture={wakeGesture}>
          <Animated.View style={[styles.handle, styles.handleWake, wakeHandleStyle]} />
        </GestureDetector>
      </View>

      {/* Axis labels */}
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>6 PM</Text>
        <Text style={styles.axisLabel}>12 AM</Text>
        <Text style={styles.axisLabel}>6 AM</Text>
        <Text style={styles.axisLabel}>12 PM</Text>
        <Text style={styles.axisLabel}>6 PM</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  duration: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  timeLabel: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  trackArea: {
    height: TRACK_H,
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
    backgroundColor: colors.surfaceLight,
    borderRadius: BAR_HEIGHT / 2,
  },
  fill: {
    position: 'absolute',
    height: BAR_HEIGHT,
    backgroundColor: colors.sleepFill,
    borderRadius: BAR_HEIGHT / 2,
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: colors.accent,
    top: (TRACK_H - HANDLE_SIZE) / 2,
    borderWidth: 3,
    borderColor: colors.bg,
  },
  handleWake: {
    backgroundColor: colors.success,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  axisLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
