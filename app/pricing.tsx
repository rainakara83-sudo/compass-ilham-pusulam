import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  getMonthlyUsage,
  getPlanStartedAt,
  getUserPlan,
  MonthlyUsage,
  setUserPlan,
  UserPlan,
} from '../services/storage';
import PageHint from '../components/PageHint';

type PlanId = 'free' | 'pro_monthly' | 'pro_yearly';

type PlanCardConfig = {
  id: PlanId;
  price: string;
  periodKey: string;
  ctaKind: 'secondary' | 'primary';
  accent: string;
  cardBg: string;
  hasSaveBadge: boolean;
  highlight: boolean;
};

const PLAN_CARDS: PlanCardConfig[] = [
  {
    id: 'free',
    price: '$0',
    periodKey: 'pricing.perMonth',
    ctaKind: 'secondary',
    accent: '#6B7280',
    cardBg: '#FAFCF6',
    hasSaveBadge: false,
    highlight: false,
  },
  {
    id: 'pro_monthly',
    price: '$7.99',
    periodKey: 'pricing.perMonth',
    ctaKind: 'primary',
    accent: '#2F3B25',
    cardBg: '#E8F0DC',
    hasSaveBadge: false,
    highlight: false,
  },
  {
    id: 'pro_yearly',
    price: '$54.99',
    periodKey: 'pricing.perYear',
    ctaKind: 'primary',
    accent: '#D4836B',
    cardBg: '#FFF6E0',
    hasSaveBadge: true,
    highlight: true,
  },
];

const getFeatureKey = (plan: PlanId, idx: number): string => {
  const arrKey =
    plan === 'free'
      ? 'pricing.freeFeatures'
      : plan === 'pro_monthly'
      ? 'pricing.proMonthlyFeatures'
      : 'pricing.proYearlyFeatures';
  return `${arrKey}.${idx}`;
};

