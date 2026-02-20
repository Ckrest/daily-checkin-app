import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '../theme';
import { formatDisplay, isToday } from '../data/dateUtils';

interface Props {
  date: string;
  onPrev: () => void;
  onNext: () => void;
  onLongPress?: () => void;
}

export function DateNav({ date, onPrev, onNext, onLongPress }: Props) {
  const atToday = isToday(date);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPrev} style={styles.arrow} activeOpacity={0.6}>
        <Text style={styles.arrowText}>{'<'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onLongPress={onLongPress} activeOpacity={1} style={styles.center}>
        <Text style={styles.date}>{formatDisplay(date)}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onNext}
        style={styles.arrow}
        activeOpacity={atToday ? 1 : 0.6}
        disabled={atToday}
      >
        <Text style={[styles.arrowText, atToday && styles.arrowDisabled]}>{'>'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  arrowDisabled: {
    color: colors.textMuted,
    opacity: 0.3,
  },
  center: {
    alignItems: 'center',
  },
  date: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});
