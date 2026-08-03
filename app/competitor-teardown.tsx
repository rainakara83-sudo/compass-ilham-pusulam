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
import {
  CompetitorEntry,
  CompetitorStrength,
  CompetitorTier,
  COMPETITOR_STRENGTHS,
  COMPETITOR_TIERS,
  TrendPlatform,
  TREND_PLATFORMS,
  buildCompetitorInsights,
  clearCompetitors,
  getCompetitorList,
  removeCompetitor,
  saveCompetitor,
  updateCompetitor,
  addCopyToHistory,
} from '../services/storage';
import niches from '../data/niches.json';

const NICHES: { id: string; icon: string; color: string; label: string }[] = niches.map(n => ({
  id: n.id,
  icon: n.icon,
  color: n.color,
  label: n.id.replace('_', ' '),
}));

const formatNumber = (n: number): string => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function CompetitorTeardownScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<CompetitorEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [handle, setHandle] = useState('');
  const [niche, setNiche] = useState<string>('fitness');
  const [platform, setPlatform] = useState<TrendPlatform>('instagram');
  const [tier, setTier] = useState<CompetitorTier>('direct');
  const [topStrength, setTopStrength] = useState<CompetitorStrength>('hook');
  const [preview, setPreview] = useState<Omit<CompetitorEntry, 'id' | 'createdAt'> | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const data = await getCompetitorList();
    setList(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const generatePreview = useCallback(() => {
    const clean = handle.trim().replace(/^@/, '');
    if (clean.length < 2) {
      setPreview(null);
      return;
    }
    setPreview(
      buildCompetitorInsights({
        handle: clean,
        niche,
        platform,
        tier,
        topStrength,
      })
    );
  }, [handle, niche, platform, tier, topStrength]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  const onSave = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    const next = await saveCompetitor(preview);
    setList(next);
    setSaving(false);
    setHandle('');
    setPreview(null);
    setToast('Rakip kaydedildi ✓');
  }, [preview]);

  const onRemove = useCallback(async (id: string) => {
    Alert.alert('Sil', 'Bu kaydı silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeCompetitor(id);
          setList(next);
          if (openId === id) setOpenId(null);
        },
      },
    ]);
  }, [openId]);

  const onClear = useCallback(() => {
    if (list.length === 0) return;
    Alert.alert('Tümünü sil', `${list.length} kayıt silinecek. Emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearCompetitors();
          setList([]);
          setToast('Tüm rakipler silindi');
        },
      },
    ]);
  }, [list.length]);

  const onCopy = useCallback(async (text: string) => {
    Clipboard.setString(text);
    await addCopyToHistory(text, 'pool');
    setToast('Kopyalandı ✓');
  }, []);

  const onSaveNotes = useCallback(
    async (id: string) => {
      const note = notesDraft[id];
      if (note === undefined) return;
      const next = await updateCompetitor(id, { notes: note });
      setList(next);
      setToast('Not güncellendi ✓');
      setNotesDraft(prev => {
        const c = { ...prev };
        delete c[id];
        return c;
      });
    },
    [notesDraft]
  );

  const summary = useMemo(() => {
    const byTier: Record<CompetitorTier, number> = { direct: 0, adjacent: 0, aspirational: 0 };
    list.forEach(c => {
      byTier[c.tier] += 1;
    });
    const avgFollowers = list.length === 0 ? 0 : Math.round(list.reduce((s, c) => s + c.followers, 0) / list.length);
    const avgCadence = list.length === 0 ? 0 : (list.reduce((s, c) => s + c.postsPerWeek, 0) / list.length).toFixed(1);
    return { byTier, avgFollowers, avgCadence };
  }, [list]);

  const tierKeys = Object.keys(COMPETITOR_TIERS) as CompetitorTier[];
  const strengthKeys = Object.keys(COMPETITOR_STRENGTHS) as CompetitorStrength[];

  const nicheLabel = (id: string) => NICHES.find(n => n.id === id)?.label ?? id;
  const nicheIcon = (id: string) => NICHES.find(n => n.id === id)?.icon ?? '📌';

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Rakip Teardown',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Bir rakibin handle'ını gir, niş + tier + güç seç. Otomatik içgörü üretir.
        </Text>

        {/* HANDLE */}
        <Text style={styles.sectionLabel}>Handle</Text>
        <TextInput
          value={handle}
          onChangeText={txt => setHandle(txt.replace(/\s/g, ''))}
          placeholder="@örnekhesap"
          placeholderTextColor="#475569"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        {/* NICHE */}
        <Text style={styles.sectionLabel}>Niche</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {NICHES.map(n => {
            const active = niche === n.id;
            return (
              <Pressable
                key={n.id}
                onPress={() => setNiche(n.id)}
                style={[styles.chip, active && { backgroundColor: n.color, borderColor: n.color }]}
              >
                <Text style={styles.chipIcon}>{n.icon}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{n.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* PLATFORM */}
        <Text style={styles.sectionLabel}>Platform</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {TREND_PLATFORMS.map(p => {
            const active = platform === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPlatform(p.id)}
                style={[styles.chip, active && { backgroundColor: p.color, borderColor: p.color }]}
              >
                <Text style={styles.chipIcon}>{p.emoji}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* TIER */}
        <Text style={styles.sectionLabel}>Tier</Text>
        <View style={styles.chipRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {tierKeys.map(tk => {
              const meta = COMPETITOR_TIERS[tk];
              const active = tier === tk;
              return (
                <Pressable
                  key={tk}
                  onPress={() => setTier(tk)}
                  style={[styles.chip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
                >
                  <Text style={styles.chipIcon}>{meta.emoji}</Text>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* STRENGTH */}
        <Text style={styles.sectionLabel}>En güçlü yanı</Text>
        <View style={styles.chipRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {strengthKeys.map(sk => {
              const meta = COMPETITOR_STRENGTHS[sk];
              const active = topStrength === sk;
              return (
                <Pressable
                  key={sk}
                  onPress={() => setTopStrength(sk)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={styles.chipIcon}>{meta.emoji}</Text>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* PREVIEW */}
        {preview && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewHandle}>@{preview.handle}</Text>
              <View style={[styles.tierBadge, { backgroundColor: COMPETITOR_TIERS[preview.tier].color + '22', borderColor: COMPETITOR_TIERS[preview.tier].color }]}>
                <Text style={styles.tierBadgeEmoji}>{COMPETITOR_TIERS[preview.tier].emoji}</Text>
                <Text style={[styles.tierBadgeText, { color: COMPETITOR_TIERS[preview.tier].color }]}>
                  {COMPETITOR_TIERS[preview.tier].label}
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{formatNumber(preview.followers)}</Text>
                <Text style={styles.statLabel}>takipçi (tahmini)</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{preview.postsPerWeek}/hafta</Text>
                <Text style={styles.statLabel}>paylaşım</Text>
              </View>
            </View>

            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>🎯 Güçlü yanı</Text>
              <Text style={styles.previewText}>
                {COMPETITOR_STRENGTHS[preview.topStrength].label} — {COMPETITOR_STRENGTHS[preview.topStrength].tip}
              </Text>
            </View>

            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>⚠️ Zayıf nokta</Text>
              <Text style={styles.previewText}>{preview.weakness}</Text>
            </View>

            <View style={[styles.previewSection, { backgroundColor: '#6366f1' + '15' }]}>
              <Text style={[styles.previewLabel, { color: '#6366f1' }]}>🪝 Çalınabilecek hook</Text>
              <Text style={styles.previewText}>{preview.stealableHook}</Text>
            </View>

            <View style={[styles.previewSection, { backgroundColor: '#10B981' + '15' }]}>
              <Text style={[styles.previewLabel, { color: '#10B981' }]}>🎬 Çalınabilecek format</Text>
              <Text style={styles.previewText}>{preview.stealableFormat}</Text>
            </View>

            <Text style={styles.tierTip}>💡 {COMPETITOR_TIERS[preview.tier].tip}</Text>

            <View style={styles.previewActions}>
              <Pressable
                onPress={() => onCopy(`${preview.handle} — Hook: ${preview.stealableHook} | Format: ${preview.stealableFormat}`)}
                style={styles.copyBtn}
              >
                <Text style={styles.copyBtnText}>📋 Kopyala</Text>
              </Pressable>
              <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>💾 Kaydet</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {!preview && handle.length >= 2 && (
          <View style={styles.previewCard}>
            <ActivityIndicator color="#6366f1" />
          </View>
        )}

        {/* SAVED LIST */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🗂️ Kayıtlı Rakipler ({list.length})</Text>
            {list.length > 0 && (
              <Pressable onPress={onClear}>
                <Text style={styles.clearBtn}>Tümünü sil</Text>
              </Pressable>
            )}
          </View>

          {list.length > 0 && (
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ortalama takipçi</Text>
                <Text style={styles.summaryValue}>{formatNumber(summary.avgFollowers)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ortalama kadans</Text>
                <Text style={styles.summaryValue}>{summary.avgCadence}/hafta</Text>
              </View>
              <View style={styles.tierRow}>
                {tierKeys.map(tk => {
                  const meta = COMPETITOR_TIERS[tk];
                  return (
                    <View key={tk} style={[styles.tierSummaryChip, { borderColor: meta.color }]}>
                      <Text style={styles.tierSummaryEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.tierSummaryCount, { color: meta.color }]}>{summary.byTier[tk]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {list.length === 0 ? (
            <Text style={styles.empty}>Henüz rakip yok. Yukarıdan bir handle gir.</Text>
          ) : (
            list.map(c => {
              const tierMeta = COMPETITOR_TIERS[c.tier];
              const strMeta = COMPETITOR_STRENGTHS[c.topStrength];
              const platformMeta = TREND_PLATFORMS.find(p => p.id === c.platform);
              const open = openId === c.id;
              return (
                <View key={c.id} style={styles.entry}>
                  <Pressable onPress={() => setOpenId(open ? null : c.id)} style={styles.entryHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryHandle} numberOfLines={1}>
                        {nicheIcon(c.niche)} @{c.handle}
                      </Text>
                      <View style={styles.entryMetaRow}>
                        <Text style={styles.entryMeta}>{platformMeta?.emoji} {platformMeta?.label}</Text>
                        <Text style={styles.entryMeta}> · {formatNumber(c.followers)}</Text>
                        <Text style={styles.entryMeta}> · {c.postsPerWeek}/hf</Text>
                      </View>
                    </View>
                    <View style={[styles.tierBadge, { backgroundColor: tierMeta.color + '22', borderColor: tierMeta.color }]}>
                      <Text style={styles.tierBadgeEmoji}>{tierMeta.emoji}</Text>
                    </View>
                  </Pressable>

                  <View style={styles.strengthRow}>
                    <Text style={styles.strengthEmoji}>{strMeta.emoji}</Text>
                    <Text style={styles.strengthText}>{strMeta.label}</Text>
                  </View>

                  {open && (
                    <View style={styles.entryDetail}>
                      <Text style={styles.entryLabel}>⚠️ Zayıf nokta</Text>
                      <Text style={styles.entryText}>{c.weakness}</Text>

                      <Text style={[styles.entryLabel, { color: '#6366f1', marginTop: 10 }]}>🪝 Çalınabilecek hook</Text>
                      <Text style={styles.entryText}>{c.stealableHook}</Text>

                      <Text style={[styles.entryLabel, { color: '#10B981', marginTop: 10 }]}>🎬 Çalınabilecek format</Text>
                      <Text style={styles.entryText}>{c.stealableFormat}</Text>

                      <Text style={[styles.entryLabel, { marginTop: 10 }]}>Notlar</Text>
                      <TextInput
                        value={notesDraft[c.id] ?? c.notes}
                        onChangeText={txt => setNotesDraft(prev => ({ ...prev, [c.id]: txt }))}
                        placeholder="Not ekle..."
                        placeholderTextColor="#475569"
                        style={styles.notesInput}
                        multiline
                      />
                      <Text style={styles.entryDate}>{formatDate(c.createdAt)}</Text>

                      <View style={styles.entryActions}>
                        <Pressable
                          onPress={() => onSaveNotes(c.id)}
                          disabled={notesDraft[c.id] === undefined}
                          style={[styles.smallBtn, notesDraft[c.id] === undefined && { opacity: 0.4 }]}
                        >
                          <Text style={styles.smallBtnText}>💾 Notu kaydet</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onCopy(`${c.handle} — Hook: ${c.stealableHook}`)}
                          style={styles.smallBtn}
                        >
                          <Text style={styles.smallBtnText}>📋 Kopyala</Text>
                        </Pressable>
                        <Pressable onPress={() => onRemove(c.id)} style={[styles.smallBtn, { borderColor: '#F97316' }]}>
                          <Text style={[styles.smallBtnText, { color: '#F97316' }]}>🗑️ Sil</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Geri</Text>
        </Pressable>
      </ScrollView>

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16 },
  intro: { color: '#94a3b8', fontSize: 13, marginBottom: 16, lineHeight: 18 },
  sectionLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  chipRow: { marginBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipIcon: { fontSize: 16, marginRight: 6 },
  chipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0f172a' },
  previewCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewHandle: { color: '#f8fafc', fontSize: 18, fontWeight: '700', flex: 1 },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  tierBadgeEmoji: { fontSize: 14 },
  tierBadgeText: { fontSize: 11, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statValue: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  previewSection: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  previewText: { color: '#e2e8f0', fontSize: 13, lineHeight: 18 },
  tierTip: { color: '#94a3b8', fontSize: 12, marginTop: 8, marginBottom: 12, fontStyle: 'italic' },
  previewActions: { flexDirection: 'row', gap: 8 },
  copyBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  copyBtnText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  clearBtn: { color: '#F97316', fontSize: 12, fontWeight: '600' },
  summaryBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: { color: '#94a3b8', fontSize: 12 },
  summaryValue: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  tierRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  tierSummaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  tierSummaryEmoji: { fontSize: 12 },
  tierSummaryCount: { fontSize: 13, fontWeight: '700' },
  empty: { color: '#64748b', fontSize: 13, fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },
  entry: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  entryHandle: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  entryMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  entryMeta: { color: '#94a3b8', fontSize: 11 },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  strengthEmoji: { fontSize: 12, marginRight: 4 },
  strengthText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  entryDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  entryLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  entryText: { color: '#e2e8f0', fontSize: 13, lineHeight: 18 },
  entryDate: { color: '#64748b', fontSize: 11, marginTop: 8 },
  notesInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    color: '#f8fafc',
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 4,
    marginBottom: 4,
  },
  entryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  smallBtnText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  backBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  backBtnText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});