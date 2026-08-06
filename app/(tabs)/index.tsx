import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  getActiveNiche,
  setActiveNiche,
  getStreak,
  getStreakShields,
  recordStreakActivity,
  saveWeekToHistory,
  toggleFavorite,
  getFavorites,
  getDoneIdeas,
  toggleDone,
  getTodayDoneCount,
  bumpTodayDoneCount,
  getIdeaStats,
  IdeaStats,
  addCopyToHistory,
  getRecentCopies,
  CopyEntry,
  getWeeklyGoal,
  setWeeklyGoal,
  getCurrentWeekGoalProgress,
  incrementWeeklyGoalProgress,
  decrementWeeklyGoalProgress,
  WeeklyGoalProgress,
  WeeklyGoalTarget,
  getScheduleForDate,
  toggleScheduleEntry,
  ScheduleEntry,
  getDailyCard,
  getMonthlyUsage,
  getUserPlan,
  incrementMonthlyUsage,
  FREE_NICHE_LIMIT,
  MonthlyUsage,
  UserPlan,
} from '../../services/storage';
import { NicheId, WeeklyIdea, pickWeeklyIdeasFromPool, isWeekend, getBestTimeForToday, formatHHMM, formatDurationTR, formatLongDate, NICHE_TIME_BOOST } from '../../services/contentService';
import { generateWeeklyIdeasWithAIResult } from '../../services/aiService';
import AnimatedCard from '../../components/AnimatedCard';
import { NicheImage, getNiche } from '../../components/NicheImage';
import nichesData from '../../data/niches.json';
import * as Notifications from 'expo-notifications';
import { lightColors } from '../../styles/colors';
import { spacing } from '../../styles/spacing';
import PlanBadge from '../../components/PlanBadge';
import PaywallModal from '../../components/PaywallModal';
import { radius } from '../../styles/radius';
import { typography } from '../../styles/typography';
import { shadows } from '../../styles/shadows';

