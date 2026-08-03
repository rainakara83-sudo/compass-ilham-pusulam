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
  COLLECTION_COLORS,
  IdeaCollection,
  addIdeaToCollection,
  createCollection,
  deleteCollection,
  getCollections,
  removeIdeaFromCollection,
  updateCollection,
} from '../services/storage';

export default function CollectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [collections, setCollections] = useState<IdeaCollection[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftColor, setDraftColor] = useState<string>(COLLECTION_COLORS[0]);
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<IdeaCollection | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState<string>(COLLECTION_COLORS[0]);
  const [copiedIdea, setCopiedIdea] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await getCollections();
    setCollections(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onCreate = async () => {
    const trimmed = draftName.trim();
    if (trimmed.length === 0) {
      Alert.alert('İsim gerekli', 'Lütfen koleksiyona bir isim ver.');
      return;
    }
    await createCollection(trimmed, draftDesc.trim() || undefined, draftColor);
    setDraftName('');
    setDraftDesc('');
    setDraftColor(COLLECTION_COLORS[0]);
    setShowAdd(false);
    await load();
  };

  const onDelete = (col: IdeaCollection) => {
    Alert.alert(
      'Koleksiyonu sil',
      `“${col.name}” ve içindeki ${col.ideas.length} fikir bağlantısı silinsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const next = await deleteCollection(col.id);
            setCollections(next);
            if (expandedId === col.id) setExpandedId(null);
          },
        },
      ]
    );
  };

  const openEdit = (col: IdeaCollection) => {
    setEditTarget(col);
    setEditName(col.name);
    setEditDesc(col.description ?? '');
    setEditColor(col.color);
    setShowEdit(true);
  };

  const onSaveEdit = async () => {
    if (!editTarget) return;
    const trimmed = editName.trim();
    if (trimmed.length === 0) {
      Alert.alert('İsim gerekli', 'Koleksiyon ismi boş olamaz.');
      return;
    }
    const next = await updateCollection(editTarget.id, {
      name: trimmed,
      description: editDesc.trim(),
      color: editColor,
    });
    setCollections(next);
    setShowEdit(false);
    setEditTarget(null);
  };

  const onRemoveIdea = async (col: IdeaCollection, idea: string) => {
    const next = await removeIdeaFromCollection(col.id, idea);
    setCollections(next);
  };

  const onAddIdea = async (col: IdeaCollection, idea: string) => {
    const trimmed = idea.trim();
    if (trimmed.length === 0) return;
    const next = await addIdeaToCollection(col.id, trimmed);
    setCollections(next);
  };

  const onCopyIdea = (idea: string) => {
    Clipboard.setString(idea);
    setCopiedIdea(idea);
    setTimeout(() => setCopiedIdea(null), 1500);
  };

  if (!collections) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const totalIdeas = collections.reduce((acc, c) => acc + c.ideas.length, 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹ Geri</Text>
        </Pressable>
        <Text style={styles.title}>📚 Fikir Paketleri</Text>
        <Pressable onPress={() => setShowAdd(true)} style={styles.addBtn}>
          <Text style={styles.addTxt}>+ Yeni</Text>
        </Pressable>
      </View>

      <Text style={styles.subtitle}>
        Fikirlerini kendi koleksiyonlarına grupla. “Haftalık Seri”, “Lansman”, “Eğitim” gibi.
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{collections.length}</Text>
          <Text style={styles.statLbl}>paket</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{totalIdeas}</Text>
          <Text style={styles.statLbl}>fikir</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>
            {collections.length > 0 ? Math.round((totalIdeas / collections.length) * 10) / 10 : 0}
          </Text>
          <Text style={styles.statLbl}>ortalama</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
      >
        {collections.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>Henüz paket yok</Text>
            <Text style={styles.emptyDesc}>
              Fikirlerini organize etmek için bir koleksiyon oluştur.
            </Text>
            <Pressable onPress={() => setShowAdd(true)} style={styles.emptyBtn}>
              <Text style={styles.emptyBtnTxt}>+ İlk paketini oluştur</Text>
            </Pressable>
          </View>
        ) : (
          collections.map((col) => {
            const isExpanded = expandedId === col.id;
            return (
              <View key={col.id} style={[styles.colCard, { borderLeftColor: col.color }]}>
                <Pressable
                  onPress={() => setExpandedId(isExpanded ? null : col.id)}
                  style={styles.colHeader}
                >
                  <View style={[styles.colColorDot, { backgroundColor: col.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.colName}>{col.name}</Text>
                    {col.description && <Text style={styles.colDesc}>{col.description}</Text>}
                    <Text style={styles.colMeta}>{col.ideas.length} fikir</Text>
                  </View>
                  <Text style={styles.colChev}>{isExpanded ? '▾' : '▸'}</Text>
                </Pressable>

                {isExpanded && (
                  <View style={styles.colBody}>
                    <View style={styles.colActions}>
                      <Pressable onPress={() => openEdit(col)} style={styles.colActionBtn}>
                        <Text style={styles.colActionTxt}>✏️ Düzenle</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onDelete(col)}
                        style={[styles.colActionBtn, styles.colActionDel]}
                      >
                        <Text style={[styles.colActionTxt, styles.colActionDelTxt]}>🗑 Sil</Text>
                      </Pressable>
                    </View>

                    <AddIdeaInline onAdd={(t) => onAddIdea(col, t)} />

                    {col.ideas.length === 0 ? (
                      <Text style={styles.colEmpty}>Bu pakette henüz fikir yok.</Text>
                    ) : (
                      col.ideas.map((idea, idx) => {
                        const isCopied = copiedIdea === idea;
                        return (
                          <View key={`${col.id}-${idx}-${idea}`} style={styles.ideaItem}>
                            <Text style={styles.ideaText}>{idea}</Text>
                            <View style={styles.ideaActions}>
                              <Pressable
                                onPress={() => onCopyIdea(idea)}
                                style={styles.ideaBtn}
                                hitSlop={6}
                              >
                                <Text style={styles.ideaBtnTxt}>{isCopied ? '✓' : '⧉'}</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => onRemoveIdea(col, idea)}
                                style={styles.ideaBtn}
                                hitSlop={6}
                              >
                                <Text style={styles.ideaBtnTxt}>✕</Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yeni paket</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="örn: Haftalık Seri"
              placeholderTextColor="#9CA3AF"
              style={styles.modalInput}
              maxLength={40}
              autoFocus
            />
            <TextInput
              value={draftDesc}
              onChangeText={setDraftDesc}
              placeholder="Açıklama (opsiyonel)"
              placeholderTextColor="#9CA3AF"
              style={[styles.modalInput, { marginTop: 8, minHeight: 60 }]}
              maxLength={120}
              multiline
            />
            <Text style={styles.modalLabel}>Renk</Text>
            <View style={styles.colorRow}>
              {COLLECTION_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setDraftColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    draftColor === c && styles.colorDotActive,
                  ]}
                />
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowAdd(false)}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnCancelTxt}>Vazgeç</Text>
              </Pressable>
              <Pressable onPress={onCreate} style={[styles.modalBtn, styles.modalBtnSave]}>
                <Text style={styles.modalBtnSaveTxt}>Oluştur</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEdit} animationType="slide" transparent onRequestClose={() => setShowEdit(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Paketi düzenle</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Paket adı"
              placeholderTextColor="#9CA3AF"
              style={styles.modalInput}
              maxLength={40}
            />
            <TextInput
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="Açıklama (opsiyonel)"
              placeholderTextColor="#9CA3AF"
              style={[styles.modalInput, { marginTop: 8, minHeight: 60 }]}
              maxLength={120}
              multiline
            />
            <Text style={styles.modalLabel}>Renk</Text>
            <View style={styles.colorRow}>
              {COLLECTION_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setEditColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    editColor === c && styles.colorDotActive,
                  ]}
                />
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowEdit(false)}
                style={[styles.modalBtn, styles.modalBtnCancel]}
              >
                <Text style={styles.modalBtnCancelTxt}>Vazgeç</Text>
              </Pressable>
              <Pressable onPress={onSaveEdit} style={[styles.modalBtn, styles.modalBtnSave]}>
                <Text style={styles.modalBtnSaveTxt}>Kaydet</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const AddIdeaInline: React.FC<{ onAdd: (text: string) => void }> = ({ onAdd }) => {
  const [val, setVal] = useState('');
  return (
    <View style={styles.addInline}>
      <TextInput
        value={val}
        onChangeText={setVal}
        placeholder="Paketin içine fikir ekle…"
        placeholderTextColor="#9CA3AF"
        style={styles.addInlineInput}
        maxLength={140}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (val.trim().length > 0) {
            onAdd(val);
            setVal('');
          }
        }}
      />
      <Pressable
        onPress={() => {
          if (val.trim().length > 0) {
            onAdd(val);
            setVal('');
          }
        }}
        style={styles.addInlineBtn}
      >
        <Text style={styles.addInlineBtnTxt}>+</Text>
      </Pressable>
    </View>
  );
};

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
    backgroundColor: '#7c5cff',
    borderRadius: 8,
  },
  addTxt: { color: 'white', fontWeight: '700', fontSize: 13 },
  subtitle: { fontSize: 13, color: '#6B7280', paddingHorizontal: 16, marginBottom: 12 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
  statBox: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  statNum: { fontSize: 18, fontWeight: '800', color: '#7c5cff' },
  statLbl: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  colCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  colHeader: { flexDirection: 'row', alignItems: 'center' },
  colColorDot: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  colName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  colDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  colMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  colChev: { fontSize: 18, color: '#9CA3AF', paddingHorizontal: 6 },
  colBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  colActions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  colActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  colActionTxt: { fontSize: 12, fontWeight: '700', color: '#374151' },
  colActionDel: { backgroundColor: '#FEE2E2' },
  colActionDelTxt: { color: '#DC2626' },
  colEmpty: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', marginTop: 8 },
  addInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingLeft: 12,
    marginBottom: 10,
  },
  addInlineInput: { flex: 1, fontSize: 13, color: '#111827', paddingVertical: 8 },
  addInlineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7c5cff',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  addInlineBtnTxt: { color: 'white', fontSize: 18, fontWeight: '800' },
  ideaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  ideaText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  ideaActions: { flexDirection: 'row', gap: 6, marginLeft: 8 },
  ideaBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ideaBtnTxt: { fontSize: 13, color: '#374151', fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingVertical: 50 },
  emptyIcon: { fontSize: 50, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 16, paddingHorizontal: 30 },
  emptyBtn: {
    backgroundColor: '#7c5cff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyBtnTxt: { color: 'white', fontWeight: '800', fontSize: 13 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 14 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
  },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 14, marginBottom: 8 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: '#111827' },
  modalActions: { flexDirection: 'row', marginTop: 20, gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#F3F4F6' },
  modalBtnCancelTxt: { color: '#374151', fontWeight: '700' },
  modalBtnSave: { backgroundColor: '#7c5cff' },
  modalBtnSaveTxt: { color: 'white', fontWeight: '700' },
});