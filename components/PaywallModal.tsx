import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MonthlyUsage, getUserPlan } from '../services/storage';

type Props = {
  visible: boolean;
  onClose: () => void;
  usage: MonthlyUsage | null;
  reason: 'idea_limit' | 'niche_limit';
  nicheName?: string;
};

export default function PaywallModal({ visible, onClose, usage, reason, nicheName }: Props) {
  const router = useRouter();
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    if (visible) {
      getUserPlan().then((p) => setIsPro(p !== 'free'));
    }
  }, [visible]);

  const goPricing = () => {
    onClose();
    router.push('/pricing');
  };

  const title = reason === 'idea_limit'
    ? 'Bu ay 20 fikir limitine ulaştın'
    : 'Tüm 8 niş Pro ile açılır';

  const sub = reason === 'idea_limit'
    ? `Bu ay ${usage?.count ?? 20}/${usage?.limit ?? 20} fikir kullandın. Pro ile sınırsız fikir üret, AI özelliklerini aç.`
    : `Free planda en fazla 3 niş seçebilirsin${nicheName ? ` ("${nicheName}" dahil)` : ''}. Pro ile tüm 8 nişe eriş, ayda sınırsız fikir üret.`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🔒</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{sub}</Text>

          <View style={styles.bullets}>
            <Text style={styles.bullet}>✓ Sınırsız fikir</Text>
            <Text style={styles.bullet}>✓ Tüm 8 niş</Text>
            <Text style={styles.bullet}>✓ AI özellikler açık</Text>
            <Text style={styles.bullet}>✓ Reklamsız</Text>
          </View>

          {!isPro ? (
            <View style={styles.actions}>
              <Pressable onPress={onClose} style={[styles.btn, styles.btnGhost]}>
                <Text style={[styles.btnText, { color: '#374151' }]}>Daha Sonra</Text>
              </Pressable>
              <Pressable onPress={goPricing} style={[styles.btn, styles.btnPrimary]}>
                <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Pro'ya Geç ›</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={onClose} style={[styles.btn, styles.btnPrimary]}>
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Tamam</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(47, 59, 37, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FAFCF6',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: '#2F3B25', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 13, color: '#374151', textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  bullets: { alignSelf: 'stretch', gap: 6, marginBottom: 18 },
  bullet: { fontSize: 13, color: '#2F3B25', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: '#E5E7EB' },
  btnPrimary: { backgroundColor: '#2F3B25' },
  btnText: { fontSize: 14, fontWeight: '800' },
});
