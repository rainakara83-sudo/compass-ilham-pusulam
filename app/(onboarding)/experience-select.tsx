import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ExperienceLevel, setExperience, setGoal, ContentGoal } from '../../services/storage';

const LEVELS: { id: ExperienceLevel; icon: string; title: string; subtitle: string; color: string }[] = [
  { id: 'beginner', icon: '🌱', title: 'Yeni başlıyorum', subtitle: '0–6 ay deneyim', color: '#10B981' },
  { id: 'intermediate', icon: '🚀', title: 'Büyüyorum', subtitle: '6 ay – 2 yıl', color: '#4D96FF' },
  { id: 'pro', icon: '👑', title: 'Profesyonelim', subtitle: '2+ yıl, düzenli üretim', color: '#F59E0B' },
];

const GOALS: { id: ContentGoal; icon: string; title: string }[] = [
  { id: 'growth', icon: '📈', title: 'Büyümek' },
  { id: 'engagement', icon: '💬', title: 'Etkileşim' },
  { id: 'monetize', icon: '💰', title: 'Gelir' },
  { id: 'community', icon: '🤝', title: 'Topluluk' },
];

export default function ExperienceSelect() {
  const router = useRouter();
  const { t } = useTranslation();
  const [level, setLevel] = useState<ExperienceLevel | null>(null);
  const [goal, setLocalGoal] = useState<ContentGoal | null>(null);

  const onContinue = async () => {
    if (!level || !goal) return;
    await setExperience(level);
    await setGoal(goal);
    router.replace('/(onboarding)/permissions');
  };

  return (
    <View style={styles.container}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepText}>3 / 4</Text>
      </View>
      <Text style={styles.title}>🎯 Seni tanıyalım</Text>
      <Text style={styles.subtitle}>İçerik üretiminde deneyimin ve hedefin</Text>

      <Text style={styles.section}>Deneyim seviyesi</Text>
      {LEVELS.map((l) => {
        const sel = level === l.id;
        return (
          <Pressable
            key={l.id}
            onPress={() => setLevel(l.id)}
            style={[styles.card, sel && { borderColor: l.color, backgroundColor: l.color + '10' }]}
          >
            <Text style={styles.icon}>{l.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{l.title}</Text>
              <Text style={styles.cardSub}>{l.subtitle}</Text>
            </View>
            {sel && <Text style={[styles.check, { color: l.color }]}>✓</Text>}
          </Pressable>
        );
      })}

      <Text style={styles.section}>Hedefin ne?</Text>
      <View style={styles.goalRow}>
        {GOALS.map((g) => {
          const sel = goal === g.id;
          return (
            <Pressable
              key={g.id}
              onPress={() => setLocalGoal(g.id)}
              style={[styles.goalCard, sel && styles.goalCardActive]}
            >
              <Text style={styles.goalIcon}>{g.icon}</Text>
              <Text style={[styles.goalTitle, sel && { color: 'white' }]}>{g.title}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Geri</Text>
        </Pressable>
        <Pressable
          onPress={onContinue}
          disabled={!level || !goal}
          style={[styles.cta, { opacity: level && goal ? 1 : 0.4, flex: 1 }]}
        >
          <Text style={styles.ctaText}>Başla 🚀</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80, paddingHorizontal: 20, backgroundColor: '#F9FAFB' },
  stepBadge: { alignSelf: 'flex-start', backgroundColor: '#E0E7FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  stepText: { fontSize: 11, color: '#4338CA', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8, marginBottom: 20 },
  section: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginTop: 18, marginBottom: 8, textTransform: 'uppercase' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  icon: { fontSize: 28 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 12, color: '#6B7280' },
  check: { fontSize: 20, fontWeight: '700' },
  goalRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  goalCard: {
    width: '48%',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  goalCardActive: { backgroundColor: '#4D96FF', borderColor: '#4D96FF' },
  goalIcon: { fontSize: 28, marginBottom: 4 },
  goalTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  footer: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 24 },
  backBtn: { paddingVertical: 16, paddingHorizontal: 18, borderRadius: 14, backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB' },
  backBtnText: { color: '#374151', fontWeight: '700' },
  cta: { backgroundColor: '#4D96FF', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  ctaText: { color: 'white', fontWeight: '700', fontSize: 16 },
});