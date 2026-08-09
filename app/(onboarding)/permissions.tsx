import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { requestNotificationPermission } from '../../services/notificationService';

export default function PermissionsStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [busy, setBusy] = useState(false);

  const askNotifications = async () => {
    setBusy(true);
    const ok = await requestNotificationPermission();
    setNotifications(ok ? 'granted' : 'denied');
    setBusy(false);
  };

  const finish = () => {
    router.replace('/(onboarding)/welcome');
  };

  return (
    <View style={styles.container}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepText}>{t('onboardingFlow.stepOf', { current: 4, total: 4 })}</Text>
      </View>
      <Text style={styles.title}>🔔 {t('reminders.title')}</Text>
      <Text style={styles.subtitle}>{t('onboardingFlow.permissionsSubtitle')}</Text>

      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.icon}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t('reminders.title')}</Text>
            <Text style={styles.cardSub}>{t('onboardingFlow.permissionsCardSub')}</Text>
            {notifications !== 'unknown' && (
              <Text style={[styles.status, notifications === 'granted' ? styles.statusOk : styles.statusBad]}>
                {notifications === 'granted' ? '✓ ' + t('reminders.permissionGranted') : '✕ ' + t('reminders.permissionDenied')}
              </Text>
            )}
          </View>
        </View>
        <Pressable onPress={askNotifications} disabled={busy} style={[styles.btn, notifications === 'granted' && styles.btnDone]}>
          <Text style={styles.btnText}>{busy ? t('onboardingFlow.permissionsWorking') : notifications === 'granted' ? t('onboardingFlow.permissionsReask') : t('onboardingFlow.permissionsGrant')}</Text>
        </Pressable>
      </View>

      <View style={[styles.card, styles.tipsCard]}>
        <Text style={styles.tipTitle}>{t('onboardingFlow.permissionsTipTitle')}</Text>
        <Text style={styles.tipText}>
          {t('onboardingFlow.permissionsTipBody')}
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t('onboardingFlow.nicheBack')}</Text>
        </Pressable>
        <Pressable onPress={finish} style={[styles.cta, { flex: 1 }]}>
          <Text style={styles.ctaText}>{t('onboardingFlow.experienceStart')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80, paddingHorizontal: 20, backgroundColor: '#F9FAFB' },
  stepBadge: { alignSelf: 'flex-start', backgroundColor: '#E0E7FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  stepText: { fontSize: 11, color: '#4338CA', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 8, marginBottom: 24 },
  card: { backgroundColor: 'white', padding: 18, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  icon: { fontSize: 32 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  status: { marginTop: 8, fontSize: 12, fontWeight: '700' },
  statusOk: { color: '#10B981' },
  statusBad: { color: '#DC2626' },
  btn: { backgroundColor: '#4D96FF', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnDone: { backgroundColor: '#10B981' },
  btnText: { color: 'white', fontWeight: '700' },
  tipsCard: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D', borderWidth: 1 },
  tipTitle: { fontSize: 13, fontWeight: '800', color: '#92400E', marginBottom: 6 },
  tipText: { fontSize: 12, color: '#78350F', lineHeight: 18 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 'auto', marginBottom: 24 },
  backBtn: { paddingVertical: 16, paddingHorizontal: 18, borderRadius: 14, backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB' },
  backBtnText: { color: '#374151', fontWeight: '700' },
  cta: { backgroundColor: '#4D96FF', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  ctaText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
