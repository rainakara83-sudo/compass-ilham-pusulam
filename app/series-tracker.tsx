import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  SeriesEntry,
  TRACKER_EP_STATUS_META,
  TRACKER_STATUS_META,
  TrackerEp,
  TrackerStatus,
  addTrackerEp,
  clearTracker,
  getTrackerList,
  removeTracker,
  removeTrackerEp,
  saveTracker,
  trackerProgress,
  updateTracker,
  updateTrackerEp,
} from '../services/storage';

const STATUS_ORDER: TrackerEp['status'][] = ['planned', 'shot', 'edited', 'published'];
const SERIES_STATUSES: TrackerStatus[] = ['active', 'paused', 'finished', 'abandoned'];
const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'blog'];

const fmtDate = (ts: number | null): string => {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
};

export default function SeriesTrackerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<SeriesEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [format, setFormat] = useState('Reels');
  const [totalEpisodes, setTotalEpisodes] = useState('5');
  const [cadenceDays, setCadenceDays] = useState('7');

  const [episodeDraft, setEpisodeDraft] = useState<{ [seriesId: string]: { title: string; number: string } }>({});

  const load = useCallback(async () => {
    const l = await getTrackerList();
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

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Eksik bilgi', 'Seri adı yazmalısın.');
      return;
    }
    const total = Math.max(1, Math.min(60, parseInt(totalEpisodes, 10) || 5));
    const cadence = Math.max(1, Math.min(60, parseInt(cadenceDays, 10) || 7));
    const next = await saveTracker({
      name: name.trim(),
      description: description.trim(),
      platform,
      format,
      totalEpisodes: total,
      cadenceDays: cadence,
      status: 'active',
    });
    setList(next);
    setName('');
    setDescription('');
    setTotalEpisodes('5');
    setCadenceDays('7');
    setToast('Seri oluşturuldu ✓');
  };

  const handleCycleStatus = async (id: string, current: TrackerStatus) => {
    const idx = SERIES_STATUSES.indexOf(current);
    const next = SERIES_STATUSES[(idx + 1) % SERIES_STATUSES.length];
    const list2 = await updateTracker(id, { status: next });
    setList(list2);
  };

  const handleDeleteSeries = (id: string) => {
    Alert.alert('Seri silinsin mi?', 'Tüm episode kayıtları silinir.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeTracker(id);
          setList(next);
          if (openId === id) setOpenId(null);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (list.length === 0) return;
    Alert.alert('Tüm seriler silinsin mi?', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearTracker();
          setList([]);
          setOpenId(null);
          setToast('Liste temizlendi');
        },
      },
    ]);
  };

  const handleAddEpisode = async (seriesId: string) => {
    const draft = episodeDraft[seriesId] ?? { title: '', number: '' };
    if (!draft.title.trim()) {
      Alert.alert('Eksik bilgi', 'Episode başlığı yaz.');
      return;
    }
    const series = list.find(s => s.id === seriesId);
    if (!series) return;
    const used = new Set(series.episodes.map(e => e.number));
    let num = parseInt(draft.number, 10);
    if (isNaN(num) || num <= 0) {
      num = series.episodes.length + 1;
    }
    while (used.has(num) && num <= 100) num += 1;

    const next = await addTrackerEp(seriesId, {
      number: num,
      title: draft.title.trim(),
      platform: series.platform,
      status: 'planned',
      publishedAt: null,
      notes: '',
    });
    setList(next);
    setEpisodeDraft(d => ({ ...d, [seriesId]: { title: '', number: '' } }));
    setToast(`Episode ${num} eklendi ✓`);
  };

  const handleCycleEpisodeStatus = async (seriesId: string, ep: TrackerEp) => {
    const idx = STATUS_ORDER.indexOf(ep.status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    const patch: Partial<TrackerEp> = { status: next };
    if (next === 'published' && !ep.publishedAt) patch.publishedAt = Date.now();
    const list2 = await updateTrackerEp(seriesId, ep.id, patch);
    setList(list2);
  };

  const handleDeleteEpisode = (seriesId: string, epId: string) => {
    Alert.alert('Episode silinsin mi?', 'Bu bölüm kaldırılır.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeTrackerEp(seriesId, epId);
          setList(next);
        },
      },
    ]);
  };

  const renderEpisode = (series: SeriesEntry, ep: TrackerEp) => {
    const meta = TRACKER_EP_STATUS_META[ep.status];
    return (
      <Pressable
        key={ep.id}
        style={[styles.epRow, { borderLeftColor: meta.color }]}
        onPress={() => handleCycleEpisodeStatus(series.id, ep)}
        onLongPress={() => handleDeleteEpisode(series.id, ep.id)}
      >
        <View style={styles.epNum}>
          <Text style={styles.epNumText}>#{ep.number}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.epTitle}>{ep.title}</Text>
          <Text style={styles.epMeta}>
            {meta.emoji} {meta.label}
            {ep.publishedAt ? ` · ${fmtDate(ep.publishedAt)}` : ''}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderSeries = (s: SeriesEntry) => {
    const status = TRACKER_STATUS_META[s.status];
    const prog = trackerProgress(s);
    const isOpen = openId === s.id;
    const draft = episodeDraft[s.id] ?? { title: '', number: '' };
    return (
      <View key={s.id} style={[styles.card, isOpen && { borderColor: status.color }]}>
        <Pressable style={styles.cardHead} onPress={() => setOpenId(isOpen ? null : s.id)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{s.name}</Text>
            <Text style={styles.cardSub}>
              {s.platform} · {s.format} · {s.totalEpisodes} bölüm · her {s.cadenceDays} gün
            </Text>
          </View>
          <Pressable
            onPress={() => handleCycleStatus(s.id, s.status)}
            style={[styles.statusPill, { backgroundColor: status.color }]}
          >
            <Text style={styles.statusPillText}>
              {status.emoji} {status.label}
            </Text>
          </Pressable>
        </Pressable>

        <View style={styles.progressWrap}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${prog.percent}%`, backgroundColor: status.color }]} />
          </View>
          <Text style={styles.progressText}>
            %{prog.percent} tamamlandı · {prog.published}/{s.totalEpisodes} yayında ·{' '}
            {prog.remainingDays} gün kaldı
          </Text>
        </View>

        {isOpen ? (
          <View style={styles.detail}>
            {s.description ? (
              <Text style={styles.desc}>{s.description}</Text>
            ) : null}

            <View style={styles.epHeader}>
              <Text style={styles.sectionTitle}>Episode'lar ({s.episodes.length})</Text>
              {s.episodes.length > 0 ? (
                <Text style={styles.epHint}>dokun → status ilerler · uzun bas → sil</Text>
              ) : null}
            </View>

            {s.episodes.length === 0 ? (
              <Text style={styles.epEmpty}>henüz episode yok</Text>
            ) : (
              s.episodes.map(e => renderEpisode(s, e))
            )}

            <View style={styles.addEpBox}>
              <Text style={styles.addEpTitle}>➕ Yeni Episode</Text>
              <View style={styles.addEpRow}>
                <TextInput
                  style={[styles.input, { flex: 0.4, marginRight: 6 }]}
                  value={draft.number}
                  onChangeText={v => setEpisodeDraft(d => ({ ...d, [s.id]: { ...draft, number: v } }))}
                  placeholder="#"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={draft.title}
                  onChangeText={v => setEpisodeDraft(d => ({ ...d, [s.id]: { ...draft, title: v } }))}
                  placeholder="episode başlığı"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <Pressable style={styles.addEpBtn} onPress={() => handleAddEpisode(s.id)}>
                <Text style={styles.addEpBtnText}>Ekle</Text>
              </Pressable>
            </View>

            <Pressable style={styles.deleteSeriesBtn} onPress={() => handleDeleteSeries(s.id)}>
              <Text style={styles.deleteSeriesText}>🗑️ Seriyi sil</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Series Tracker', headerShown: true }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>📚 Series Tracker</Text>
          <Text style={styles.heroSub}>
            Çok bölümlü içerik serilerini tanımla. Episode'ları tek tek planla, çekimden
            yayına status takibi yap, ilerleme yüzdesini gör.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yeni Seri</Text>

          <Text style={styles.label}>Seri adı *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="ör: 10 Günlük Sabah Rutini"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Açıklama</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={description}
            onChangeText={setDescription}
            placeholder="seri hakkında kısa bilgi"
            placeholderTextColor="#94a3b8"
            multiline
          />

          <Text style={styles.label}>Platform</Text>
          <View style={styles.chipRow}>
            {PLATFORMS.map(p => {
              const active = platform === p;
              return (
                <Pressable
                  key={p}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setPlatform(p)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{p}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Format</Text>
          <View style={styles.chipRow}>
            {['Reels', 'Carousel', 'Thread', 'Video', 'Blog'].map(f => {
              const active = format === f;
              return (
                <Pressable
                  key={f}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setFormat(f)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Toplam bölüm</Text>
              <TextInput
                style={styles.input}
                value={totalEpisodes}
                onChangeText={setTotalEpisodes}
                keyboardType="number-pad"
                placeholder="5"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Sıklık (gün)</Text>
              <TextInput
                style={styles.input}
                value={cadenceDays}
                onChangeText={setCadenceDays}
                keyboardType="number-pad"
                placeholder="7"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <Pressable style={styles.cta} onPress={handleCreate}>
            <Text style={styles.ctaText}>➕ Seri oluştur</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Seriler ({list.length})</Text>
            {list.length > 0 ? (
              <Pressable onPress={handleClearAll} hitSlop={10}>
                <Text style={styles.clearText}>Hepsini sil</Text>
              </Pressable>
            ) : null}
          </View>

          {list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📚</Text>
              <Text style={styles.emptyText}>
                Henüz seri yok. Yukarıdan bir tane oluştur, buraya gelsin.
              </Text>
            </View>
          ) : (
            list.map(renderSeries)
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
  inputMulti: { minHeight: 50, textAlignVertical: 'top' },
  row2: { flexDirection: 'row' },
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
  cta: { marginTop: 14, backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },

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
  cardHead: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  cardSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  progressWrap: { marginTop: 10 },
  progressBar: {
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { color: '#94a3b8', fontSize: 11, marginTop: 4 },

  detail: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
  desc: { color: '#cbd5e1', fontSize: 13, marginBottom: 12, lineHeight: 18 },

  epHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  epHint: { color: '#64748b', fontSize: 10 },
  epEmpty: { color: '#475569', fontSize: 12, fontStyle: 'italic', marginBottom: 8 },
  epRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
    borderLeftWidth: 3,
  },
  epNum: {
    width: 36,
    alignItems: 'center',
    marginRight: 8,
  },
  epNumText: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' },
  epTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
  epMeta: { color: '#94a3b8', fontSize: 11, marginTop: 2 },

  addEpBox: {
    marginTop: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
  },
  addEpTitle: { color: '#f8fafc', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  addEpRow: { flexDirection: 'row' },
  addEpBtn: {
    marginTop: 8,
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  addEpBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  deleteSeriesBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    alignItems: 'center',
  },
  deleteSeriesText: { color: '#f87171', fontSize: 12, fontWeight: '700' },

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