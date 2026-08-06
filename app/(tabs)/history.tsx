import React, { useCallback, useState } from 'react';
import { Alert, Clipboard, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HistoryEntry, deleteHistoryEntry, getDoneIdeas, getFavorites, getHistory, saveWeekToHistory } from '../../services/storage';
import niches from '../../data/niches.json';
import PlanBadge from '../../components/PlanBadge';

const ICONS = (niches as { id: string; icon: string }[]).reduce((acc, n) => {
  acc[n.id] = n.icon;
  return acc;
}, {} as Record<string, string>);

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function HistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [favSet, setFavSet] = useState<Set<string>>(new Set());
  const [planRefresh, setPlanRefresh] = useState(0);
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [h, favs, done] = await Promise.all([getHistory(), getFavorites(), getDoneIdeas()]);
    setHistory(h);
    setFavSet(new Set(favs));
    setDoneSet(new Set(done));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      setPlanRefresh((x) => x + 1);
    }, [load])
  );

  const onDelete = (weekId: string) => {
    Alert.alert('Geçmiş haftayı sil', `${weekId} haftası silinsin mi?`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await deleteHistoryEntry(weekId);
          load();
        },
      },
    ]);
  };

  const onCopy = (key: string, text: string) => {
    Clipboard.setString(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const onExportWeek = async (h: HistoryEntry) => {
    const lines: string[] = [`📅 ${h.weekId} — ${h.niche.toUpperCase()}`, ''];
    h.ideas.forEach((idea, idx) => {
      lines.push(`${idx + 1}. [${idea.day.toUpperCase()}] ${idea.text}`);
    });
    lines.push('', '— Compass — İlham Pusulam');
    const message = lines.join('\n');
    try {
      await Share.share({ message, title: `${h.weekId} içerik planı` });
    } catch (e) {
      Clipboard.setString(message);
      Alert.alert('Kopyalandı', 'Paylaşılamadı, fikirler panoya kopyalandı.');
    }
  };

  const getCurrentWeekId = (): string => {
    const d = new Date();
    const onejan = new Date(d.getFullYear(), 0, 1);
    const millisInDay = 86400000;
    const dayOfYear = (d.getTime() - onejan.getTime() + ((onejan.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000)) / millisInDay;
    const weekNum = Math.ceil((dayOfYear + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  };

  const onRestore = (h: HistoryEntry) => {
    const currentWeekId = getCurrentWeekId();
    Alert.alert(
      'Haftayı geri yükle',
      `${h.weekId} haftasındaki ${h.ideas.length} fikir bu haftaya aktarılır. Devam edilsin mi?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Geri yükle',
          onPress: async () => {
            await saveWeekToHistory({
              weekId: currentWeekId,
              niche: h.niche,
              ideas: h.ideas,
              createdAt: Date.now(),
            });
            await load();
            Alert.alert('Geri yüklendi', 'Bu haftaki fikirler güncellendi. Ana sayfaya dönün.', [
              {
                text: 'Ana sayfaya git',
                onPress: () => router.replace('/(tabs)'),
              },
              { text: 'Kapat', style: 'cancel' },
            ]);
          },
        },
      ]
    );
  };

  const openDetail = (niche: string, day: string, text: string) => {
    router.push({
      pathname: '/idea/[text]',
      params: { text: encodeURIComponent(text), niche, day, source: 'pool' },
    });
  };

  const toggleAll = () => {
    if (expanded) {
      setExpanded(null);
      return;
    }
    setExpanded('__ALL__');
  };

  const toggleCompareMode = () => {
    setCompareMode((v) => {
      const next = !v;
      if (!next) {
        setCompareA(null);
        setCompareB(null);
      }
      return next;
    });
  };

  const onTogglePick = (weekId: string) => {
    if (!compareMode) return;
    if (compareA === weekId) {
      setCompareA(null);
      return;
    }
    if (compareB === weekId) {
      setCompareB(null);
      return;
    }
    if (!compareA) setCompareA(weekId);
    else if (!compareB) setCompareB(weekId);
    else {
      setCompareA(compareB);
      setCompareB(weekId);
    }
  };

  const entryA = compareA ? history.find((h) => h.weekId === compareA) ?? null : null;
  const entryB = compareB ? history.find((h) => h.weekId === compareB) ?? null : null;

  const statsOf = (h: HistoryEntry) => {
    const favCount = h.ideas.filter((i) => favSet.has(i.text)).length;
    const doneCount = h.ideas.filter((i) => doneSet.has(i.text)).length;
    const dayCounts: Record<string, number> = {};
    h.ideas.forEach((i) => { dayCounts[i.day] = (dayCounts[i.day] ?? 0) + 1; });
    const topDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { favCount, doneCount, topDay, dayCounts };
  };

  const q = query.trim().toLowerCase();
  const totalMatches = q
    ? history.reduce((acc, h) => acc + h.ideas.filter((i) => i.text.toLowerCase().includes(q)).length, 0)
    : 0;
  const allExpanded = expanded === '__ALL__';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={styles.title}>🗂 Geçmiş Haftalar</Text>
        <PlanBadge size="sm" refreshKey={planRefresh} />
      </View>
      <Text style={styles.subtitle}>{history.length} hafta kayıtlı</Text>

      {history.length > 0 && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            placeholder="Geçmişte ara..."
            value={query}
            onChangeText={setQuery}
            placeholderTextColor="#9CA3AF"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </Pressable>
          )}
        </View>
      )}

      {q.length > 0 && (
        <Text style={styles.matchInfo}>
          {totalMatches === 0 ? 'Eşleşme yok' : `${totalMatches} fikirde eşleşti`}
        </Text>
      )}

      {history.length > 1 && (
        <View style={styles.bulkRow}>
          <Pressable onPress={toggleCompareMode} style={[styles.bulkBtn, compareMode && styles.bulkBtnActive]}>
            <Text style={[styles.bulkBtnText, compareMode && styles.bulkBtnTextActive]}>
              {compareMode ? '✕ Karşılaştırmadan çık' : '⇆ Karşılaştır'}
            </Text>
          </Pressable>
          <Pressable onPress={toggleAll} style={styles.bulkBtn}>
            <Text style={styles.bulkBtnText}>{allExpanded ? '▴ Daralt' : '▾ Tümünü genişlet'}</Text>
          </Pressable>
        </View>
      )}

      {compareMode && (
        <View style={styles.compareBanner}>
          <Text style={styles.compareBannerTitle}>⇆ Karşılaştırma modu</Text>
          <Text style={styles.compareBannerSub}>
            {compareA && compareB
              ? 'İki hafta seçildi — aşağıya bak.'
              : compareA
                ? `1. hafta: ${compareA}. Şimdi 2. haftayı seç.`
                : 'Karşılaştırmak için iki hafta seç.'}
          </Text>
          {(compareA || compareB) && (
            <Pressable onPress={() => { setCompareA(null); setCompareB(null); }} style={styles.compareClearBtn}>
              <Text style={styles.compareClearBtnText}>Seçimi temizle</Text>
            </Pressable>
          )}
        </View>
      )}

      {compareMode && entryA && entryB && (
        <View style={styles.compareCard}>
          <Text style={styles.compareCardTitle}>📊 Hafta karşılaştırması</Text>
          <View style={styles.compareGrid}>
            <View style={styles.compareCol}>
              <Text style={styles.compareColHead}>{entryA.weekId}</Text>
              <Text style={styles.compareColNiche}>{entryA.niche}</Text>
            </View>
            <View style={styles.compareCol}>
              <Text style={styles.compareColHead}>{entryB.weekId}</Text>
              <Text style={styles.compareColNiche}>{entryB.niche}</Text>
            </View>
          </View>
          {(() => {
            const a = statsOf(entryA);
            const b = statsOf(entryB);
            const rows: { label: string; av: number | string; bv: number | string; highlight: 'a' | 'b' | null }[] = [
              { label: 'Toplam fikir', av: entryA.ideas.length, bv: entryB.ideas.length, highlight: entryA.ideas.length > entryB.ideas.length ? 'a' : entryB.ideas.length > entryA.ideas.length ? 'b' : null },
              { label: 'Favoriler', av: a.favCount, bv: b.favCount, highlight: a.favCount > b.favCount ? 'a' : b.favCount > a.favCount ? 'b' : null },
              { label: 'Üretildi', av: a.doneCount, bv: b.doneCount, highlight: a.doneCount > b.doneCount ? 'a' : b.doneCount > a.doneCount ? 'b' : null },
              { label: 'En aktif gün', av: a.topDay ? a.topDay.toUpperCase() : '—', bv: b.topDay ? b.topDay.toUpperCase() : '—', highlight: null },
            ];
            return rows.map((r) => (
              <View key={r.label} style={styles.compareRow}>
                <View style={[styles.compareCell, r.highlight === 'a' && styles.compareCellWin]}>
                  <Text style={[styles.compareCellValue, r.highlight === 'a' && styles.compareCellValueWin]}>
                    {r.av}{typeof r.av === 'number' && r.label !== 'En aktif gün' ? '' : ''}
                  </Text>
                </View>
                <View style={styles.compareRowLabel}>
                  <Text style={styles.compareRowLabelText}>{r.label}</Text>
                </View>
                <View style={[styles.compareCell, r.highlight === 'b' && styles.compareCellWin]}>
                  <Text style={[styles.compareCellValue, r.highlight === 'b' && styles.compareCellValueWin]}>
                    {r.bv}
                  </Text>
                </View>
              </View>
            ));
          })()}
        </View>
      )}

      {history.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyText}>Henüz geçmiş hafta yok.</Text>
          <Text style={styles.emptyHint}>
            Ana sayfada fikirleri yenilediğinde burada otomatik olarak görünecek.
          </Text>
        </View>
      )}

      {history.map((h) => {
        const isOpen = allExpanded || expanded === h.weekId;
        const visibleIdeas = q
          ? h.ideas.filter((i) => i.text.toLowerCase().includes(q))
          : h.ideas;
        if (q && visibleIdeas.length === 0) return null;
        const favCount = h.ideas.filter((i) => favSet.has(i.text)).length;
        const doneCount = h.ideas.filter((i) => doneSet.has(i.text)).length;
        const isPicked = compareA === h.weekId || compareB === h.weekId;
        return (
          <View key={h.weekId} style={[styles.card, isPicked && styles.cardPicked]}>
            <Pressable
              onPress={() => {
                if (compareMode) {
                  onTogglePick(h.weekId);
                  return;
                }
                setExpanded(allExpanded ? null : isOpen ? null : h.weekId);
              }}
              style={styles.cardHeader}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                {compareMode && (
                  <View style={[styles.pickCircle, isPicked && styles.pickCircleOn]}>
                    <Text style={styles.pickCircleText}>{isPicked ? '✓' : ''}</Text>
                  </View>
                )}
                <Text style={styles.icon}>{ICONS[h.niche] ?? '✨'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.weekId}>{h.weekId}</Text>
                  <Text style={styles.weekMeta}>
                    {h.niche} • {formatDate(h.createdAt)} • {h.ideas.length} fikir
                  </Text>
                  {(favCount > 0 || doneCount > 0) && (
                    <View style={styles.badgeRow}>
                      {favCount > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>★ {favCount}</Text>
                        </View>
                      )}
                      {doneCount > 0 && (
                        <View style={[styles.badge, styles.badgeDone]}>
                          <Text style={[styles.badgeText, styles.badgeDoneText]}>✓ {doneCount}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.chev}>{compareMode ? (isPicked ? '★' : '○') : (isOpen ? '▴' : '▾')}</Text>
            </Pressable>

            {isOpen && (
              <View style={styles.body}>
                {visibleIdeas.length === 0 && (
                  <Text style={styles.noMatch}>Bu haftada "{query}" için fikir yok.</Text>
                )}
                {visibleIdeas.map((idea, idx) => {
                  const isFav = favSet.has(idea.text);
                  const isDone = doneSet.has(idea.text);
                  return (
                    <View key={`${h.weekId}-${idx}`} style={[styles.ideaRow, isDone && styles.ideaRowDone]}>
                      <Pressable
                        onPress={() => openDetail(h.niche, idea.day, idea.text)}
                        style={{ flex: 1 }}
                      >
                        <View style={styles.ideaLabelRow}>
                          <Text style={styles.ideaDay}>{idea.day.toUpperCase()}</Text>
                          {isFav && <Text style={styles.ideaFavTag}>★</Text>}
                          {isDone && <Text style={styles.ideaDoneTag}>✓ üretildi</Text>}
                        </View>
                        <Text style={[styles.ideaText, isDone && styles.ideaTextDone]}>{idea.text}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onCopy(`${h.weekId}-${idx}`, idea.text)}
                        style={styles.copyBtn}
                      >
                        <Text style={styles.copyBtnText}>
                          {copiedKey === `${h.weekId}-${idx}` ? '✓' : '⧉'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
                <View style={styles.actionRow}>
                  <Pressable onPress={() => onRestore(h)} style={styles.restoreBtn}>
                    <Text style={styles.restoreBtnText}>↺ Geri yükle</Text>
                  </Pressable>
                  <Pressable onPress={() => onExportWeek(h)} style={styles.exportBtn}>
                    <Text style={styles.exportBtnText}>↗ Dışa aktar</Text>
                  </Pressable>
                  <Pressable onPress={() => onDelete(h.weekId)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>🗑 Sil</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5C6B4F' },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginTop: 50 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  search: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  clearBtn: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: { fontSize: 14, color: '#374151', fontWeight: '700' },
  matchInfo: { fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: '600' },
  bulkBtn: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 10, marginBottom: 10 },
  bulkBtnText: { fontSize: 12, color: '#4D96FF', fontWeight: '700' },
  bulkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  bulkBtnActive: { backgroundColor: '#EEF2FF', borderRadius: 8 },
  bulkBtnTextActive: { color: '#4338CA' },
  compareBanner: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  compareBannerTitle: { fontSize: 13, fontWeight: '800', color: '#4338CA', marginBottom: 4 },
  compareBannerSub: { fontSize: 12, color: '#3730A3' },
  compareClearBtn: { marginTop: 8, alignSelf: 'flex-start' },
  compareClearBtnText: { fontSize: 11, color: '#4338CA', fontWeight: '700' },
  compareCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  compareCardTitle: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 10 },
  compareGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  compareCol: { flex: 1, alignItems: 'center' },
  compareColHead: { fontSize: 13, fontWeight: '800', color: '#4338CA' },
  compareColNiche: { fontSize: 11, color: '#6B7280', marginTop: 2, textTransform: 'capitalize' },
  compareRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  compareRowLabel: { flex: 1.2, alignItems: 'center' },
  compareRowLabelText: { fontSize: 11, color: '#6B7280', fontWeight: '700' },
  compareCell: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  compareCellWin: { backgroundColor: '#DCFCE7' },
  compareCellValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  compareCellValueWin: { color: '#047857' },
  cardPicked: { borderWidth: 2, borderColor: '#4D96FF' },
  pickCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#C7D2FE',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'white',
  },
  pickCircleOn: { backgroundColor: '#4D96FF', borderColor: '#4D96FF' },
  pickCircleText: { fontSize: 12, color: 'white', fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptyHint: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 8, paddingHorizontal: 24 },
  card: { backgroundColor: 'white', borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', padding: 14, alignItems: 'center' },
  icon: { fontSize: 24 },
  weekId: { fontSize: 14, fontWeight: '800', color: '#111827' },
  weekMeta: { fontSize: 11, color: '#6B7280', marginTop: 2, textTransform: 'capitalize' },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 10, color: '#92400E', fontWeight: '800' },
  badgeDone: { backgroundColor: '#DCFCE7' },
  badgeDoneText: { color: '#166534' },
  chev: { fontSize: 16, color: '#6B7280', marginLeft: 8 },
  body: { borderTopWidth: 1, borderTopColor: '#F3F4F6', padding: 14 },
  noMatch: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 },
  ideaRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-start', gap: 8 },
  ideaRowDone: { opacity: 0.65 },
  ideaLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  ideaDay: { fontSize: 10, fontWeight: '700', color: '#4D96FF' },
  ideaFavTag: { fontSize: 10, color: '#F59E0B', fontWeight: '800' },
  ideaDoneTag: { fontSize: 9, color: '#10B981', fontWeight: '800', backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  ideaText: { fontSize: 14, color: '#111827', fontWeight: '500', lineHeight: 20 },
  ideaTextDone: { textDecorationLine: 'line-through', color: '#6B7280' },
  copyBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  copyBtnText: { fontSize: 14, color: '#4D96FF', fontWeight: '700' },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  deleteBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  restoreBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  restoreBtnText: { color: '#1E40AF', fontWeight: '700', fontSize: 12 },
  exportBtn: { backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  exportBtnText: { color: '#047857', fontWeight: '700', fontSize: 12 },
});
