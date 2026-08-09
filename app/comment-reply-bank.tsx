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
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
  ReplyEntry,
  ReplyIntent,
  ReplyTone,
  REPLYBANK_INTENTS,
  REPLYBANK_TONES,
  buildReplySuggestions,
  clearReplyBanks,
  getReplyBankList,
  removeReplyBank,
  saveReplyBank,
  updateReplyBank,
  addCopyToHistory,
} from '../services/storage';

export default function CommentReplyBankScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [list, setList] = useState<ReplyEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [comment, setComment] = useState('');
  const [intent, setIntent] = useState<ReplyIntent>('curiosity');
  const [tone, setTone] = useState<ReplyTone>('warm');
  const [preview, setPreview] = useState<Omit<ReplyEntry, 'id' | 'createdAt'> | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const data = await getReplyBankList();
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
    if (comment.trim().length < 2) {
      setPreview(null);
      return;
    }
    setPreview(buildReplySuggestions({ comment, intent, tone }));
  }, [comment, intent, tone]);

  useEffect(() => {
    generate();
  }, [generate]);

  const onSave = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    const next = await saveReplyBank(preview);
    setList(next);
    setSaving(false);
    setComment('');
    setPreview(null);
    setToast(t('commentReplyBank.toastSaved'));
  }, [preview, t]);

  const onRemove = useCallback(async (id: string) => {
    Alert.alert(
      t('commentReplyBank.deleteAlertTitle'),
      t('commentReplyBank.deleteAlertBody'),
      [
        { text: t('commentReplyBank.deleteAlertCancel'), style: 'cancel' },
        {
          text: t('commentReplyBank.deleteAlertConfirm'),
          style: 'destructive',
          onPress: async () => {
            const next = await removeReplyBank(id);
            setList(next);
            if (openId === id) setOpenId(null);
          },
        },
      ]
    );
  }, [openId, t]);

  const onClear = useCallback(() => {
    if (list.length === 0) return;
    Alert.alert(
      t('commentReplyBank.clearAllAlertTitle'),
      t('commentReplyBank.clearAllAlertBody', { count: list.length }),
      [
        { text: t('commentReplyBank.deleteAlertCancel'), style: 'cancel' },
        {
          text: t('commentReplyBank.clearAllAlertConfirm'),
          style: 'destructive',
          onPress: async () => {
            await clearReplyBanks();
            setList([]);
            setToast(t('commentReplyBank.toastCleared'));
          },
        },
      ]
    );
  }, [list.length, t]);

  const onCopy = useCallback(async (text: string) => {
    Clipboard.setString(text);
    await addCopyToHistory(text, 'pool');
    setToast(t('commentReplyBank.toastCopied'));
  }, [t]);

  const onSaveNotes = useCallback(
    async (id: string) => {
      const note = notesDraft[id];
      if (note === undefined) return;
      const next = await updateReplyBank(id, { notes: note });
      setList(next);
      setToast(t('commentReplyBank.toastNoteSaved'));
      setNotesDraft(prev => {
        const c = { ...prev };
        delete c[id];
        return c;
      });
    },
    [notesDraft, t]
  );

  const summary = useMemo(() => {
    const intentCount: Partial<Record<ReplyIntent, number>> = {};
    list.forEach(e => {
      intentCount[e.intent] = (intentCount[e.intent] ?? 0) + 1;
    });
    const totalSuggestions = list.reduce((s, e) => s + e.suggestions.length, 0);
    const avgSuggestions = list.length === 0 ? 0 : Math.round((totalSuggestions / list.length) * 10) / 10;
    return { intentCount, totalSuggestions, avgSuggestions };
  }, [list]);

  const intentKeys = Object.keys(REPLYBANK_INTENTS) as ReplyIntent[];
  const toneKeys = Object.keys(REPLYBANK_TONES) as ReplyTone[];

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: t('commentReplyBank.title'),
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          {t('commentReplyBank.subtitle')}
        </Text>

        {/* COMMENT INPUT */}
        <Text style={styles.sectionLabel}>{t('commentReplyBank.labelComment')}</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder={t('commentReplyBank.placeholderComment')}
          placeholderTextColor="#475569"
          style={styles.commentInput}
          multiline
        />

        {/* INTENT */}
        <Text style={styles.sectionLabel}>{t('commentReplyBank.labelIntent')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {intentKeys.map(ik => {
            const meta = REPLYBANK_INTENTS[ik];
            const active = intent === ik;
            return (
              <Pressable
                key={ik}
                onPress={() => setIntent(ik)}
                style={[styles.chip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
              >
                <Text style={styles.chipIcon}>{meta.emoji}</Text>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* TONE */}
        <Text style={styles.sectionLabel}>{t('commentReplyBank.labelTone')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {toneKeys.map(tk => {
            const meta = REPLYBANK_TONES[tk];
            const active = tone === tk;
            return (
              <Pressable
                key={tk}
                onPress={() => setTone(tk)}
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
            <View style={styles.commentBox}>
              <Text style={styles.commentLabel}>{t('commentReplyBank.sectionComment')}</Text>
              <Text style={styles.commentText}>{preview.comment}</Text>
            </View>

            <Text style={styles.tip}>💡 {REPLYBANK_INTENTS[preview.intent].tip}</Text>

            <Text style={styles.sectionTitle}>{t('commentReplyBank.sectionReplies', { count: preview.suggestions.length })}</Text>
            {preview.suggestions.map(s => {
              const isBest = s.id === preview.bestId;
              const tMeta = REPLYBANK_TONES[s.tone];
              return (
                <View key={s.id} style={[styles.suggRow, isBest && styles.suggRowBest]}>
                  {isBest && <Text style={styles.bestBadge}>{t('commentReplyBank.badgeBest')}</Text>}
                  <View style={styles.suggHeader}>
                    <View style={styles.tonePill}>
                      <Text style={styles.tonePillEmoji}>{tMeta.emoji}</Text>
                      <Text style={styles.tonePillText}>{tMeta.label}</Text>
                    </View>
                    <Text style={styles.lengthText}>{s.text.length}kr</Text>
                  </View>
                  <Text style={styles.suggText}>{s.text || t('commentReplyBank.emptyReply')}</Text>
                  {s.text.length > 0 && (
                    <Pressable onPress={() => onCopy(s.text)} style={styles.suggCopyBtn}>
                      <Text style={styles.suggCopyBtnText}>{t('commentReplyBank.copyBtn')}</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}

            <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>💾 Kaydet</Text>}
            </Pressable>
          </View>
        )}

        {/* SAVED LIST */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('commentReplyBank.savedTitle', { count: list.length })}</Text>
            {list.length > 0 && (
              <Pressable onPress={onClear}>
                <Text style={styles.clearBtn}>{t('commentReplyBank.clearAll')}</Text>
              </Pressable>
            )}
          </View>

          {list.length > 0 && (
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('commentReplyBank.statTotal')}</Text>
                <Text style={styles.summaryValue}>{summary.totalSuggestions}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('commentReplyBank.statAvg')}</Text>
                <Text style={styles.summaryValue}>{summary.avgSuggestions}</Text>
              </View>
              <Text style={[styles.summaryLabel, { marginTop: 8, marginBottom: 4 }]}>{t('commentReplyBank.statIntents')}</Text>
              <View style={styles.intentRow}>
                {intentKeys.map(ik => {
                  const cnt = summary.intentCount[ik] ?? 0;
                  if (cnt === 0) return null;
                  const meta = REPLYBANK_INTENTS[ik];
                  return (
                    <View key={ik} style={[styles.intentChip, { borderColor: meta.color }]}>
                      <Text style={styles.intentChipEmoji}>{meta.emoji}</Text>
                      <Text style={[styles.intentChipCount, { color: meta.color }]}>{cnt}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {list.length === 0 ? (
            <Text style={styles.empty}>{t('commentReplyBank.empty')}</Text>
          ) : (
            list.map(e => {
              const intentMeta = REPLYBANK_INTENTS[e.intent];
              const open = openId === e.id;
              return (
                <View key={e.id} style={styles.entry}>
                  <Pressable onPress={() => setOpenId(open ? null : e.id)} style={styles.entryHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryComment} numberOfLines={2}>
                        {intentMeta?.emoji} {e.comment}
                      </Text>
                      <Text style={styles.entryMeta}>
                        {intentMeta?.label} · {t('commentReplyBank.suggestionsCount', { count: e.suggestions.length })}
                      </Text>
                    </View>
                    <Text style={styles.entryChevron}>{open ? '▲' : '▼'}</Text>
                  </Pressable>

                  {open && (
                    <View style={styles.entryDetail}>
                      {e.suggestions.map(s => {
                        const isBest = s.id === e.bestId;
                        const tMeta = REPLYBANK_TONES[s.tone];
                        return (
                          <View key={s.id} style={[styles.entrySuggRow, isBest && styles.entrySuggBest]}>
                            <View style={styles.entrySuggHeader}>
                              <Text style={[styles.entrySuggTone, isBest && { color: '#10B981' }]}>
                                {tMeta?.emoji} {tMeta?.label}{isBest ? ' ⭐' : ''}
                              </Text>
                              <Text style={styles.entrySuggLen}>{s.text.length}kr</Text>
                            </View>
                            <Text style={styles.entrySuggText}>{s.text || t('commentReplyBank.emptyReply')}</Text>
                            {s.text.length > 0 && (
                              <Pressable onPress={() => onCopy(s.text)} style={styles.entryCopyBtn}>
                                <Text style={styles.entryCopyBtnText}>{t('commentReplyBank.copyBtn')}</Text>
                              </Pressable>
                            )}
                          </View>
                        );
                      })}

                      <Text style={styles.entryLabel}>{t('commentReplyBank.notes')}</Text>
                      <TextInput
                        value={notesDraft[e.id] ?? e.notes}
                        onChangeText={txt => setNotesDraft(prev => ({ ...prev, [e.id]: txt }))}
                        placeholder={t('commentReplyBank.notesPlaceholder')}
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
                          <Text style={styles.smallBtnText}>{t('commentReplyBank.saveNoteBtn')}</Text>
                        </Pressable>
                        <Pressable onPress={() => onRemove(e.id)} style={[styles.smallBtn, { borderColor: '#F97316' }]}>
                          <Text style={[styles.smallBtnText, { color: '#F97316' }]}>{t('commentReplyBank.deleteBtn')}</Text>
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
          <Text style={styles.backBtnText}>{t('commentReplyBank.back')}</Text>
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
  commentInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
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
  commentBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  commentLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  commentText: { color: '#f8fafc', fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
  tip: { color: '#94a3b8', fontSize: 12, marginBottom: 10, fontStyle: 'italic' },
  sectionTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  suggRow: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  suggRowBest: {
    borderColor: '#10B981',
    borderWidth: 2,
  },
  bestBadge: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 1,
  },
  suggHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  tonePillEmoji: { fontSize: 11 },
  tonePillText: { color: '#cbd5e1', fontSize: 10, fontWeight: '700' },
  lengthText: { color: '#64748b', fontSize: 10 },
  suggText: { color: '#f8fafc', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  suggCopyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
  },
  suggCopyBtnText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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
  intentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  intentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  intentChipEmoji: { fontSize: 12 },
  intentChipCount: { fontSize: 13, fontWeight: '700' },
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
  entryComment: { color: '#f8fafc', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
  entryMeta: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  entryChevron: { color: '#94a3b8', fontSize: 14 },
  entryDetail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  entrySuggRow: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  entrySuggBest: { borderColor: '#10B981', borderWidth: 2 },
  entrySuggHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  entrySuggTone: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  entrySuggLen: { color: '#64748b', fontSize: 10 },
  entrySuggText: { color: '#f8fafc', fontSize: 12, marginBottom: 6, lineHeight: 16 },
  entryCopyBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#475569',
  },
  entryCopyBtnText: { color: '#cbd5e1', fontSize: 10, fontWeight: '600' },
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