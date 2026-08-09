import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MonthlyUsage, getUserPlan } from '../services/storage';

type Props = {
  visible: boolean;
  onClose: () => void;
  usage: MonthlyUsage | null;
  reason: 'idea_limit' | 'niche_limit';
  nicheName?: string;
};

export default function PaywallModal({ visible, onClose, usage, reason, nicheName }: Props) {
  const { t } = useTranslation();
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
    ? t('paywall.ideaLimitTitle')
    : t('paywall.nicheLimitTitle');

  const sub = reason === 'idea_limit'
    ? t('paywall.ideaLimitSub', {
        count: usage?.count ?? 20,
        limit: usage?.limit ?? 20,
      })
    : t('paywall.nicheLimitSub', {
        nameSuffix: nicheName ? t('paywall.nicheSuffix', { name: nicheName }) : '',
      });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🔒</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{sub}</Text>

          <View style={styles.bullets}>
            <Text style={styles.bullet}>{t('paywall.bulletUnlimited')}</Text>
            <Text style={styles.bullet}>{t('paywall.bulletAllNiches')}</Text>
            <Text style={styles.bullet}>{t('paywall.bulletAI')}</Text>
            <Text style={styles.bullet}>{t('paywall.bulletNoAds')}</Text>
          </View>

          {!isPro ? (
            <View style={styles.actions}>
              <Pressable onPress={onClose} style={[styles.btn, styles.btnGhost]}>
                <Text style={[styles.btnText, { color: '#374151' }]}>{t('paywall.later')}</Text>
              </Pressable>
              <Pressable onPress={goPricing} style={[styles.btn, styles.btnPrimary]}>
                <Text style={[styles.btnText, { color: '#FFFFFF' }]}>{t('paywall.goPro')}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={onClose} style={[styles.btn, styles.btnPrimary]}>
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>{t('common.ok')}</Text>
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