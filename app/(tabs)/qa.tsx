import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { askAI } from '../../services/aiService';
import {
  FavoritePrompt,
  QACategory,
  RecentQuestion,
  addFavoritePrompt,
  addRecentQuestion,
  clearRecentQuestions,
  getFavoritePrompts,
  getRecentQuestions,
  getStoredNiche,
  isFavoritePrompt,
  removeFavoritePrompt,
} from '../../services/storage';
import { NicheId } from '../../services/contentService';

type Msg = { id: string; role: 'user' | 'assistant'; content: string };

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const CATEGORIES: { id: QACategory; label: string; icon: string }[] = [
  { id: 'titles', label: 'Başlıklar', icon: '✍️' },
  { id: 'ideas', label: 'Fikirler', icon: '💡' },
  { id: 'caption', label: 'Caption', icon: '📝' },
  { id: 'hashtag', label: 'Hashtag', icon: '#️⃣' },
  { id: 'analytics', label: 'Analiz', icon: '📊' },
  { id: 'other', label: 'Diğer', icon: '✨' },
];

const PROMPTS_BY_CAT: Record<QACategory, { icon: string; text: string }[]> = {
  titles: [
    { icon: '🔥', text: 'Bu hafta için 5 dikkat çekici başlık öner' },
    { icon: '❓', text: 'Soru formatında 3 başlık yaz' },
    { icon: '📋', text: 'Listeleme tarzında 5 başlık öner' },
    { icon: '😱', text: 'Merak uyandıran 5 clickbait başlık öner' },
  ],
  ideas: [
    { icon: '📅', text: '30 günlük içerik takvimi çıkar' },
    { icon: '💡', text: 'Nişimde trend olan konular neler?' },
    { icon: '🎯', text: 'Hedef kitlemle etkileşimi nasıl artırırım?' },
    { icon: '🖼', text: 'Görsel fikirleri için ipuçları ver' },
  ],
  caption: [
    { icon: '📝', text: 'Bu fikir için kısa bir caption yaz' },
    { icon: '🎣', text: 'İlk cümlesi dikkat çeken bir açılış yaz' },
    { icon: '💬', text: 'Yoruma teşvik eden bir caption öner' },
    { icon: '🪄', text: 'Mevcut captionımı daha akıcı hale getir' },
  ],
  hashtag: [
    { icon: '📊', text: 'Nişim için 20 hashtag öner' },
    { icon: '🔥', text: 'Trend hashtag kombinasyonları sun' },
    { icon: '🌍', text: 'Türkçe ve uluslararası hashtag karışımı öner' },
  ],
  analytics: [
    { icon: '📈', text: 'Son gönderim neden az etkileşim aldı?' },
    { icon: '⏰', text: 'En iyi paylaşım saatleri ne zaman?' },
    { icon: '🧪', text: 'A/B test için hangi değişkenleri denemeliyim?' },
  ],
  other: [
    { icon: '🤝', text: 'Nişimdeki diğer içerik üreticileriyle işbirliği nasıl yaparım?' },
    { icon: '💼', text: 'Sponsorluk teklifi alırken nelere dikkat etmeliyim?' },
  ],
};

