import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { lightColors, darkColors, type Palette } from '../styles/colors';
import { shadows } from '../styles/shadows';

type Props = {
  size?: number;
  colors?: Palette;
  showLabel?: boolean;
  style?: ViewStyle;
};

export function CompassLogo({ size = 48, colors, showLabel = false, style }: Props) {
  const c = colors ?? lightColors;
  const burstSize = size * 0.95;
  const innerSize = size * 0.55;
  return (
    <View style={[styles.wrap, style]}>
      <View
        style={{
          width: burstSize,
          height: burstSize,
          borderRadius: burstSize / 2,
          backgroundColor: c.primary,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.md,
        }}
      >
        <View
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: c.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: size * 0.42,
              fontWeight: '800',
              color: c.primary,
            }}
          >
            N
          </Text>
        </View>
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: c.text }]}>Compass</Text>
      )}
    </View>
  );
}

type BurstProps = {
  size?: number;
  colors?: Palette;
};

export function CompassBurst({ size = 120, colors }: BurstProps) {
  const c = colors ?? lightColors;
  return (
    <View
      style={[
        styles.burst,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.primary,
        },
        shadows.xl,
      ]}
    >
      <Text style={{ fontSize: size * 0.55 }}>🧭</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 18,
    fontWeight: '800',
  },
  burst: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { darkColors };
