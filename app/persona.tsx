import React, { useCallback, useEffect, useState } from 'react';
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
  PERSONA_AGE_LIST,
  PERSONA_GOAL_LIST,
  PERSONA_SEGMENT_LIST,
  PERSONA_TONE_LIST,
  Persona,
  PersonaAge,
  PersonaGoal,
  PersonaSegment,
  PersonaTone,
  buildPersona,
  clearPersonas,
  getPersonaList,
  getStoredNiche,
  removePersona,
  savePersona,
  addCopyToHistory,
} from '../services/storage';
import { NicheId } from '../services/contentService';

const SEGMENT_LABEL: Record<PersonaSegment, string> = {
  beginner: 'Yeni Başlayan',
  intermediate: 'Orta Seviye',
  advanced: 'İleri Seviye',
  returning: 'Geri Dönen',
  casual: 'Rahat İzleyici',
  pro_shopper: 'Pro Alıcı',
};

const AGE_LABEL: Record<PersonaAge, string> = {
  gen_z: 'Gen Z',
  millennial: 'Millennial',
  gen_x: 'Gen X',
  boomer: 'Boomer',
};

const TONE_LABEL: Record<PersonaTone, string> = {
  friendly: 'Samimi',
  expert: 'Uzman',
  casual: 'Rahat',
  motivational: 'Motivasyonel',
  educational: 'Eğitici',
  edgy: 'Cesur',
};

const GOAL_LABEL: Record<PersonaGoal, string> = {
  learn: 'Öğrenmek',
  buy: 'Satın Almak',
  connect: 'Bağ Kurmak',
  entertain: 'Eğlenmek',
  transform: 'Dönüşmek',
  inspire: 'İlham Almak',
};

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? '?';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase();
};