export default function PricingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [plan, setPlan] = useState<UserPlan>('free');
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);
  const [planStartedAt, setPlanStartedAt] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    (async () => {
      const [p, u, started] = await Promise.all([getUserPlan(), getMonthlyUsage(), getPlanStartedAt()]);
      setPlan(p);
      setUsage(u);
      setPlanStartedAt(started);
    })();
  }, [fade, slide]);

  const onChoose = (id: PlanId) => {
    if (id === 'free') return;
    setSelectedPlan(id);
    setConfirmOpen(true);
  };

  const confirmUpgrade = async () => {
    if (!selectedPlan || selectedPlan === 'free') return;
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1500));
    await setUserPlan(selectedPlan);
    const [u, started] = await Promise.all([getMonthlyUsage(), getPlanStartedAt()]);
    setPlan(selectedPlan);
    setUsage(u);
    setPlanStartedAt(started);
    setProcessing(false);
    setConfirmOpen(false);
    setSuccessOpen(true);
  };

  const formatStartedDate = (ts: number | null): string => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  };

  const planTitle = (id: PlanId): string => {
    if (id === 'free') return t('pricing.free');
    if (id === 'pro_monthly') return t('pricing.proMonthly');
    return t('pricing.proYearly');
  };

  const planBadgeLabel = (id: PlanId): string => {
    if (id === 'free') return t('pricing.freeBadge');
    if (id === 'pro_yearly') return t('pricing.yearlyBadge');
    return t('pricing.proBadge');
  };

  const planPillLabel = (): string => (plan === 'free' ? t('pricing.freeBadge') : t('pricing.proBadge'));
  const planPillBg = (): string => (plan === 'free' ? '#9CA3AF' : plan === 'pro_yearly' ? '#D4836B' : '#22C55E');

  const renderCard = (cfg: PlanCardConfig) => {
    const isCurrent = plan === cfg.id;
    const items = (t(
      cfg.id === 'free' ? 'pricing.freeFeatures' : cfg.id === 'pro_monthly' ? 'pricing.proMonthlyFeatures' : 'pricing.proYearlyFeatures',
      { returnObjects: true }
    ) as unknown) as string[];
    const safeItems = Array.isArray(items) ? items : [];
    return (
      <Animated.View
        key={cfg.id}
        style={[
          styles.planCard,
          {
            backgroundColor: cfg.cardBg,
            borderColor: cfg.highlight ? cfg.accent : '#C5D2A0',
            borderWidth: cfg.highlight ? 3 : 1.5,
            transform: [{ translateY: slide }],
          },
        ]}
      >
        {cfg.highlight && (
          <View style={[styles.popularBadge, { backgroundColor: cfg.accent }]}>
            <Text style={styles.popularBadgeText}>{t('pricing.popular')}</Text>
          </View>
        )}
        {cfg.hasSaveBadge && (
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>🎁 {t('pricing.saveBadge').replace('🎁 ', '')}</Text>
          </View>
        )}
        <View style={styles.planHeader}>
          <Text style={[styles.planName, { color: cfg.accent }]}>{planTitle(cfg.id)}</Text>
          <View style={[styles.planBadge, { backgroundColor: cfg.accent }]}>
            <Text style={styles.planBadgeText}>{planBadgeLabel(cfg.id)}</Text>
          </View>
        </View>
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: cfg.accent }]}>{cfg.price}</Text>
          <Text style={styles.period}> / {t(cfg.periodKey)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.featureList}>
          {safeItems.map((item, idx) => (
            <View key={idx} style={styles.featureRow}>
              <Text style={[styles.featureCheck, { color: cfg.accent }]}>✓</Text>
              <Text style={styles.featureText}>{item}</Text>
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => onChoose(cfg.id)}
          disabled={isCurrent || cfg.id === 'free'}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor:
                cfg.id === 'free'
                  ? '#E5E7EB'
                  : isCurrent
                  ? '#C5D2A0'
                  : cfg.accent,
              opacity: pressed ? 0.85 : isCurrent ? 0.6 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.ctaText,
              { color: cfg.id === 'free' ? '#374151' : isCurrent ? '#2F3B25' : '#FFFFFF' },
            ]}
          >
            {isCurrent ? t('pricing.current') : cfg.id === 'free' ? t('pricing.current') : t('pricing.upgrade')}
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  const compareRows = (t('pricing.compareRows', { returnObjects: true }) as unknown) as string[][];
  const safeCompareRows = Array.isArray(compareRows) ? compareRows : [];
  const faqs = (t('pricing.faqs', { returnObjects: true }) as unknown) as { q: string; a: string }[];
  const safeFaqs = Array.isArray(faqs) ? faqs : [];

  const { width } = Dimensions.get('window');
  const isWide = width >= 720;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('pricing.heroTitle')}</Text>
          <Text style={styles.subtitle}>{t('pricing.heroSubtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PageHint hintId="pricing" title={t('pageHints.pricing.title')} description={t('pageHints.pricing.desc')} />
        <Animated.View style={[styles.currentCard, { opacity: fade }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.currentLabel}>{t('pricing.currentPlan')}</Text>
            <Text style={styles.currentValue}>
              {plan === 'free' ? t('pricing.free') : plan === 'pro_monthly' ? t('pricing.proMonthly') : t('pricing.proYearly')}
            </Text>
            {plan === 'free' && usage && (
              <Text style={styles.currentMeta}>
                {t('pricing.monthlyUsage', { count: usage.count, limit: usage.limit })}
              </Text>
            )}
            {plan !== 'free' && planStartedAt && (
              <Text style={styles.currentMeta}>
                {t('pricing.startedOn', { date: formatStartedDate(planStartedAt) })}
              </Text>
            )}
          </View>
          <View style={[styles.planPill, { backgroundColor: planPillBg() }]}>
            <Text style={styles.planPillText}>{planPillLabel()}</Text>
          </View>
        </Animated.View>

        <View style={[styles.cardsRow, isWide ? styles.cardsRowWide : styles.cardsRowNarrow]}>
          {PLAN_CARDS.map(renderCard)}
        </View>

        <View style={styles.compareCard}>
          <Text style={styles.compareTitle}>{t('pricing.compareTitle')}</Text>
          {safeCompareRows.map((row, idx) => (
            <View key={idx} style={[styles.compareRow, idx % 2 === 1 && styles.compareRowAlt]}>
              <Text style={styles.compareCellHead}>{row[0]}</Text>
              <Text style={styles.compareCell}>{row[1]}</Text>
              <Text style={styles.compareCell}>{row[2]}</Text>
              <Text style={styles.compareCell}>{row[3]}</Text>
            </View>
          ))}
          <View style={styles.compareHead}>
            <Text style={styles.compareCellHead}></Text>
            <Text style={styles.compareColHead}>{t('pricing.free')}</Text>
            <Text style={styles.compareColHead}>{t('pricing.proMonthly')}</Text>
            <Text style={styles.compareColHead}>{t('pricing.proYearly')}</Text>
          </View>
        </View>

        <View style={styles.faqCard}>
          <Text style={styles.compareTitle}>{t('pricing.faqTitle')}</Text>
          {safeFaqs.map((item, idx) => (
            <View key={idx} style={styles.faqItem}>
              <Text style={styles.faqQ}>❓ {item.q}</Text>
              <Text style={styles.faqA}>{item.a}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footerNote}>{t('pricing.footer')}</Text>
      </ScrollView>

      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => !processing && setConfirmOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {processing ? (
              <>
                <ActivityIndicator size="large" color="#2F3B25" />
                <Text style={styles.modalTitle}>{t('pricing.processing')}</Text>
                <Text style={styles.modalSub}>{t('pricing.waitPlease')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.modalEmoji}>💳</Text>
                <Text style={styles.modalTitle}>{t('pricing.confirmTitle')}</Text>
                <Text style={styles.modalSub}>
                  {selectedPlan === 'pro_monthly'
                    ? `${t('pricing.proMonthly')} · $7.99/${t('pricing.perMonth')}`
                    : `${t('pricing.proYearly')} · $54.99/${t('pricing.perYear')}`}
                </Text>
                <Text style={styles.modalNote}>{t('pricing.confirmNote')}</Text>
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => setConfirmOpen(false)}
                    style={[styles.modalBtn, styles.modalBtnSecondary]}
                  >
                    <Text style={[styles.modalBtnText, { color: '#374151' }]}>{t('pricing.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={confirmUpgrade}
                    style={[styles.modalBtn, { backgroundColor: '#2F3B25' }]}
                  >
                    <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>{t('pricing.approve')}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={successOpen} transparent animationType="fade" onRequestClose={() => setSuccessOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>🎉</Text>
            <Text style={styles.modalTitle}>{t('pricing.successTitle')}</Text>
            <Text style={styles.modalSub}>
              {t('pricing.successSub', {
                plan: selectedPlan === 'pro_yearly' ? t('pricing.proYearly') : t('pricing.proMonthly'),
              })}
            </Text>
            <Pressable
              onPress={() => {
                setSuccessOpen(false);
                router.back();
              }}
              style={[styles.modalBtn, { backgroundColor: '#22C55E' }]}
            >
              <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>{t('pricing.letsGo')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5C6B4F' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FAFCF6',
    borderBottomWidth: 1,
    borderBottomColor: '#C5D2A0',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F0DC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: { fontSize: 20, fontWeight: '700', color: '#2F3B25' },
  title: { fontSize: 22, fontWeight: '800', color: '#2F3B25' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  scroll: { padding: 20, paddingBottom: 60 },
  currentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFCF6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#C5D2A0',
  },
  currentLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700', letterSpacing: 0.5 },
  currentValue: { fontSize: 20, fontWeight: '800', color: '#2F3B25', marginTop: 2 },
  currentMeta: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  planPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  planPillText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  cardsRow: { gap: 14, marginBottom: 24 },
  cardsRowWide: { flexDirection: 'row' },
  cardsRowNarrow: { flexDirection: 'column' },
  planCard: {
    borderRadius: 18,
    padding: 18,
    position: 'relative',
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
    }),
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    left: '50%',
    transform: [{ translateX: -50 }],
  },
  popularBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  saveBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFF6E0',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F5A524',
  },
  saveBadgeText: { fontSize: 11, fontWeight: '700', color: '#A36300' },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
  },
  planName: { fontSize: 18, fontWeight: '800' },
  planBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  planBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  price: { fontSize: 32, fontWeight: '800' },
  period: { fontSize: 14, color: '#6B7280', marginLeft: 4 },
  divider: { height: 1, backgroundColor: 'rgba(47,59,37,0.12)', marginBottom: 12 },
  featureList: { gap: 8, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureCheck: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  featureText: { fontSize: 13, color: '#2F3B25', flex: 1, lineHeight: 18 },
  cta: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaText: { fontSize: 14, fontWeight: '800' },
  compareCard: {
    backgroundColor: '#FAFCF6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#C5D2A0',
  },
  compareTitle: { fontSize: 16, fontWeight: '800', color: '#2F3B25', marginBottom: 12 },
  compareHead: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#C5D2A0',
    marginTop: 6,
  },
  compareRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  compareRowAlt: { backgroundColor: '#F0F4ED' },
  compareCellHead: { flex: 1.6, fontSize: 12, fontWeight: '700', color: '#2F3B25' },
  compareColHead: { flex: 1, fontSize: 11, fontWeight: '800', color: '#2F3B25', textAlign: 'center' },
  compareCell: { flex: 1, fontSize: 12, color: '#374151', textAlign: 'center' },
  faqCard: {
    backgroundColor: '#FAFCF6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#C5D2A0',
  },
  faqItem: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  faqQ: { fontSize: 13, fontWeight: '700', color: '#2F3B25', marginBottom: 4 },
  faqA: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  footerNote: { fontSize: 12, color: '#E8E4D2', textAlign: 'center', marginTop: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(47, 59, 37, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FAFCF6',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  modalEmoji: { fontSize: 40, marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#2F3B25', marginBottom: 6 },
  modalSub: { fontSize: 14, color: '#374151', textAlign: 'center', marginBottom: 8, lineHeight: 20 },
  modalNote: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 16, fontStyle: 'italic' },
  modalActions: { flexDirection: 'row', gap: 8, width: '100%' },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnSecondary: { backgroundColor: '#E5E7EB' },
  modalBtnText: { fontSize: 14, fontWeight: '700' },
});