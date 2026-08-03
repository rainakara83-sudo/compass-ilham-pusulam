import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Clipboard, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { addCopyToHistory, addIdeaTag, getAllUniqueTags, getCollections, getIdeaCollections, getIdeaTags, isFavorite, addIdeaToCollection, removeIdeaFromCollection, removeIdeaTag, toggleFavorite } from '../../services/storage';
import { generateIdeaVariants, askAI } from '../../services/aiService';
import { NicheId, searchNichePool } from '../../services/contentService';
import niches from '../../data/niches.json';

const ICONS = (niches as { id: string; icon: string }[]).reduce((acc, n) => {
  acc[n.id] = n.icon;
  return acc;
}, {} as Record<string, string>);

type HelperKind = 'caption' | 'hashtag' | 'altTitle' | 'story' | 'tip';

const HELPERS: { id: HelperKind; icon: string; label: string; prompt: (idea: string) => string }[] = [
  {
    id: 'caption',
    icon: '✍️',
    label: 'Caption yaz',
    prompt: (idea) =>
      `Bu içerik fikri için Instagram/Twitter caption öner: "${idea}". 3 farklı tonla (samimi/merak/profesyonel), her biri 1-2 cümle. Türkçe yaz.`,
  },
  {
    id: 'hashtag',
    icon: '#️⃣',
    label: 'Hashtag öner',
    prompt: (idea) =>
      `Şu fikir için 12-15 adet yüksek etkileşimli Türkçe hashtag öner: "${idea}". Karışık (genel + niş + uzun kuyruk). Yıldız işareti olmadan, sadece boşlukla ayrılmış liste olarak.`,
  },
  {
    id: 'altTitle',
    icon: '✏️',
    label: 'Alternatif başlık',
    prompt: (idea) =>
      `Şu fikri dikkat çekici 5 farklı başlıkla yeniden yaz: "${idea}". Kısa, merak uyandıran, emoji'siz. Her birini yeni satıra yaz.`,
  },
  {
    id: 'story',
    icon: '📱',
    label: 'Story taslağı',
    prompt: (idea) =>
      `Şu içerik fikri için 5 karelik Instagram Story taslağı hazırla: "${idea}". Her kare için: kısa başlık + ne paylaşılacağı + 1-2 saniyelik metin. Türkçe yaz, madde madde.`,
  },
  {
    id: 'tip',
    icon: '💡',
    label: 'Prodüksiyon ipucu',
    prompt: (idea) =>
      `Şu içerik fikrini prodüksiyon olarak nasıl en iyi yakalarım: "${idea}". Çekim/ışık/ses/editing açısından 3-4 pratik ipucu ver. Türkçe, madde madde.`,
  },
];

const FALLBACK_BY_KIND: Record<HelperKind, (idea: string, niche: NicheId | null) => string> = {
  caption: (idea) =>
    `📝 Caption önerisi:\n"${idea}" fikrini paylaşırken izleyiciye doğrudan soru sor — yorum almayı garantiler. #içerik #üretici notunu sona ekle.`,
  hashtag: (idea, niche) => {
    const base = niche ? `#${niche}` : '#icerik';
    return `${base} #icerikuretici #icerikfikir #sosyalmedya #etkilesim #reels #instareels #keşfet #trend #başarı #türkiye #girişimcilik #marka #icerik`.trim();
  },
  altTitle: (idea) =>
    `1. ${idea}\n2. Şimdi tam zamanı: ${idea}\n3. Sen dene: ${idea}\n4. Bilmen gereken: ${idea}\n5. Kimse söylemiyor ama: ${idea}`,
  story: (idea) =>
    `1. kare: "Bugün ne paylaşacağım?" yazısı + merak unsuru\n2. kare: Kısa tanıtım — "${idea}"\n3. kare: Ana mesajın 1 cümlede özeti\n4. kare: İzleyiciye soru (anket kutusu)\n5. kare: CTA — "DM'den yaz" veya "Kaydet"`,
  tip: (idea) =>
    `1. Doğal ışıkta çek, gölge yumuşak olsun.\n2. İlk 3 saniyede dikkat çekici bir kare dene.\n3. Müziği düşük tut, ses netliği öncelikli.\n4. Son karede net CTA olsun: "${idea}"için bir sonraki adım.`,
};

