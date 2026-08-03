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
  IDEA_ANGLES,
  IDEA_PRIORITY_LABELS,
  IDEA_REACH,
  IDEA_STATUSES,
  Idea,
  IdeaAngle,
  IdeaStatus,
  buildIdeaSuggestion,
  clearIdeaBank,
  getIdeaBank,
  getStoredNiche,
  removeIdea,
  saveIdea,
  seedIdeaBankDemo,
  addCopyToHistory,
} from '../services/storage';
import { NicheId } from '../services/contentService';

const STATUS_LABEL: Record<IdeaStatus, string> = {
  raw: 'Ham',
  developing: 'Geliştiriliyor',
  ready: 'Hazır',
  used: 'Kullanıldı',
  archived: 'Arşiv',
};

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
};

const priorityEmoji = (p: number): string => {
  if (p >= 5) return '🔥';
  if (p >= 4) return '⚡';
  if (p >= 3) return '⭐';
  if (p >= 2) return '📌';
  return '📎';
};

export default function IdeaBankScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [list, setList] = useState<Idea[]>([]);
  const [filterStatus, setFilterStatus] = useState<IdeaStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hookIdea, setHookIdea] = useState('');
  const [angle, setAngle] = useState<IdeaAngle>('tutorial');
  const [status, setStatus] = useState<IdeaStatus>('raw');
  const [format, setFormat] = useState('Reels');
  const [reach, setReach] = useState<Idea['estimatedReach']>('medium');
  const [priority, setPriority] = useState<Idea['priority']>(3);
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    const n = await getStoredNiche();
    setNiche(n);
    let l = await getIdeaBank();
    if (l.length === 0 && n) {
      l = await seedIdeaBankDemo(n);
    }
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
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setHookIdea('');
    setAngle('tutorial');
    setStatus('raw');
    setFormat('Reels');
    setReach('medium');
    setPriority(3);
    setTagsInput('');
    setNotes('');
    setEditingId(null);
  }, []);

  const openAdd = useCallback(() => {
    resetForm();
    setShowAdd(true);
  }, [resetForm]);

  const openEdit = useCallback((idea: Idea) => {
    setTitle(idea.title);
    setDescription(idea.description);
    setHookIdea(idea.hookIdea);
    setAngle(idea.angle);
    setStatus(idea.status);
    setFormat(idea.format);
    setReach(idea.estimatedReach);
    setPriority(idea.priority);
    setTagsInput(idea.tags.join(', '));
    setNotes(idea.notes);
    setEditingId(idea.id);
    setShowAdd(true);
  }, [resetForm]);

  const handleGenerateSuggestion = useCallback(() => {
    if (!niche) {
      Alert.alert('Niche seçili değil', 'Önce ana ekrandan bir niche seç.');
      return;
    }
    const s = buildIdeaSuggestion(niche, Date.now());
    setTitle(s.title);
    setDescription(s.description);
    setHookIdea(s.hookIdea);
    setAngle(s.angle);
    setFormat(s.format);
    setReach(s.estimatedReach);
    setTagsInput(s.tags.join(', '));
    setToast('💡 Öneri üretildi');
  }, [niche]);

  const parseTags = (input: string): string[] => {
    return input
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8);
  };

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Başlık gerekli', 'Fikre bir başlık ver.');
      return;
    }
    setSaving(true);
    const tags = parseTags(tagsInput);
    const payload = {
      id: editingId ?? undefined,
      title: title.trim(),
      description: description.trim(),
      hookIdea: hookIdea.trim(),
      angle,
      status,
      format: format.trim() || 'Reels',
      estimatedReach: reach,
      priority,
      tags,
      notes: notes.trim(),
      source: 'manual' as const,
    };
    const next = await saveIdea(payload);
    setList(next);
    setSaving(false);
    setShowAdd(false);
    resetForm();
    setToast(editingId ? '✏️ Fikir güncellendi' : '💾 Fikir kaydedildi');
  }, [title, description, hookIdea, angle, status, format, reach, priority, tagsInput, notes, editingId, resetForm]);

  const handleRemove = useCallback(async (id: string) => {
    const next = await removeIdea(id);
    setList(next);
    setToast('🗑️ Fikir silindi');
  }, []);

  const handleClearAll = useCallback(() => {
    if (list.length === 0) return;
    Alert.alert('Tüm fikirleri sil', `${list.length} kayıt silinecek. Emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await clearIdeaBank();
          setList([]);
          setToast('🧹 Tümü silindi');
        },
      },
    ]);
  }, [list]);

  const copyIdea = useCallback(async (idea: Idea) => {
    const lines: string[] = [];
    lines.push(`💡 ${idea.title.toUpperCase()}`);
    lines.push(`Açı: ${IDEA_ANGLES.find(a => a.id === idea.angle)?.label ?? idea.angle} | Format: ${idea.format} | Durum: ${STATUS_LABEL[idea.status]}`);
    lines.push(`Öncelik: ${priorityEmoji(idea.priority)} ${IDEA_PRIORITY_LABELS[idea.priority]} | Erişim: ${IDEA_REACH[idea.estimatedReach].emoji} ${IDEA_REACH[idea.estimatedReach].label}`);
    if (idea.tags.length > 0) lines.push(`Etiketler: ${idea.tags.map(t => '#' + t).join(' ')}`);
    lines.push('');
    if (idea.hookIdea) {
      lines.push(`🎯 HOOK ÖNERİSİ`);
      lines.push(idea.hookIdea);
      lines.push('');
    }
    if (idea.description) {
      lines.push(`📝 AÇIKLAMA`);
      lines.push(idea.description);
      lines.push('');
    }
    if (idea.notes) {
      lines.push(`📌 NOTLAR`);
      lines.push(idea.notes);
    }
    const text = lines.join('\n');
    try {
      Clipboard.setString(text);
      await addCopyToHistory(text, 'detail');
      setToast('📋 Fikir kopyalandı');
    } catch {
      setToast('Kopyalama başarısız');
    }
  }, []);

  const cycleStatus = useCallback(async (idea: Idea) => {
    const order: IdeaStatus[] = ['raw', 'developing', 'ready', 'used', 'archived'];
    const idx = order.indexOf(idea.status);
    const next = order[(idx + 1) % order.length];
    const updated = await saveIdea({ ...idea, status: next });
    setList(updated);
    setToast(`🔄 ${STATUS_LABEL[next]}`);
  }, []);

  const filtered = useMemo(() => {
    let f = list;
    if (filterStatus !== 'all') f = f.filter(i => i.status === filterStatus);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      f = f.filter(
        i =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.tags.some(t => t.includes(q)) ||
          i.hookIdea.toLowerCase().includes(q)
      );
    }
    return f.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.updatedAt - a.updatedAt;
    });
  }, [list, filterStatus, searchQuery]);

  const counts = useMemo(() => {
    const c: Record<IdeaStatus, number> = { raw: 0, developing: 0, ready: 0, used: 0, archived: 0 };
    list.forEach(i => {
      c[i.status]++;
    });
    return c;
  }, [list]);

  const IdeaCard = ({ idea, onEdit, onCopy, onDelete, onCycle }: { idea: Idea; onEdit: () => void; onCopy: () => void; onDelete: () => void; onCycle: () => void }) => {
    const angleInfo = IDEA_ANGLES.find(a => a.id === idea.angle);
    const statusInfo = IDEA_STATUSES.find(s => s.id === idea.status);
    const reachInfo = IDEA_REACH[idea.estimatedReach];
    return (
      <View style={[styles.ideaCard, { borderLeftColor: angleInfo?.color ?? '#06B6D4' }]}>
        <View style={styles.ideaHeader}>
          <View style={styles.ideaHeaderLeft}>
            <Text style={styles.ideaEmoji}>{angleInfo?.emoji ?? '💡'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.ideaTitle} numberOfLines={2}>{idea.title}</Text>
              <View style={styles.ideaMetaRow}>
                <Text style={[styles.ideaStatusChip, { color: statusInfo?.color, backgroundColor: statusInfo?.bg }]}>
                  {statusInfo?.emoji} {STATUS_LABEL[idea.status]}
                </Text>
                <Text style={[styles.ideaReachChip, { color: reachInfo.color }]}>
                  {reachInfo.emoji} {reachInfo.label}
                </Text>
                <Text style={styles.ideaPriority}>{priorityEmoji(idea.priority)}</Text>
              </View>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.ideaCycleBtn, pressed && { opacity: 0.6 }]}
            onPress={onCycle}
            hitSlop={8}
          >
            <Text style={styles.ideaCycleText}>🔄</Text>
          </Pressable>
        </View>

        {idea.description ? (
          <Text style={styles.ideaDescription} numberOfLines={3}>{idea.description}</Text>
        ) : null}

        {idea.hookIdea ? (
          <View style={styles.ideaHookBox}>
            <Text style={styles.ideaHookLabel}>🎯 HOOK ÖNERİSİ</Text>
            <Text style={styles.ideaHookText}>{idea.hookIdea}</Text>
          </View>
        ) : null}

        <View style={styles.ideaDetailsRow}>
          <View style={styles.ideaDetailItem}>
            <Text style={styles.ideaDetailLabel}>FORMAT</Text>
            <Text style={styles.ideaDetailValue}>{idea.format}</Text>
          </View>
          <View style={styles.ideaDetailItem}>
            <Text style={styles.ideaDetailLabel}>ÖNCELİK</Text>
            <Text style={styles.ideaDetailValue}>{IDEA_PRIORITY_LABELS[idea.priority]}</Text>
          </View>
          <View style={styles.ideaDetailItem}>
            <Text style={styles.ideaDetailLabel}>TARİH</Text>
            <Text style={styles.ideaDetailValue}>{formatDate(idea.updatedAt)}</Text>
          </View>
        </View>

        {idea.tags.length > 0 && (
          <View style={styles.ideaTagsRow}>
            {idea.tags.map((t, i) => (
              <View key={i} style={styles.ideaTagChip}>
                <Text style={styles.ideaTagText}>#{t}</Text>
              </View>
            ))}
          </View>
        )}

        {idea.notes ? (
          <View style={styles.ideaNotesBox}>
            <Text style={styles.ideaNotesLabel}>📌 NOT</Text>
            <Text style={styles.ideaNotesText}>{idea.notes}</Text>
          </View>
        ) : null}

        <View style={styles.ideaActions}>
          <Pressable style={({ pressed }) => [styles.ideaCopyBtn, pressed && { opacity: 0.6 }]} onPress={onCopy}>
            <Text style={styles.ideaCopyBtnText}>📋 Kopyala</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.ideaEditBtn, pressed && { opacity: 0.6 }]} onPress={onEdit}>
            <Text style={styles.ideaEditBtnText}>✏️ Düzenle</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.ideaDeleteBtn, pressed && { opacity: 0.6 }]} onPress={onDelete}>
            <Text style={styles.ideaDeleteBtnText}>🗑️</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Idea Bank', headerBackTitle: 'Geri' }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroBadge}>💡 IDEA BANK / FİKİR HAVUZU</Text>
          <Text style={styles.heroTitle}>Bir sonraki içerik burada</Text>
          <Text style={styles.heroSub}>
            Ham fikirleri topla, geliştir, hazır olunca içerik takvimine at.
          </Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{list.length}</Text>
              <Text style={styles.heroStatLabel}>toplam</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: IDEA_STATUSES[2].color }]}>{counts.ready}</Text>
              <Text style={styles.heroStatLabel}>hazır</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: IDEA_STATUSES[1].color }]}>{counts.developing}</Text>
              <Text style={styles.heroStatLabel}>geliştiriliyor</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: IDEA_STATUSES[0].color }]}>{counts.raw}</Text>
              <Text style={styles.heroStatLabel}>ham</Text>
            </View>
          </View>
        </View>

        <View style={styles.toolbar}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Fikirlerde ara..."
            placeholderTextColor="#64748B"
          />
          <Pressable style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]} onPress={openAdd}>
            <Text style={styles.addBtnText}>+ Yeni</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={[styles.filterChipText, filterStatus === 'all' && styles.filterChipTextActive]}>Tümü ({list.length})</Text>
          </Pressable>
          {IDEA_STATUSES.map(s => (
            <Pressable
              key={s.id}
              style={[styles.filterChip, filterStatus === s.id && { backgroundColor: s.color, borderColor: s.color }]}
              onPress={() => setFilterStatus(s.id)}
            >
              <Text style={[styles.filterChipText, filterStatus === s.id && styles.filterChipTextActive]}>
                {s.emoji} {s.label} ({counts[s.id]})
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {showAdd && (
          <View style={styles.addCard}>
            <View style={styles.addHeader}>
              <Text style={styles.addTitle}>{editingId ? '✏️ Fikri Düzenle' : '💡 Yeni Fikir'}</Text>
              <Pressable onPress={() => { setShowAdd(false); resetForm(); }}>
                <Text style={styles.addClose}>✕</Text>
              </Pressable>
            </View>

            <Pressable style={({ pressed }) => [styles.suggestBtn, pressed && { opacity: 0.7 }]} onPress={handleGenerateSuggestion}>
              <Text style={styles.suggestBtnText}>🎲 Bana Öneri Üret</Text>
            </Pressable>

            <Text style={styles.formLabel}>Başlık *</Text>
            <TextInput
              style={styles.formInput}
              value={title}
              onChangeText={setTitle}
              placeholder="ör. Yaz öncesi 12 haftalık program"
              placeholderTextColor="#64748B"
              maxLength={120}
            />

            <Text style={styles.formLabel}>Açı</Text>
            <View style={styles.angleRow}>
              {IDEA_ANGLES.map(a => (
                <Pressable
                  key={a.id}
                  style={[styles.angleChip, angle === a.id && { backgroundColor: a.color, borderColor: a.color }]}
                  onPress={() => setAngle(a.id)}
                >
                  <Text style={styles.angleEmoji}>{a.emoji}</Text>
                  <Text style={[styles.angleText, angle === a.id && styles.angleTextActive]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.formLabel}>Durum</Text>
            <View style={styles.statusRow}>
              {IDEA_STATUSES.map(s => (
                <Pressable
                  key={s.id}
                  style={[styles.statusChip, status === s.id && { backgroundColor: s.color, borderColor: s.color }]}
                  onPress={() => setStatus(s.id)}
                >
                  <Text style={[styles.statusText, status === s.id && styles.statusTextActive]}>{s.emoji} {STATUS_LABEL[s.id]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.formLabel}>Hook Önerisi</Text>
            <TextInput
              style={[styles.formInput, { minHeight: 60 }]}
              value={hookIdea}
              onChangeText={setHookIdea}
              placeholder="Açılış cümlesi / dikkat çekici giriş"
              placeholderTextColor="#64748B"
              multiline
              maxLength={200}
            />

            <Text style={styles.formLabel}>Açıklama</Text>
            <TextInput
              style={[styles.formInput, { minHeight: 80 }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Fikrin detayı, ana mesaj, hedef kitle..."
              placeholderTextColor="#64748B"
              multiline
              maxLength={400}
            />

            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Format</Text>
                <TextInput
                  style={styles.formInput}
                  value={format}
                  onChangeText={setFormat}
                  placeholder="ör. Reels"
                  placeholderTextColor="#64748B"
                  maxLength={24}
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Etiketler (virgülle)</Text>
                <TextInput
                  style={styles.formInput}
                  value={tagsInput}
                  onChangeText={setTagsInput}
                  placeholder="squat, motivasyon"
                  placeholderTextColor="#64748B"
                  maxLength={120}
                />
              </View>
            </View>

            <Text style={styles.formLabel}>Tahmini Erişim</Text>
            <View style={styles.reachRow}>
              {(Object.keys(IDEA_REACH) as Idea['estimatedReach'][]).map(r => (
                <Pressable
                  key={r}
                  style={[styles.reachChip, reach === r && { backgroundColor: IDEA_REACH[r].color, borderColor: IDEA_REACH[r].color }]}
                  onPress={() => setReach(r)}
                >
                  <Text style={[styles.reachText, reach === r && styles.reachTextActive]}>
                    {IDEA_REACH[r].emoji} {IDEA_REACH[r].label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.formLabel}>Öncelik (1-5)</Text>
            <View style={styles.priorityRow}>
              {([1, 2, 3, 4, 5] as const).map(p => (
                <Pressable
                  key={p}
                  style={[styles.priorityChip, priority === p && styles.priorityChipActive]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={styles.priorityEmoji}>{priorityEmoji(p)}</Text>
                  <Text style={[styles.priorityNum, priority === p && styles.priorityNumActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.formLabel}>Notlar</Text>
            <TextInput
              style={[styles.formInput, { minHeight: 60 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ek notlar, referanslar..."
              placeholderTextColor="#64748B"
              multiline
              maxLength={200}
            />

            <Pressable
              style={({ pressed }) => [styles.saveBtn, saving && { opacity: 0.6 }, pressed && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.saveBtnText}>{editingId ? '💾 Güncelle' : '💾 Kaydet'}</Text>
              )}
            </Pressable>
          </View>
        )}

        {filtered.length > 0 ? (
          <View style={styles.listWrap}>
            {filtered.map(idea => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onEdit={() => openEdit(idea)}
                onCopy={() => copyIdea(idea)}
                onDelete={() => handleRemove(idea.id)}
                onCycle={() => cycleStatus(idea)}
              />
            ))}
            <Pressable style={({ pressed }) => [styles.clearAllBtn, pressed && { opacity: 0.6 }]} onPress={handleClearAll}>
              <Text style={styles.clearAllBtnText}>🧹 Tüm Fikir Havuzunu Temizle</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>💭</Text>
            <Text style={styles.emptyTitle}>Henüz fikir yok</Text>
            <Text style={styles.emptySub}>
              {searchQuery.trim() ? 'Aramanızla eşleşen fikir bulunamadı.' : 'Yukarıdan "+ Yeni" ile ilk fikrini ekle.'}
            </Text>
          </View>
        )}
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
  container: { flex: 1, backgroundColor: '#020617' },
  scroll: { padding: 16, gap: 16 },

  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#06B6D4',
    gap: 8,
  },
  heroBadge: { color: '#06B6D4', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heroTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  heroSub: { color: '#94A3B8', fontSize: 13, lineHeight: 18 },
  heroStatsRow: { flexDirection: 'row', marginTop: 12, gap: 12 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  heroStatLabel: { color: '#94A3B8', fontSize: 10, marginTop: 2, textAlign: 'center' },

  toolbar: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  addBtn: {
    backgroundColor: '#06B6D4',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtnText: { color: '#0F172A', fontSize: 14, fontWeight: '700' },

  filterRow: { gap: 8, paddingVertical: 4 },
  filterChip: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  filterChipActive: { backgroundColor: '#06B6D4', borderColor: '#06B6D4' },
  filterChipText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#0F172A' },

  addCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#06B6D4',
    gap: 10,
  },
  addHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  addClose: { color: '#94A3B8', fontSize: 22, fontWeight: '300', padding: 4 },
  suggestBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#06B6D4',
    borderStyle: 'dashed',
  },
  suggestBtnText: { color: '#06B6D4', fontSize: 13, fontWeight: '700' },

  formLabel: { color: '#F8FAFC', fontSize: 13, fontWeight: '600', marginTop: 4 },
  formInput: {
    backgroundColor: '#020617',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    textAlignVertical: 'top',
  },
  formRow: { flexDirection: 'row' },

  angleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  angleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  angleEmoji: { fontSize: 13 },
  angleText: { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
  angleTextActive: { color: '#0F172A' },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChip: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
  statusTextActive: { color: '#0F172A' },

  reachRow: { flexDirection: 'row', gap: 6 },
  reachChip: {
    flex: 1,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  reachText: { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
  reachTextActive: { color: '#0F172A' },

  priorityRow: { flexDirection: 'row', gap: 6 },
  priorityChip: {
    flex: 1,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  priorityChipActive: { backgroundColor: '#06B6D4', borderColor: '#06B6D4' },
  priorityEmoji: { fontSize: 18 },
  priorityNum: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginTop: 2 },
  priorityNumActive: { color: '#0F172A' },

  saveBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#0F172A', fontSize: 15, fontWeight: '700' },

  listWrap: { gap: 12 },
  ideaCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    borderLeftWidth: 4,
    gap: 10,
  },
  ideaHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ideaHeaderLeft: { flex: 1, flexDirection: 'row', gap: 10 },
  ideaEmoji: { fontSize: 28, marginTop: 2 },
  ideaTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  ideaMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  ideaStatusChip: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  ideaReachChip: { fontSize: 10, fontWeight: '700' },
  ideaPriority: { fontSize: 14 },
  ideaCycleBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  ideaCycleText: { fontSize: 14 },

  ideaDescription: { color: '#CBD5E1', fontSize: 13, lineHeight: 18 },
  ideaHookBox: {
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#06B6D4',
    borderStyle: 'dashed',
  },
  ideaHookLabel: { color: '#06B6D4', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  ideaHookText: { color: '#F8FAFC', fontSize: 12, fontStyle: 'italic', lineHeight: 16 },

  ideaDetailsRow: { flexDirection: 'row', gap: 8 },
  ideaDetailItem: { flex: 1, backgroundColor: '#020617', borderRadius: 8, padding: 8 },
  ideaDetailLabel: { color: '#64748B', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  ideaDetailValue: { color: '#F8FAFC', fontSize: 11, fontWeight: '600' },

  ideaTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  ideaTagChip: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ideaTagText: { color: '#06B6D4', fontSize: 10, fontWeight: '600' },

  ideaNotesBox: {
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  ideaNotesLabel: { color: '#F59E0B', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  ideaNotesText: { color: '#CBD5E1', fontSize: 12, lineHeight: 16 },

  ideaActions: { flexDirection: 'row', gap: 6, marginTop: 4 },
  ideaCopyBtn: {
    flex: 1,
    backgroundColor: '#06B6D4',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  ideaCopyBtnText: { color: '#0F172A', fontSize: 12, fontWeight: '700' },
  ideaEditBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  ideaEditBtnText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  ideaDeleteBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ideaDeleteBtnText: { fontSize: 14 },

  clearAllBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  clearAllBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', padding: 40, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  emptySub: { color: '#94A3B8', fontSize: 13, textAlign: 'center' },

  toast: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    backgroundColor: '#0F172A',
    borderColor: '#06B6D4',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toastText: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
});