const detectCategory = (text: string): QACategory => {
  const lower = text.toLowerCase();
  if (/(başlık|title)/.test(lower)) return 'titles';
  if ((/fikir|takvim|trend|konu/.test(lower))) return 'ideas';
  if (/caption|açılış|yorum/.test(lower)) return 'caption';
  if (/(hashtag|#)/.test(lower)) return 'hashtag';
  if (/(analiz|saat|etkileşim|test)/.test(lower)) return 'analytics';
  return 'other';
};

export default function QAScreen() {
  const { t } = useTranslation();
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<QACategory>('titles');
  const [favPrompts, setFavPrompts] = useState<FavoritePrompt[]>([]);
  const [recent, setRecent] = useState<RecentQuestion[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    getStoredNiche().then((n) => setNiche(n));
    setMessages([{ id: newId(), role: 'assistant', content: t('qa.welcome') }]);
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setFavPrompts(await getFavoritePrompts());
        setRecent(await getRecentQuestions());
      })();
    }, [])
  );

  const refreshFav = async () => setFavPrompts(await getFavoritePrompts());

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || !niche) return;
    const userMsg: Msg = { id: newId(), role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);
    if (!overrideText) setInput('');
    setBusy(true);
    const result = await askAI({ niche, question: text, history: messages });
    setMessages((m) => [...m, { id: newId(), role: 'assistant', content: result.answer || t('qa.error') }]);
    setBusy(false);
    setRecent(await addRecentQuestion(text));
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const regenerate = async (assistantId: string) => {
    if (!niche) return;
    let userText = '';
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === assistantId);
      if (idx <= 0) return prev;
      userText = prev[idx - 1].content;
      return prev.slice(0, idx);
    });
    if (!userText) return;
    setBusy(true);
    const result = await askAI({ niche, question: userText, history: messages });
    setMessages((m) => [...m, { id: newId(), role: 'assistant', content: result.answer || t('qa.error') }]);
    setBusy(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const copy = (id: string, content: string) => {
    Clipboard.setString(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const clearChat = () => {
    setMessages([{ id: newId(), role: 'assistant', content: t('qa.welcome') }]);
  };

  const toggleFavoritePrompt = async (text: string) => {
    const cat = detectCategory(text);
    const isFav = await isFavoritePrompt(text);
    if (isFav) {
      const list = await getFavoritePrompts();
      const target = list.find((p) => p.text === text);
      if (target) await removeFavoritePrompt(target.id);
    } else {
      await addFavoritePrompt(text, cat);
    }
    await refreshFav();
  };

  const onClearRecent = () => {
    Alert.alert('Geçmişi temizle', 'Son sorular silinsin mi?', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Temizle',
        style: 'destructive',
        onPress: async () => {
          await clearRecentQuestions();
          setRecent([]);
        },
      },
    ]);
  };

  const prompts = PROMPTS_BY_CAT[activeCat];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('qa.title')}</Text>
        <Pressable onPress={clearChat} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>Temizle</Text>
        </Pressable>
      </View>

      <View style={styles.catRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setActiveCat(c.id)}
              style={[styles.catChip, activeCat === c.id && styles.catChipOn]}
            >
              <Text style={[styles.catIcon]}>{c.icon}</Text>
              <Text style={[styles.catLabel, activeCat === c.id && styles.catLabelOn]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={{ padding: 16 }}
      >
        {messages.map((m) => {
          const lastUser = (() => {
            const idx = messages.findIndex((mm) => mm.id === m.id);
            return idx > 0 && messages[idx - 1].role === 'user';
          })();
          return (
            <View key={m.id} style={[styles.bubbleWrap, m.role === 'user' ? styles.userWrap : styles.aiWrap]}>
              <Pressable
                onLongPress={() => copy(m.id, m.content)}
                style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.aiBubble]}
              >
                <Text style={m.role === 'user' ? styles.userText : styles.aiText}>{m.content}</Text>
                {copiedId === m.id && <Text style={styles.copiedHint}>Kopyalandı</Text>}
              </Pressable>
              {m.role === 'assistant' && lastUser && (
                <View style={styles.bubbleActions}>
                  <Pressable onPress={() => copy(m.id, m.content)} style={styles.actionBtn}>
                    <Text style={styles.actionText}>⧉ Kopyala</Text>
                  </Pressable>
                  <Pressable onPress={() => regenerate(m.id)} style={styles.actionBtn}>
                    <Text style={styles.actionText}>↻ Yenile</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
        {busy && <ActivityIndicator style={{ marginVertical: 8 }} />}
      </ScrollView>

      {favPrompts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⭐ Favori prompt'ların</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
            {favPrompts.map((p) => (
              <Pressable key={p.id} onPress={() => send(p.text)} style={styles.favChip}>
                <Text style={styles.favChipText} numberOfLines={1}>{p.text}</Text>
                <Pressable onPress={() => toggleFavoritePrompt(p.text)} style={styles.favChipX}>
                  <Text style={styles.favChipXText}>★</Text>
                </Pressable>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.quickRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        >
          {prompts.map((qp, i) => (
            <View key={i} style={styles.quickChipWrap}>
              <Pressable onPress={() => send(qp.text)} style={styles.quickChip}>
                <Text style={styles.quickIcon}>{qp.icon}</Text>
                <Text style={styles.quickText} numberOfLines={2}>{qp.text}</Text>
              </Pressable>
              <Pressable onPress={() => toggleFavoritePrompt(qp.text)} style={styles.quickStar}>
                <Text style={styles.quickStarText}>
                  {favPrompts.some((p) => p.text === qp.text) ? '★' : '☆'}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>

      {recent.length > 0 && (
        <View style={styles.recentBox}>
          <View style={styles.recentHead}>
            <Text style={styles.recentTitle}>🕘 Son soruların</Text>
            <Pressable onPress={onClearRecent}>
              <Text style={styles.recentClear}>Temizle</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
            {recent.map((r) => (
              <Pressable key={`${r.askedAt}-${r.text}`} onPress={() => send(r.text)} style={styles.recentChip}>
                <Text style={styles.recentChipText} numberOfLines={1}>{r.text}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={t('qa.placeholder')}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <Pressable onPress={() => send()} style={styles.sendBtn} disabled={busy}>
          <Text style={styles.sendText}>{t('qa.send')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F3F4F6', borderRadius: 8 },
  clearBtnText: { color: '#6B7280', fontWeight: '600', fontSize: 12 },
  catRow: { paddingVertical: 6, backgroundColor: 'white' },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: '#F3F4F6', gap: 4 },
  catChipOn: { backgroundColor: '#4D96FF' },
  catIcon: { fontSize: 14 },
  catLabel: { fontSize: 12, color: '#374151', fontWeight: '700' },
  catLabelOn: { color: 'white' },
  messages: { flex: 1 },
  bubbleWrap: { marginBottom: 10, maxWidth: '88%' },
  userWrap: { alignSelf: 'flex-end' },
  aiWrap: { alignSelf: 'flex-start' },
  bubble: { padding: 12, borderRadius: 14 },
  userBubble: { backgroundColor: '#4D96FF' },
  aiBubble: { backgroundColor: 'white' },
  userText: { color: 'white' },
  aiText: { color: '#111827' },
  copiedHint: { marginTop: 4, fontSize: 10, color: '#10B981', fontWeight: '600' },
  bubbleActions: { flexDirection: 'row', gap: 6, marginTop: 4 },
  actionBtn: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#F3F4F6', borderRadius: 6 },
  actionText: { fontSize: 10, color: '#6B7280', fontWeight: '700' },
  section: { paddingVertical: 8, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#6B7280', paddingHorizontal: 16, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  favChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderColor: '#FCD34D', borderWidth: 1, paddingLeft: 10, paddingRight: 4, paddingVertical: 6, borderRadius: 14, maxWidth: 220, gap: 4 },
  favChipText: { fontSize: 11, color: '#92400E', fontWeight: '700', flex: 1 },
  favChipX: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: '#FCD34D' },
  favChipXText: { fontSize: 11, color: '#92400E', fontWeight: '800' },
  quickRow: { paddingVertical: 8, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  quickChipWrap: { position: 'relative', marginRight: 4 },
  quickChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, maxWidth: 220, gap: 6, paddingRight: 32 },
  quickIcon: { fontSize: 14 },
  quickText: { fontSize: 12, color: '#1E40AF', fontWeight: '600' },
  quickStar: { position: 'absolute', right: 6, top: 6, padding: 4 },
  quickStarText: { fontSize: 13, color: '#F59E0B', fontWeight: '800' },
  recentBox: { paddingVertical: 8, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  recentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 6 },
  recentTitle: { fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 0.5, textTransform: 'uppercase' },
  recentClear: { fontSize: 11, color: '#DC2626', fontWeight: '700' },
  recentChip: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, maxWidth: 200 },
  recentChipText: { fontSize: 11, color: '#374151', fontWeight: '600' },
  inputRow: { flexDirection: 'row', padding: 12, backgroundColor: 'white', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120 },
  sendBtn: { backgroundColor: '#4D96FF', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  sendText: { color: 'white', fontWeight: '700' },
});
