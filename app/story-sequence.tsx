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
  StorySeqEntry,
  StorySeqFrame,
  StorySeqGoal,
  StorySeqPlatform,
  STORYSEQ_GOALS,
  STORYSEQ_PLATFORMS,
  STORYSEQ_PURPOSE_META,
  STORYSEQ_TRANSITIONS,
  buildStorySeq,
  clearStorySeqs,
  getStorySeqList,
  removeStorySeq,
  saveStorySeq,
  updateStorySeq,
  addCopyToHistory,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const PURPOSE_COLORS: Record<StorySeqFrame['purpose'], string> = {
  hook: '#6366f1',
  context: '#0EA5E9',
  tension: '#F59E0B',
  reveal: '#10B981',
  cta: '#EF4444',
};

export default function StorySequenceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<StorySeqEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState<StorySeqPlatform>('instagram');
  const [goal, setGoal] = useState<StorySeqGoal>('product_launch');
  const [preview, setPreview] = useState<Omit<StorySeqEntry, 'id' | 'createdAt'> | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const data = await getStorySeqList();
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

  const generate = useCallback(() => {
    if (title.trim().length < 2) {
      setPreview(null);
      return;
    }
    setPreview(buildStorySeq({ title: title.trim(), platform, goal }));
  }, [title, platform, goal]);

  useEffect(() => {
    generate();
  }, [generate]);

  const onSave = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    const next = await saveStorySeq(preview);
    setList(next);
    setSaving(false);
    setTitle('');
    setPreview(null);
    setToast('Story sequence kaydedildi ✓');
  }, [preview]);

  const onRemove = useCallback(async (id: string) => {
    Alert.alert('Sil', 'Bu story sequence kaydını silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeStorySeq(id);
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
          await clearStorySeqs();
          setList([]);
          setToast('Tüm sequence kayıtları silindi');
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
      const next = await updateStorySeq(id, { notes: note });
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
    const byGoal: Partial<Record<StorySeqGoal, number>> = {};
    list.forEach(e => {
      byGoal[e.goal] = (byGoal[e.goal] ?? 0) + 1;
    });
    const totalFrames = list.reduce((s, e) => s + e.storyArcs.length, 0);
    const avgFrames = list.length === 0 ? 0 : Math.round((totalFrames / list.length) * 10) / 10;
    return { byGoal, totalFrames, avgFrames };
  }, [list]);

  const platformKeys = Object.keys(STORYSEQ_PLATFORMS) as StorySeqPlatform[];
  const goalKeys = Object.keys(STORYSEQ_GOALS) as StorySeqGoal[];

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: 'Story Sequence',
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Başlık + platform + amaç seç. Otomatik sahne sahne storyboard oluştur.
        </Text>

        {/* TITLE */}
        <Text style={styles.sectionLabel}>Başlık</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Story için kısa başlık"
          placeholderTextColor="#475569"
          style={styles.input}
        />

        {/* PLATFORM */}
        <Text style={styles.sectionLabel}>Platform</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {platformKeys.map(pk => {
            const meta = STORYSEQ_PLATFORMS[pk];
            const active = platform === pk;
            return (
              <Pressable
                key={pk}
                onPress={() => setPlatform(pk)}
                style={[styles.chip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
              >
                <Text style={styles.chipIcon}>{meta.emoji}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* GOAL */}
        <Text style={styles.sectionLabel}>Amaç</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {goalKeys.map(gk => {
            const meta = STORYSEQ_GOALS[gk];
            const active = goal === gk;
            return (
              <Pressable
                key={gk}
                onPress={() => setGoal(gk)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={styles.chipIcon}>{meta.emoji}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* PREVIEW */}
        {preview && (
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle} numberOfLines={2}>{preview.title}</Text>
              <View style={styles.durationPill}>
                <Text style={styles.durationText}>⏱️ {preview.totalDuration}</Text>
              </View>
            </View>

            <Text style={styles.goalTip}>💡 {STORYSEQ_GOALS[preview.goal].tip}</Text>

            <Text style={styles.sectionTitle}>🎬 Storyboard ({preview.storyArcs.length} sahne)</Text>
            {preview.storyArcs.map((frame, idx) => {
              const purposeMeta = STORYSEQ_PURPOSE_META[frame.purpose];
              const color = PURPOSE_COLORS[frame.purpose];
              return (
                <View key={idx} style={styles.frameRow}>
                  <View style={[styles.frameTimeline, { backgroundColor: color }]} />
                  <View style={[styles.frameNumber, { borderColor: color, backgroundColor: color + '22' }]}>
                    <Text style={[styles.frameNumberText, { color }]}>{frame.index + 1}</Text>
                  </View>
                  <View style={styles.frameBody}>
                    <View style={styles.frameHeader}>
                      <View style={styles.framePurposePill}>
                        <Text style={styles.framePurposeEmoji}>{purposeMeta.emoji}</Text>
                        <Text style={[styles.framePurposeText, { color }]}>{purposeMeta.label}</Text>
                      </View>
                      <Text style={styles.frameDuration}>⏱️ {frame.duration}sn</Text>
                    </View>
                    <Text style={styles.frameVisual}>🎥 {frame.visual}</Text>
                    <Text style={styles.frameCaption}>💬 "{frame.caption}"</Text>
                    <Text style={styles.frameTransition}>↪ Geçiş: {STORYSEQ_TRANSITIONS[frame.transition]}</Text>
                  </View>
                </View>
              );
            })}

            <Text style={styles.hooksTitle}>🪝 Hook önerileri</Text>
            <View style={styles.hooksBox}>
              {preview.hooks.map((h, idx) => (
                <Pressable key={idx} onPress={() => onCopy(h)} style={styles.hookRow}>
                  <Text style={styles.hookText}>"{h}"</Text>
                  <Text style={styles.hookCopy}>📋</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.previewActions}>
              <Pressable
                onPress={() =>
                  onCopy(
                    `🎬 ${preview.title}\n${preview.storyArcs
                      .map(f => `${f.index + 1}. (${f.duration}sn) ${f.caption}`)
                      .join('\n')}`
                  )
                }
                style={styles.copyBtn}
              >
                <Text style={styles.copyBtnText}>📋 Storyboard kopyala</Text>
              </Pressable>
              <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>💾 Kaydet</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {/* SAVED LIST */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🗂️ Kayıtlı Sequence'lar ({list.length})</Text>
            {list.length > 0 && (
              <Pressable onPress={onClear}>
                <Text style={styles.clearBtn}>Tümünü sil</Text>
              </Pressable>
            )}
          </View>

          {list.length > 0 && (
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Toplam sahne</Text>
                <Text style={styles.summaryValue}>{summary.totalFrames}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ortalama sahne</Text>
                <Text style={styles.summaryValue}>{summary.avgFrames}</Text>
              </View>
              <Text style={[styles.summaryLabel, { marginTop: 8, marginBottom: 4 }]}>Amaç dağılımı</Text>
              <View style={styles.goalRow}>
                {goalKeys.map(gk => {
                  const cnt = summary.byGoal[gk] ?? 0;
                  if (cnt === 0) return null;
                  const meta = STORYSEQ_GOALS[gk];
                  return (
                    <View key={gk} style={styles.goalChip}>
                      <Text style={styles.goalChipEmoji}>{meta.emoji}</Text>
                      <Text style={styles.goalChipCount}>{cnt}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {list.length === 0 ? (
            <Text style={styles.empty}>Henüz sequence yok. Yukarıdan başlık yaz.</Text>
          ) : (
            list.map(e => {
              const platformMeta = STORYSEQ_PLATFORMS[e.platform];
              const goalMeta = STORYSEQ_GOALS[e.goal];
              const open = openId === e.id;
              return (
                <View key={e.id} style={styles.entry}>
                  <Pressable onPress={() => setOpenId(open ? null : e.id)} style={styles.entryHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryTitle} numberOfLines={1}>
                        {platformMeta?.emoji} {e.title}
                      </Text>
                      <Text style={styles.entryMeta}>
                        {goalMeta?.emoji} {goalMeta?.label} · {e.totalDuration} · {e.storyArcs.length} sahne
                      </Text>
                    </View>
                    <Text style={styles.entryChevron}>{open ? '▲' : '▼'}</Text>
                  </Pressable>

                  {open && (
                    <View style={styles.entryDetail}>
                      {e.storyArcs.map((frame, idx) => {
                        const purposeMeta = STORYSEQ_PURPOSE_META[frame.purpose];
                        const color = PURPOSE_COLORS[frame.purpose];
                        return (
                          <View key={idx} style={styles.entryFrameRow}>
                            <View style={[styles.entryFrameNum, { backgroundColor: color + '22', borderColor: color }]}>
                              <Text style={[styles.entryFrameNumText, { color }]}>{frame.index + 1}</Text>
                            </View>
                            <View style={styles.entryFrameBody}>
                              <View style={styles.entryFrameHeaderRow}>
                                <Text style={[styles.entryFramePurpose, { color }]}>
                                  {purposeMeta.emoji} {purposeMeta.label}
                                </Text>
                                <Text style={styles.entryFrameDur}>⏱️ {frame.duration}sn</Text>
                              </View>
                              <Text style={styles.entryFrameVisual}>🎥 {frame.visual}</Text>
                              <Text style={styles.entryFrameCaption}>💬 "{frame.caption}"</Text>
                            </View>
                          </View>
                        );
                      })}

                      <Text style={styles.entryLabel}>Notlar</Text>
                      <TextInput
                        value={notesDraft[e.id] ?? e.notes}
                        onChangeText={txt => setNotesDraft(prev => ({ ...prev, [e.id]: txt }))}
                        placeholder="Not ekle..."
                        placeholderTextColor="#475569"
                        style={styles.notesInput}
                        multiline
                      />
                      <View style={styles.entryActions}>
                        <Pressable
                          onPress={() => onSaveNotes(e.id)}
                          disabled={notesDraft[e.id] === undefined}
                          style={[styles.smallBtn, notesDraft[e.id] === undefined && { opacity: 0.4 }]}
                        >
                          <Text style={styles.smallBtnText}>💾 Notu kaydet</Text>
                        </Pressable>
                        <Pressable onPress={() => onRemove(e.id)} style={[styles.smallBtn, { borderColor: '#F97316' }]}>
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  previewTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  durationPill: {
    backgroundColor: '#6366f1' + '22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  durationText: { color: '#6366f1', fontSize: 12, fontWeight: '700' },
  goalTip: { color: '#94a3b8', fontSize: 12, marginBottom: 12, fontStyle: 'italic' },
  sectionTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  frameRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  frameTimeline: { width: 4 },
  frameNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    marginVertical: 10,
    borderWidth: 2,
  },
  frameNumberText: { fontSize: 13, fontWeight: '700' },
  frameBody: { flex: 1, padding: 10 },
  frameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 4,
  },
  framePurposePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  framePurposeEmoji: { fontSize: 13 },
  framePurposeText: { fontSize: 12, fontWeight: '700' },
  frameDuration: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  frameVisual: { color: '#cbd5e1', fontSize: 12, marginBottom: 4, lineHeight: 16 },
  frameCaption: { color: '#94a3b8', fontSize: 11, fontStyle: 'italic', marginBottom: 4, lineHeight: 14 },
  frameTransition: { color: '#64748b', fontSize: 10 },
  hooksTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 8 },
  hooksBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  hookRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  hookText: { color: '#e2e8f0', fontSize: 12, flex: 1, marginRight: 8, lineHeight: 16 },
  hookCopy: { color: '#6366f1', fontSize: 14 },
  previewActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  copyBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  copyBtnText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
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
  goalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 4,
  },
  goalChipEmoji: { fontSize: 12 },
  goalChipCount: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
  empty: { color: '#64748b', fontSize: 13, fontStyle: 'italic', paddingVertical: 12, textAlign: 'center' },
  entry: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  entryHeader: { flexDirection: 'row', alignItems: 'center' },
  entryTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  entryMeta: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  entryChevron: { color: '#94a3b8', fontSize: 14 },
  entryDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  entryFrameRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  entryFrameNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
  },
  entryFrameNumText: { fontSize: 11, fontWeight: '700' },
  entryFrameBody: { flex: 1 },
  entryFrameHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  entryFramePurpose: { fontSize: 11, fontWeight: '700' },
  entryFrameDur: { color: '#94a3b8', fontSize: 10 },
  entryFrameVisual: { color: '#cbd5e1', fontSize: 11, lineHeight: 14 },
  entryFrameCaption: { color: '#94a3b8', fontSize: 10, fontStyle: 'italic', marginTop: 2 },
  entryLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 4 },
  notesInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    color: '#f8fafc',
    fontSize: 13,
    minHeight: 50,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  entryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  smallBtnText: { color: '#cbd5e1', fontSize: 10, fontWeight: '600' },
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