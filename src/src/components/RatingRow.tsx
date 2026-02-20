import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, radius } from '../theme';

interface Props {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}

export function RatingRow({ label, value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.bubbles}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.bubble, value === n && styles.bubbleSelected]}
            onPress={() => onChange(n)}
            activeOpacity={0.7}
          >
            <Text style={[styles.bubbleText, value === n && styles.bubbleTextSelected]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const BUBBLE_SIZE = 48;

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textDim,
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  bubbles: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bubble: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: colors.ratingUnselected,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  bubbleSelected: {
    backgroundColor: colors.ratingSelected,
    borderColor: colors.accent,
  },
  bubbleText: {
    color: colors.textDim,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  bubbleTextSelected: {
    color: colors.text,
  },
});
