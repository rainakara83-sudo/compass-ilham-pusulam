import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import niches from '../../data/niches.json';
import { getNichePool } from '../../services/contentService';

type Niche = { id: string; icon: string; color: string; description?: string };

export default function NichePreview() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const niche = (niches as Niche[]).find((n) => n.id === id);
  const samples = useMemo(() => {
    if (!id) return [];
    const lng = (i18n.language || 'en').split('-')[0] as 'tr' | 'en' | 'es' | 'de' | 'fr';
    return getNichePool(id as any, lng).slice(0, 5);
  }, [id, i18n.language]);

  if (!niche) {
    return (
      <View style={styles.center}>
        <Text>{t('onboardingFlow.nicheNotFound')}</Text>
        <Pressable onPress={() => router.back()} style={styles.cta}>
          <Text style={styles.ctaText}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ presentation: 'modal', title: '', headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.topTitle}>{t('onboardingFlow.nichePreviewTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={[styles.hero, { backgroundColor: niche.color + '15', borderColor: niche.color }]}>
          <Text style={styles.heroIcon}>{niche.icon}</Text>
          <Text style={styles.heroTitle}>{t(`niches.${niche.id}`, niche.id)}</Text>
          {niche.description && <Text style={styles.heroDesc}>{t(`descriptions.${niche.id}`, niche.description)}</Text>}
        </View>

        <Text style={styles.sectionTitle}>{t('onboardingFlow.nichePreviewSubtitle')}</Text>
        {samples.map((idea, idx) => (
          <View key={idx} style={styles.sampleRow}>
            <View style={[styles.sampleNum, { backgroundColor: niche.color }]}>
              <Text style={styles.sampleNumText}>{idx + 1}</Text>
            </View>
            <Text style={styles.sampleText}>{idea}</Text>
          </View>
        ))}

        <Text style={styles.hint}>
          Haftalık 3 fikir otomatik olarak Pazartesi, Çarşamba ve Cuma günleri için hazırlanır.
        </Text>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => router.replace({ pathname: '/(onboarding)/niche-select', params: { preset: niche.id } } as any)}
          style={[styles.cta, { backgroundColor: niche.color }]}
        >
          <Text style={styles.ctaText}>{t('onboardingFlow.nichePreviewPick')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 18, color: '#374151', fontWeight: '700' },
  topTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  hero: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    borderWidth: 2,
    marginBottom: 20,
  },
  heroIcon: { fontSize: 56, marginBottom: 8 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  heroDesc: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12 },
  sampleRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'white', padding: 14, borderRadius: 12, marginBottom: 8, gap: 12 },
  sampleNum: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  sampleNumText: { color: 'white', fontSize: 12, fontWeight: '700' },
  sampleText: { flex: 1, fontSize: 14, color: '#111827', lineHeight: 20 },
  hint: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 16, paddingHorizontal: 20 },
  bottomBar: { padding: 16, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  cta: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  ctaText: { color: 'white', fontWeight: '700', fontSize: 16 },
});