export default function PersonaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [list, setList] = useState<Persona[]>([]);
  const [generated, setGenerated] = useState<Persona | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [age, setAge] = useState<PersonaAge>('millennial');
  const [segment, setSegment] = useState<PersonaSegment>('intermediate');
  const [goals, setGoals] = useState<PersonaGoal[]>(['learn']);
  const [tone, setTone] = useState<PersonaTone>('friendly');

  const load = useCallback(async () => {
    const n = await getStoredNiche();
    setNiche(n);
    const l = await getPersonaList();
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

  const toggleGoal = useCallback((g: PersonaGoal) => {
    setGoals(prev => (prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]));
  }, []);

  const handleGenerate = useCallback(() => {
    if (!niche) {
      Alert.alert('Niche seçili değil', 'Önce ana ekrandan bir niche seç.');
      return;
    }
    const finalName = name.trim() || 'İdeal Takipçi';
    const p = buildPersona(niche, finalName, age, segment, goals, tone);
    const preview: Persona = {
      ...p,
      id: `preview-${Date.now()}`,
      name: finalName,
      createdAt: Date.now(),
    };
    setGenerated(preview);
  }, [niche, name, segment, age, goals, tone]);

  const handleSave = useCallback(async () => {
    if (!generated) return;
    setSaving(true);
    const next = await savePersona(generated);
    setList(next);
    setSaving(false);
    setToast('👤 Persona kaydedildi');
  }, [generated]);

  const handleRemove = useCallback(async (id: string) => {
    const next = await removePersona(id);
    setList(next);
    setToast('🗑️ Persona silindi');
  }, []);

  const handleClearAll = useCallback(() => {
    if (list.length === 0) return;
    Alert.alert('Tüm personayı sil', `${list.length} kayıt silinecek. Emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await clearPersonas();
          setList([]);
          setToast('🧹 Tümü silindi');
        },
      },
    ]);
  }, [list]);

  const copyBrief = useCallback(async (p: Persona) => {
    const lines: string[] = [];
    lines.push(`👤 ${p.name.toUpperCase()} — PERSONA`);
    lines.push(`Yaş: ${AGE_LABEL[p.age]} | Segment: ${SEGMENT_LABEL[p.segment]} | Ton: ${TONE_LABEL[p.tone]}`);
    lines.push(`Hedefler: ${p.goals.map(g => GOAL_LABEL[g]).join(', ')}`);
    lines.push('');
    lines.push(`📝 BİYO`);
    lines.push(p.bio);
    lines.push('');
    lines.push(`😣 Ağrı Noktaları`);
    p.painPoints.forEach(x => lines.push(`• ${x}`));
    lines.push('');
    lines.push(`✨ Arzular`);
    p.desires.forEach(x => lines.push(`• ${x}`));
    lines.push('');
    lines.push(`🗣️ Kelime Havuzu: ${p.vocabulary.join(', ')}`);
    lines.push(`⛔ Kaçınılacak: ${p.avoidWords.join(', ')}`);
    lines.push(`🎬 Format: ${p.preferredFormats.join(', ')}`);
    lines.push('');
    lines.push(`💡 Hook stili: ${p.hookPattern}`);
    lines.push(`📣 CTA: ${p.ctaPattern}`);
    const text = lines.join('\n');
    try {
      Clipboard.setString(text);
      await addCopyToHistory(text, 'detail');
      setToast('📋 Brief kopyalandı');
    } catch {
      setToast('Kopyalama başarısız');
    }
  }, []);

  const PersonaCard = ({ p, onDelete, onCopy }: { p: Persona; onDelete: () => void; onCopy: () => void }) => {
    const segInfo = PERSONA_SEGMENT_LIST.find(s => s.id === p.segment);
    return (
      <View style={styles.personaCard}>
        <View style={styles.personaHeader}>
          <View style={[styles.personaAvatar, { backgroundColor: segInfo?.color ?? '#EC4899' }]}>
            <Text style={styles.personaAvatarText}>{initialsOf(p.name)}</Text>
          </View>
          <View style={styles.personaHeaderRight}>
            <Text style={styles.personaName}>{p.name}</Text>
            <Text style={styles.personaMeta}>
              {AGE_LABEL[p.age]} · {SEGMENT_LABEL[p.segment]} · {TONE_LABEL[p.tone]}
            </Text>
          </View>
        </View>

        <View style={styles.personaBioBox}>
          <Text style={styles.personaBioText}>{p.bio}</Text>
        </View>

        <View style={styles.personaGoalsRow}>
          {p.goals.map(g => (
            <View key={g} style={styles.personaGoalChip}>
              <Text style={styles.personaGoalText}>{PERSONA_GOAL_LIST.find(x => x.id === g)?.emoji} {GOAL_LABEL[g]}</Text>
            </View>
          ))}
        </View>

        <View style={styles.personaSection}>
          <Text style={styles.personaSectionLabel}>😣 Ağrı Noktaları</Text>
          {p.painPoints.map((x, i) => (
            <Text key={i} style={styles.personaBullet}>• {x}</Text>
          ))}
        </View>

        <View style={styles.personaSection}>
          <Text style={styles.personaSectionLabel}>✨ Arzular</Text>
          {p.desires.map((x, i) => (
            <Text key={i} style={styles.personaBullet}>• {x}</Text>
          ))}
        </View>

        <View style={styles.personaSection}>
          <Text style={styles.personaSectionLabel}>🗣️ Kelime Havuzu</Text>
          <View style={styles.personaChipRow}>
            {p.vocabulary.map((v, i) => (
              <View key={i} style={styles.personaVocChip}>
                <Text style={styles.personaVocText}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.personaSection}>
          <Text style={styles.personaSectionLabel}>⛔ Kaçınılacak</Text>
          <View style={styles.personaChipRow}>
            {p.avoidWords.map((v, i) => (
              <View key={i} style={styles.personaAvoidChip}>
                <Text style={styles.personaAvoidText}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.personaHookBox}>
          <Text style={styles.personaHookLabel}>💡 HOOK STİLİ</Text>
          <Text style={styles.personaHookText}>{p.hookPattern}</Text>
        </View>

        <View style={styles.personaCtaBox}>
          <Text style={styles.personaHookLabel}>📣 CTA</Text>
          <Text style={styles.personaHookText}>{p.ctaPattern}</Text>
        </View>

        <View style={styles.personaSection}>
          <Text style={styles.personaSectionLabel}>🎬 Tercih Ettiği Formatlar</Text>
          <View style={styles.personaChipRow}>
            {p.preferredFormats.map((f, i) => (
              <View key={i} style={styles.personaFormatChip}>
                <Text style={styles.personaFormatText}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.personaActions}>
          <Pressable
            style={({ pressed }) => [styles.personaCopyBtn, pressed && { opacity: 0.6 }]}
            onPress={onCopy}
          >
            <Text style={styles.personaCopyBtnText}>📋 Brief'i Kopyala</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.personaDeleteBtn, pressed && { opacity: 0.6 }]}
            onPress={onDelete}
          >
            <Text style={styles.personaDeleteBtnText}>🗑️ Sil</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Audience Persona', headerBackTitle: 'Geri' }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroBadge}>👤 AUDIENCE PERSONA BUILDER</Text>
          <Text style={styles.heroTitle}>Hedef kitlenin kim?</Text>
          <Text style={styles.heroSub}>
            Segment, yaş, hedef ve ton seç — nişine özel persona oluşsun.
          </Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{PERSONA_SEGMENT_LIST.length}</Text>
              <Text style={styles.heroStatLabel}>segment</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{PERSONA_TONE_LIST.length}</Text>
              <Text style={styles.heroStatLabel}>ton</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{list.length}</Text>
              <Text style={styles.heroStatLabel}>kayıtlı</Text>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>İsim (opsiyonel)</Text>
          <TextInput
            style={styles.formInput}
            value={name}
            onChangeText={setName}
            placeholder="ör. Sıkı Fitness Annesi"
            placeholderTextColor="#64748B"
            maxLength={32}
          />

          <Text style={styles.formLabel}>Yaş grubu</Text>
          <View style={styles.chipRow}>
            {PERSONA_AGE_LIST.map(a => (
              <Pressable
                key={a.id}
                style={({ pressed }) => [
                  styles.ageChip,
                  age === a.id && styles.ageChipActive,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setAge(a.id)}
              >
                <Text style={[styles.ageChipText, age === a.id && styles.ageChipTextActive]}>{a.label}</Text>
                <Text style={[styles.ageChipRange, age === a.id && styles.ageChipTextActive]}>{a.range}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.formLabel}>Segment</Text>
          <View style={styles.segmentGrid}>
            {PERSONA_SEGMENT_LIST.map(s => (
              <Pressable
                key={s.id}
                style={({ pressed }) => [
                  styles.segmentCard,
                  segment === s.id && { borderColor: s.color, backgroundColor: s.color + '22' },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setSegment(s.id)}
              >
                <Text style={styles.segmentEmoji}>{s.emoji}</Text>
                <Text style={[styles.segmentLabel, segment === s.id && { color: s.color }]}>{s.label}</Text>
                <Text style={styles.segmentHint}>{s.hint}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.formLabel}>Hedefler (çoklu seçim)</Text>
          <View style={styles.chipRow}>
            {PERSONA_GOAL_LIST.map(g => {
              const active = goals.includes(g.id);
              return (
                <Pressable
                  key={g.id}
                  style={({ pressed }) => [
                    styles.goalChip,
                    active && styles.goalChipActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => toggleGoal(g.id)}
                >
                  <Text style={styles.goalEmoji}>{g.emoji}</Text>
                  <Text style={[styles.goalText, active && styles.goalTextActive]}>{g.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.formLabel}>Ton</Text>
          <View style={styles.toneGrid}>
            {PERSONA_TONE_LIST.map(t => (
              <Pressable
                key={t.id}
                style={({ pressed }) => [
                  styles.toneCard,
                  tone === t.id && styles.toneCardActive,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => setTone(t.id)}
              >
                <Text style={styles.toneEmoji}>{t.emoji}</Text>
                <Text style={[styles.toneLabel, tone === t.id && styles.toneLabelActive]}>{t.label}</Text>
                <Text style={[styles.toneHint, tone === t.id && styles.toneHintActive]}>{t.example}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [styles.generateBtn, pressed && { opacity: 0.7 }]}
            onPress={handleGenerate}
          >
            <Text style={styles.generateBtnText}>✨ Persona Oluştur</Text>
          </Pressable>
        </View>

        {generated && (
          <View style={styles.previewWrap}>
            <Text style={styles.previewLabel}>🎯 ÖNİZLEME</Text>
            <PersonaCard p={generated} onDelete={() => setGenerated(null)} onCopy={() => copyBrief(generated)} />
            <Pressable
              style={({ pressed }) => [styles.saveBtn, saving && { opacity: 0.6 }, pressed && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#0F172A" />
              ) : (
                <Text style={styles.saveBtnText}>💾 Personayı Kaydet</Text>
              )}
            </Pressable>
          </View>
        )}

        {list.length > 0 && (
          <View style={styles.savedWrap}>
            <View style={styles.savedHeader}>
              <Text style={styles.savedLabel}>📚 KAYITLI PERSONA</Text>
              <Pressable onPress={handleClearAll}>
                <Text style={styles.savedClear}>Hepsini sil</Text>
              </Pressable>
            </View>
            {list.map(p => (
              <PersonaCard
                key={p.id}
                p={p}
                onDelete={() => handleRemove(p.id)}
                onCopy={() => copyBrief(p)}
              />
            ))}
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
    borderColor: '#EC4899',
    gap: 8,
  },
  heroBadge: { color: '#EC4899', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heroTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  heroSub: { color: '#94A3B8', fontSize: 13, lineHeight: 18 },
  heroStatsRow: { flexDirection: 'row', marginTop: 12, gap: 12 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  heroStatLabel: { color: '#94A3B8', fontSize: 11, marginTop: 2 },

  formCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 10,
  },
  formLabel: { color: '#F8FAFC', fontSize: 14, fontWeight: '600', marginTop: 6 },
  formInput: {
    backgroundColor: '#020617',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ageChip: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 70,
  },
  ageChipActive: { backgroundColor: '#EC4899', borderColor: '#EC4899' },
  ageChipText: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  ageChipRange: { color: '#94A3B8', fontSize: 10, marginTop: 2 },
  ageChipTextActive: { color: '#0F172A' },

  segmentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segmentCard: {
    width: '48%',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  segmentEmoji: { fontSize: 22 },
  segmentLabel: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  segmentHint: { color: '#64748B', fontSize: 11, lineHeight: 14 },

  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  goalChipActive: { backgroundColor: '#EC4899', borderColor: '#EC4899' },
  goalEmoji: { fontSize: 14 },
  goalText: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  goalTextActive: { color: '#0F172A' },

  toneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toneCard: {
    width: '48%',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  toneCardActive: { backgroundColor: '#EC4899', borderColor: '#EC4899' },
  toneEmoji: { fontSize: 22 },
  toneLabel: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  toneLabelActive: { color: '#0F172A' },
  toneHint: { color: '#64748B', fontSize: 11 },
  toneHintActive: { color: '#0F172A' },

  generateBtn: {
    backgroundColor: '#EC4899',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  generateBtnText: { color: '#0F172A', fontSize: 15, fontWeight: '700' },

  previewWrap: { gap: 12 },
  previewLabel: { color: '#EC4899', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginLeft: 4 },

  personaCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EC4899',
    gap: 12,
  },
  personaHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personaAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personaAvatarText: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  personaHeaderRight: { flex: 1, gap: 2 },
  personaName: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  personaMeta: { color: '#94A3B8', fontSize: 11 },
  personaBioBox: {
    backgroundColor: '#020617',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  personaBioText: { color: '#CBD5E1', fontSize: 13, lineHeight: 18 },
  personaGoalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  personaGoalChip: {
    backgroundColor: '#EC489933',
    borderColor: '#EC4899',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  personaGoalText: { color: '#EC4899', fontSize: 11, fontWeight: '600' },

  personaSection: { gap: 4 },
  personaSectionLabel: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  personaBullet: { color: '#CBD5E1', fontSize: 12, lineHeight: 16 },
  personaChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  personaVocChip: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  personaVocText: { color: '#0EA5E9', fontSize: 11, fontWeight: '600' },
  personaAvoidChip: {
    backgroundColor: '#EF444433',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  personaAvoidText: { color: '#EF4444', fontSize: 11, fontWeight: '600' },

  personaHookBox: {
    backgroundColor: '#020617',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EC4899',
    borderStyle: 'dashed',
  },
  personaCtaBox: {
    backgroundColor: '#020617',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#10B981',
    borderStyle: 'dashed',
  },
  personaHookLabel: { color: '#F8FAFC', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  personaHookText: { color: '#CBD5E1', fontSize: 12, lineHeight: 16, fontStyle: 'italic' },

  personaFormatChip: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  personaFormatText: { color: '#F8FAFC', fontSize: 11, fontWeight: '600' },

  personaActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  personaCopyBtn: {
    flex: 1,
    backgroundColor: '#EC4899',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  personaCopyBtnText: { color: '#0F172A', fontSize: 13, fontWeight: '700' },
  personaDeleteBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personaDeleteBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '700' },

  saveBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#0F172A', fontSize: 15, fontWeight: '700' },

  savedWrap: { gap: 12 },
  savedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  savedLabel: { color: '#EC4899', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  savedClear: { color: '#EF4444', fontSize: 12, fontWeight: '600' },

  toast: {
    position: 'absolute',
    bottom: 32,
    alignSelf: 'center',
    backgroundColor: '#0F172A',
    borderColor: '#EC4899',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toastText: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
});
