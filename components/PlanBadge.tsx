import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { UserPlan, getUserPlan } from '../services/storage';

type Props = {
  size?: 'sm' | 'md';
  onPress?: () => void;
  refreshKey?: number;
};

export default function PlanBadge({ size = 'md', onPress, refreshKey = 0 }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState<UserPlan>('free');

  useEffect(() => {
    let active = true;
    getUserPlan().then((p) => {
      if (active) setPlan(p);
    });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const isPro = plan !== 'free';
  const label = isPro ? (plan === 'pro_yearly' ? '⭐ YILLIK' : '✓ PRO') : 'FREE';
  const bg = isPro ? '#22C55E' : '#9CA3AF';
  const fontSize = size === 'sm' ? 9 : 11;
  const paddingH = size === 'sm' ? 8 : 10;
  const paddingV = size === 'sm' ? 3 : 5;

  return (
    <Pressable
      onPress={() => (onPress ? onPress() : router.push('/pricing'))}
      style={[styles.badge, { backgroundColor: bg, paddingHorizontal: paddingH, paddingVertical: paddingV }]}
    >
      <Text style={[styles.text, { fontSize }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999 },
  text: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.5 },
});
