import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import niches from '../../data/niches.json';
import { addStoredNiche, setActiveNiche, setStoredNiches } from '../../services/storage';
import { NicheId } from '../../services/contentService';
import { sagePalette } from '../../styles/colors';
import { NicheImage } from '../../components/NicheImage';

type Niche = { id: string; icon: string; color: string; description?: string; popularity?: number; image?: string };

export default function NicheSelect() {
  const router = useRouter();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const list = niches as Niche[];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((n) =>
      t(`niches.${n.id}`, n.id).toLowerCase().includes(q) ||
      t(`descriptions.${n.id}`, n.description ?? '').toLowerCase().includes(q)
    );
  }, [list, query, t]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const onContinue = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected) as NicheId[];
    await setStoredNiches(ids);
    const first = ids[0];
    await addStoredNiche(first);
    await setActiveNiche(first);
    router.push('/(onboarding)/experience-select');
  };

  return (
    <View style={styles.container}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepText}>{t('onboardingFlow.stepOf', { current: 2, total: 4 })}</Text>
      </View>
      <Text style={styles.title}>{t('onboardingFlow.nicheTitle')}</Text>
      <Text style={styles.subtitle}>{t('onboardingFlow.nicheSubtitle')}</Text>

      <View style={styles.helperRow}>
        <Text style={styles.helperText}>
          {t('onboardingFlow.nicheHelper', { count: selected.size })}
        </Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder={t('onboardingFlow.nicheSearchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        placeholderTextColor="#9CA3AF"
      />

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {filtered
          .slice()
          .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
          .map((n) => {
            const isSel = selected.has(n.id);
            const isPopular = (n.popularity ?? 0) >= 85;
            return (
              <Pressable
                key={n.id}
                onPress={() => toggle(n.id)}
                onLongPress={() => router.push({ pathname: '/(onboarding)/niche-preview', params: { id: n.id } })}
                delayLongPress={400}
                style={[
                  styles.card,
                  { borderColor: isSel ? n.color : '#C5D2A0', backgroundColor: isSel ? n.color + '15' : 'white' },
                ]}
              >
                {isSel && (
                  <View style={[styles.checkBubble, { backgroundColor: n.color }]}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
                {isPopular && !isSel && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>{t('onboardingFlow.nichePopularBadge')}</Text>
                  </View>
                )}
                <NicheImage nicheId={n.id} size={88} borderRadius={14} />
                <Text style={styles.label}>{t(`niches.${n.id}`, n.id)}</Text>
                {n.description && <Text style={styles.desc}>{t(`descriptions.${n.id}`, n.description)}</Text>}
                <Text style={styles.hint}>{t('onboardingFlow.nicheHoldHint')}</Text>
              </Pressable>
            );
          })}
        {filtered.length === 0 && (
          <Text style={styles.noResults}>{t('onboardingFlow.nicheNoResults', { query })}</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={() => router.replace('/(onboarding)/language-select')} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t('onboardingFlow.nicheBack')}</Text>
        </Pressable>
        <Pressable
          onPress={onContinue}
          disabled={selected.size === 0}
          style={[styles.cta, { opacity: selected.size > 0 ? 1 : 0.4, flex: 1 }]}
        >
          <Text style={styles.ctaText}>{t('common.continue')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80, paddingHorizontal: 20, backgroundColor: sagePalette.bg },
  stepBadge: { alignSelf: 'flex-start', backgroundColor: sagePalette.accentSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  stepText: { fontSize: 11, color: sagePalette.accentDeep, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800', color: sagePalette.text },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8, marginBottom: 8 },
  helperRow: { marginBottom: 12 },
  helperText: { fontSize: 13, color: sagePalette.accentDeep, fontWeight: '700' },
  search: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    marginBottom: 16,
  },
  noResults: { width: '100%', textAlign: 'center', color: '#6B7280', paddingVertical: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 24 },
  card: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    padding: 14,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { fontSize: 14, fontWeight: '700', color: '#111827', textAlign: 'center' },
  desc: { fontSize: 11, color: '#6B7280', textAlign: 'center', marginTop: 4, lineHeight: 14 },
  hint: { fontSize: 9, color: '#9CA3AF', textAlign: 'center', marginTop: 6, fontStyle: 'italic' },
  popularBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularBadgeText: { fontSize: 9, fontWeight: '800', color: '#92400E', letterSpacing: 0.5 },
  checkBubble: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  checkText: { color: 'white', fontSize: 14, fontWeight: '900' },
  footer: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  backBtn: { paddingVertical: 16, paddingHorizontal: 18, borderRadius: 14, backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB' },
  backBtnText: { color: '#374151', fontWeight: '700' },
  cta: { backgroundColor: '#4D96FF', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  ctaText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
