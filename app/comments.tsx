import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Modal,
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
  CommentCategory,
  CommentTemplate,
  addCommentTemplate,
  getCommentTemplates,
  removeCommentTemplate,
  resetCommentTemplates,
} from '../services/storage';

const CATEGORY_META: Record<CommentCategory, { icon: string; label: string; color: string }> = {
  fire: { icon: '🔥', label: 'Beğeni', color: '#F59E0B' },
  love: { icon: '❤️', label: 'Sevgi', color: '#EC4899' },
  question: { icon: '❓', label: 'Soru', color: '#4D96FF' },
  tip: { icon: '💡', label: 'Öneri', color: '#10B981' },
  shoutout: { icon: '📢', label: 'Tanıtım', color: '#8B5CF6' },
  custom: { icon: '⭐', label: 'Özel', color: '#6B7280' },
};

const CATEGORIES_ORDER: CommentCategory[] = ['fire', 'love', 'question', 'tip', 'shoutout', 'custom'];

export default function CommentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [templates, setTemplates] = useState<CommentTemplate[] | null>(null);
  const [filter, setFilter] = useState<CommentCategory | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftCat, setDraftCat] = useState<CommentCategory>('custom');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await getCommentTemplates();
    setTemplates(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onCopy = async (tpl: CommentTemplate) => {
    Clipboard.setString(tpl.text);
    setCopiedId(tpl.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const onDelete = (tpl: CommentTemplate) => {
    Alert.alert('Şablonu sil', `“${tpl.text.slice(0, 40)}${tpl.text.length > 40 ? '…' : ''}” silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const next = await removeCommentTemplate(tpl.id);
          setTemplates(next);
        },
      },
    ]);
  };

  const onReset = () => {
    Alert.alert(
      'Varsayılana dön',
      'Tüm özel şablonların silinir ve varsayılan 5 şablon geri gelir.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            const next = await resetCommentTemplates();
            setTemplates(next);
          },
        },
      ]
    );
  };

  const onSaveNew = async () => {
    const trimmed = draftText.trim();
    if (trimmed.length === 0) {
      Alert.alert('Boş bırakılamaz', 'Lütfen bir yorum yaz.');
      return;
    }
    const next = await addCommentTemplate(trimmed, draftCat);
    setTemplates(next);
    setDraftText('');
    setDraftCat('custom');
    setShowAdd(false);
  };

  if (!templates) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const visible = filter === 'all' ? templates : templates.filter((t) => t.category === filter);
  const counts: Record<CommentCategory, number> = {
    fire: 0,
    love: 0,
    question: 0,
    tip: 0,
    shoutout: 0,
    custom: 0,
  };
  for (const t of templates) counts[t.category] = (counts[t.category] ?? 0) + 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹ Geri</Text>
        </Pressable>
        <Text style={styles.title}>💬 Yorum Şablonları</Text>
        <Pressable onPress={() => setShowAdd(true)} style={styles.addBtn}>
          <Text style={styles.addTxt}>+ Ekle</Text>
        </Pressable>
      </View>

      <Text style={styles.subtitle}>
        Sık kullandığın yorumları kaydet, tek tıkla kopyala.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <FilterChip
          label={`Tümü (${templates.length})`}
          active={filter === 'all'}
          onPress={() => setFilter('all')}
          color="#111827"
        />
        {CATEGORIES_ORDER.map((c) => (
          <FilterChip
            key={c}
            label={`${CATEGORY_META[c].icon} ${CATEGORY_META[c].label} (${counts[c]})`}
            active={filter === c}
            onPress={() => setFilter(c)}
            color={CATEGORY_META[c].color}
          />
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
      >
        {visible.length === 0 ? (
          <Text style={styles.empty}>Bu kategoride şablon yok.</Text>
        ) : (
          visible.map((tpl) => {
            const meta = CATEGORY_META[tpl.category];
            const isCopied = copiedId === tpl.id;
            return (
              <View key={tpl.id} style={styles.tplCard}>
                <View style={styles.tplHeader}>
                  <View style={[styles.tplBadge, { backgroundColor: meta.color + '22' }]}>
                    <Text style={[styles.tplBadgeTxt, { color: meta.color }]}>
                      {meta.icon} {meta.label}
                    </Text>
                  </View>
                  {tpl.id.startsWith('tpl-default-') ? null : (
                    <Pressable onPress={() => onDelete(tpl)} hitSlop={10}>
                      <Text style={styles.deleteTxt}>🗑</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={styles.tplText}>{tpl.text}</Text>
                <Pressable
                  onPress={() => onCopy(tpl)}
                  style={[styles.copyBtn, { backgroundColor: meta.color }, isCopied && styles.copyBtnDone]}
                >
                  <Text style={styles.copyBtnTxt}>
                    {isCopied ? '✓ Kopyalandı' : '📋 Kopyala'}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}

        <Pressable onPress={onReset} style={styles.resetBtn}>
          <Text style={styles.resetTxt}>↺ Varsayılan şablonlara dön</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yeni yorum şablonu</Text>
            <TextInput
              value={draftText}
              onChangeText={setDraftText}
              placeholder="Örn: Harika içerik! 🔥"
              placeholderTextColor="#9CA3AF"
              style={styles.modalInput}
              multiline
              maxLength={200}
              autoFocus
            />
            <Text style={styles.modalCounter}>{draftText.length}/200</Text>

            <Text style={styles.modalLabel}>Kategori</Text>
            <View style={styles.modalCatRow}>
              {CATEGORIES_ORDER.map((c) => {
                const m = CATEGORY_META[c];
                const active = draftCat === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setDraftCat(c)}
                    style={[
                      styles.modalCatChip,
                      { borderColor: m.color },
                      active && { backgroundColor: m.color + '22' },
                    ]}
                  >
                    <Text style={[styles.modalCatChipTxt, { color: active ? m.color : '#374151' }]}>
                      {m.icon} {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowAdd(false)} style={[styles.modalBtn, styles.modalBtnCancel]}>
                <Text style={styles.modalBtnCancelTxt}>Vazgeç</Text>
              </Pressable>
              <Pressable onPress={onSaveNew} style={[styles.modalBtn, styles.modalBtnSave]}>
                <Text style={styles.modalBtnSaveTxt}>Kaydet</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const FilterChip: React.FC<{
  label: string;
  active: boolean;
  onPress: () => void;
  color: string;
}> = ({ label, active, onPress, color }) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.chip,
      { borderColor: color },
      active && { backgroundColor: color + '22' },
    ]}
  >
    <Text style={[styles.chipTxt, { color: active ? color : '#374151' }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  backTxt: { fontSize: 16, color: '#4D96FF', fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  addBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#4D96FF',
    borderRadius: 8,
  },
  addTxt: { color: 'white', fontWeight: '700', fontSize: 13 },
  subtitle: { fontSize: 13, color: '#6B7280', paddingHorizontal: 16, marginBottom: 12 },
  chipRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: 'white',
  },
  chipTxt: { fontSize: 12, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#9CA3AF', fontStyle: 'italic', marginTop: 40 },
  tplCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  tplHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tplBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  tplBadgeTxt: { fontSize: 11, fontWeight: '800' },
  deleteTxt: { fontSize: 18, padding: 4 },
  tplText: { fontSize: 14, color: '#111827', lineHeight: 20, marginBottom: 10 },
  copyBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  copyBtnDone: { opacity: 0.8 },
  copyBtnTxt: { color: 'white', fontWeight: '700', fontSize: 13 },
  resetBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  resetTxt: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 14 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    color: '#111827',
  },
  modalCounter: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 14, marginBottom: 8 },
  modalCatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalCatChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'white',
  },
  modalCatChipTxt: { fontSize: 12, fontWeight: '700' },
  modalActions: { flexDirection: 'row', marginTop: 20, gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#F3F4F6' },
  modalBtnCancelTxt: { color: '#374151', fontWeight: '700' },
  modalBtnSave: { backgroundColor: '#4D96FF' },
  modalBtnSaveTxt: { color: 'white', fontWeight: '700' },
});