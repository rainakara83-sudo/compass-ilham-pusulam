import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
  getDayNames,
  THEME_PILLARS,
  ThemeWeek,
  buildWeekTheme,
  clearThemeWeeks,
  getThemeWeekList,
  removeThemeWeek,
  saveThemeWeek,
  startOfWeek,
  addCopyToHistory,
} from '../services/storage';

const fmtDate = (ts: number): string => {
  const d = new Date(ts);
  const lng = (i18n.language || 'en').split('-')[0];
  return d.toLocaleDateString(lng, { day: '2-digit', month: 'short' });
};

const fmtRange = (ts: number): string => {
  const start = new Date(ts);
  const end = new Date(ts);
  end.setDate(end.getDate() + 6);
  const lng = (i18n.language || 'en').split('-')[0];
  const f = (d: Date) => d.toLocaleDateString(lng, { day: '2-digit', month: 'short' });
  return `${f(start)} – ${f(end)}`;
};

export default function WeeklyThemeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { i18n: i18nInstance } = useTranslation();
  const [list, setList] = useState<ThemeWeek[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const DAY_NAMES = useMemo(() => getDayNames(), [i18nInstance.language]);

  const [theme, setTheme] = useState('');
  const [pillar, setPillar] = useState('education');
  const [weekStart, setWeekStart] = useState<number>(startOfWeek(Date.now()));
  const [preview, setPreview] = useState<Omit<ThemeWeek, 'id' | 'createdAt'> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const l = await getThemeWeekList();
    setList(l);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const handlePrev = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d.getTime());
  };

  const handleNext = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d.getTime());
  };

  const handleToday = () => setWeekStart(startOfWeek(Date.now()));

  const handleGenerate = () => {
    if (!theme.trim()) {
      Alert.alert('Eksik bilgi', 'Tema yaz (örn: sabah rutini).');
      return;
    }
    setGenerating(true);
    const built = buildWeekTheme({ theme: theme.trim(), pillar, weekStart });
    setPreview(built);
    setGenerating(false);
  };

  const handleReroll = () => {
    if (!theme.trim()) return;
    const built = buildWeekTheme({ theme: theme.trim(), pillar, weekStart, seed: Date.now() });
    setPreview(built);
  };

  const handleSave = async () => {
    if (!preview) return;
    const next = await saveThemeWeek(preview);
    setList(next);
    await addCopyToHistory(`[theme-week] ${preview.theme}/${preview.pillar}`);
    setToast('Hafta kaydedildi ✓');
  };

  const handleDelete = (id: string) => {
    Alert.alert('Tema silinsin mi?', 'Bu hafta planı listeden çıkar.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeThemeWeek(id);
          setList(next);
          if (openId === id) setOpenId(null);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (list.length === 0) return;
    Alert.alert('Tüm haftalar silinsin mi?', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearThemeWeeks();
          setList([]);
          setOpenId(null);
          setToast('Liste temizlendi');
        },
      },
    ]);
  };

  const copy = (label: string, text: string) => {
    Clipboard.setString(text);
    addCopyToHistory(`[theme-copy] ${label}`);
    setToast(`${label} kopyalandı ✓`);
  };

  const renderDayRow = (
    day: number,
    subtopic: string,
    format: string,
    hook: string,
    isPreview: boolean,
    id?: string
  ) => (
    <View key={`${id ?? 'preview'}-${day}`} style={styles.dayRow}>
      <View style={styles.dayLabel}>
        <Text style={styles.dayName}>{DAY_NAMES[day]}</Text>
      </View>
      <View style={styles.dayBody}>
        <Text style={styles.dayFormat}>{format}</Text>
        <Text style={styles.daySub}>{subtopic}</Text>
        <Pressable onPress={() => copy('Hook', hook)}>
          <Text style={styles.dayHook} numberOfLines={2}>{hook}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderCard = (w: ThemeWeek) => {
    const pillarMeta = THEME_PILLARS.find(p => p.id === w.pillar);
    const isOpen = openId === w.id;
    return (
      <Pressable
        key={w.id}
        style={[styles.card, isOpen && { borderColor: pillarMeta?.color }]}
        onPress={() => setOpenId(isOpen ? null : w.id)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{w.theme}</Text>
            <Text style={styles.cardSub}>
              {pillarMeta?.emoji} {pillarMeta?.label} · {fmtDate(w.weekStart)}
            </Text>
          </View>
        </View>
        <Text style={styles.cardRange}>{fmtRange(w.weekStart)}</Text>
        {isOpen ? (
          <View style={styles.detail}>
            {w.days.map(d => renderDayRow(d.day, d.subtopic, d.format, d.hook, false, w.id))}
            <Pressable
              style={styles.fullCopyBtn}
              onPress={() =>
                copy(
                  'Tüm hafta',
                  w.days
                    .map(
                      (d, i) =>
                        `${DAY_NAMES[d.day]} (${d.format}): ${d.subtopic}\n  Hook: ${d.hook}`
                    )
                    .join('\n')
                )
              }
            >
              <Text style={styles.fullCopyText}>📋 Haftanın tamamını kopyala</Text>
            </Pressable>
            <Pressable style={styles.deleteBtn} onPress={() => handleDelete(w.id)}>
              <Text style={styles.deleteBtnText}>🗑️ Haftayı sil</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.cardHint} numberOfLines={2}>
            {w.days[0].subtopic} · {w.days[1].subtopic} · {w.days[2].subtopic}…
          </Text>
        )}
      </Pressable>
    );
  };

  const pillarMeta = useMemo(
    () => THEME_PILLARS.find(p => p.id === pillar) ?? THEME_PILLARS[0],
    [pillar]
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Weekly Theme', headerShown: true }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>🎯 Weekly Theme Planner</Text>
          <Text style={styles.heroSub}>
            Haftaya tek bir ana tema seç; her gün için farklı alt konu, format ve hook üretilsin.
            Sütun tutarlılığı topluluk sadakatini artırır.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yeni Haftalık Tema</Text>

          <Text style={styles.label}>Tema / ana konu *</Text>
          <TextInput
            style={styles.input}
            value={theme}
            onChangeText={setTheme}
            placeholder="ör: sabah rutini, içerik üretimi"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>İçerik direği (pillar)</Text>
          <View style={styles.chipRow}>
            {THEME_PILLARS.map(p => {
              const active = pillar === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[
                    styles.chip,
                    active && { backgroundColor: p.color, borderColor: p.color },
                  ]}
                  onPress={() => setPillar(p.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {p.emoji} {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.weekNav}>
            <Pressable style={styles.navBtn} onPress={handlePrev}>
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
            <Pressable style={styles.navMid} onPress={handleToday}>
              <Text style={styles.navMidText}>{fmtRange(weekStart)}</Text>
              <Text style={styles.navMidSub}>bugüne dön</Text>
            </Pressable>
            <Pressable style={styles.navBtn} onPress={handleNext}>
              <Text style={styles.navBtnText}>›</Text>
            </Pressable>
          </View>

          <View style={[styles.tipBox, { borderLeftColor: pillarMeta.color }]}>
            <Text style={styles.tipTitle}>
              {pillarMeta.emoji} {pillarMeta.label} sütunu
            </Text>
            <Text style={styles.tipText}>
              {pillar === 'education' && 'İzleyiciye değer kat. Kaydetme oranı yüksek olur.'}
              {pillar === 'story' && 'Kişisel bağ kur. Yorum ve DM artışı beklenir.'}
              {pillar === 'opinion' && 'Tartışma başlat. Reach yükselir, biraz negatifsiz riskli.'}
              {pillar === 'howto' && 'Pratik değer ver. Paylaşım oranı yüksek olur.'}
              {pillar === 'fun' && 'Erişim patlaması. Yorum hızı artar.'}
              {pillar === 'community' && 'Sadakat inşa et. Takipçi tutma oranı yükselir.'}
              {pillar === 'behind' && 'Güven inşa et. Beğeni/kaydet dengesi güçlü.'}
            </Text>
          </View>

          <View style={styles.ctaRow}>
            <Pressable
              style={[styles.cta, styles.ctaPrimary, generating && { opacity: 0.6 }]}
              onPress={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>✨ Haftayı üret</Text>
              )}
            </Pressable>
            {preview ? (
              <Pressable style={[styles.cta, styles.ctaReroll]} onPress={handleReroll}>
                <Text style={styles.ctaText}>🎲 Yenile</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {preview ? (
          <View style={styles.section}>
            <View style={styles.previewHeader}>
              <Text style={styles.sectionTitle}>Önizleme</Text>
              <View style={[styles.pillarPill, { backgroundColor: pillarMeta.color }]}>
                <Text style={styles.pillarPillText}>
                  {pillarMeta.emoji} {pillarMeta.label}
                </Text>
              </View>
            </View>
            {preview.days.map(d =>
              renderDayRow(d.day, d.subtopic, d.format, d.hook, true)
            )}
            <Pressable style={[styles.cta, styles.ctaSave]} onPress={handleSave}>
              <Text style={styles.ctaText}>💾 Haftayı kaydet</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Kayıtlı Haftalar ({list.length})</Text>
            {list.length > 0 ? (
              <Pressable onPress={handleClearAll} hitSlop={10}>
                <Text style={styles.clearText}>Hepsini sil</Text>
              </Pressable>
            ) : null}
          </View>

          {list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <Text style={styles.emptyText}>
                Henüz kayıtlı hafta yok. Yukarıdan bir tane üret, buraya gelsin.
              </Text>
            </View>
          ) : (
            list.map(renderCard)
          )}
        </View>
      </ScrollView>

      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 32 },
  hero: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginBottom: 16 },
  heroTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  heroSub: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  section: { backgroundColor: '#1e293b', borderRadius: 16, padding: 14, marginBottom: 16 },
  sectionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  label: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 6,
    marginTop: 12,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  navMid: { flex: 1, alignItems: 'center' },
  navMidText: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  navMidSub: { color: '#94a3b8', fontSize: 10, marginTop: 2 },

  tipBox: {
    marginTop: 12,
    backgroundColor: '#0f172a',
    borderLeftWidth: 3,
    padding: 10,
    borderRadius: 8,
  },
  tipTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  tipText: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },

  ctaRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cta: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaPrimary: { backgroundColor: '#6366f1' },
  ctaReroll: { backgroundColor: '#475569' },
  ctaSave: { backgroundColor: '#10B981', marginTop: 12 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pillarPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillarPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  dayRow: { flexDirection: 'row', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  dayLabel: { width: 44 },
  dayName: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' },
  dayBody: { flex: 1 },
  dayFormat: { color: '#94a3b8', fontSize: 10, fontWeight: '700' },
  daySub: { color: '#f8fafc', fontSize: 13, fontWeight: '600', marginTop: 2 },
  dayHook: { color: '#cbd5e1', fontSize: 12, marginTop: 4, lineHeight: 16 },

  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearText: { color: '#f87171', fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  cardSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  cardRange: { color: '#a5b4fc', fontSize: 12, fontWeight: '600', marginTop: 6 },
  cardHint: { color: '#94a3b8', fontSize: 11, marginTop: 6, fontStyle: 'italic' },

  detail: { marginTop: 10 },
  fullCopyBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  fullCopyText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  deleteBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
  },
  deleteBtnText: { color: '#f87171', fontSize: 12, fontWeight: '700' },

  empty: { alignItems: 'center', padding: 24 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { color: '#94a3b8', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});