const getWeekId = (d: Date) => {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const millisInDay = 86400000;
  const dayOfYear = (d.getTime() - onejan.getTime() + ((onejan.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000)) / millisInDay;
  const weekNum = Math.ceil((dayOfYear + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [nichePickerOpen, setNichePickerOpen] = useState(false);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [dailyCardFlipped, setDailyCardFlipped] = useState(false);
  const dailyFlipAnim = useRef(new Animated.Value(0)).current;
  const [ideas, setIdeas] = useState<WeeklyIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<UserPlan>('free');
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<'idea_limit' | 'niche_limit'>('idea_limit');
  const [paywallNicheName, setPaywallNicheName] = useState<string | undefined>();
  const [planRefresh, setPlanRefresh] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [poolLoading, setPoolLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'info' | 'success' | 'warn'>('info');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [favSet, setFavSet] = useState<Set<string>>(new Set());
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set());
  const [todayDone, setTodayDone] = useState<number>(0);
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [ideaStats, setIdeaStats] = useState<IdeaStats | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [shields, setShields] = useState<number>(0);
  const [recentCopies, setRecentCopies] = useState<CopyEntry[]>([]);
  const [goalTarget, setGoalTarget] = useState<WeeklyGoalTarget>(5);
  const [goalProgress, setGoalProgress] = useState<WeeklyGoalProgress | null>(null);
  const [aiInfoMsg, setAiInfoMsg] = useState<string | null>(null);
  const [aiInfoVariant, setAiInfoVariant] = useState<'info' | 'success' | 'warn'>('info');
  const [todayPlan, setTodayPlan] = useState<ScheduleEntry[]>([]);
  const [dailyCardText, setDailyCardText] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const todayDateKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const weekId = useMemo(() => getWeekId(new Date()), []);
  const weekend = useMemo(() => isWeekend(new Date()), []);
  const daysToNextWeek = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    if (day === 1) return 7;
    const daysUntilMon = (8 - day) % 7;
    return daysUntilMon === 0 ? 7 : daysUntilMon;
  }, []);

  const loadPool = async (n: NicheId) => {
    const plan = await getUserPlan();
    setUserPlan(plan);
    if (plan === 'free') {
      const u = await getMonthlyUsage();
      setUsage(u);
      if (u.count >= u.limit) {
        setPaywallReason('idea_limit');
        setPaywallOpen(true);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    const picked = pickWeeklyIdeasFromPool(n, weekend);
    setIdeas(picked);
    setLoading(false);
    if (plan === 'free') {
      const u = await incrementMonthlyUsage(picked.length);
      setUsage(u);
    }
    await saveWeekToHistory({
      weekId,
      niche: n,
      ideas: picked.map((p) => ({ day: p.day, text: p.text, source: p.source })),
      createdAt: Date.now(),
    });
    const { count, shieldEarned, shieldUsed } = await recordStreakActivity();
    setStreak(count);
    setShields(await getStreakShields());
    if (shieldEarned) {
      Alert.alert('🛡 Yeni kalkan kazandın!', '7 gün üst üste ürettin. 1 streak kalkanı hesabına eklendi.');
    } else if (shieldUsed) {
      Alert.alert('🛡 Kalkan kullanıldı', 'Bir günü kaçırdın ama kalkanın seni korudu — serin devam ediyor.');
    }
  };

  useEffect(() => {
    (async () => {
      const n = await getActiveNiche();
      if (!n) {
        setLoading(false);
        return;
      }
      setNiche(n);
      const [s, favs, done, tdc, perm, stats, copies, goal, gProg, sh] = await Promise.all([
        getStreak(),
        getFavorites(),
        getDoneIdeas(),
        getTodayDoneCount(),
        Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' as const })),
        getIdeaStats(),
        getRecentCopies(),
        getWeeklyGoal(),
        getCurrentWeekGoalProgress(),
        getStreakShields(),
      ]);
      const status = perm?.status ?? 'undetermined';
      setStreak(s.count);
      setShields(sh);
      setFavSet(new Set(favs));
      setDoneSet(new Set(done));
      setTodayDone(tdc);
      setNotifStatus(status as 'granted' | 'denied' | 'undetermined');
      setIdeaStats(stats);
      setRecentCopies(copies);
      setGoalTarget(goal);
      setGoalProgress(gProg);
      await loadPool(n);
    })();
  }, []);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const interval = setInterval(tick, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadTodayPlan = useCallback(async () => {
    const list = await getScheduleForDate(todayDateKey);
    list.sort((a, b) => Number(a.done) - Number(b.done));
    setTodayPlan(list);
  }, [todayDateKey]);

  const loadDailyCard = useCallback(async (overrideNiche?: NicheId | null) => {
    const target = overrideNiche !== undefined ? overrideNiche : niche;
    const card = await getDailyCard(target);
    setDailyCardText(card.idea);
  }, [niche]);

  useFocusEffect(
    useCallback(() => {
      loadTodayPlan();
      loadDailyCard();
      (async () => {
        const [p, u, active] = await Promise.all([
          getUserPlan(),
          getMonthlyUsage(),
          getActiveNiche(),
        ]);
        setUserPlan(p);
        setUsage(u);
        if (active && active !== niche) {
          setNiche(active);
          setIdeas([]);
          setLoading(true);
          await loadPool(active);
        }
        setPlanRefresh((x) => x + 1);
      })();
    }, [loadTodayPlan, loadDailyCard, niche])
  );

  const refreshFromPool = async () => {
    if (!niche) return;
    setPoolLoading(true);
    await new Promise((r) => setTimeout(r, 350));
    await loadPool(niche);
    setPoolLoading(false);
    setToastVariant('success');
    setToastMsg(`📚 Havuzdan ${ideas.length} yeni fikir`);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const refreshFromAI = async () => {
    if (!niche) return;
    setAiLoading(true);
    setAiInfoMsg('⏳ AI düşünüyor...');
    setAiInfoVariant('info');
    setToastVariant('info');
    setToastMsg('⏳ AI düşünüyor...');
    setTimeout(() => setToastMsg(null), 2000);
    const currentTexts = ideas.map((i) => i.text);
    const result = await generateWeeklyIdeasWithAIResult(niche, currentTexts);
    if (result.ideas.length > 0) {
      setIdeas(result.ideas);
      await saveWeekToHistory({
        weekId,
        niche,
        ideas: result.ideas.map((a) => ({ day: a.day, text: a.text, source: a.source })),
        createdAt: Date.now(),
      });
      setIdeaStats(await getIdeaStats());
      if (result.fallbackUsed) {
        setAiInfoMsg('⚠️ AI şu an yanıt vermedi. Akıllı havuzdan yeni bir fikir seçildi.');
        setAiInfoVariant('warn');
        setToastVariant('warn');
        setToastMsg('⚠️ Havuzdan fikir seçildi');
      } else if (result.usedVariant && result.usedVariant !== 'detailed') {
        setAiInfoMsg(`🤖 AI "${result.usedVariant}" yedek prompt ile cevap verdi.`);
        setAiInfoVariant('info');
        setToastVariant('info');
        setToastMsg(`🤖 Yedek prompt ile ${result.ideas.length} fikir`);
      } else {
        setAiInfoMsg(`✨ Yeni fikir geldi (${result.ideas.length} adet)`);
        setAiInfoVariant('success');
        setToastVariant('success');
        setToastMsg(`✨ Yeni fikir geldi`);
      }
      setTimeout(() => setAiInfoMsg(null), 3000);
      setTimeout(() => setToastMsg(null), 2500);
    } else {
      setAiInfoMsg('⚠️ AI şu an yanıt vermedi. Akıllı havuzdan yeni bir fikir seçildi.');
      setAiInfoVariant('warn');
      setTimeout(() => setAiInfoMsg(null), 3000);
      Alert.alert('AI şu an cevap veremedi. Havuzdan yenilemeyi deneyin.');
    }
    setAiLoading(false);
  };

  const copyIdea = async (idx: number, text: string, source: 'pool' | 'ai' | 'detail' = 'pool') => {
    Clipboard.setString(text);
    setCopiedIdx(idx);
    const next = await addCopyToHistory(text, source);
    setRecentCopies(next);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const onFavorite = async (idea: string) => {
    await toggleFavorite(idea);
    setFavSet((prev) => {
      const next = new Set(prev);
      if (next.has(idea)) next.delete(idea);
      else next.add(idea);
      return next;
    });
  };

  const onDone = async (idea: string) => {
    const becomingDone = !doneSet.has(idea);
    await toggleDone(idea);
    setDoneSet((prev) => {
      const next = new Set(prev);
      if (next.has(idea)) next.delete(idea);
      else next.add(idea);
      return next;
    });
    if (becomingDone) {
      const c = await bumpTodayDoneCount();
      setTodayDone(c);
      const beforeAchieved = goalProgress?.achieved ?? false;
      const np = await incrementWeeklyGoalProgress();
      setGoalProgress(np);
      if (!beforeAchieved && np.achieved) {
        Alert.alert('🎉 Tebrikler!', `Bu haftaki hedefine ulaştın (${np.target} fikir).`);
      }
    } else {
      const np = await decrementWeeklyGoalProgress();
      setGoalProgress(np);
    }
  };

  const onPickGoal = () => {
    setGoalPickerOpen(true);
  };

  const applyGoal = async (n: WeeklyGoalTarget) => {
    await setWeeklyGoal(n);
    setGoalTarget(n);
    setGoalProgress(await getCurrentWeekGoalProgress());
    setGoalPickerOpen(false);
  };

  const openNichePicker = () => setNichePickerOpen(true);
  const closeNichePicker = () => setNichePickerOpen(false);

  const pickNicheInline = async (id: NicheId) => {
    if (id === niche) {
      setNichePickerOpen(false);
      return;
    }
    const plan = await getUserPlan();
    setUserPlan(plan);
    const nicheList = nichesData as { id: string }[];
    const usedNiches = nicheList.slice(0, FREE_NICHE_LIMIT).map((n) => n.id);
    const isFresh = !usedNiches.includes(id);
    if (plan === 'free' && isFresh) {
      const targetName = t(`niches.${id}`, id);
      setPaywallNicheName(targetName);
      setPaywallReason('niche_limit');
      setPaywallOpen(true);
      return;
    }
    await setActiveNiche(id);
    setNiche(id);
    setNichePickerOpen(false);
    setDailyCardText(null);
    setDailyCardFlipped(false);
    dailyFlipAnim.setValue(0);
    setIdeas([]);
    setLoading(true);
    setAiInfoMsg(null);
    setAiInfoMsg(`✨ Niş "${id}" olarak değişti. Yeni fikirler yükleniyor...`);
    setAiInfoVariant('info');
    setToastVariant('info');
    setToastMsg(`🔄 Niş değişti: yeni fikirler geliyor`);
    setTimeout(() => setToastMsg(null), 2200);
    setTimeout(() => setAiInfoMsg(null), 3500);
    await loadPool(id);
    await loadDailyCard(id);
  };

  const flipDailyCard = () => {
    const next = dailyCardFlipped ? 0 : 1;
    setDailyCardFlipped(!dailyCardFlipped);
    Animated.timing(dailyFlipAnim, {
      toValue: next,
      duration: 420,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const onShare = async (idea: string) => {
    try {
      await Share.share({
        message: `İçerik fikri: ${idea}`,
        title: 'Compass — İlham Pusulam',
      });
    } catch (e) {
      console.warn('share error', e);
    }
  };

  const onTogglePlanned = async (entry: ScheduleEntry) => {
    const becomingDone = !entry.done;
    await toggleScheduleEntry(entry.id);
    setTodayPlan((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, done: !e.done } : e)).sort((a, b) => Number(a.done) - Number(b.done))
    );
    if (becomingDone) {
      await toggleDone(entry.text);
      setDoneSet((prev) => {
        const next = new Set(prev);
        next.add(entry.text);
        return next;
      });
      const c = await bumpTodayDoneCount();
      setTodayDone(c);
      const beforeAchieved = goalProgress?.achieved ?? false;
      const np = await incrementWeeklyGoalProgress();
      setGoalProgress(np);
      if (!beforeAchieved && np.achieved) {
        Alert.alert('🎉 Tebrikler!', `Bu haftaki hedefine ulaştın (${np.target} fikir).`);
      }
    }
  };

  const openCalendar = () => {
    router.push('/(tabs)/calendar');
  };

  const openDetail = (idea: WeeklyIdea) => {
    router.push({
      pathname: '/idea/[text]',
      params: {
        text: encodeURIComponent(idea.text),
        niche: niche ?? '',
        day: idea.day,
        source: idea.source,
      },
    });
  };

  const askNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifStatus(status as 'granted' | 'denied' | 'undetermined');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={lightColors.primary} />
      </View>
    );
  }

  if (!niche) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('home.noIdeas')}</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('home.weeklyTitle')}</Text>
          <Text style={styles.subtitle}>{t('home.weeklySubtitle', { count: ideas.length })}</Text>
        </View>
        <Pressable onPress={() => router.push('/search')} style={styles.searchBtn} hitSlop={6}>
          <Text style={styles.searchBtnTxt}>🔎</Text>
        </Pressable>
        {shields > 0 && (
          <View style={styles.shieldBadge}>
            <Text style={styles.shieldIcon}>🛡</Text>
            <Text style={styles.shieldText}>{shields}</Text>
          </View>
        )}
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakIcon}>🔥</Text>
            <Text style={styles.streakText}>{streak}</Text>
          </View>
        )}
        {userPlan === 'free' && usage && (
          <Pressable onPress={() => router.push('/pricing')} style={styles.streakBadge}>
            <Text style={styles.streakText}>💡 {usage.count}/{usage.limit}</Text>
          </Pressable>
        )}
        <View style={styles.weekBadge}>
          <Text style={styles.weekBadgeText}>{weekId}</Text>
        </View>
      </View>

      {niche && (
        <View style={styles.nicheHeroCard}>
          <NicheImage nicheId={niche} size={72} borderRadius={18} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.nicheHeroLabel}>BU HAFTANIN NİŞİ</Text>
              <PlanBadge size="sm" refreshKey={planRefresh} />
            </View>
            <Text style={styles.nicheHeroTitle}>{t(`niches.${niche}`, niche)}</Text>
            <Text style={styles.nicheHeroSub}>{nichesData.find((x) => x.id === niche)?.description ?? ''}</Text>
          </View>
          <Pressable onPress={openNichePicker} style={styles.nicheHeroBtn} hitSlop={6}>
            <Text style={styles.nicheHeroBtnText}>Değiştir</Text>
          </Pressable>
        </View>
      )}

      {niche && (() => {
        const bestT = getBestTimeForToday(niche, now);
        const nicheColor = (nichesData.find((x) => x.id === niche)?.color) ?? lightColors.primary;
        const slots = NICHE_TIME_BOOST[niche] ?? [];
        const slotLabelKey = `home.${bestT.slot.label}Slot`;
        return (
          <View style={[styles.timeWidget, { borderColor: nicheColor + '55' }]}>
            <View style={[styles.timeWidgetGradient, { backgroundColor: nicheColor + '12' }]}>
              <View style={styles.timeWidgetRow}>
                <View style={styles.timeWidgetCol}>
                  <Text style={[styles.timeWidgetBadge, { color: nicheColor }]}>{t('home.nowBadge')}</Text>
                  <Text style={styles.timeWidgetTime}>{formatHHMM(now.getHours(), now.getMinutes())}</Text>
                  <Text style={styles.timeWidgetDate}>{formatLongDate(now)}</Text>
                </View>
                <View style={[styles.timeWidgetDivider, { backgroundColor: nicheColor + '40' }]} />
                <View style={styles.timeWidgetCol}>
                  <Text style={[styles.timeWidgetBadge, { color: nicheColor }]}>{t('home.bestTimeBadge')}</Text>
                  <Text style={styles.timeWidgetTime}>{formatHHMM(bestT.hour, bestT.minute)}</Text>
                  <Text style={styles.timeWidgetDate}>
                    {bestT.isNow ? '🔥 ' + t('home.onAir') : `🎯 ${t('home.goldHourIn')} ${formatDurationTR(bestT.minutesUntil)}`}
                  </Text>
                </View>
              </View>
              <View style={styles.timeWidgetSlotsRow}>
                {slots.map((s, i) => {
                  const active = bestT.slot === s;
                  return (
                    <View
                      key={`slot-${i}`}
                      style={[
                        styles.timeWidgetSlot,
                        active && { backgroundColor: nicheColor, borderColor: nicheColor },
                      ]}
                    >
                      <Text style={[styles.timeWidgetSlotLabel, active && { color: '#FFFFFF' }]}>
                        {t(slotLabelKey, s.label)}
                      </Text>
                      <Text style={[styles.timeWidgetSlotRange, active && { color: '#FFFFFFCC' }]}>
                        {formatHHMM(s.start, 0)}–{formatHHMM(s.end, 0)}
                      </Text>
                      <View style={styles.timeWidgetSlotBar}>
                        <View
                          style={[
                            styles.timeWidgetSlotBarFill,
                            {
                              width: `${s.weight * 10}%`,
                              backgroundColor: active ? '#FFFFFF' : nicheColor,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
              <Pressable onPress={() => router.push('/(tabs)/calendar')} style={[styles.timeWidgetCta, { backgroundColor: nicheColor }]}>
                <Text style={styles.timeWidgetCtaText}>📅 {t('home.addToCalendar')}</Text>
              </Pressable>
            </View>
          </View>
        );
      })()}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.nicheScroller}
      >
        {nichesData.map((n) => {
          const active = n.id === niche;
          return (
            <Pressable
              key={n.id}
              onPress={() => pickNicheInline(n.id as NicheId)}
              style={[
                styles.nicheChip,
                { borderColor: active ? n.color : 'rgba(255,255,255,0.4)' },
              ]}
            >
              <NicheImage nicheId={n.id} size={44} borderRadius={10} />
              <Text style={styles.nicheChipLabel} numberOfLines={1}>
                {t(`niches.${n.id}`, n.id)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {notifStatus !== 'granted' && (
        <Pressable
          onPress={askNotifications}
          style={[
            styles.notifPill,
            notifStatus === 'denied' ? styles.notifPillBad : null,
          ]}
        >
          <Text style={styles.notifPillText}>
            {notifStatus === 'denied' ? '🔕 Bildirimler kapalı' : '🔔 Bildirim izni ver'}
          </Text>
          <Text style={styles.notifPillHint}>
            {notifStatus === 'denied' ? 'Ayarlardan açabilirsin' : 'Hatırlatma alabilmek için dokun'}
          </Text>
        </Pressable>
      )}

      {streak === 0 && daysToNextWeek > 0 && (
        <View style={styles.countdownPill}>
          <Text style={styles.countdownText}>
            🗓 Yeni haftaya {daysToNextWeek} gün var. Şimdiden fikir biriktirmeye başla!
          </Text>
        </View>
      )}

      {todayDone > 0 && (
        <View style={styles.todayPill}>
          <Text style={styles.todayPillText}>Bugün {todayDone} fikir ürettin</Text>
        </View>
      )}

      {goalProgress && (
        <View style={[styles.goalCard, goalProgress.achieved && styles.goalCardAchieved]}>
          <View style={styles.goalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.goalTitle}>
                {goalProgress.achieved ? '🏆 Hedefe ulaştın!' : '🎯 Haftalık hedef'}
              </Text>
              <Text style={styles.goalSubtitle}>
                {goalProgress.completed}/{goalProgress.target} fikir üretildi · {weekId}
              </Text>
            </View>
            <Pressable onPress={onPickGoal} style={styles.goalPickBtn}>
              <Text style={styles.goalPickBtnText}>Değiştir</Text>
            </Pressable>
          </View>
          <View style={styles.goalBarBg}>
            <View
              style={[
                styles.goalBarFill,
                {
                  width: `${Math.min(100, Math.round((goalProgress.completed / goalProgress.target) * 100))}%`,
                  backgroundColor: goalProgress.achieved ? lightColors.success.solid : lightColors.primary,
                },
              ]}
            />
          </View>
          <View style={styles.goalTickRow}>
            {[...Array(goalProgress.target)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.goalTick,
                  i < goalProgress.completed && styles.goalTickOn,
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {dailyCardText && (() => {
        const nicheColor = (nichesData.find((x) => x.id === niche)?.color) ?? lightColors.secondary;
        const dailyRotate = dailyFlipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
        return (
          <Pressable
            onPress={flipDailyCard}
            style={[styles.dailyCard, { backgroundColor: nicheColor + '18', borderColor: nicheColor }]}
          >
            <View style={styles.dailyCardHead}>
              <Text style={[styles.dailyCardBadge, { color: nicheColor }]}>🌟 GÜNÜN KARTI</Text>
              <Animated.Text style={[styles.dailyCardChev, { transform: [{ rotate: dailyRotate }] }]}>
                ↻
              </Animated.Text>
            </View>
            <Text style={styles.dailyCardText} numberOfLines={3}>
              {dailyCardFlipped ? '✨ Detaylı açıyı görmek için tam ekranı aç' : dailyCardText}
            </Text>
            <Text style={styles.dailyCardHint}>
              {dailyCardFlipped ? '↩ Geri çevirmek için tekrar dokun' : 'Çevirmek için karta dokun ↻'}
            </Text>
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); router.push({ pathname: '/daily-card', params: { niche: niche ?? '' } }); }}
              hitSlop={8}
              style={[styles.dailyCardOpenBtn, { backgroundColor: nicheColor }]}
            >
              <Text style={styles.dailyCardOpenBtnText}>Tam ekran ›</Text>
            </Pressable>
          </Pressable>
        );
      })()}

      <Pressable
        onPress={() => router.push('/mood')}
        style={styles.moodEntryCard}
      >
        <View style={styles.moodEntryLeft}>
          <Text style={styles.moodEntryBadge}>🎭 RUH HALİNE GÖRE</Text>
          <Text style={styles.moodEntryTitle}>Bugün nasıl hissediyorsun?</Text>
          <Text style={styles.moodEntrySub}>6 farklı tonda fikir — enerjikten sakine, yorgundan eğlenceliye</Text>
          <View style={styles.moodEntryChips}>
            <Text style={styles.moodChip}>⚡️</Text>
            <Text style={styles.moodChip}>🌿</Text>
            <Text style={styles.moodChip}>🎨</Text>
            <Text style={styles.moodChip}>🌙</Text>
            <Text style={styles.moodChip}>📖</Text>
            <Text style={styles.moodChip}>🎉</Text>
            <Text style={styles.moodChipText}>+ daha fazla</Text>
          </View>
        </View>
        <Text style={styles.moodEntryChev}>›</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/pomodoro')}
        style={styles.pomodoroEntryCard}
      >
        <View style={styles.pomodoroEntryLeft}>
          <Text style={styles.pomodoroEntryBadge}>⏱ ODAKLANMA</Text>
          <Text style={styles.pomodoroEntryTitle}>Pomodoro Zamanlayıcısı</Text>
          <Text style={styles.pomodoroEntrySub}>25dk odak · 5dk mola — fikirle birlikte çalış</Text>
        </View>
        <View style={styles.pomodoroEntryRight}>
          <Text style={styles.pomodoroEntryIcon}>⏱</Text>
          <Text style={styles.pomodoroEntryChev}>›</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => router.push('/hooks')}
        style={styles.hooksEntryCard}
      >
        <View style={styles.hooksEntryLeft}>
          <Text style={styles.hooksEntryBadge}>🎣 HOOK ÜRETİCİ</Text>
          <Text style={styles.hooksEntryTitle}>Dikkat çeken açılışlar</Text>
          <Text style={styles.hooksEntrySub}>6 stil × 5 format — 30 hook bir tıkla</Text>
        </View>
        <View style={styles.hooksEntryRight}>
          <Text style={styles.hooksEntryIcon}>🎣</Text>
          <Text style={styles.hooksEntryChev}>›</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => router.push('/calendar')}
        style={styles.calendarEntryCard}
      >
        <View style={styles.calendarEntryLeft}>
          <Text style={styles.calendarEntryBadge}>📅 İÇERİK TAKVİMİ</Text>
          <Text style={styles.calendarEntryTitle}>En iyi paylaşım zamanları</Text>
          <Text style={styles.calendarEntrySub}>Niche özel skor — slot planlayıcı</Text>
        </View>
        <View style={styles.calendarEntryRight}>
          <Text style={styles.calendarEntryIcon}>📅</Text>
          <Text style={styles.calendarEntryChev}>›</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => router.push('/repurpose')}
        style={styles.repurposeEntryCard}
      >
        <View style={styles.repurposeEntryLeft}>
          <Text style={styles.repurposeEntryBadge}>♻️ REPURPOSE ENGINE</Text>
          <Text style={styles.repurposeEntryTitle}>Bir içeriği 8 platforma taşı</Text>
          <Text style={styles.repurposeEntrySub}>Caption + hashtag + format önerisi</Text>
        </View>
        <View style={styles.repurposeEntryRight}>
          <Text style={styles.repurposeEntryIcon}>♻️</Text>
          <Text style={styles.repurposeEntryChev}>›</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => router.push('/content-series')}
        style={styles.contentSeriesEntryCard}
      >
        <View style={styles.contentSeriesEntryLeft}>
          <Text style={styles.contentSeriesEntryBadge}>🎬 CONTENT SERIES</Text>
          <Text style={styles.contentSeriesEntryTitle}>7 bölümlük seri planla</Text>
          <Text style={styles.contentSeriesEntrySub}>Anlatı arkı + bölüm senaryosu</Text>
        </View>
        <View style={styles.contentSeriesEntryRight}>
          <Text style={styles.contentSeriesEntryIcon}>🎬</Text>
          <Text style={styles.contentSeriesEntryChev}>›</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => router.push('/persona')}
        style={styles.personaEntryCard}
      >
        <View style={styles.personaEntryLeft}>
          <Text style={styles.personaEntryBadge}>🎯 AUDIENCE PERSONA</Text>
          <Text style={styles.personaEntryTitle}>Kime yazıyorsun?</Text>
          <Text style={styles.personaEntrySub}>Ton + kelime hazinesi + hook kalıbı</Text>
        </View>
        <View style={styles.personaEntryRight}>
          <Text style={styles.personaEntryIcon}>🎯</Text>
          <Text style={styles.personaEntryChev}>›</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => router.push('/performance')}
        style={styles.performanceEntryCard}
      >
        <View style={styles.performanceEntryLeft}>
          <Text style={styles.performanceEntryBadge}>📊 PERFORMANCE TRACKER</Text>
          <Text style={styles.performanceEntryTitle}>İçerik performansını analiz et</Text>
          <Text style={styles.performanceEntrySub}>Platform + format + hook kazananları</Text>
        </View>
        <View style={styles.performanceEntryRight}>
          <Text style={styles.performanceEntryIcon}>📊</Text>
          <Text style={styles.performanceEntryChev}>›</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => router.push('/idea-bank')}
        style={styles.ideaBankEntryCard}
      >
        <View style={styles.ideaBankEntryLeft}>
          <Text style={styles.ideaBankEntryBadge}>💡 IDEA BANK / FİKİR HAVUZU</Text>
          <Text style={styles.ideaBankEntryTitle}>Fikirlerini biriktir, organize et</Text>
          <Text style={styles.ideaBankEntrySub}>Ham fikir → geliştirme → hazır → kullanıldı</Text>
        </View>
        <View style={styles.ideaBankEntryRight}>
          <Text style={styles.ideaBankEntryIcon}>💡</Text>
          <Text style={styles.ideaBankEntryChev}>›</Text>
        </View>
      </Pressable>

      {recentCopies.length > 0 && (
        <View style={styles.recentCopiesBox}>
          <View style={styles.recentCopiesHead}>
            <Text style={styles.recentCopiesTitle}>📋 Son kopyalananlar</Text>
            <Text style={styles.recentCopiesCount}>{recentCopies.length}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
            {recentCopies.slice(0, 8).map((c, i) => (
              <Pressable
                key={`${c.copiedAt}-${i}`}
                onPress={() => copyIdea(i + 1000, c.text, c.source)}
                style={styles.recentCopyChip}
              >
                <Text style={styles.recentCopyText} numberOfLines={1}>{c.text}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {weekend && (
        <View style={styles.weekendBanner}>
          <Text style={styles.weekendTitle}>� Hafta sonu modu</Text>
          <Text style={styles.weekendSub}>Sana ekstra bir bonus fikir ekledik. İyi içerikler!</Text>
        </View>
      )}

      {todayPlan.length > 0 && (
        <View style={styles.todayPlanCard}>
          <View style={styles.todayPlanHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayPlanTitle}>📅 Bugünün planı</Text>
              <Text style={styles.todayPlanSub}>
                {todayPlan.filter((e) => e.done).length}/{todayPlan.length} tamamlandı
              </Text>
            </View>
            <Pressable onPress={() => router.push('/weekly-planner')} style={styles.todayPlanWeekBtn}>
              <Text style={styles.todayPlanWeekBtnText}>Haftayı Planla</Text>
            </Pressable>
            <Pressable onPress={openCalendar} style={styles.todayPlanOpenBtn}>
              <Text style={styles.todayPlanOpenBtnText}>Takvim →</Text>
            </Pressable>
          </View>
          {todayPlan.slice(0, 4).map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => onTogglePlanned(entry)}
              style={[styles.todayPlanItem, entry.done && styles.todayPlanItemDone]}
            >
              <View style={[styles.todayPlanCheck, entry.done && styles.todayPlanCheckDone]}>
                <Text style={[styles.todayPlanCheckText, entry.done && styles.todayPlanCheckTextDone]}>
                  {entry.done ? '✓' : ''}
                </Text>
              </View>
              <Text style={[styles.todayPlanItemText, entry.done && styles.todayPlanItemTextDone]} numberOfLines={2}>
                {entry.text}
              </Text>
            </Pressable>
          ))}
          {todayPlan.length > 4 && (
            <Text style={styles.todayPlanMore}>+{todayPlan.length - 4} daha — takvime git</Text>
          )}
        </View>
      )}

      {aiInfoMsg && (
        <Pressable
          onPress={() => setAiInfoMsg(null)}
          style={[
            styles.aiInfoBanner,
            aiInfoVariant === 'success' && styles.aiInfoBannerSuccess,
            aiInfoVariant === 'warn' && styles.aiInfoBannerWarn,
            aiInfoVariant === 'info' && styles.aiInfoBannerInfo,
          ]}
        >
          <Text
            style={[
              styles.aiInfoText,
              aiInfoVariant === 'success' && styles.aiInfoTextSuccess,
              aiInfoVariant === 'warn' && styles.aiInfoTextWarn,
              aiInfoVariant === 'info' && styles.aiInfoTextInfo,
            ]}
          >
            {aiInfoMsg}
          </Text>
          <Text
            style={[
              styles.aiInfoDismiss,
              aiInfoVariant === 'success' && { color: lightColors.success.text },
              aiInfoVariant === 'warn' && { color: lightColors.warning.text },
              aiInfoVariant === 'info' && { color: lightColors.info.text },
            ]}
          >
            ✕
          </Text>
        </Pressable>
      )}

      {ideas.length > 0 && (
        <AnimatedCard index={0}>
          <Pressable
            style={[styles.heroCard, doneSet.has(ideas[0].text) && styles.heroCardDone]}
            onPress={() => onDone(ideas[0].text)}
          >
            <Text style={styles.heroLabel}>{doneSet.has(ideas[0].text) ? '✓ ÜRETILDI' : '⭐ Haftanın fikri'}</Text>
            <Text style={[styles.heroText, doneSet.has(ideas[0].text) && styles.heroTextDone]} numberOfLines={3}>{ideas[0].text}</Text>
            <View style={styles.heroFooter}>
              <Text style={styles.heroHint}>Karta dokun → {doneSet.has(ideas[0].text) ? 'geri al' : 'üretildi olarak işaretle'}</Text>
              <Text style={styles.heroDay}>{t(`home.${ideas[0].day}`)}</Text>
            </View>
          </Pressable>
        </AnimatedCard>
      )}

      {(poolLoading || aiLoading) && (
        <View style={styles.skeletonCard}>
          <View style={styles.skeletonPulse}>
            <Text style={styles.skeletonIcon}>💡</Text>
            <Text style={styles.skeletonTitle}>{aiLoading ? '✨ AI düşünüyor…' : '📚 Yeni fikirler hazırlanıyor…'}</Text>
            <Text style={styles.skeletonSub}>Yaklaşık 1-2 saniye</Text>
          </View>
          {[0, 1, 2].map((i) => (
            <View key={`skel-${i}`} style={[styles.skeletonRow, i === 0 && { marginTop: 10 }]}>
              <View style={[styles.skeletonBar, { width: '40%' }]} />
              <View style={[styles.skeletonBar, { width: '92%', marginTop: 6 }]} />
              <View style={[styles.skeletonBar, { width: '70%', marginTop: 6 }]} />
            </View>
          ))}
        </View>
      )}

      {!poolLoading && !aiLoading && ideas.slice(1).map((idea, idx) => {
        const isFav = favSet.has(idea.text);
        const isDone = doneSet.has(idea.text);
        const renderRight = () => (
          <View style={styles.swipeRight}>
            <Text style={styles.swipeText}>🗒 KOPYALA</Text>
          </View>
        );
        const renderLeft = () => (
          <View style={[styles.swipeLeft, isFav ? styles.swipeLeftOn : null]}>
            <Text style={styles.swipeText}>{isFav ? '★ ÇIKAR' : '☆ FAV'}</Text>
          </View>
        );
        return (
          <AnimatedCard key={`${idea.day}-${idx}`} index={idx + 1}>
            <Swipeable
              renderRightActions={renderRight}
              renderLeftActions={renderLeft}
              onSwipeableRightOpen={() => copyIdea(idx, idea.text, idea.source)}
              onSwipeableLeftOpen={() => onFavorite(idea.text)}
              overshootRight={false}
              overshootLeft={false}
            >
              <Pressable
                style={[styles.card, isDone && styles.cardDone]}
                onPress={() => openDetail(idea)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.dayBadge}>{t(`home.${idea.day}`)}</Text>
                  <View style={styles.cardActions}>
                    <Text style={styles.sourceBadge}>{idea.source === 'ai' ? '✨ AI' : '📚 Pool'}</Text>
                    <Pressable
                      onPress={() => onDone(idea.text)}
                      style={[styles.iconBtn, isDone && styles.iconBtnDone]}
                    >
                      <Text style={[styles.iconBtnText, isDone && { color: lightColors.textInverse }]}>
                        {isDone ? '✓' : '◻'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => onFavorite(idea.text)} style={styles.iconBtn}>
                      <Text style={[styles.iconBtnText, isFav && { color: lightColors.warning.solid }]}>
                        {isFav ? '★' : '☆'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => onShare(idea.text)} style={styles.iconBtn}>
                      <Text style={styles.iconBtnText}>↗</Text>
                    </Pressable>
                    <Pressable onPress={() => copyIdea(idx, idea.text, idea.source)} style={styles.iconBtn}>
                      <Text style={styles.iconBtnText}>{copiedIdx === idx ? '✓' : '�'}</Text>
                    </Pressable>
                  </View>
                </View>
                <Text style={[styles.ideaText, isDone && styles.ideaTextDone]}>{idea.text}</Text>
                {copiedIdx === idx && <Text style={styles.copiedHint}>Kopyalandı</Text>}
                {isDone && <Text style={styles.doneHint}>Üretildi</Text>}
              </Pressable>
            </Swipeable>
          </AnimatedCard>
        );
      })}

      {ideaStats && ideaStats.totalIdeas > 0 && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>📊 Fikir istatistiklerin</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{ideaStats.totalIdeas}</Text>
              <Text style={styles.statLabel}>Toplam</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{ideaStats.uniqueIdeas}</Text>
              <Text style={styles.statLabel}>Benzersiz</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {ideaStats.mostFrequentDayLabel ?? '—'}
              </Text>
              <Text style={styles.statLabel}>En aktif gün</Text>
            </View>
          </View>
          {ideaStats.mostFrequentIdea && ideaStats.mostFrequentIdea.count > 1 && (
            <View style={styles.favIdeaBox}>
              <Text style={styles.favIdeaLabel}>Sık çıkan fikir</Text>
              <Text style={styles.favIdeaText} numberOfLines={2}>{ideaStats.mostFrequentIdea.text}</Text>
              <Text style={styles.favIdeaCount}>{ideaStats.mostFrequentIdea.count} kez üretildi</Text>
            </View>
          )}
        </View>
      )}

      {toastMsg && (
        <View
          style={[
            styles.toast,
            toastVariant === 'success' && styles.toastSuccess,
            toastVariant === 'warn' && styles.toastWarn,
            toastVariant === 'info' && styles.toastInfo,
          ]}
        >
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.btnAlt]} onPress={refreshFromPool} disabled={poolLoading}>
          <Text style={styles.btnAltText}>{poolLoading ? '...' : t('home.poolButton')}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={refreshFromAI} disabled={aiLoading || poolLoading}>
          {aiLoading ? (
            <ActivityIndicator color={lightColors.textInverse} />
          ) : (
            <Text style={styles.btnText}>{t('home.aiButton')}</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>

    {nichePickerOpen && (
      <InlineNichePicker
        currentNiche={niche}
        niches={nichesData}
        onClose={closeNichePicker}
        onPick={pickNicheInline}
        title="Bu haftanın nişini değiştir"
        t={t}
      />
    )}

    {goalPickerOpen && (
      <InlineGoalPicker
        currentTarget={goalTarget}
        onClose={() => setGoalPickerOpen(false)}
        onPick={applyGoal}
      />
    )}

    <PaywallModal
      visible={paywallOpen}
      onClose={() => setPaywallOpen(false)}
      usage={usage}
      reason={paywallReason}
      nicheName={paywallNicheName}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lightColors.bg },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: lightColors.bg,
  },
  emptyText: {
    ...typography.body,
    color: lightColors.textMuted,
  },
  nicheHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    padding: 14,
    borderRadius: 18,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    ...shadows.sm,
  },
  nicheHeroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: lightColors.primary,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  nicheHeroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: lightColors.text,
  },
  nicheHeroSub: {
    fontSize: 11,
    color: lightColors.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },
  nicheHeroBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: lightColors.primarySoft,
  },
  nicheHeroBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: lightColors.primary,
  },
  nicheScroller: {
    paddingVertical: 4,
    paddingBottom: spacing.md,
    gap: 8,
  },
  nicheChip: {
    width: 78,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: lightColors.surface,
    alignItems: 'center',
    marginRight: 8,
  },
  nicheChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: lightColors.text,
    marginTop: 4,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing['4xl'],
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: lightColors.text,
  },
  subtitle: {
    ...typography.bodySm,
    color: lightColors.textMuted,
    marginTop: spacing.xs,
  },
  weekBadge: {
    backgroundColor: lightColors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  weekBadgeText: {
    ...typography.caption,
    color: lightColors.primary,
    fontWeight: '700',
  },
  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: lightColors.surface,
    borderWidth: 1.5,
    borderColor: lightColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  searchBtnTxt: { fontSize: 16 },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.warning.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  streakIcon: { fontSize: 12, marginRight: spacing.xs },
  streakText: {
    ...typography.caption,
    color: lightColors.warning.text,
    fontWeight: '800',
  },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.info.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
  shieldIcon: { fontSize: 12, marginRight: spacing.xs },
  shieldText: {
    ...typography.caption,
    color: lightColors.info.text,
    fontWeight: '800',
  },
  card: {
    backgroundColor: lightColors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dayBadge: {
    ...typography.caption,
    color: lightColors.primary,
    fontWeight: '700',
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: lightColors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnText: {
    fontSize: 14,
    color: lightColors.primary,
    fontWeight: '700',
  },
  ideaText: {
    ...typography.body,
    color: lightColors.text,
    fontWeight: '600',
  },
  sourceBadge: {
    ...typography.caption,
    color: lightColors.textMuted,
    backgroundColor: lightColors.inputBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  copiedHint: {
    marginTop: spacing.sm,
    ...typography.caption,
    color: lightColors.success.text,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  btn: {
    flex: 1,
    backgroundColor: lightColors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  btnText: {
    color: lightColors.textInverse,
    fontWeight: '700',
  },
  btnAlt: {
    backgroundColor: lightColors.surface,
    borderWidth: 1,
    borderColor: lightColors.primary,
  },
  btnAltText: {
    color: lightColors.primary,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: lightColors.primary,
    padding: spacing.xl,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    ...shadows.md,
    shadowColor: lightColors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  heroLabel: {
    ...typography.caption,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  heroText: {
    fontSize: 18,
    fontWeight: '700',
    color: lightColors.textInverse,
    lineHeight: 24,
  },
  heroTextDone: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  heroCardDone: {
    backgroundColor: lightColors.success.solid,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  heroHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontStyle: 'italic',
  },
  heroDay: {
    fontSize: 11,
    fontWeight: '700',
    color: lightColors.textInverse,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  swipeRight: {
    backgroundColor: lightColors.success.solid,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: spacing['2xl'],
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    width: 140,
  },
  swipeLeft: {
    backgroundColor: lightColors.warning.solid,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: spacing['2xl'],
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    width: 140,
  },
  swipeLeftOn: {
    backgroundColor: lightColors.warning.text,
  },
  swipeText: {
    color: lightColors.textInverse,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  todayPill: {
    alignSelf: 'flex-start',
    backgroundColor: lightColors.success.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  todayPillText: {
    ...typography.caption,
    color: lightColors.success.text,
    fontWeight: '700',
  },
  notifPill: {
    backgroundColor: lightColors.info.bg,
    borderColor: lightColors.info.border,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  notifPillBad: {
    backgroundColor: lightColors.error.bg,
    borderColor: lightColors.error.border,
  },
  notifPillText: {
    ...typography.label,
    color: lightColors.info.text,
  },
  notifPillHint: {
    ...typography.caption,
    color: lightColors.textMuted,
    marginTop: 2,
  },
  countdownPill: {
    backgroundColor: lightColors.success.bg,
    borderColor: lightColors.success.border,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  countdownText: {
    ...typography.label,
    color: lightColors.success.text,
  },
  recentCopiesBox: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  recentCopiesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  recentCopiesTitle: {
    ...typography.caption,
    fontWeight: '800',
    color: lightColors.text,
    letterSpacing: 0.5,
  },
  recentCopiesCount: {
    ...typography.caption,
    color: lightColors.textMuted,
    fontWeight: '700',
    backgroundColor: lightColors.inputBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  recentScroll: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recentCopyChip: {
    backgroundColor: lightColors.inputBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    maxWidth: 220,
  },
  recentCopyText: {
    ...typography.caption,
    color: lightColors.text,
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: lightColors.surface,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    ...shadows.sm,
  },
  statsTitle: {
    ...typography.label,
    fontWeight: '800',
    color: lightColors.text,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.numeric,
    fontSize: 18,
    color: lightColors.primary,
    marginBottom: 2,
  },
  statLabel: {
    ...typography.caption,
    color: lightColors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  favIdeaBox: {
    backgroundColor: lightColors.inputBg,
    borderLeftWidth: 3,
    borderLeftColor: lightColors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  favIdeaLabel: {
    ...typography.caption,
    fontWeight: '800',
    color: lightColors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  favIdeaText: {
    ...typography.bodySm,
    color: lightColors.text,
    fontWeight: '600',
    lineHeight: 18,
  },
  favIdeaCount: {
    ...typography.caption,
    color: lightColors.success.text,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  weekendBanner: {
    backgroundColor: lightColors.warning.bg,
    borderColor: lightColors.warning.border,
    borderWidth: 1,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  weekendTitle: {
    ...typography.label,
    fontWeight: '800',
    color: lightColors.warning.text,
    marginBottom: spacing.xs,
  },
  weekendSub: {
    ...typography.caption,
    color: lightColors.warning.text,
  },
  cardDone: {
    opacity: 0.6,
    borderColor: lightColors.success.solid,
    borderWidth: 1.5,
  },
  ideaTextDone: {
    textDecorationLine: 'line-through',
    color: lightColors.textMuted,
  },
  iconBtnDone: {
    backgroundColor: lightColors.success.solid,
  },
  doneHint: {
    marginTop: spacing.sm,
    ...typography.caption,
    color: lightColors.success.text,
    fontWeight: '700',
  },
  goalCard: {
    backgroundColor: lightColors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: lightColors.border,
    ...shadows.sm,
  },
  goalCardAchieved: {
    backgroundColor: lightColors.success.bg,
    borderColor: lightColors.success.solid,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  goalTitle: {
    ...typography.label,
    fontWeight: '800',
    color: lightColors.text,
  },
  goalSubtitle: {
    ...typography.caption,
    color: lightColors.textMuted,
    marginTop: 2,
  },
  goalPickBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: lightColors.primarySoft,
  },
  goalPickBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: lightColors.primary,
  },
  goalBarBg: {
    height: 8,
    backgroundColor: lightColors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  goalBarFill: {
    height: 8,
    borderRadius: 4,
  },
  goalTickRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  goalTick: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: lightColors.border,
  },
  goalTickOn: {
    backgroundColor: lightColors.success.solid,
  },
  aiInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.info.bg,
    borderColor: lightColors.info.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  aiInfoText: {
    flex: 1,
    ...typography.caption,
    color: lightColors.info.text,
    fontWeight: '700',
  },
  aiInfoDismiss: {
    fontSize: 14,
    color: lightColors.info.text,
    fontWeight: '800',
    marginLeft: spacing.sm,
  },
  aiInfoBannerSuccess: {
    backgroundColor: lightColors.success.bg,
    borderColor: lightColors.success.solid,
  },
  aiInfoTextSuccess: {
    color: lightColors.success.text,
  },
  aiInfoBannerWarn: {
    backgroundColor: lightColors.warning.bg,
    borderColor: lightColors.warning.solid,
  },
  aiInfoTextWarn: {
    color: lightColors.warning.text,
  },
  aiInfoBannerInfo: {
    backgroundColor: lightColors.info.bg,
    borderColor: lightColors.info.border,
  },
  aiInfoTextInfo: {
    color: lightColors.info.text,
  },
  todayPlanCard: {
    backgroundColor: lightColors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: lightColors.border,
    ...shadows.sm,
  },
  todayPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  todayPlanTitle: {
    ...typography.label,
    fontWeight: '800',
    color: lightColors.text,
  },
  todayPlanSub: {
    ...typography.caption,
    color: lightColors.textMuted,
    marginTop: 2,
  },
  todayPlanOpenBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: lightColors.primarySoft,
  },
  todayPlanOpenBtnText: {
    ...typography.caption,
    color: lightColors.primary,
    fontWeight: '800',
  },
  todayPlanWeekBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: lightColors.secondary,
    marginRight: spacing.xs,
  },
  todayPlanWeekBtnText: {
    ...typography.caption,
    color: lightColors.textInverse,
    fontWeight: '800',
  },
  todayPlanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  todayPlanItemDone: {
    opacity: 0.65,
  },
  todayPlanCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: lightColors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
  },
  todayPlanCheckDone: {
    backgroundColor: lightColors.success.solid,
    borderColor: lightColors.success.solid,
  },
  todayPlanCheckText: {
    fontSize: 12,
    color: lightColors.textInverse,
    fontWeight: '800',
  },
  todayPlanCheckTextDone: {
    color: lightColors.textInverse,
  },
  todayPlanItemText: {
    flex: 1,
    ...typography.label,
    color: lightColors.text,
    fontWeight: '500',
    lineHeight: 18,
  },
  todayPlanItemTextDone: {
    textDecorationLine: 'line-through',
    color: lightColors.textMuted,
  },
  todayPlanMore: {
    ...typography.caption,
    color: lightColors.primary,
    fontWeight: '700',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  skeletonCard: {
    backgroundColor: lightColors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  skeletonPulse: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  skeletonIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  skeletonTitle: {
    ...typography.label,
    fontWeight: '800',
    color: lightColors.text,
  },
  skeletonSub: {
    ...typography.caption,
    color: lightColors.textMuted,
    marginTop: 2,
  },
  skeletonRow: {
    marginTop: spacing.md,
  },
  skeletonBar: {
    height: 12,
    borderRadius: radius.sm,
    backgroundColor: lightColors.border,
  },
  toast: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
  },
  toastSuccess: {
    backgroundColor: lightColors.success.bg,
    borderColor: lightColors.success.solid,
  },
  toastWarn: {
    backgroundColor: lightColors.warning.bg,
    borderColor: lightColors.warning.solid,
  },
  toastInfo: {
    backgroundColor: lightColors.info.bg,
    borderColor: lightColors.info.border,
  },
  toastText: {
    ...typography.label,
    fontWeight: '700',
    color: lightColors.text,
    textAlign: 'center',
  },
  dailyCard: {
    backgroundColor: lightColors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: lightColors.secondary,
    ...shadows.md,
    shadowColor: lightColors.secondary,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  dailyCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dailyCardBadge: {
    ...typography.caption,
    fontWeight: '800',
    color: lightColors.secondary,
    letterSpacing: 1.2,
  },
  dailyCardChev: {
    fontSize: 24,
    color: lightColors.secondary,
    fontWeight: '300',
  },
  dailyCardText: {
    fontSize: 15,
    color: lightColors.text,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  dailyCardHint: {
    ...typography.caption,
    color: lightColors.textMuted,
    fontStyle: 'italic',
  },
  moodEntryCard: {
    backgroundColor: lightColors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: lightColors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.md,
    shadowColor: lightColors.secondary,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  moodEntryLeft: {
    flex: 1,
  },
  moodEntryBadge: {
    ...typography.caption,
    fontWeight: '800',
    color: lightColors.secondary,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  moodEntryTitle: {
    ...typography.h3,
    color: lightColors.text,
    marginBottom: spacing.xs,
  },
  moodEntrySub: {
    ...typography.caption,
    color: lightColors.textMuted,
    fontWeight: '500',
    lineHeight: 15,
  },
  moodEntryChips: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  moodChip: {
    fontSize: 18,
  },
  moodChipText: {
    fontSize: 10,
    color: lightColors.secondary,
    fontWeight: '700',
    marginLeft: 2,
  },
  moodEntryChev: {
    fontSize: 26,
    color: lightColors.secondary,
    fontWeight: '300',
    marginLeft: spacing.sm,
  },
  pomodoroEntryCard: {
    backgroundColor: lightColors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: lightColors.error.solid,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.md,
    shadowColor: lightColors.error.solid,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  pomodoroEntryLeft: {
    flex: 1,
  },
  pomodoroEntryBadge: {
    ...typography.caption,
    fontWeight: '800',
    color: lightColors.error.solid,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  pomodoroEntryTitle: {
    ...typography.h3,
    color: lightColors.text,
    marginBottom: spacing.xs,
  },
  pomodoroEntrySub: {
    ...typography.caption,
    color: lightColors.textMuted,
    fontWeight: '500',
  },
  pomodoroEntryRight: {
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  pomodoroEntryIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  pomodoroEntryChev: {
    fontSize: 22,
    color: lightColors.error.solid,
    fontWeight: '300',
  },
  hooksEntryCard: {
    flexDirection: 'row',
    backgroundColor: lightColors.info.bg,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 2,
    borderColor: lightColors.info.solid,
  },
  hooksEntryLeft: {
    flex: 1,
  },
  hooksEntryBadge: {
    color: lightColors.info.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  hooksEntryTitle: {
    ...typography.h3,
    color: lightColors.text,
    marginBottom: spacing.xs,
  },
  hooksEntrySub: {
    ...typography.caption,
    color: lightColors.textMuted,
    fontWeight: '500',
  },
  hooksEntryRight: {
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  hooksEntryIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  hooksEntryChev: {
    fontSize: 22,
    color: lightColors.info.solid,
    fontWeight: '300',
  },
  calendarEntryCard: {
    flexDirection: 'row',
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: lightColors.info.solid,
  },
  calendarEntryLeft: {
    flex: 1,
  },
  calendarEntryBadge: {
    color: lightColors.info.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  calendarEntryTitle: {
    ...typography.h3,
    color: lightColors.text,
    marginBottom: spacing.xs,
  },
  calendarEntrySub: {
    ...typography.caption,
    color: lightColors.textMuted,
    fontWeight: '500',
  },
  calendarEntryRight: {
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  calendarEntryIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  calendarEntryChev: {
    fontSize: 22,
    color: lightColors.info.solid,
    fontWeight: '300',
  },
  repurposeEntryCard: {
    flexDirection: 'row',
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: lightColors.success.solid,
  },
  repurposeEntryLeft: {
    flex: 1,
  },
  repurposeEntryBadge: {
    color: lightColors.success.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  repurposeEntryTitle: {
    ...typography.h3,
    color: lightColors.text,
    marginBottom: spacing.xs,
  },
  repurposeEntrySub: {
    ...typography.caption,
    color: lightColors.textMuted,
    fontWeight: '500',
  },
  repurposeEntryRight: {
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  repurposeEntryIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  repurposeEntryChev: {
    fontSize: 22,
    color: lightColors.success.solid,
    fontWeight: '300',
  },
  contentSeriesEntryCard: {
    flexDirection: 'row',
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: lightColors.secondary,
  },
  contentSeriesEntryLeft: {
    flex: 1,
  },
  contentSeriesEntryBadge: {
    color: lightColors.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  contentSeriesEntryTitle: {
    ...typography.h3,
    color: lightColors.text,
    marginBottom: spacing.xs,
  },
  contentSeriesEntrySub: {
    ...typography.caption,
    color: lightColors.textMuted,
    fontWeight: '500',
  },
  contentSeriesEntryRight: {
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  contentSeriesEntryIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  contentSeriesEntryChev: {
    fontSize: 22,
    color: lightColors.secondary,
    fontWeight: '300',
  },
  personaEntryCard: {
    flexDirection: 'row',
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: lightColors.accent,
  },
  personaEntryLeft: {
    flex: 1,
  },
  personaEntryBadge: {
    color: lightColors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  personaEntryTitle: {
    ...typography.h3,
    color: lightColors.text,
    marginBottom: spacing.xs,
  },
  personaEntrySub: {
    ...typography.caption,
    color: lightColors.textMuted,
    fontWeight: '500',
  },
  personaEntryRight: {
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  personaEntryIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  personaEntryChev: {
    fontSize: 22,
    color: lightColors.accent,
    fontWeight: '300',
  },
  performanceEntryCard: {
    flexDirection: 'row',
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: lightColors.warning.solid,
  },
  performanceEntryLeft: {
    flex: 1,
  },
  performanceEntryBadge: {
    color: lightColors.warning.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  performanceEntryTitle: {
    ...typography.h3,
    color: lightColors.text,
    marginBottom: spacing.xs,
  },
  performanceEntrySub: {
    ...typography.caption,
    color: lightColors.textMuted,
    fontWeight: '500',
  },
  performanceEntryRight: {
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  performanceEntryIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  performanceEntryChev: {
    fontSize: 22,
    color: lightColors.warning.solid,
    fontWeight: '300',
  },
  ideaBankEntryCard: {
    flexDirection: 'row',
    backgroundColor: lightColors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: lightColors.info.solid,
  },
  ideaBankEntryLeft: {
    flex: 1,
  },
  ideaBankEntryBadge: {
    color: lightColors.info.solid,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  ideaBankEntryTitle: {
    ...typography.h3,
    color: lightColors.text,
    marginBottom: spacing.xs,
  },
  ideaBankEntrySub: {
    ...typography.caption,
    color: lightColors.textMuted,
    fontWeight: '500',
  },
  ideaBankEntryRight: {
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  ideaBankEntryIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  ideaBankEntryChev: {
    fontSize: 22,
    color: lightColors.info.solid,
    fontWeight: '300',
  },
  dailyCardOpenBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  dailyCardOpenBtnText: {
    ...typography.caption,
    color: lightColors.textInverse,
    fontWeight: '800',
  },
  timeWidget: {
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  timeWidgetGradient: {
    padding: spacing.lg,
  },
  timeWidgetRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timeWidgetCol: {
    flex: 1,
    paddingVertical: 4,
  },
  timeWidgetDivider: {
    width: 1,
    marginHorizontal: spacing.md,
    alignSelf: 'stretch',
  },
  timeWidgetBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  timeWidgetTime: {
    fontSize: 28,
    fontWeight: '900',
    color: lightColors.text,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  timeWidgetDate: {
    fontSize: 11,
    color: lightColors.textMuted,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 14,
  },
  timeWidgetSlotsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  timeWidgetSlot: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
  },
  timeWidgetSlotLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: lightColors.text,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  timeWidgetSlotRange: {
    fontSize: 11,
    fontWeight: '700',
    color: lightColors.textMuted,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  timeWidgetSlotBar: {
    height: 4,
    backgroundColor: lightColors.border,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  timeWidgetSlotBarFill: {
    height: 4,
    borderRadius: 2,
  },
  timeWidgetCta: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    alignItems: 'center',
  },
  timeWidgetCtaText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
  },
});

type InlineNichePickerProps = {
  currentNiche: string | null;
  niches: { id: string; icon: string; color: string; description?: string }[];
  onClose: () => void;
  onPick: (id: NicheId) => void;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
};

function InlineNichePicker({ currentNiche, niches, onClose, onPick, title, t }: InlineNichePickerProps) {
  const { height } = Dimensions.get('window');
  const sheetHeight = Math.min(Math.round(height * 0.78), 640);
  const [plan, setPlan] = useState<UserPlan>('free');
  useEffect(() => {
    getUserPlan().then(setPlan);
  }, []);
  const isPro = plan !== 'free';
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        elevation: 24,
        justifyContent: 'flex-end',
      }}
    >
      <Pressable
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: lightColors.overlay,
        }}
        onPress={onClose}
      />
      <View
        style={{
          backgroundColor: lightColors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 24,
          height: sheetHeight,
          ...Platform.select({
            web: { boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.18)' },
            default: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.18,
              shadowRadius: 12,
            },
          }),
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: lightColors.border,
            marginBottom: 12,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '800', color: lightColors.text }}>{title}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: lightColors.inputBg,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, color: lightColors.text, fontWeight: '700' }}>✕</Text>
          </Pressable>
        </View>
        <Text
          style={{
            fontSize: 13,
            color: lightColors.textMuted,
            marginBottom: 12,
            lineHeight: 18,
          }}
        >
          İçerik fikirleri ve planlar bu nişe göre hazırlanır.
        </Text>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
          {niches.map((n, idx) => {
            const isSel = currentNiche === n.id;
            const isLocked = !isPro && idx >= FREE_NICHE_LIMIT;
            return (
              <Pressable
                key={n.id}
                onPress={() => onPick(n.id as NicheId)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 10,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: isSel ? n.color : lightColors.border,
                  backgroundColor: isSel ? n.color + '14' : lightColors.surface,
                  marginBottom: 8,
                  gap: 12,
                  opacity: isLocked ? 0.55 : 1,
                }}
              >
                <NicheImage nicheId={n.id} size={56} borderRadius={12} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: lightColors.text }}>
                      {t(`niches.${n.id}`, n.id)}
                    </Text>
                    {isLocked && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#F5A524', borderRadius: 6 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>PRO</Text>
                      </View>
                    )}
                  </View>
                  {n.description && (
                    <Text style={{ fontSize: 11, color: lightColors.textMuted, marginTop: 2 }}>
                      {n.description}
                    </Text>
                  )}
                </View>
                {isSel && (
                  <Text style={{ fontSize: 22, fontWeight: '800', marginLeft: 6, color: n.color }}>
                    ✓
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

type InlineGoalPickerProps = {
  currentTarget: WeeklyGoalTarget;
  onClose: () => void;
  onPick: (n: WeeklyGoalTarget) => void;
};

function InlineGoalPicker({ currentTarget, onClose, onPick }: InlineGoalPickerProps) {
  const options: WeeklyGoalTarget[] = [3, 5, 7];
  const meta: Record<WeeklyGoalTarget, { label: string; emoji: string; sub: string }> = {
    3: { label: '3 fikir', emoji: '🌱', sub: 'Hafif başla — sürdürülebilir' },
    5: { label: '5 fikir', emoji: '🎯', sub: 'Dengeli — haftalık hedef' },
    7: { label: '7 fikir', emoji: '🚀', sub: 'Yoğun — her gün üret' },
  };
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        elevation: 24,
        justifyContent: 'flex-end',
      }}
    >
      <Pressable
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: lightColors.overlay,
        }}
        onPress={onClose}
      />
      <View
        style={{
          backgroundColor: lightColors.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 24,
          ...Platform.select({
            web: { boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.18)' },
            default: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.18,
              shadowRadius: 12,
            },
          }),
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: lightColors.border,
            marginBottom: 12,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '800', color: lightColors.text }}>
            🎯 Haftalık Hedef
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: lightColors.inputBg,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, color: lightColors.text, fontWeight: '700' }}>✕</Text>
          </Pressable>
        </View>
        <Text
          style={{
            fontSize: 13,
            color: lightColors.textMuted,
            marginBottom: 12,
            lineHeight: 18,
          }}
        >
          Bu hafta kaç fikir üretmek istiyorsun?
        </Text>
        {options.map((n) => {
          const isSel = currentTarget === n;
          const m = meta[n];
          return (
            <Pressable
              key={n}
              onPress={() => onPick(n)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: isSel ? lightColors.primary : lightColors.border,
                backgroundColor: isSel ? lightColors.primarySoft : lightColors.surface,
                marginBottom: 8,
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: lightColors.text }}>
                  {m.label}
                </Text>
                <Text style={{ fontSize: 11, color: lightColors.textMuted, marginTop: 2 }}>
                  {m.sub}
                </Text>
              </View>
              {isSel && (
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '800',
                    marginLeft: 6,
                    color: lightColors.primary,
                  }}
                >
                  ✓
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
