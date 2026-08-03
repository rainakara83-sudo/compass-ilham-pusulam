import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  buildArc,
  clearSAGs,
  getSAGList,
  removeSAG,
  SAG_EMOTIONS,
  SAGEntry,
  SAGEmotion,
  SAG_THEMES,
  SAGTheme,
  saveSAG,
} from '../services/storage';

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)}`;
};

const intensityColor = (i: number): string => {
  if (i >= 85) return '#ef4444';
  if (i >= 70) return '#f59e0b';
  return '#10b981';
};

export default function StoryArcScreen() {
  const [theme, setTheme] = useState<SAGTheme>('transformation');
  const [emotion, setEmotion] = useState<SAGEmotion>('inspiration');
  const [hero, setHero] = useState('');
  const [goal, setGoal] = useState('');
  const [conflict, setConflict] = useState('');
  const [resolution, setResolution] = useState('');
  const [lesson, setLesson] = useState('');
  const [title, setTitle] = useState('');
  const [list, setList] = useState<SAGEntry[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await getSAGList();
    setList(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const arc = useMemo(() => {
    if (!hero.trim() && !goal.trim() && !conflict.trim()) return null;
    return buildArc(theme, hero, goal, conflict, resolution, lesson, emotion);
  }, [theme, emotion, hero, goal, conflict, resolution, lesson]);

  const onSave = useCallback(async () => {
    if (!arc) return;
    const entry: SAGEntry = {
      id: String(Date.now()),
      title: title.trim() || arc.title,
      theme,
      emotion,
      hero,
      goal,
      conflict,
      resolution,
      lesson,
      beats: arc.beats,
      createdAt: Date.now(),
    };
    const next = await saveSAG(entry);
    setList(next);
    setSaved('Kaydedildi ✓');
    setTimeout(() => setSaved(null), 1500);
  }, [arc, title, theme, emotion, hero, goal, conflict, resolution, lesson]);

  const onRemove = useCallback(async (id: string) => {
    const next = await removeSAG(id);
    setList(next);
  }, []);

  const onClear = useCallback(async () => {
    await clearSAGs();
    setList([]);
  }, []);

  const totalIntensity = list.reduce((sum, e) => {
    const a = buildArc(e.theme, e.hero, e.goal, e.conflict, e.resolution, e.lesson, e.emotion);
    return sum + a.intensity;
  }, 0);
  const avgIntensity = list.length > 0 ? Math.round(totalIntensity / list.length) : 0;
  const themeCount = new Set(list.map(e => e.theme)).size;
  const emotionCount = new Set(list.map(e => e.emotion)).size;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Story Arc Generator</Text>
      <Text style={styles.subtitle}>Hikaye anlatımını yapılandır</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Tema</Text>
        <View style={styles.chipRow}>
          {SAG_THEMES.map(t => (
            <Pressable
              key={t.id}
              onPress={() => setTheme(t.id)}
              style={[styles.chip, theme === t.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, theme === t.id && styles.chipTextActive]}>
                {t.emoji} {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Duygu</Text>
        <View style={styles.chipRow}>
          {SAG_EMOTIONS.map(e => (
            <Pressable
              key={e.id}
              onPress={() => setEmotion(e.id)}
              style={[styles.chip, emotion === e.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, emotion === e.id && styles.chipTextActive]}>
                {e.emoji} {e.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Kahraman</Text>
        <TextInput
          value={hero}
          onChangeText={setHero}
          placeholder="örn. genç girişimci"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Hedef</Text>
        <TextInput
          value={goal}
          onChangeText={setGoal}
          placeholder="kahramanın amacı"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Çatışma</Text>
        <TextInput
          value={conflict}
          onChangeText={setConflict}
          placeholder="karşılaşılan engel"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Çözüm</Text>
        <TextInput
          value={resolution}
          onChangeText={setResolution}
          placeholder="nasıl aşıldı"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Ders</Text>
        <TextInput
          value={lesson}
          onChangeText={setLesson}
          placeholder="alınan mesaj"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Başlık (opsiyonel)</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="kaydetmek için"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
      </View>

      {arc && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>{arc.title}</Text>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{arc.estEngagement}</Text>
              <Text style={styles.statLbl}>Tahmini Etkileşim</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statVal, { color: intensityColor(arc.intensity) }]}>{arc.intensity}</Text>
              <Text style={styles.statLbl}>Yoğunluk</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{arc.beats.length}</Text>
              <Text style={styles.statLbl}>Aşama</Text>
            </View>
          </View>

          <Text style={styles.labelSm}>Hook</Text>
          <Text style={styles.body}>{arc.hook}</Text>

          <Text style={styles.labelSm}>Aşamalar</Text>
          {arc.beats.map((b, i) => (
            <View key={i} style={styles.beatRow}>
              <View style={styles.beatNo}>
                <Text style={styles.beatNoText}>{i + 1}</Text>
              </View>
              <View style={styles.beatBody}>
                <Text style={styles.beatPhase}>{b.phase}</Text>
                <Text style={styles.beatText}>{b.text}</Text>
              </View>
            </View>
          ))}

          <Text style={styles.labelSm}>Doruk</Text>
          <Text style={styles.body}>{arc.climax}</Text>

          <Text style={styles.labelSm}>Sonuç</Text>
          <Text style={styles.body}>{arc.payoff}</Text>

          <Text style={styles.labelSm}>Ahlaki Ders</Text>
          <Text style={styles.body}>{arc.moral}</Text>
        </View>
      )}

      <Pressable
        onPress={onSave}
        disabled={!arc}
        style={[styles.button, !arc && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{saved ?? 'Arki Kaydet'}</Text>
      </Pressable>

      {list.length > 0 && (
        <Pressable onPress={onClear} style={[styles.button, styles.buttonGhost]}>
          <Text style={[styles.buttonText, { color: '#fca5a5' }]}>Tümünü Temizle</Text>
        </Pressable>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Kayıtlı Arklar ({list.length})</Text>
        {list.length === 0 ? (
          <Text style={styles.empty}>Henüz ark yok</Text>
        ) : (
          <View style={styles.summaryRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{avgIntensity}</Text>
              <Text style={styles.statLbl}>Ort. Yoğunluk</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{themeCount}</Text>
              <Text style={styles.statLbl}>Tema Çeşitliliği</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{emotionCount}</Text>
              <Text style={styles.statLbl}>Duygu Çeşitliliği</Text>
            </View>
          </View>
        )}

        {list.map(entry => {
          const a = buildArc(entry.theme, entry.hero, entry.goal, entry.conflict, entry.resolution, entry.lesson, entry.emotion);
          return (
            <View key={entry.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{entry.title}</Text>
                <Pressable onPress={() => onRemove(entry.id)}>
                  <Text style={styles.remove}>Sil</Text>
                </Pressable>
              </View>
              <Text style={styles.meta}>
                {entry.theme} · {entry.emotion} · {formatDate(entry.createdAt)}
              </Text>
              <View style={styles.intensityBar}>
                <View
                  style={[
                    styles.intensityFill,
                    { width: `${a.intensity}%`, backgroundColor: intensityColor(a.intensity) },
                  ]}
                />
              </View>
              <Text style={styles.body}>{a.hook}</Text>
            </View>
          );
        })}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#f8fafc' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 16 },
  section: { marginBottom: 16 },
  label: { fontSize: 12, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelSm: { fontSize: 11, color: '#cbd5e1', marginTop: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    marginRight: 6,
    marginBottom: 6,
  },
  chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  chipText: { fontSize: 12, color: '#cbd5e1' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
  },
  preview: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewTitle: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 10 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  stat: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 18, fontWeight: '800', color: '#6366f1' },
  statLbl: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingVertical: 8 },
  body: { fontSize: 13, color: '#cbd5e1', lineHeight: 19 },
  beatRow: { flexDirection: 'row', marginTop: 8 },
  beatNo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  beatNoText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  beatBody: { flex: 1 },
  beatPhase: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
  beatText: { fontSize: 13, color: '#e2e8f0', lineHeight: 19 },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: { backgroundColor: '#475569' },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ef4444' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  empty: { fontSize: 13, color: '#64748b', fontStyle: 'italic' },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#f8fafc', flex: 1 },
  remove: { fontSize: 12, color: '#fca5a5' },
  meta: { fontSize: 11, color: '#94a3b8', marginBottom: 8 },
  intensityBar: { height: 4, backgroundColor: '#334155', borderRadius: 2, marginBottom: 8, overflow: 'hidden' },
  intensityFill: { height: '100%', borderRadius: 2 },
});