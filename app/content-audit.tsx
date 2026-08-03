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
  AuditEntry,
  AuditPlatform,
  AuditVerdict,
  AUDIT_PLATFORMS,
  AUDIT_VERDICTS,
  buildAudit,
  clearAudits,
  getAuditList,
  removeAudit,
  saveAudit,
  updateAudit,
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

const scoreColor = (s: number): string => {
  if (s >= 75) return '#10B981';
  if (s >= 50) return '#F59E0B';
  if (s >= 30) return '#F97316';
  return '#EF4444';
};

const scoreEmoji = (s: number): string => {
  if (s >= 75) return '🚀';
  if (s >= 50) return '⚡';
  if (s >= 30) return '🔄';
  return '🪦';
};

export default function ContentAuditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<AuditEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filterVerdict, setFilterVerdict] = useState<AuditVerdict | 'all'>('all');

  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<AuditPlatform>('instagram');
  const [niche, setNiche] = useState<string>('fitness');
  const [reach, setReach] = useState('1000');
  const [likes, setLikes] = useState('60');
  const [comments, setComments] = useState('5');
  const [shares, setShares] = useState('3');
  const [saves, setSaves] = useState('8');
  const [formatTag, setFormatTag] = useState('reel');
  const [topicTag, setTopicTag] = useState('');
  const [preview, setPreview] = useState<Omit<AuditEntry, 'id' | 'createdAt'> | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const data = await getAuditList();
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
    if (title.trim().length < 2) {
      setPreview(null);
      return;
    }
    setPreview(
      buildAudit({
        title: title.trim(),
        platform,
        niche,
        reach: parseInt(reach, 10) || 0,
        likes: parseInt(likes, 10) || 0,
        comments: parseInt(comments, 10) || 0,
        shares: parseInt(shares, 10) || 0,
        saves: parseInt(saves, 10) || 0,
        publishedAt: Date.now(),
        formatTag: formatTag.trim() || 'unknown',
        topicTag: topicTag.trim() || 'general',
      })
    );
  }, [title, platform, niche, reach, likes, comments, shares, saves, formatTag, topicTag]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  const onSave = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    const next = await saveAudit(preview);
    setList(next);
    setSaving(false);
    setTitle('');
    setPreview(null);
    setToast('Audit kaydedildi ✓');
  }, [preview]);

  const onRemove = useCallback(async (id: string) => {
    Alert.alert('Sil', 'Bu audit kaydını silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeAudit(id);
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
          await clearAudits();
          setList([]);
          setToast('Tüm audit kayıtları silindi');
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
      const next = await updateAudit(id, { notes: note });
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
    const byVerdict: Record<AuditVerdict, number> = { kill: 0, pivot: 0, spike: 0, double_down: 0 };
    list.forEach(a => {
      byVerdict[a.verdict] += 1;
    });
    const avgScore = list.length === 0 ? 0 : Math.round(list.reduce((s, a) => s + a.score, 0) / list.length);
    const totalReach = list.reduce((s, a) => s + a.reach, 0);
    const totalEngagement = list.reduce(
      (s, a) => s + a.likes + a.comments + a.shares + a.saves,
      0
    );
    const er = totalReach > 0 ? ((totalEngagement / totalReach) * 100).toFixed(1) : '0.0';
    const formatPerf: Record<string, { count: number; totalScore: number }> = {};
    list.forEach(a => {
      const k = a.formatTag;
      if (!formatPerf[k]) formatPerf[k] = { count: 0, totalScore: 0 };
      formatPerf[k].count += 1;
      formatPerf[k].totalScore += a.score;
    });
    const bestFormat = Object.entries(formatPerf)
      .map(([k, v]) => ({ name: k, avg: Math.round(v.totalScore / v.count), count: v.count }))
      .sort((a, b) => b.avg - a.avg)[0];
    return { byVerdict, avgScore, totalReach, er, bestFormat };
  }, [list]);

  const verdictKeys = Object.keys(AUDIT_VERDICTS) as AuditVerdict[];

  const filteredList = useMemo(() => {
    if (filterVerdict === 'all') return list;
    return list.filter(a => a.verdict === filterVerdict);
  }, [list, filterVerdict]);

  const nicheLabel = (id: string) => NICHES.find(n => n.id === id)?.label ?? id;
  const nicheIcon = (id: string) => NICHES.find(n => n.id === id)?.icon ?? '📌';

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Content Audit',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Geçmiş bir içeriğin metriklerini gir, otomatik karar (öldür/pivot/spike/double_down) al.
        </Text>

        {/* TITLE */}
        <Text style={styles.sectionLabel}>İçerik başlığı</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Örn: 5 dakikada akşam yemeği"
          placeholderTextColor="#475569"
          style={styles.input}
        />

        {/* PLATFORM */}
        <Text style={styles.sectionLabel}>Platform</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {AUDIT_PLATFORMS.map(p => {
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

        {/* METRICS */}
        <Text style={styles.sectionLabel}>Metrikler</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Erişim</Text>
            <TextInput
              value={reach}
              onChangeText={setReach}
              keyboardType="numeric"
              placeholderTextColor="#475569"
              style={styles.metricInput}
            />
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Beğeni</Text>
            <TextInput
              value={likes}
              onChangeText={setLikes}
              keyboardType="numeric"
              placeholderTextColor="#475569"
              style={styles.metricInput}
            />
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Yorum</Text>
            <TextInput
              value={comments}
              onChangeText={setComments}
              keyboardType="numeric"
              placeholderTextColor="#475569"
              style={styles.metricInput}
            />
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Paylaşım</Text>
            <TextInput
              value={shares}
              onChangeText={setShares}
              keyboardType="numeric"
              placeholderTextColor="#475569"
              style={styles.metricInput}
            />
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Kaydetme</Text>
            <TextInput
              value={saves}
              onChangeText={setSaves}
              keyboardType="numeric"
              placeholderTextColor="#475569"
              style={styles.metricInput}
            />
          </View>
        </View>

        {/* TAGS */}
        <Text style={styles.sectionLabel}>Etiketler</Text>
        <View style={styles.tagsRow}>
          <TextInput
            value={formatTag}
            onChangeText={setFormatTag}
            placeholder="format (reel, carousel...)"
            placeholderTextColor="#475569"
            style={[styles.input, { flex: 1, marginRight: 8, marginBottom: 0 }]}
          />
          <TextInput
            value={topicTag}
            onChangeText={setTopicTag}
            placeholder="konu"
            placeholderTextColor="#475569"
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
          />
        </View>

        {/* PREVIEW */}
        {preview && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle} numberOfLines={2}>{preview.title}</Text>
              <View style={[styles.scoreBig, { backgroundColor: scoreColor(preview.score) + '22', borderColor: scoreColor(preview.score) }]}>
                <Text style={styles.scoreBigEmoji}>{scoreEmoji(preview.score)}</Text>
                <Text style={[styles.scoreBigText, { color: scoreColor(preview.score) }]}>{preview.score}</Text>
              </View>
            </View>

            <View style={[styles.verdictBanner, { backgroundColor: AUDIT_VERDICTS[preview.verdict].color + '22', borderColor: AUDIT_VERDICTS[preview.verdict].color }]}>
              <Text style={styles.verdictBannerEmoji}>{AUDIT_VERDICTS[preview.verdict].emoji}</Text>
              <Text style={[styles.verdictBannerText, { color: AUDIT_VERDICTS[preview.verdict].color }]}>
                {AUDIT_VERDICTS[preview.verdict].label}
              </Text>
            </View>

            <Text style={styles.previewTip}>💡 {AUDIT_VERDICTS[preview.verdict].tip}</Text>
            <Text style={styles.previewReason}>{preview.reasoning}</Text>

            <View style={styles.previewMetricsRow}>
              <Text style={styles.previewMetric}>👁️ {formatNumber(preview.reach)}</Text>
              <Text style={styles.previewMetric}>❤️ {formatNumber(preview.likes)}</Text>
              <Text style={styles.previewMetric}>💬 {formatNumber(preview.comments)}</Text>
              <Text style={styles.previewMetric}>↗️ {formatNumber(preview.shares)}</Text>
              <Text style={styles.previewMetric}>🔖 {formatNumber(preview.saves)}</Text>
            </View>

            <View style={styles.previewActions}>
              <Pressable
                onPress={() => onCopy(`${preview.title} — ${AUDIT_VERDICTS[preview.verdict].label}: ${preview.reasoning}`)}
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

        {!preview && title.length >= 2 && (
          <View style={styles.previewCard}>
            <ActivityIndicator color="#6366f1" />
          </View>
        )}

        {/* SAVED LIST */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📋 Audit Listesi ({list.length})</Text>
            {list.length > 0 && (
              <Pressable onPress={onClear}>
                <Text style={styles.clearBtn}>Tümünü sil</Text>
              </Pressable>
            )}
          </View>

          {list.length > 0 && (
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ortalama skor</Text>
                <Text style={[styles.summaryValue, { color: scoreColor(summary.avgScore) }]}>
                  {summary.avgScore}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Toplam erişim</Text>
                <Text style={styles.summaryValue}>{formatNumber(summary.totalReach)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Genel ER</Text>
                <Text style={styles.summaryValue}>%{summary.er}</Text>
              </View>
              {summary.bestFormat && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>En iyi format</Text>
                  <Text style={[styles.summaryValue, { fontSize: 13 }]}>
                    {summary.bestFormat.name} ({summary.bestFormat.avg})
                  </Text>
                </View>
              )}
              <View style={styles.verdictBreakdown}>
                {verdictKeys.map(vk => {
                  const meta = AUDIT_VERDICTS[vk];
                  return (
                    <View key={vk} style={[styles.verdictChip, { borderColor: meta.color }]}>
                      <Text style={styles.verdictChipEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.verdictChipCount, { color: meta.color }]}>
                        {summary.byVerdict[vk]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {list.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <Pressable
                onPress={() => setFilterVerdict('all')}
                style={[styles.filterChip, filterVerdict === 'all' && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, filterVerdict === 'all' && styles.filterChipTextActive]}>
                  Hepsi ({list.length})
                </Text>
              </Pressable>
              {verdictKeys.map(vk => {
                const meta = AUDIT_VERDICTS[vk];
                const cnt = summary.byVerdict[vk];
                const active = filterVerdict === vk;
                return (
                  <Pressable
                    key={vk}
                    onPress={() => setFilterVerdict(vk)}
                    style={[styles.filterChip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {meta.emoji} {meta.label} ({cnt})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {filteredList.length === 0 ? (
            <Text style={styles.empty}>
              {list.length === 0 ? 'Henüz audit yok. Yukarıdan içerik ekle.' : 'Bu filtreyle eşleşen audit yok.'}
            </Text>
          ) : (
            filteredList.map(a => {
              const verdict = AUDIT_VERDICTS[a.verdict];
              const open = openId === a.id;
              const platformMeta = AUDIT_PLATFORMS.find(p => p.id === a.platform);
              return (
                <View key={a.id} style={styles.entry}>
                  <Pressable onPress={() => setOpenId(open ? null : a.id)} style={styles.entryHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTitle} numberOfLines={1}>
                        {nicheIcon(a.niche)} {a.title}
                      </Text>
                      <Text style={styles.entryMeta}>
                        {platformMeta?.emoji} {platformMeta?.label} · {formatDate(a.publishedAt)}
                      </Text>
                    </View>
                    <View style={[styles.scoreBig, { backgroundColor: scoreColor(a.score) + '22', borderColor: scoreColor(a.score) }]}>
                      <Text style={styles.scoreBigEmoji}>{scoreEmoji(a.score)}</Text>
                      <Text style={[styles.scoreBigText, { color: scoreColor(a.score) }]}>{a.score}</Text>
                    </View>
                  </Pressable>

                  <View style={[styles.verdictPill, { backgroundColor: verdict.color + '22', borderColor: verdict.color }]}>
                    <Text style={styles.verdictPillEmoji}>{verdict.emoji}</Text>
                    <Text style={[styles.verdictPillText, { color: verdict.color }]}>{verdict.label}</Text>
                  </View>

                  {open && (
                    <View style={styles.entryDetail}>
                      <Text style={styles.entryReason}>{a.reasoning}</Text>
                      <Text style={styles.entryTip}>💡 {verdict.tip}</Text>
                      <View style={styles.entryMetricsRow}>
                        <Text style={styles.entryMetric}>👁️ {formatNumber(a.reach)}</Text>
                        <Text style={styles.entryMetric}>❤️ {formatNumber(a.likes)}</Text>
                        <Text style={styles.entryMetric}>💬 {formatNumber(a.comments)}</Text>
                        <Text style={styles.entryMetric}>↗️ {formatNumber(a.shares)}</Text>
                        <Text style={styles.entryMetric}>🔖 {formatNumber(a.saves)}</Text>
                      </View>
                      <Text style={styles.entryTags}>
                        🎬 {a.formatTag} · 💡 {a.topicTag}
                      </Text>
                      <Text style={styles.entryLabel}>Notlar</Text>
                      <TextInput
                        value={notesDraft[a.id] ?? a.notes}
                        onChangeText={txt => setNotesDraft(prev => ({ ...prev, [a.id]: txt }))}
                        placeholder="Not ekle..."
                        placeholderTextColor="#475569"
                        style={styles.notesInput}
                        multiline
                      />
                      <View style={styles.entryActions}>
                        <Pressable
                          onPress={() => onSaveNotes(a.id)}
                          disabled={notesDraft[a.id] === undefined}
                          style={[styles.smallBtn, notesDraft[a.id] === undefined && { opacity: 0.4 }]}
                        >
                          <Text style={styles.smallBtnText}>💾 Notu kaydet</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onCopy(`${a.title} — ${verdict.label}: ${a.reasoning}`)}
                          style={styles.smallBtn}
                        >
                          <Text style={styles.smallBtnText}>📋 Kopyala</Text>
                        </Pressable>
                        <Pressable onPress={() => onRemove(a.id)} style={[styles.smallBtn, { borderColor: '#F97316' }]}>
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
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
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
  chipIcon: { fontSize: 16, marginRight: 6 },
  chipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0f172a' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, gap: 8 },
  metricBox: { width: '31%', minWidth: 90 },
  metricLabel: { color: '#94a3b8', fontSize: 11, marginBottom: 4, fontWeight: '600' },
  metricInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tagsRow: { flexDirection: 'row', marginBottom: 12 },
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
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  previewTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  scoreBig: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  scoreBigEmoji: { fontSize: 14 },
  scoreBigText: { fontSize: 16, fontWeight: '700' },
  verdictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  verdictBannerEmoji: { fontSize: 20 },
  verdictBannerText: { fontSize: 16, fontWeight: '700' },
  previewTip: { color: '#cbd5e1', fontSize: 13, marginBottom: 8, lineHeight: 18 },
  previewReason: { color: '#94a3b8', fontSize: 12, marginBottom: 12, fontStyle: 'italic', lineHeight: 16 },
  previewMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 6,
  },
  previewMetric: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  previewActions: { flexDirection: 'row', gap: 8 },
  copyBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
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
  verdictBreakdown: { flexDirection: 'row', gap: 6, marginTop: 8 },
  verdictChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  verdictChipEmoji: { fontSize: 12 },
  verdictChipCount: { fontSize: 13, fontWeight: '700' },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 6,
  },
  filterChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filterChipText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
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
  entryTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  entryMeta: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  verdictPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  verdictPillEmoji: { fontSize: 12 },
  verdictPillText: { fontSize: 11, fontWeight: '700' },
  entryDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  entryReason: { color: '#cbd5e1', fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  entryTip: { color: '#94a3b8', fontSize: 12, marginBottom: 10 },
  entryMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  entryMetric: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  entryTags: { color: '#94a3b8', fontSize: 12, marginBottom: 10 },
  entryLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', marginBottom: 4 },
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
    marginBottom: 8,
  },
  entryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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