import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getStoredNiche, getStreak, getStreakShields, recordStreakActivity, saveWeekToHistory, toggleFavorite, getFavorites, getDoneIdeas, toggleDone, getTodayDoneCount, bumpTodayDoneCount, getIdeaStats, IdeaStats, addCopyToHistory, getRecentCopies, CopyEntry, getWeeklyGoal, setWeeklyGoal, getCurrentWeekGoalProgress, incrementWeeklyGoalProgress, decrementWeeklyGoalProgress, WeeklyGoalProgress, WeeklyGoalTarget, getScheduleForDate, toggleScheduleEntry, ScheduleEntry, getDailyCard } from '../../services/storage';
import { NicheId, WeeklyIdea, pickWeeklyIdeasFromPool, isWeekend } from '../../services/contentService';
import { generateWeeklyIdeasWithAIResult } from '../../services/aiService';
import AnimatedCard from '../../components/AnimatedCard';
import * as Notifications from 'expo-notifications';

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
  const [ideas, setIdeas] = useState<WeeklyIdea[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [todayPlan, setTodayPlan] = useState<ScheduleEntry[]>([]);
  const [dailyCardText, setDailyCardText] = useState<string | null>(null);
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
    setLoading(true);
    const picked = pickWeeklyIdeasFromPool(n, weekend);
    setIdeas(picked);
    setLoading(false);
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
      const n = await getStoredNiche();
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

  const loadTodayPlan = useCallback(async () => {
    const list = await getScheduleForDate(todayDateKey);
    list.sort((a, b) => Number(a.done) - Number(b.done));
    setTodayPlan(list);
  }, [todayDateKey]);

  const loadDailyCard = useCallback(async () => {
    const card = await getDailyCard(niche);
    setDailyCardText(card.idea);
  }, [niche]);

  useFocusEffect(
    useCallback(() => {
      loadTodayPlan();
      loadDailyCard();
    }, [loadTodayPlan, loadDailyCard])
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
    setAiInfoMsg(null);
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
        setAiInfoMsg('🤖 AI şu an yanıt vermedi. Akıllı havuzdan seçildi (geçmiştekilerden farklı).');
        setToastVariant('warn');
        setToastMsg('🤖 AI çevrimdışı — akıllı havuz kullanıldı');
      } else if (result.usedVariant && result.usedVariant !== 'detailed') {
        setAiInfoMsg(`🤖 AI "${result.usedVariant}" yedek prompt ile cevap verdi.`);
        setToastVariant('info');
        setToastMsg(`🤖 Yedek prompt ile ${result.ideas.length} fikir`);
      } else {
        setToastVariant('success');
        setToastMsg(`✨ ${result.ideas.length} yeni AI fikri geldi!`);
      }
      setTimeout(() => setToastMsg(null), 2500);
    } else {
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
    Alert.alert(
      'Haftalık hedefini seç',
      'Bu hafta kaç fikir üretmek istiyorsun?',
      [
        { text: '3 fikir', onPress: async () => { await setWeeklyGoal(3); setGoalTarget(3); setGoalProgress(await getCurrentWeekGoalProgress()); } },
        { text: '5 fikir', onPress: async () => { await setWeeklyGoal(5); setGoalTarget(5); setGoalProgress(await getCurrentWeekGoalProgress()); } },
        { text: '7 fikir', onPress: async () => { await setWeeklyGoal(7); setGoalTarget(7); setGoalProgress(await getCurrentWeekGoalProgress()); } },
        { text: 'Vazgeç', style: 'cancel' },
      ]
    );
  };

  const onShare = async (idea: string) => {
    try {
      await Share.share({
        message: `İçerik fikri: ${idea}`,
        title: 'Content Coach',
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
        <ActivityIndicator />
      </View>
    );
  }

  if (!niche) {
    return (
      <View style={styles.center}>
        <Text>{t('home.noIdeas')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
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
        <View style={styles.weekBadge}>
          <Text style={styles.weekBadgeText}>{weekId}</Text>
        </View>
      </View>

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
                  backgroundColor: goalProgress.achieved ? '#10B981' : '#4D96FF',
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

      {dailyCardText && (
        <Pressable
          onPress={() => router.push({ pathname: '/daily-card', params: { niche: niche ?? '' } })}
          style={styles.dailyCard}
        >
          <View style={styles.dailyCardHead}>
            <Text style={styles.dailyCardBadge}>🌟 GÜNÜN KARTI</Text>
            <Text style={styles.dailyCardChev}>›</Text>
          </View>
          <Text style={styles.dailyCardText} numberOfLines={3}>{dailyCardText}</Text>
          <Text style={styles.dailyCardHint}>Çevirmek için karta dokun ↻</Text>
        </Pressable>
      )}

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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
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
          <Text style={styles.weekendTitle}>🎉 Hafta sonu modu</Text>
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
        <Pressable onPress={() => setAiInfoMsg(null)} style={styles.aiInfoBanner}>
          <Text style={styles.aiInfoText}>{aiInfoMsg}</Text>
          <Text style={styles.aiInfoDismiss}>✕</Text>
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
                      <Text style={[styles.iconBtnText, isDone && { color: 'white' }]}>
                        {isDone ? '✓' : '◻'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => onFavorite(idea.text)} style={styles.iconBtn}>
                      <Text style={[styles.iconBtnText, isFav && { color: '#F59E0B' }]}>
                        {isFav ? '★' : '☆'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => onShare(idea.text)} style={styles.iconBtn}>
                      <Text style={styles.iconBtnText}>↗</Text>
                    </Pressable>
                    <Pressable onPress={() => copyIdea(idx, idea.text, idea.source)} style={styles.iconBtn}>
                      <Text style={styles.iconBtnText}>{copiedIdx === idx ? '✓' : '⧉'}</Text>
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
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.btnText}>{t('home.aiButton')}</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 50, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  weekBadge: { backgroundColor: '#E0E7FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  weekBadgeText: { fontSize: 11, color: '#4338CA', fontWeight: '700' },
  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#4D96FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  searchBtnTxt: { fontSize: 16 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, marginRight: 6 },
  streakIcon: { fontSize: 12, marginRight: 4 },
  streakText: { fontSize: 12, color: '#92400E', fontWeight: '800' },
  shieldBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, marginRight: 6 },
  shieldIcon: { fontSize: 12, marginRight: 4 },
  shieldText: { fontSize: 12, color: '#1E40AF', fontWeight: '800' },
  card: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayBadge: { fontSize: 12, fontWeight: '700', color: '#4D96FF' },
  iconBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  iconBtnText: { fontSize: 14, color: '#4D96FF', fontWeight: '700' },
  ideaText: { fontSize: 16, color: '#111827', fontWeight: '600', lineHeight: 22 },
  sourceBadge: { fontSize: 11, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  copiedHint: { marginTop: 8, fontSize: 12, color: '#10B981', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, backgroundColor: '#4D96FF', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '700' },
  btnAlt: { backgroundColor: 'white', borderWidth: 1, borderColor: '#4D96FF' },
  btnAltText: { color: '#4D96FF', fontWeight: '700' },
  heroCard: {
    backgroundColor: '#4D96FF',
    padding: 20,
    borderRadius: 18,
    marginBottom: 18,
    shadowColor: '#4D96FF',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  heroLabel: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 1, marginBottom: 8 },
  heroText: { fontSize: 18, fontWeight: '700', color: 'white', lineHeight: 24 },
  heroTextDone: { textDecorationLine: 'line-through', opacity: 0.7 },
  heroCardDone: { backgroundColor: '#10B981', shadowColor: '#10B981' },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  heroHint: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' },
  heroDay: { fontSize: 11, fontWeight: '700', color: 'white', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  swipeRight: { backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 24, borderRadius: 16, marginBottom: 12, width: 140 },
  swipeLeft: { backgroundColor: '#F59E0B', justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: 24, borderRadius: 16, marginBottom: 12, width: 140 },
  swipeLeftOn: { backgroundColor: '#B45309' },
  swipeText: { color: 'white', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  todayPill: { alignSelf: 'flex-start', backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 14 },
  todayPillText: { fontSize: 12, color: '#166534', fontWeight: '700' },
  notifPill: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  notifPillBad: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  notifPillText: { fontSize: 13, fontWeight: '700', color: '#1E40AF' },
  notifPillHint: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  countdownPill: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  countdownText: { fontSize: 13, fontWeight: '600', color: '#166534' },
  recentCopiesBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  recentCopiesHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  recentCopiesTitle: { fontSize: 12, fontWeight: '800', color: '#374151', letterSpacing: 0.5 },
  recentCopiesCount: { fontSize: 11, color: '#6B7280', fontWeight: '700', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  recentCopyChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    maxWidth: 220,
  },
  recentCopyText: { fontSize: 12, color: '#111827', fontWeight: '600' },
  statsCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 14,
    marginTop: 18,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statsTitle: { fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#4D96FF', marginBottom: 2 },
  statLabel: { fontSize: 10, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  favIdeaBox: {
    backgroundColor: '#F9FAFB',
    borderLeftWidth: 3,
    borderLeftColor: '#4D96FF',
    padding: 10,
    borderRadius: 8,
  },
  favIdeaLabel: { fontSize: 10, fontWeight: '800', color: '#6B7280', letterSpacing: 1, marginBottom: 4 },
  favIdeaText: { fontSize: 13, color: '#111827', fontWeight: '600', lineHeight: 18 },
  favIdeaCount: { fontSize: 11, color: '#10B981', fontWeight: '700', marginTop: 4 },
  weekendBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  weekendTitle: { fontSize: 14, fontWeight: '800', color: '#92400E', marginBottom: 4 },
  weekendSub: { fontSize: 12, color: '#78350F' },
  cardDone: { opacity: 0.6, borderColor: '#10B981', borderWidth: 1.5 },
  ideaTextDone: { textDecorationLine: 'line-through', color: '#6B7280' },
  iconBtnDone: { backgroundColor: '#10B981' },
  doneHint: { marginTop: 8, fontSize: 12, color: '#10B981', fontWeight: '700' },
  goalCard: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  goalCardAchieved: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  goalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  goalTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  goalSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  goalPickBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#EEF2FF' },
  goalPickBtnText: { fontSize: 12, fontWeight: '700', color: '#4338CA' },
  goalBarBg: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  goalBarFill: { height: 8, borderRadius: 4 },
  goalTickRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  goalTick: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E5E7EB' },
  goalTickOn: { backgroundColor: '#10B981' },
  aiInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderColor: '#93C5FD',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  aiInfoText: { flex: 1, fontSize: 12, color: '#1E40AF', fontWeight: '600' },
  aiInfoDismiss: { fontSize: 14, color: '#1E40AF', fontWeight: '800', marginLeft: 8 },
  todayPlanCard: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  todayPlanHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  todayPlanTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  todayPlanSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  todayPlanOpenBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#EEF2FF' },
  todayPlanOpenBtnText: { fontSize: 11, color: '#4338CA', fontWeight: '800' },
  todayPlanWeekBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#7c5cff', marginRight: 6 },
  todayPlanWeekBtnText: { fontSize: 11, color: 'white', fontWeight: '800' },
  todayPlanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  todayPlanItemDone: { opacity: 0.65 },
  todayPlanCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#C7D2FE',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'white',
  },
  todayPlanCheckDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
  todayPlanCheckText: { fontSize: 12, color: 'white', fontWeight: '800' },
  todayPlanCheckTextDone: { color: 'white' },
  todayPlanItemText: { flex: 1, fontSize: 13, color: '#111827', fontWeight: '500', lineHeight: 18 },
  todayPlanItemTextDone: { textDecorationLine: 'line-through', color: '#6B7280' },
  todayPlanMore: { fontSize: 11, color: '#4338CA', fontWeight: '700', marginTop: 6, textAlign: 'center' },
  skeletonCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  skeletonPulse: { alignItems: 'center', marginBottom: 14 },
  skeletonIcon: { fontSize: 28, marginBottom: 4 },
  skeletonTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  skeletonSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  skeletonRow: { marginTop: 10 },
  skeletonBar: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  toast: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
  },
  toastSuccess: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  toastWarn: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  toastInfo: { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' },
  toastText: { fontSize: 13, fontWeight: '700', color: '#111827', textAlign: 'center' },
  dailyCard: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#7c5cff',
    shadowColor: '#7c5cff',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  dailyCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dailyCardBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7c5cff',
    letterSpacing: 1.2,
  },
  dailyCardChev: { fontSize: 24, color: '#7c5cff', fontWeight: '300' },
  dailyCardText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 8,
  },
  dailyCardHint: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  moodEntryCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#7c5cff',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#7c5cff',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  moodEntryLeft: { flex: 1 },
  moodEntryBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7c5cff',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  moodEntryTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 4 },
  moodEntrySub: { fontSize: 11, color: '#6B7280', fontWeight: '500', lineHeight: 15 },
  moodEntryChips: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  moodChip: { fontSize: 18 },
  moodChipText: { fontSize: 10, color: '#7c5cff', fontWeight: '700', marginLeft: 2 },
  moodEntryChev: { fontSize: 26, color: '#7c5cff', fontWeight: '300', marginLeft: 8 },
  pomodoroEntryCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  pomodoroEntryLeft: { flex: 1 },
  pomodoroEntryBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  pomodoroEntryTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 4 },
  pomodoroEntrySub: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  pomodoroEntryRight: { alignItems: 'center', marginLeft: 12 },
  pomodoroEntryIcon: { fontSize: 32, marginBottom: 4 },
  pomodoroEntryChev: { fontSize: 22, color: '#EF4444', fontWeight: '300' },
  hooksEntryCard: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  hooksEntryLeft: { flex: 1 },
  hooksEntryBadge: { color: '#0EA5E9', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  hooksEntryTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  hooksEntrySub: { fontSize: 11, color: '#475569', fontWeight: '500' },
  hooksEntryRight: { alignItems: 'center', marginLeft: 12 },
  hooksEntryIcon: { fontSize: 32, marginBottom: 4 },
  hooksEntryChev: { fontSize: 22, color: '#0EA5E9', fontWeight: '300' },
  calendarEntryCard: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  calendarEntryLeft: { flex: 1 },
  calendarEntryBadge: { color: '#0EA5E9', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  calendarEntryTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 },
  calendarEntrySub: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  calendarEntryRight: { alignItems: 'center', marginLeft: 12 },
  calendarEntryIcon: { fontSize: 32, marginBottom: 4 },
  calendarEntryChev: { fontSize: 22, color: '#0EA5E9', fontWeight: '300' },
  repurposeEntryCard: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  repurposeEntryLeft: { flex: 1 },
  repurposeEntryBadge: { color: '#10B981', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  repurposeEntryTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 },
  repurposeEntrySub: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  repurposeEntryRight: { alignItems: 'center', marginLeft: 12 },
  repurposeEntryIcon: { fontSize: 32, marginBottom: 4 },
  repurposeEntryChev: { fontSize: 22, color: '#10B981', fontWeight: '300' },
  contentSeriesEntryCard: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  contentSeriesEntryLeft: { flex: 1 },
  contentSeriesEntryBadge: { color: '#8B5CF6', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  contentSeriesEntryTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 },
  contentSeriesEntrySub: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  contentSeriesEntryRight: { alignItems: 'center', marginLeft: 12 },
  contentSeriesEntryIcon: { fontSize: 32, marginBottom: 4 },
  contentSeriesEntryChev: { fontSize: 22, color: '#8B5CF6', fontWeight: '300' },
  personaEntryCard: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#EC4899',
  },
  personaEntryLeft: { flex: 1 },
  personaEntryBadge: { color: '#EC4899', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  personaEntryTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 },
  personaEntrySub: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  personaEntryRight: { alignItems: 'center', marginLeft: 12 },
  personaEntryIcon: { fontSize: 32, marginBottom: 4 },
  personaEntryChev: { fontSize: 22, color: '#EC4899', fontWeight: '300' },
  performanceEntryCard: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  performanceEntryLeft: { flex: 1 },
  performanceEntryBadge: { color: '#F59E0B', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  performanceEntryTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 },
  performanceEntrySub: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  performanceEntryRight: { alignItems: 'center', marginLeft: 12 },
  performanceEntryIcon: { fontSize: 32, marginBottom: 4 },
  performanceEntryChev: { fontSize: 22, color: '#F59E0B', fontWeight: '300' },
  ideaBankEntryCard: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#06B6D4',
  },
  ideaBankEntryLeft: { flex: 1 },
  ideaBankEntryBadge: { color: '#06B6D4', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  ideaBankEntryTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 4 },
  ideaBankEntrySub: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  ideaBankEntryRight: { alignItems: 'center', marginLeft: 12 },
  ideaBankEntryIcon: { fontSize: 32, marginBottom: 4 },
  ideaBankEntryChev: { fontSize: 22, color: '#06B6D4', fontWeight: '300' },
});