const Action: React.FC<{ icon: string; label: string; onPress: () => void; primary?: boolean }> = ({
  icon,
  label,
  onPress,
  primary,
}) => (
  <Pressable onPress={onPress} style={[styles.action, primary && styles.actionPrimary]}>
    <Text style={[styles.actionIcon, primary && { color: 'white' }]}>{icon}</Text>
    <Text style={[styles.actionLabel, primary && { color: 'white' }]}>{label}</Text>
  </Pressable>
);

export default function IdeaDetailModal() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ text: string; niche?: string; day?: string; source?: string }>();
  const text = typeof params.text === 'string' ? decodeURIComponent(params.text) : '';
  const niche = typeof params.niche === 'string' ? (params.niche as NicheId) : null;
  const day = typeof params.day === 'string' ? params.day : null;
  const source = typeof params.source === 'string' ? params.source : 'pool';

  const [fav, setFav] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeKind, setActiveKind] = useState<HelperKind | null>(null);
  const [helperAnswer, setHelperAnswer] = useState<string>('');
  const [helperLoading, setHelperLoading] = useState(false);
  const [helperError, setHelperError] = useState<string | null>(null);
  const [helperCopied, setHelperCopied] = useState(false);
  const [relatedIdeas, setRelatedIdeas] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [variants, setVariants] = useState<string[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantsFallback, setVariantsFallback] = useState(false);
  const [variantCopiedIdx, setVariantCopiedIdx] = useState<number | null>(null);
  const [allCollections, setAllCollections] = useState<{ id: string; name: string; color: string }[]>([]);
  const [linkedCollections, setLinkedCollections] = useState<string[]>([]);

  const loadTags = useCallback(async () => {
    const [t, all] = await Promise.all([getIdeaTags(text), getAllUniqueTags()]);
    setTags(t);
    setAllTags(all);
  }, [text]);

  const loadCollections = useCallback(async () => {
    const [cols, linked] = await Promise.all([getCollections(), getIdeaCollections(text)]);
    setAllCollections(cols.map((c) => ({ id: c.id, name: c.name, color: c.color })));
    setLinkedCollections(linked.map((c) => c.id));
  }, [text]);

  useEffect(() => {
    isFavorite(text).then(setFav);
  }, [text]);

  useEffect(() => {
    loadTags();
    loadCollections();
  }, [loadTags, loadCollections]);

  useEffect(() => {
    if (niche) {
      const pool = searchNichePool(niche, '');
      const filtered = pool.filter((p) => p !== text).slice(0, 3);
      setRelatedIdeas(filtered);
    } else {
      setRelatedIdeas([]);
    }
  }, [niche, text]);

  const onCopy = () => {
    Clipboard.setString(text);
    setCopied(true);
    addCopyToHistory(text, 'detail').catch(() => {});
    setTimeout(() => setCopied(false), 1500);
  };

  const onShare = async () => {
    setBusy(true);
    try {
      await Share.share({ message: `İçerik fikri: ${text}`, title: 'Content Coach' });
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } finally {
      setBusy(false);
    }
  };

  const onFav = async () => {
    const newVal = await toggleFavorite(text);
    setFav(newVal);
  };

  const onAddTag = async (raw: string) => {
    const clean = raw.trim().replace(/^#/, '');
    if (clean.length === 0) return;
    const next = await addIdeaTag(text, clean);
    setTags(next);
    setAllTags(await getAllUniqueTags());
    setTagDraft('');
  };

  const onRemoveTag = async (tag: string) => {
    const next = await removeIdeaTag(text, tag);
    setTags(next);
    setAllTags(await getAllUniqueTags());
  };

  const onToggleCollection = async (colId: string) => {
    if (linkedCollections.includes(colId)) {
      await removeIdeaFromCollection(colId, text);
      setLinkedCollections((prev) => prev.filter((id) => id !== colId));
    } else {
      await addIdeaToCollection(colId, text);
      setLinkedCollections((prev) => [...prev, colId]);
    }
  };

  const generateVariants = async () => {
    setVariantsLoading(true);
    setVariantsFallback(false);
    setVariants([]);
    const safeNiche: NicheId = (niche ?? 'lifestyle') as NicheId;
    const result = await generateIdeaVariants(safeNiche, text);
    setVariants(result.variants);
    setVariantsFallback(result.usedFallback);
    setVariantsLoading(false);
  };

  const onCopyVariant = (v: string, idx: number) => {
    Clipboard.setString(v);
    setVariantCopiedIdx(idx);
    setTimeout(() => setVariantCopiedIdx(null), 1500);
  };

  const onUseVariant = (v: string) => {
    router.push({ pathname: '/idea/[text]', params: { text: encodeURIComponent(v), niche: niche ?? '', source: 'variant' } });
  };

  const runHelper = async (kind: HelperKind) => {
    setActiveKind(kind);
    setHelperAnswer('');
    setHelperError(null);
    setHelperCopied(false);
    setHelperLoading(true);
    const helper = HELPERS.find((h) => h.id === kind);
    if (!helper) {
      setHelperLoading(false);
      return;
    }
    if (niche) {
      const ai = await askAI({ niche, question: helper.prompt(text) });
      if (ai.answer && !ai.answer.includes('cevap veremiyorum') && !ai.answer.includes('hatası') && !ai.answer.includes('zaman aşımı') && !ai.answer.includes('sık istek')) {
        setHelperAnswer(ai.answer);
        setHelperLoading(false);
        return;
      }
    }
    const fallback = FALLBACK_BY_KIND[kind](text, niche);
    setHelperAnswer(fallback + '\n\n— (AI şu an yanıt vermedi; akıllı öneri kullanıldı)');
    setHelperError('offline');
    setHelperLoading(false);
  };

  const copyHelper = () => {
    if (!helperAnswer) return;
    Clipboard.setString(helperAnswer);
    setHelperCopied(true);
    setTimeout(() => setHelperCopied(false), 1500);
  };

  const openRelated = (idea: string) => {
    router.replace({
      pathname: '/idea/[text]',
      params: {
        text: encodeURIComponent(idea),
        niche: niche ?? '',
        day: day ?? '',
        source,
      },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ presentation: 'modal', title: '', headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.topTitle}>İçerik Detayı</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {niche && (
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>{ICONS[niche] ?? '✨'}</Text>
            <Text style={styles.metaText}>
              {t(`niches.${niche}`, niche)} {day ? ` • ${day.toUpperCase()}` : ''} {source === 'ai' ? ' • ✨ AI' : ''}
            </Text>
          </View>
        )}

        <Text style={styles.bigText}>{text}</Text>

        <View style={styles.tagsBox}>
          <View style={styles.tagsHeaderRow}>
            <Text style={styles.tagsTitle}>🏷 Etiketler</Text>
            <Pressable onPress={() => setShowTagInput((s) => !s)} style={styles.tagsAddBtn}>
              <Text style={styles.tagsAddBtnTxt}>{showTagInput ? 'Vazgeç' : '+ Ekle'}</Text>
            </Pressable>
          </View>

          <View style={styles.tagsChipRow}>
            {tags.length === 0 ? (
              <Text style={styles.tagsEmpty}>Henüz etiket yok. Fikri organize etmek için ekle.</Text>
            ) : (
              tags.map((t) => (
                <Pressable key={t} onPress={() => onRemoveTag(t)} style={styles.tagChip}>
                  <Text style={styles.tagChipTxt}>#{t} ✕</Text>
                </Pressable>
              ))
            )}
          </View>

          {showTagInput && (
            <View style={styles.tagInputRow}>
              <TextInput
                value={tagDraft}
                onChangeText={setTagDraft}
                placeholder="örn: reels, tutorial, vlog"
                placeholderTextColor="#9CA3AF"
                style={styles.tagInput}
                autoFocus
                onSubmitEditing={() => onAddTag(tagDraft)}
                returnKeyType="done"
              />
              <Pressable
                onPress={() => onAddTag(tagDraft)}
                style={styles.tagInputSave}
              >
                <Text style={styles.tagInputSaveTxt}>Kaydet</Text>
              </Pressable>
            </View>
          )}

          {showTagInput && allTags.filter((t) => !tags.includes(t)).length > 0 && (
            <View style={styles.tagsSuggestRow}>
              <Text style={styles.tagsSuggestLabel}>Önerilen:</Text>
              {allTags
                .filter((t) => !tags.includes(t))
                .slice(0, 6)
                .map((t) => (
                  <Pressable key={`s-${t}`} onPress={() => onAddTag(t)} style={styles.tagSuggestChip}>
                    <Text style={styles.tagSuggestChipTxt}>#{t}</Text>
                  </Pressable>
                ))}
            </View>
          )}
        </View>

        <View style={styles.variantsBox}>
          <View style={styles.variantsHeader}>
            <Text style={styles.variantsTitle}>🎭 Alternatifler</Text>
            <Pressable onPress={generateVariants} disabled={variantsLoading} style={styles.variantsGenBtn}>
              <Text style={styles.variantsGenBtnTxt}>
                {variantsLoading ? '⏳ Üretiliyor…' : variants.length > 0 ? '↻ Yenile' : '✨ Üret'}
              </Text>
            </Pressable>
          </View>

          {variantsLoading && (
            <View style={styles.variantsLoading}>
              <ActivityIndicator color="#8B5CF6" />
              <Text style={styles.variantsLoadingTxt}>AI varyasyonlar hazırlıyor…</Text>
            </View>
          )}

          {!variantsLoading && variantsFallback && variants.length > 0 && (
            <Text style={styles.variantsHint}>📴 AI çevrimdışı — benzer fikirlerden önerildi</Text>
          )}

          {!variantsLoading && variants.length > 0 && (
            <View style={{ marginTop: 8 }}>
              {variants.map((v, idx) => (
                <View key={`${idx}-${v}`} style={styles.variantItem}>
                  <Text style={styles.variantText}>{v}</Text>
                  <View style={styles.variantActions}>
                    <Pressable onPress={() => onCopyVariant(v, idx)} style={styles.variantBtn}>
                      <Text style={styles.variantBtnTxt}>{variantCopiedIdx === idx ? '✓' : '⧉'}</Text>
                    </Pressable>
                    <Pressable onPress={() => onUseVariant(v)} style={styles.variantBtn}>
                      <Text style={styles.variantBtnTxt}>↗</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {!variantsLoading && variants.length === 0 && (
            <Text style={styles.variantsEmpty}>Fikrin farklı versiyonlarını üretmek için “Üret”e dokun.</Text>
          )}
        </View>

        <View style={styles.collectionsBox}>
          <View style={styles.collectionsHeader}>
            <Text style={styles.collectionsTitle}>📚 Paketler</Text>
            <Pressable onPress={() => router.push('/collections')} style={styles.collectionsOpenBtn}>
              <Text style={styles.collectionsOpenBtnTxt}>Tümü ›</Text>
            </Pressable>
          </View>
          {allCollections.length === 0 ? (
            <Text style={styles.collectionsEmpty}>Henüz paket yok. “Tümü”nden oluşturabilirsin.</Text>
          ) : (
            <View style={styles.collectionsChipRow}>
              {allCollections.map((c) => {
                const linked = linkedCollections.includes(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => onToggleCollection(c.id)}
                    style={[
                      styles.collectionChip,
                      { borderColor: c.color },
                      linked && { backgroundColor: c.color + '22' },
                    ]}
                  >
                    <View style={[styles.collectionDot, { backgroundColor: c.color }]} />
                    <Text
                      style={[
                        styles.collectionChipTxt,
                        { color: linked ? c.color : '#374151' },
                      ]}
                    >
                      {c.name}
                    </Text>
                    <Text
                      style={[
                        styles.collectionChipCheck,
                        { color: linked ? c.color : '#9CA3AF' },
                      ]}
                    >
                      {linked ? '✓' : '+'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.statRow}>
          <Stat icon={fav ? '★' : '☆'} label={fav ? 'Favorilerde' : 'Favoriye ekle'} color={fav ? '#F59E0B' : '#6B7280'} />
          <Stat icon="⧉" label="Kopyala" color="#4D96FF" />
          <Stat icon="↗" label="Paylaş" color="#10B981" />
        </View>

        <View style={styles.hashtagQuickBox}>
          <Pressable
            onPress={() => router.push({ pathname: '/hashtags', params: { text: encodeURIComponent(text), niche: niche ?? '' } })}
            style={styles.hashtagQuickBtn}
          >
            <Text style={styles.hashtagQuickIcon}>#</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.hashtagQuickTitle}>Hashtag Paketi Üret</Text>
              <Text style={styles.hashtagQuickSub}>15 hashtag öneri, seç, kopyala veya etiketle</Text>
            </View>
            <Text style={styles.hashtagQuickChev}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>✨ AI Yardımcı</Text>
        <View style={styles.helperGrid}>
          {HELPERS.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => runHelper(h.id)}
              disabled={helperLoading}
              style={[styles.helperChip, activeKind === h.id && styles.helperChipActive]}
            >
              <Text style={styles.helperIcon}>{h.icon}</Text>
              <Text style={[styles.helperLabel, activeKind === h.id && styles.helperLabelActive]}>
                {h.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {helperLoading && (
          <View style={styles.helperBox}>
            <ActivityIndicator color="#4D96FF" />
            <Text style={styles.helperLoadingText}>AI düşünüyor…</Text>
          </View>
        )}

        {helperError === 'offline' && !helperLoading && (
          <View style={styles.helperOffline}>
            <Text style={styles.helperOfflineText}>📴 AI çevrimdışı — akıllı öneri gösteriliyor</Text>
          </View>
        )}

        {!helperLoading && helperAnswer && (
          <View style={styles.helperBox}>
            <Text style={styles.helperAnswer}>{helperAnswer}</Text>
            <Pressable onPress={copyHelper} style={styles.helperCopyBtn}>
              <Text style={styles.helperCopyText}>{helperCopied ? '✓ Kopyalandı' : '⧉ Cevabı kopyala'}</Text>
            </Pressable>
          </View>
        )}

        {relatedIdeas.length > 0 && (
          <>
            <Text style={styles.section}>🔗 İlgili fikirler</Text>
            {relatedIdeas.map((r, idx) => (
              <Pressable key={`${r}-${idx}`} onPress={() => openRelated(r)} style={styles.relatedCard}>
                <Text style={styles.relatedDay}>Pzt/Sal/Çr</Text>
                <Text style={styles.relatedText}>{r}</Text>
                <Text style={styles.relatedChev}>›</Text>
              </Pressable>
            ))}
          </>
        )}

        {!niche && (
          <Pressable
            onPress={() =>
              Alert.alert('Niş seç', 'İlgili fikirleri görmek için bir niş seçmelisin. Ayarlardan ayarlayabilirsin.')
            }
            style={styles.helperHintCard}
          >
            <Text style={styles.helperHintIcon}>💡</Text>
            <Text style={styles.helperHintText}>İlgili fikir önerileri için bir niş seçili olmalı.</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Action icon={fav ? '★' : '☆'} label={fav ? 'Favoride' : 'Favori'} onPress={onFav} />
        <Action
          icon={copied ? '✓' : '⧉'}
          label={copied ? 'Kopyalandı' : 'Kopyala'}
          onPress={onCopy}
          primary
        />
        <Action icon={busy ? '…' : '↗'} label={shared ? 'Paylaşıldı' : 'Paylaş'} onPress={onShare} />
      </View>
    </View>
  );
}

const Stat: React.FC<{ icon: string; label: string; color: string }> = ({ icon, label, color }) => (
  <View style={styles.stat}>
    <Text style={[styles.statIcon, { color }]}>{icon}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 18, color: '#374151', fontWeight: '700' },
  topTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  metaIcon: { fontSize: 18, marginRight: 6 },
  metaText: { fontSize: 13, color: '#6B7280', textTransform: 'capitalize' },
  bigText: { fontSize: 22, color: '#111827', fontWeight: '600', lineHeight: 32, marginBottom: 16 },
  tagsBox: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  tagsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  tagsTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  tagsAddBtn: { paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#E0E7FF', borderRadius: 8 },
  tagsAddBtnTxt: { fontSize: 12, color: '#4338CA', fontWeight: '700' },
  tagsChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagsEmpty: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  tagChipTxt: { fontSize: 12, color: '#4338CA', fontWeight: '700' },
  tagInputRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
  tagInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  tagInputSave: {
    backgroundColor: '#4D96FF',
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
  },
  tagInputSaveTxt: { color: 'white', fontWeight: '700', fontSize: 12 },
  tagsSuggestRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 },
  tagsSuggestLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700', marginRight: 4 },
  tagSuggestChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tagSuggestChipTxt: { fontSize: 11, color: '#6B7280', fontWeight: '700' },
  variantsBox: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  variantsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  variantsTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  variantsGenBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  variantsGenBtnTxt: { color: 'white', fontWeight: '700', fontSize: 12 },
  variantsLoading: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  variantsLoadingTxt: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  variantsHint: { fontSize: 11, color: '#92400E', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4, fontWeight: '600' },
  variantsEmpty: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', paddingVertical: 8 },
  variantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  variantText: { flex: 1, fontSize: 13, color: '#111827', lineHeight: 18, fontWeight: '500' },
  variantActions: { flexDirection: 'row', gap: 4 },
  variantBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  variantBtnTxt: { fontSize: 14, color: '#6B7280', fontWeight: '700' },
  collectionsBox: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  collectionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  collectionsTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  collectionsOpenBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  collectionsOpenBtnTxt: { fontSize: 12, color: '#7c5cff', fontWeight: '700' },
  collectionsEmpty: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  collectionsChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  collectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'white',
    gap: 6,
  },
  collectionDot: { width: 8, height: 8, borderRadius: 4 },
  collectionChipTxt: { fontSize: 12, fontWeight: '700' },
  collectionChipCheck: { fontSize: 13, fontWeight: '800' },
  hashtagQuickBox: { marginBottom: 12 },
  hashtagQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  hashtagQuickIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 40,
  },
  hashtagQuickTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  hashtagQuickSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  hashtagQuickChev: { fontSize: 28, color: '#9CA3AF', fontWeight: '300' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'white', padding: 16, borderRadius: 14 },
  stat: { alignItems: 'center', flex: 1 },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#6B7280' },
  section: { fontSize: 13, fontWeight: '800', color: '#6B7280', marginTop: 24, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  helperGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  helperChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  helperChipActive: { backgroundColor: '#4D96FF', borderColor: '#4D96FF' },
  helperIcon: { fontSize: 16 },
  helperLabel: { fontSize: 12, fontWeight: '700', color: '#374151' },
  helperLabelActive: { color: 'white' },
  helperBox: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    marginBottom: 8,
  },
  helperLoadingText: { marginTop: 8, fontSize: 13, color: '#6B7280', fontWeight: '600' },
  helperAnswer: { fontSize: 14, color: '#111827', lineHeight: 22 },
  helperCopyBtn: {
    marginTop: 12,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  helperCopyText: { fontSize: 12, fontWeight: '700', color: '#4D96FF' },
  helperOffline: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  helperOfflineText: { fontSize: 12, color: '#92400E', fontWeight: '700', textAlign: 'center' },
  relatedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  relatedDay: { fontSize: 10, fontWeight: '800', color: '#4D96FF', minWidth: 60 },
  relatedText: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },
  relatedChev: { fontSize: 20, color: '#9CA3AF', fontWeight: '700' },
  helperHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 10,
    gap: 8,
    marginTop: 12,
  },
  helperHintIcon: { fontSize: 18 },
  helperHintText: { fontSize: 12, color: '#92400E', flex: 1, fontWeight: '600' },
  bottomBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  action: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F4F6' },
  actionPrimary: { backgroundColor: '#4D96FF' },
  actionIcon: { fontSize: 18, color: '#374151' },
  actionLabel: { fontSize: 11, color: '#374151', marginTop: 4, fontWeight: '600' },
});