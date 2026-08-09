import React, { useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import PlanBadge from '../../components/PlanBadge';
import PageHint from '../../components/PageHint';
import { useTheme } from '../../services/theme';

const APP_VERSION = (Constants.expoConfig?.version as string) ?? '1.0.0';

export default function InfoScreen() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [open, setOpen] = useState<number | null>(0);
  const [planRefresh] = useState(0);

  const FAQS = [
    { q: t('info.faq1q'), a: t('info.faq1a') },
    { q: t('info.faq2q'), a: t('info.faq2a') },
    { q: t('info.faq3q'), a: t('info.faq3a') },
    { q: t('info.faq4q'), a: t('info.faq4a') },
    { q: t('info.faq5q'), a: t('info.faq5a') },
    { q: t('info.faq6q'), a: t('info.faq6a') },
    { q: t('info.faq7q'), a: t('info.faq7a') },
  ];

  const onFeedback = async () => {
    const url = 'mailto:hello@contentcoach.app?subject=Compass%20Feedback&body=';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = url;
        return;
      }
      await Share.share({
        message: t('info.shareMsg'),
        title: t('info.shareTitle'),
      });
    } catch {}
  };

  const onMail = () => {
    const url = 'mailto:hello@contentcoach.app?subject=Content%20Coach%20Feedback';
    Linking.openURL(url).catch(() => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = url;
      }
    });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#5C6B4F' }]} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
      <PageHint hintId="info" title={t('pageHints.info.title')} description={t('pageHints.info.desc')} />
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.title}>{t('info.title')}</Text>
            <PlanBadge size="sm" refreshKey={planRefresh} />
          </View>
          <Text style={styles.subtitle}>{t('info.subtitle')}</Text>
        </View>
      </View>

      <View style={styles.aboutCard}>
        <Text style={styles.brandIcon}>🧭</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandName}>Compass</Text>
          <Text style={styles.brandSub}>{t('info.brandSub', { version: APP_VERSION })}</Text>
        </View>
      </View>

      <Text style={styles.section}>{t('info.sectionFaq')}</Text>
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <Pressable
            key={i}
            onPress={() => setOpen(isOpen ? null : i)}
            style={styles.faq}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQ}>{f.q}</Text>
              <Text style={styles.faqChev}>{isOpen ? '−' : '+'}</Text>
            </View>
            {isOpen && <Text style={styles.faqA}>{f.a}</Text>}
          </Pressable>
        );
      })}

      <Text style={styles.section}>{t('info.sectionContact')}</Text>
      <Pressable onPress={onFeedback} style={styles.actionBtn}>
        <Text style={styles.actionText}>{t('info.feedbackBtn')}</Text>
      </Pressable>
      <Pressable onPress={onMail} style={styles.actionBtn}>
        <Text style={styles.actionText}>{t('info.mailBtn')}</Text>
      </Pressable>

      <Text style={styles.section}>{t('info.sectionAbout')}</Text>
      <View style={styles.aboutCard}>
        <Text style={styles.aboutBody}>{t('info.aboutBody')}</Text>
      </View>

      <Text style={styles.creditText}>{t('info.credit')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5C6B4F' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 50, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  aboutCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'white',
    padding: 18, borderRadius: 16, marginBottom: 16, shadowColor: '#000',
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  brandIcon: { fontSize: 40 },
  brandName: { fontSize: 18, fontWeight: '800', color: '#111827' },
  brandSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  section: { fontSize: 12, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
  faq: {
    backgroundColor: 'white', padding: 14, borderRadius: 12, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQ: { fontSize: 14, fontWeight: '700', color: '#111827', flex: 1, paddingRight: 8 },
  faqChev: { fontSize: 20, color: '#4D96FF', fontWeight: '800' },
  faqA: { fontSize: 13, color: '#374151', marginTop: 10, lineHeight: 20 },
  actionBtn: {
    backgroundColor: 'white', paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.03,
    shadowRadius: 4, elevation: 1,
  },
  actionText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  aboutBody: { fontSize: 13, color: '#374151', lineHeight: 20, flex: 1 },
  creditText: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 12 },
});
