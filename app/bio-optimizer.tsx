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
  BIO_PLATFORMS,
  BIO_TONES,
  BioEntry,
  BioPlatform,
  BioTone,
  buildBio,
  clearBios,
  getBioList,
  getStoredNiche,
  removeBio,
  saveBio,
  addCopyToHistory,
} from '../services/storage';
import nichesData from '../data/niches.json';

const nicheMap = nichesData as { id: string; icon: string; color: string }[];

const fmtDate = (ts: number): string => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function BioOptimizerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<BioEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [niche, setNiche] = useState('tech');
  const [audience, setAudience] = useState('');
  const [platform, setPlatform] = useState<BioPlatform>('instagram');
  const [tone, setTone] = useState<BioTone>('casual');
  const [preview, setPreview] = useState<ReturnType<typeof buildBio> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const stored = await getStoredNiche();
    if (stored && !niche) setNiche(stored);
    const l = await getBioList();
    setList(l);
  }, [niche]);

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

  const platformMeta = useMemo(
    () => BIO_PLATFORMS.find(p => p.id === platform) ?? BIO_PLATFORMS[0],
    [platform]
  );
  const toneMeta = useMemo(
    () => BIO_TONES.find(t => t.id === tone) ?? BIO_TONES[0],
    [tone]
  );

  const handleGenerate = () => {
    setGenerating(true);
    const built = buildBio({ niche, audience, platform, tone });
    setPreview(built);
    setGenerating(false);
  };

  const handleReroll = () => {
    const built = buildBio({ niche, audience, platform, tone, seed: Date.now() });
    setPreview(built);
  };

  const handleSave = async () => {
    if (!preview) return;
    const next = await saveBio({
      niche,
      audience,
      platform,
      tone,
      bio: preview.bio,
      highlights: preview.highlights,
      cta: preview.cta,
    });
    setList(next);
    await addCopyToHistory(`[bio] ${niche}/${platform}/${tone}`);
    setToast('Bio kaydedildi ✓');
  };

  const handleDelete = (id: string) => {
    Alert.alert('Bio silinsin mi?', 'Bu kayıt listeden çıkar.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeBio(id);
          setList(next);
          if (openId === id) setOpenId(null);
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (list.length === 0) return;
    Alert.alert('Tüm biyografiler silinsin mi?', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Hepsini sil',
        style: 'destructive',
        onPress: async () => {
          await clearBios();
          setList([]);
          setOpenId(null);
          setToast('Liste temizlendi');
        },
      },
    ]);
  };

  const copy = (label: string, text: string) => {
    Clipboard.setString(text);
    addCopyToHistory(`[bio-copy] ${label}`);
    setToast(`${label} kopyalandı ✓`);
  };

  const renderCard = (b: BioEntry) => {
    const pMeta = BIO_PLATFORMS.find(p => p.id === b.platform);
    const tMeta = BIO_TONES.find(t => t.id === b.tone);
    const isOpen = openId === b.id;
    return (
      <Pressable
        key={b.id}
        style={[styles.card, isOpen && { borderColor: tMeta?.color }]}
        onPress={() => setOpenId(isOpen ? null : b.id)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>
              {pMeta?.emoji} {pMeta?.label} · {tMeta?.emoji} {tMeta?.label}
            </Text>
            <Text style={styles.cardSub}>
              {b.niche} · {fmtDate(b.createdAt)}
            </Text>
          </View>
          <View style={[styles.charPill, b.bio.length > pMeta!.cap && styles.charPillOver]}>
            <Text style={styles.charPillText}>{b.bio.length}/{pMeta?.cap}</Text>
          </View>
        </View>
        <Text style={styles.cardBio} numberOfLines={isOpen ? undefined : 3}>
          {b.bio}
        </Text>
        {isOpen ? (
          <View style={styles.detail}>
            <Text style={styles.detailLabel}>📌 Highlight isimleri</Text>
            <View style={styles.highlightRow}>
              {b.highlights.map((h, i) => (
                <View key={i} style={styles.highlightPill}>
                  <Text style={styles.highlightText}>{h}</Text>
                </View>
              ))}
            </View>
            <View style={styles.actionRow}>
              <Pressable style={[styles.smallBtn, styles.smallBtnPrimary]} onPress={() => copy('Bio', b.bio)}>
                <Text style={styles.smallBtnText}>📋 Bio kopyala</Text>
              </Pressable>
              <Pressable style={[styles.smallBtn, styles.smallBtnPrimary]} onPress={() => copy('Highlight', b.highlights.join(' | '))}>
                <Text style={styles.smallBtnText}>📋 Highlights</Text>
              </Pressable>
            </View>
            <Pressable style={styles.deleteBtn} onPress={() => handleDelete(b.id)}>
              <Text style={styles.deleteBtnText}>🗑️ Sil</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Bio Optimizer', headerShown: true }} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>👤 Bio Optimizer</Text>
          <Text style={styles.heroSub}>
            Niche + hedef kitle + ton'a göre profil bio'su + Highlight isimleri + CTA üret. Her
            platform için karakter sınırına göre budanır.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yeni Bio</Text>

          <Text style={styles.label}>Niche</Text>
          <View style={styles.chipRow}>
            {nicheMap.map(n => {
              const active = niche === n.id;
              return (
                <Pressable
                  key={n.id}
                  style={[
                    styles.chip,
                    active && { backgroundColor: n.color, borderColor: n.color },
                  ]}
                  onPress={() => setNiche(n.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {n.icon} {n.id}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Hedef kitle</Text>
          <TextInput
            style={styles.input}
            value={audience}
            onChangeText={setAudience}
            placeholder="örn: 25-34 yaş, Türkiye"
            placeholderTextColor="#94a3b8"
          />

          <Text style={styles.label}>Platform</Text>
          <View style={styles.chipRow}>
            {BIO_PLATFORMS.map(p => {
              const active = platform === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setPlatform(p.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {p.emoji} {p.label} · {p.cap}kr
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Ton</Text>
          <View style={styles.chipRow}>
            {BIO_TONES.map(t => {
              const active = tone === t.id;
              return (
                <Pressable
                  key={t.id}
                  style={[
                    styles.chip,
                    active && { backgroundColor: t.color, borderColor: t.color },
                  ]}
                  onPress={() => setTone(t.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t.emoji} {t.label}
                  </Text>
                </Pressable>
              );
            })}
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
                <Text style={styles.ctaText}>✨ Bio üret</Text>
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
              <View style={[styles.charPill, preview.bio.length > platformMeta.cap && styles.charPillOver]}>
                <Text style={styles.charPillText}>
                  {preview.bio.length}/{platformMeta.cap}
                </Text>
              </View>
            </View>

            <View style={[styles.tipBox, { borderLeftColor: toneMeta.color }]}>
              <Text style={styles.tipTitle}>
                {toneMeta.emoji} {toneMeta.label} · {platformMeta.emoji} {platformMeta.label}
              </Text>
              <Text style={styles.tipText}>
                {platform === 'linkedin' && 'LinkedIn için profesyonel headline + 1 satır CTA.'}
                {platform === 'twitter' && 'Twitter 160 karakter sınırı — kısa ve net.'}
                {platform === 'instagram' && 'IG için emoji + satır sonu ile ritim önemli.'}
                {platform === 'tiktok' && 'TikTok bio\'da direkt hook + link yönlendirmesi.'}
                {platform === 'youtube' && 'YouTube için uzun açıklama desteklenir.'}
                {platform === 'blog' && 'Blog için newsletter/abone CTA ekleyebilirsin.'}
              </Text>
            </View>

            <View style={styles.bioBox}>
              <Text style={styles.bioText}>{preview.bio}</Text>
            </View>

            <Pressable style={[styles.copyBtn, styles.copyBtnPrimary]} onPress={() => copy('Bio', preview.bio)}>
              <Text style={styles.copyBtnText}>📋 Bio kopyala</Text>
            </Pressable>

            <Text style={styles.subLabel}>📌 Highlight isimleri</Text>
            <View style={styles.highlightRow}>
              {preview.highlights.map((h, i) => (
                <Pressable key={i} style={styles.highlightPill} onPress={() => copy('Highlight', h)}>
                  <Text style={styles.highlightText}>{h}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.copyBtn, styles.copyBtnSecondary]} onPress={() => copy('Highlights', preview.highlights.join(' | '))}>
              <Text style={styles.copyBtnText}>📋 Highlight listesini kopyala</Text>
            </Pressable>

            <Pressable style={[styles.cta, styles.ctaSave]} onPress={handleSave}>
              <Text style={styles.ctaText}>💾 Kaydet</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Kayıtlı Biyografiler ({list.length})</Text>
            {list.length > 0 ? (
              <Pressable onPress={handleClearAll} hitSlop={10}>
                <Text style={styles.clearText}>Hepsini sil</Text>
              </Pressable>
            ) : null}
          </View>

          {list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>👤</Text>
              <Text style={styles.emptyText}>
                Henüz kayıtlı bio yok. Yukarıdan bir tane üret, buraya gelsin.
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
  subLabel: { color: '#a5b4fc', fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 8 },
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
  ctaRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cta: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaPrimary: { backgroundColor: '#6366f1' },
  ctaReroll: { backgroundColor: '#475569' },
  ctaSave: { backgroundColor: '#10B981', marginTop: 12 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  charPill: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  charPillOver: { borderColor: '#EF4444' },
  charPillText: { color: '#a5b4fc', fontSize: 11, fontWeight: '700' },

  tipBox: {
    marginTop: 10,
    backgroundColor: '#0f172a',
    borderLeftWidth: 3,
    padding: 10,
    borderRadius: 8,
  },
  tipTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  tipText: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },

  bioBox: {
    marginTop: 12,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  bioText: { color: '#f8fafc', fontSize: 14, lineHeight: 20 },

  copyBtn: { marginTop: 10, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  copyBtnPrimary: { backgroundColor: '#6366f1' },
  copyBtnSecondary: { backgroundColor: '#475569' },
  copyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  highlightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  highlightPill: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  highlightText: { color: '#a5b4fc', fontSize: 12, fontWeight: '600' },

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
  cardTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700' },
  cardSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  cardBio: { color: '#e2e8f0', fontSize: 13, marginTop: 8, lineHeight: 18 },

  detail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  detailLabel: { color: '#a5b4fc', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  smallBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  smallBtnPrimary: { backgroundColor: '#6366f1' },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  deleteBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  deleteBtnText: { color: '#f87171', fontSize: 11, fontWeight: '700' },

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