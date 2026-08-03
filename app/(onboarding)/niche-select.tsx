import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import niches from '../../data/niches.json';
import { setStoredNiche } from '../../services/storage';
import { NicheId } from '../../services/contentService';

type Niche = { id: string; icon: string; color: string; description?: string; popularity?: number };

export default function NicheSelect() {
  const router = useRouter();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const list = niches as Niche[];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((n) =>
      t(`niches.${n.id}`, n.id).toLowerCase().includes(q) ||
      (n.description?.toLowerCase().includes(q) ?? false)
    );
  }, [list, query, t]);

  const onContinue = async () => {
    if (!selected) return;
    await setStoredNiche(selected as NicheId);
    router.push('/(onboarding)/experience-select');
  };

  return (
    <View style={styles.container}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepText}>2 / 4</Text>
      </View>
      <Text style={styles.title}>{t('onboarding.title')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>

      <TextInput
        style={styles.search}
        placeholder="Niş ara..."
        value={query}
        onChangeText={setQuery}
        placeholderTextColor="#9CA3AF"
      />

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {filtered
          .slice()
          .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
          .map((n) => {
            const isSel = selected === n.id;
            const isPopular = (n.popularity ?? 0) >= 85;
            return (
              <Pressable
                key={n.id}
                onPress={() => setSelected(n.id)}
                onLongPress={() => router.push({ pathname: '/(onboarding)/niche-preview', params: { id: n.id } })}
                delayLongPress={400}
                style={[
                  styles.card,
                  { borderColor: isSel ? n.color : '#E5E7EB', backgroundColor: isSel ? n.color + '15' : 'white' },
                ]}
              >
                {isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>⭐ ÖNERİLEN</Text>
                  </View>
                )}
                <Text style={styles.icon}>{n.icon}</Text>
                <Text style={styles.label}>{t(`niches.${n.id}`, n.id)}</Text>
                {n.description && <Text style={styles.desc}>{n.description}</Text>}
                <Text style={styles.hint}>Basılı tut: örnekler</Text>
              </Pressable>
            );
          })}
        {filtered.length === 0 && (
          <Text style={styles.noResults}>"{query}" için sonuç yok</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Geri</Text>
        </Pressable>
        <Pressable
          onPress={onContinue}
          disabled={!selected}
          style={[styles.cta, { opacity: selected ? 1 : 0.4, flex: 1 }]}
        >
          <Text style={styles.ctaText}>{t('common.continue')}</Text>
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
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8, marginBottom: 16 },
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
  icon: { fontSize: 36, marginBottom: 6 },
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
  footer: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  backBtn: { paddingVertical: 16, paddingHorizontal: 18, borderRadius: 14, backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB' },
  backBtnText: { color: '#374151', fontWeight: '700' },
  cta: { backgroundColor: '#4D96FF', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  ctaText: { color: 'white', fontWeight: '700', fontSize: 16 },
});