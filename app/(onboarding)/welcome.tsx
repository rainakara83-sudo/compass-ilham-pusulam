import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getStoredNiche } from '../../services/storage';
import niches from '../../data/niches.json';

type Niche = { id: string; icon: string; color: string };

export default function Welcome() {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    getStoredNiche().then((nid) => {
      if (!mounted) return;
      const niche = (niches as Niche[]).find((x) => x.id === nid);

      Animated.sequence([
        Animated.parallel([
          Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
        ]),
        Animated.timing(subtitleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();

      Animated.loop(
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.8, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ])
      ).start();

      timer = setTimeout(() => {
        router.replace('/(tabs)');
      }, 1800);

      void niche;
    });

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [fade, ringOpacity, ringScale, router, scale, subtitleFade]);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.ring,
            {
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
        />
        <Animated.View style={[styles.bubble, { opacity: fade, transform: [{ scale }] }]}>
          <Text style={styles.icon}>🎉</Text>
        </Animated.View>
        <Animated.Text style={[styles.title, { opacity: fade }]}>Hoş geldin!</Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: subtitleFade }]}>
          İçerik koçun hazır. Hadi başlayalım 🚀
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(77,150,255,0.25)',
  },
  bubble: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4D96FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4D96FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: { fontSize: 56 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', marginTop: 20 },
  subtitle: { fontSize: 15, color: '#6B7280', marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },
});
