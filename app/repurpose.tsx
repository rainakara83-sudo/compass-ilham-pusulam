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
  PLATFORMS,
  REPURPOSE_FORMATS,
  PlatformId,
  RepurposeFormat,
  RepurposeOutput,
  SavedRepurposePack,
  buildRepurposePack,
  saveRepurposePack,
  getRepurposePacks,
  removeRepurposePack,
  clearRepurposePacks,
  getStoredNiche,
  addCopyToHistory,
} from '../services/storage';
import { NicheId } from '../services/contentService';

const FORMAT_LABEL: Record<RepurposeFormat, { label: string; emoji: string; hint: string; color: string; bg: string }> = {
  tip: { label: 'Hızlı İpucu', emoji: '💡', hint: 'Tek cümle pratik tavsiye', color: '#F59E0B', bg: '#FEF3C7' },
  story: { label: 'Hikaye', emoji: '📖', hint: 'Kişisel deneyim', color: '#10B981', bg: '#D1FAE5' },
  listicle: { label: 'Liste', emoji: '📋', hint: '5-7 maddelik liste', color: '#8B5CF6', bg: '#F3E8FF' },
  tutorial: { label: 'Nasıl Yapılır', emoji: '🛠️', hint: 'Adım adım eğitim', color: '#0EA5E9', bg: '#E0F2FE' },
  opinion: { label: 'Görüş', emoji: '🔥', hint: 'Cesur iddia + argüman', color: '#EF4444', bg: '#FEE2E2' },
  question: { label: 'Soru', emoji: '❓', hint: 'Topluluğu dahil et', color: '#0EA5E9', bg: '#E0F2FE' },
  myth: { label: 'Efsane', emoji: '🚫', hint: 'Yanlış bilgiyi çürüt', color: '#EC4899', bg: '#FCE7F3' },
  quote: { label: 'Alıntı', emoji: '💬', hint: 'İlham verici kısa not', color: '#10B981', bg: '#D1FAE5' },
  news: { label: 'Haber', emoji: '📰', hint: 'Sektörden güncel', color: '#6366F1', bg: '#E0E7FF' },
  challenge: { label: 'Meydan Okuma', emoji: '🎯', hint: 'Aksiyona çağır', color: '#F59E0B', bg: '#FEF3C7' },
};

export default function RepurposeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [format, setFormat] = useState<RepurposeFormat>('tip');
  const [topic, setTopic] = useState('');
  const [angle, setAngle] = useState('');
  const [pack, setPack] = useState<RepurposeOutput | null>(null);
  const [activePlatform, setActivePlatform] = useState<PlatformId>('instagram');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [savedPacks, setSavedPacks] = useState<SavedRepurposePack[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const n = await getStoredNiche();
      setNiche(n);
      const list = await getRepurposePacks();
      setSavedPacks(list);
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const list = await getRepurposePacks();
        setSavedPacks(list);
      })();
    }, [])
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const generate = useCallback(async () => {
    if (!topic.trim()) {
      Alert.alert('Konu gerekli', 'Lütfen bir konu veya ana fikir yaz.');
      return;
    }
    setLoading(true);
    setPack(null);
    await new Promise((r) => setTimeout(r, 240));
    const result = buildRepurposePack(niche, format, topic, angle);
    setPack(result);
    setActivePlatform('instagram');
    setLoading(false);
    setToast('✨ Repurpose paketi hazır');
  }, [niche, format, topic, angle]);

  const copyText = useCallback(
    async (text: string, key: string) => {
      try {
        Clipboard.setString(text);
        setCopied(key);
        await addCopyToHistory(text, 'detail');
        setToast('📋 Panoya kopyalandı');
        setTimeout(() => setCopied(null), 1400);
      } catch {
        setToast('Kopyalama başarısız');
      }
    },
    []
  );

  const saveCurrent = useCallback(async () => {
    if (!pack) return;
    const next = await saveRepurposePack(pack, angle);
    setSavedPacks(next);
    setToast('💾 Paket kaydedildi');
  }, [pack, angle]);

  const removeSaved = useCallback(async (id: string) => {
    const next = await removeRepurposePack(id);
    setSavedPacks(next);
    setToast('🗑️ Paket silindi');
  }, []);

  const clearSaved = useCallback(() => {
    if (savedPacks.length === 0) return;
    Alert.alert(
      'Tüm paketleri sil',
      `${savedPacks.length} kayıtlı paket silinecek. Emin misin?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await clearRepurposePacks();
            setSavedPacks([]);
            setToast('🧹 Tüm paketler silindi');
          },
        },
      ]
    );
  }, [savedPacks]);

  const activePlatformData = PLATFORMS.find((p) => p.id === activePlatform)!;
  const activeAdaptation = pack?.adaptations[activePlatform];
  const fmtInfo = FORMAT_LABEL[format];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Repurpose Engine', headerBackTitle: 'Geri' }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroBadge}>♻️ REPURPOSE ENGINE</Text>
          <Text style={styles.heroTitle}>Bir içeriği 8 platforma taşı</Text>
          <Text style={styles.heroSub}>
            Konuyu ve açıyı yaz, her platforma özel caption, hashtag ve format önerisi üretelim.
          </Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{PLATFORMS.length}</Text>
              <Text style={styles.heroStatLabel}>platform</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{REPURPOSE_FORMATS.length}</Text>
              <Text style={styles.heroStatLabel}>format</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{savedPacks.length}</Text>
              <Text style={styles.heroStatLabel}>kayıtlı</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>1. Format seç</Text>
        <View style={styles.formatGrid}>
          {REPURPOSE_FORMATS.map((f) => {
            const info = FORMAT_LABEL[f.id];
            const isActive = format === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFormat(f.id)}
                style={[
                  styles.formatChip,
                  isActive && { backgroundColor: info.bg, borderColor: info.color },
                ]}
              >
                <Text style={styles.formatEmoji}>{f.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.formatLabel,
                      isActive && { color: info.color, fontWeight: '800' },
                    ]}
                  >
                    {f.label}
                  </Text>
                  <Text style={styles.formatHint} numberOfLines={1}>
                    {f.hint}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>2. Konu & Açı</Text>
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Ana konu</Text>
          <TextInput
            value={topic}
            onChangeText={setTopic}
            placeholder="Örn: Sabah 5 dakikalık rutin"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            multiline
            maxLength={120}
          />
          <Text style={styles.inputLabel}>Açı / yaklaşım (opsiyonel)</Text>
          <TextInput
            value={angle}
            onChangeText={setAngle}
            placeholder="Örn: karşıt görüş, kişisel deneyim"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            maxLength={80}
          />
          <Pressable
            onPress={generate}
            disabled={loading}
            style={[styles.generateButton, { backgroundColor: fmtInfo.color }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.generateButtonText}>
                {fmtInfo.emoji} 8 platforma dönüştür
              </Text>
            )}
          </Pressable>
        </View>

        {pack && activeAdaptation && (
          <>
            <Text style={styles.sectionTitle}>3. Platform çıktısı</Text>

            <View style={styles.platformRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {PLATFORMS.map((p) => {
                  const isActive = activePlatform === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setActivePlatform(p.id)}
                      style={[
                        styles.platformChip,
                        isActive && { backgroundColor: p.color, borderColor: p.color },
                      ]}
                    >
                      <Text style={styles.platformEmoji}>{p.emoji}</Text>
                      <Text
                        style={[
                          styles.platformLabel,
                          isActive && { color: '#fff', fontWeight: '800' },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View
              style={[
                styles.platformCard,
                { borderColor: activePlatformData.color, backgroundColor: activePlatformData.bg },
              ]}
            >
              <View style={styles.platformCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.platformCardEmoji}>{activePlatformData.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.platformCardTitle, { color: activePlatformData.color }]}>
                      {activePlatformData.label}
                    </Text>
                    <Text style={styles.platformCardSub}>{activePlatformData.tagline}</Text>
                  </View>
                </View>
                <View style={styles.platformMetaPill}>
                  <Text style={styles.platformMetaText}>{activePlatformData.bestFormat}</Text>
                </View>
              </View>

              <View style={styles.platformInfoRow}>
                <View style={styles.platformInfoItem}>
                  <Text style={styles.platformInfoLabel}>Karakter</Text>
                  <Text style={styles.platformInfoValue}>{activePlatformData.charLimit.toLocaleString('tr-TR')}</Text>
                </View>
                <View style={styles.platformInfoItem}>
                  <Text style={styles.platformInfoLabel}>Caption uzunluğu</Text>
                  <Text style={styles.platformInfoValue}>{activeAdaptation.caption.length}</Text>
                </View>
                <View style={styles.platformInfoItem}>
                  <Text style={styles.platformInfoLabel}>Hashtag</Text>
                  <Text style={styles.platformInfoValue}>{activeAdaptation.hashtags.length}</Text>
                </View>
              </View>

              <Text style={styles.cardFieldLabel}>🎯 Hook</Text>
              <View style={styles.fieldBox}>
                <Text style={styles.fieldBoxText}>{activeAdaptation.hook}</Text>
                <Pressable
                  onPress={() => copyText(activeAdaptation.hook, 'hook')}
                  style={styles.copyMiniBtn}
                >
                  <Text style={styles.copyMiniText}>
                    {copied === 'hook' ? '✓' : '📋'}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.cardFieldLabel}>📝 Caption</Text>
              <View style={styles.fieldBox}>
                <Text style={styles.fieldBoxText}>{activeAdaptation.caption}</Text>
                <Pressable
                  onPress={() => copyText(activeAdaptation.caption, 'caption')}
                  style={styles.copyMiniBtn}
                >
                  <Text style={styles.copyMiniText}>
                    {copied === 'caption' ? '✓' : '📋'}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.cardFieldLabel}>#️⃣ Hashtag'ler</Text>
              <View style={styles.fieldBox}>
                <Text style={styles.fieldBoxText}>
                  {activeAdaptation.hashtags.join(' ')}
                </Text>
                <Pressable
                  onPress={() => copyText(activeAdaptation.hashtags.join(' '), 'tags')}
                  style={styles.copyMiniBtn}
                >
                  <Text style={styles.copyMiniText}>
                    {copied === 'tags' ? '✓' : '📋'}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.cardFieldLabel}>📣 CTA</Text>
              <View style={styles.fieldBox}>
                <Text style={styles.fieldBoxText}>{activeAdaptation.cta}</Text>
              </View>

              <Text style={styles.cardFieldLabel}>💡 Format İpucu</Text>
              <View style={[styles.fieldBox, { backgroundColor: '#fff' }]}>
                <Text style={[styles.fieldBoxText, { color: '#334155' }]}>
                  {activeAdaptation.formatTip}
                </Text>
              </View>

              <View style={styles.platformActions}>
                <Pressable
                  onPress={() =>
                    copyText(
                      `${activeAdaptation.hook}\n\n${activeAdaptation.caption}\n\n${activeAdaptation.hashtags.join(' ')}\n\n${activeAdaptation.cta}`,
                      'all'
                    )
                  }
                  style={[styles.platformActionBtn, { backgroundColor: activePlatformData.color }]}
                >
                  <Text style={styles.platformActionText}>
                    {copied === 'all' ? '✓ Kopyalandı' : '📋 Tümünü kopyala'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Pressable onPress={saveCurrent} style={styles.savePackBtn}>
              <Text style={styles.savePackText}>💾 Bu paketi kaydet</Text>
            </Pressable>
          </>
        )}

        {savedPacks.length > 0 && (
          <>
            <View style={styles.savedHeader}>
              <Text style={styles.sectionTitle}>Kayıtlı paketler</Text>
              <Pressable onPress={clearSaved}>
                <Text style={styles.clearAllText}>Tümünü sil</Text>
              </Pressable>
            </View>

            {savedPacks.map((p) => {
              const info = FORMAT_LABEL[p.format];
              return (
                <View key={p.id} style={styles.savedCard}>
                  <View style={styles.savedHeaderRow}>
                    <View
                      style={[
                        styles.savedFormatPill,
                        { backgroundColor: info.bg, borderColor: info.color },
                      ]}
                    >
                      <Text style={[styles.savedFormatText, { color: info.color }]}>
                        {info.emoji} {info.label}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeSaved(p.id)} style={styles.savedDelete}>
                      <Text style={styles.savedDeleteText}>✕</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.savedTopic} numberOfLines={2}>
                    {p.topic}
                  </Text>
                  {p.angle ? (
                    <Text style={styles.savedAngle}>Açı: {p.angle}</Text>
                  ) : null}
                  <View style={styles.savedPlatformRow}>
                    {PLATFORMS.map((pl) => (
                      <View
                        key={pl.id}
                        style={[
                          styles.savedPlatformChip,
                          { backgroundColor: pl.bg, borderColor: pl.color },
                        ]}
                      >
                        <Text style={{ fontSize: 14 }}>{pl.emoji}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {savedPacks.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>♻️</Text>
            <Text style={styles.emptyTitle}>Henüz kayıtlı paket yok</Text>
            <Text style={styles.emptySub}>
              Bir içerik üretip kaydet, sonra hızlıca farklı platformlara taşı.
            </Text>
          </View>
        )}
      </ScrollView>

      {toast && (
        <View style={[styles.toast, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 16, paddingTop: 8 },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  heroBadge: { color: '#10B981', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  heroSub: { color: '#94A3B8', fontSize: 12, fontWeight: '500', lineHeight: 18, marginBottom: 14 },
  heroStatsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  heroStat: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  heroStatValue: { color: '#10B981', fontSize: 18, fontWeight: '800', marginBottom: 2 },
  heroStatLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 8, marginBottom: 10 },
  formatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  formatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexBasis: '48%',
    flexGrow: 1,
    gap: 8,
  },
  formatEmoji: { fontSize: 18 },
  formatLabel: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  formatHint: { fontSize: 10, color: '#64748B', marginTop: 1 },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    minHeight: 44,
  },
  generateButton: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  generateButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  platformRow: { marginBottom: 10 },
  platformChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  platformEmoji: { fontSize: 16 },
  platformLabel: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  platformCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
  },
  platformCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  platformCardEmoji: { fontSize: 32, marginRight: 10 },
  platformCardTitle: { fontSize: 18, fontWeight: '800' },
  platformCardSub: { fontSize: 11, color: '#475569', marginTop: 2 },
  platformMetaPill: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  platformMetaText: { fontSize: 10, fontWeight: '700', color: '#0F172A' },
  platformInfoRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  platformInfoItem: { flex: 1, alignItems: 'center' },
  platformInfoLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', marginBottom: 2 },
  platformInfoValue: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  cardFieldLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 8, marginBottom: 4 },
  fieldBox: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  fieldBoxText: { flex: 1, fontSize: 13, color: '#0F172A', lineHeight: 19 },
  copyMiniBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyMiniText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  platformActions: { marginTop: 12 },
  platformActionBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  platformActionText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  savePackBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  savePackText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  savedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  clearAllText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  savedCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  savedHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  savedFormatPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  savedFormatText: { fontSize: 11, fontWeight: '800' },
  savedDelete: {
    backgroundColor: '#FEE2E2',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedDeleteText: { color: '#EF4444', fontSize: 14, fontWeight: '800' },
  savedTopic: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  savedAngle: { fontSize: 11, color: '#64748B', fontStyle: 'italic', marginBottom: 8 },
  savedPlatformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  savedPlatformChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 24,
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#64748B', textAlign: 'center' },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#0F172A',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});