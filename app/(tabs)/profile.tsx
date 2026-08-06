import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import niches from '../../data/niches.json';
import { NicheId } from '../../services/contentService';
import {
  ContentGoal,
  ExperienceLevel,
  Stats,
  addStoredNiche,
  clearWeeklyGoalProgress,
  getAccountCreatedAt,
  getActiveNiche,
  getDoneIdeas,
  getExperience,
  getFavorites,
  getGoal,
  getSchedule,
  getStats,
  getStoredNiches,
  getStreak,
  getStreakBest,
  removeStoredNiche,
  setActiveNiche,
} from '../../services/storage';
import { NicheImage } from '../../components/NicheImage';
import PlanBadge from '../../components/PlanBadge';

type Niche = { id: string; icon: string; color: string; image?: string };

const LEVEL_META: Record<ExperienceLevel, { icon: string; label: string; color: string }> = {
  beginner: { icon: '🌱', label: 'Yeni başlıyorum', color: '#10B981' },
  intermediate: { icon: '🚀', label: 'Büyüyorum', color: '#4D96FF' },
  pro: { icon: '👑', label: 'Profesyonelim', color: '#F59E0B' },
};

const GOAL_META: Record<ContentGoal, { icon: string; label: string; color: string }> = {
  growth: { icon: '📈', label: 'Büyümek', color: '#4D96FF' },
  engagement: { icon: '💬', label: 'Etkileşim', color: '#8B5CF6' },
  monetize: { icon: '💰', label: 'Gelir', color: '#10B981' },
  community: { icon: '🤝', label: 'Topluluk', color: '#F472B6' },
};

type Badge = {
  id: string;
  icon: string;
  title: string;
  threshold: number;
  metric: 'fav' | 'streak' | 'ideas' | 'done';
  color: string;
};

const BADGES: Badge[] = [
  { id: 'fav-5', icon: '⭐', title: '5 favori', threshold: 5, metric: 'fav', color: '#F59E0B' },
  { id: 'fav-10', icon: '⭐', title: '10 favori', threshold: 10, metric: 'fav', color: '#D97706' },
  { id: 'fav-50', icon: '🏆', title: '50 favori', threshold: 50, metric: 'fav', color: '#B45309' },
  { id: 'streak-3', icon: '🔥', title: '3 gün streak', threshold: 3, metric: 'streak', color: '#F97316' },
  { id: 'streak-7', icon: '🔥', title: '7 gün streak', threshold: 7, metric: 'streak', color: '#EA580C' },
  { id: 'streak-30', icon: '🏆', title: '30 gün streak', threshold: 30, metric: 'streak', color: '#C2410C' },
  { id: 'ideas-50', icon: '💡', title: '50 fikir', threshold: 50, metric: 'ideas', color: '#4D96FF' },
  { id: 'ideas-100', icon: '💎', title: '100 fikir', threshold: 100, metric: 'ideas', color: '#2563EB' },
  { id: 'done-10', icon: '✓', title: '10 üretildi', threshold: 10, metric: 'done', color: '#10B981' },
  { id: 'done-50', icon: '🏅', title: '50 üretildi', threshold: 50, metric: 'done', color: '#059669' },
];

const computeEarned = (fav: number, streak: number, ideas: number, done: number): Badge[] =>
  BADGES.filter((b) => {
    if (b.metric === 'fav') return fav >= b.threshold;
    if (b.metric === 'streak') return streak >= b.threshold;
    if (b.metric === 'ideas') return ideas >= b.threshold;
    return done >= b.threshold;
  });

const nextBadge = (fav: number, streak: number, ideas: number, done: number): Badge | null => {
  const allNext = BADGES
    .map((b) => {
      const current =
        b.metric === 'fav' ? fav : b.metric === 'streak' ? streak : b.metric === 'ideas' ? ideas : done;
      return { b, remaining: b.threshold - current };
    })
    .filter((x) => x.remaining > 0)
    .sort((a, b) => a.remaining - b.remaining);
  return allNext[0]?.b ?? null;
};

const formatJoinDate = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const daysSince = (ts: number) => {
  const diff = Date.now() - ts;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [nichesList, setNichesList] = useState<NicheId[]>([]);
  const [showNicheAdd, setShowNicheAdd] = useState(false);
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [goal, setGoal] = useState<ContentGoal | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [streak, setStreak] = useState(0);
  const [streakBest, setStreakBest] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [joinedAt, setJoinedAt] = useState<number | null>(null);
  const [showNichePicker, setShowNichePicker] = useState(false);
  const [planStats, setPlanStats] = useState({ planned: 0, done: 0, upcoming: 0 });
  const [nextPlanned, setNextPlanned] = useState<{ text: string; date: string } | null>(null);
  const [planRefresh, setPlanRefresh] = useState(0);

  useEffect(() => {
    (async () => {
      const [list, active, e, g, s, st, favs, done, best, joined, sched] = await Promise.all([
        getStoredNiches(),
        getActiveNiche(),
        getExperience(),
        getGoal(),
        getStats(),
        getStreak(),
        getFavorites(),
        getDoneIdeas(),
        getStreakBest(),
        getAccountCreatedAt(),
        getSchedule(),
      ]);
      setNichesList(list);
      setNiche(active ?? list[0] ?? null);
      setExperience(e);
      setGoal(g);
      setStats(s);
      setStreak(st.count);
      setFavCount(favs.length);
      setDoneCount(done.length);
      setStreakBest(best);
      setJoinedAt(joined);
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = sched.filter((e) => !e.done && e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
      setPlanStats({
        planned: sched.length,
        done: sched.filter((e) => e.done).length,
        upcoming: upcoming.length,
      });
      setNextPlanned(upcoming[0] ? { text: upcoming[0].text, date: upcoming[0].date } : null);
    })();
    setPlanRefresh((x) => x + 1);
  }, []);

  const nicheData = (niches as Niche[]).find((x) => x.id === niche);
  const nicheColor = nicheData?.color ?? '#4D96FF';
  const nicheIcon = nicheData?.icon ?? '✨';
  const nicheLabel = niche ? t(`niches.${niche}`, niche) : '—';
  const expMeta = experience ? LEVEL_META[experience] : null;
  const goalMeta = goal ? GOAL_META[goal] : null;

  const tiles = [
    { icon: '📅', label: 'Toplam hafta', value: stats?.totalWeeks ?? 0 },
    { icon: '💡', label: 'Üretilen fikir', value: stats?.totalIdeas ?? 0 },
    { icon: '⭐', label: 'Favoriler', value: favCount },
    { icon: '✓', label: 'Üretildi', value: doneCount },
  ];

  const avgPerWeek =
    stats && stats.totalWeeks > 0 ? Math.round(stats.totalIdeas / stats.totalWeeks) : 0;
  const memberDays = joinedAt ? daysSince(joinedAt) : 0;
  const earned = computeEarned(favCount, streak, stats?.totalIdeas ?? 0, doneCount);
  const next = nextBadge(favCount, streak, stats?.totalIdeas ?? 0, doneCount);
  const consistency = stats && stats.totalWeeks > 0
    ? Math.min(100, Math.round((streak / Math.max(1, memberDays)) * 100))
    : 0;

  const initials = niche ? niche.slice(0, 2).toUpperCase() : 'CC';

  const onChangeNiche = () => {
    if (!niche) {
      router.push('/(onboarding)/niche-select');
      return;
    }
    Alert.alert(
      'Nişini değiştir',
      'Aktif nişini değiştirirsen bu haftaki fikirler ve haftalık hedef ilerlemen sıfırlanır. Geçmiş haftalar, favoriler ve üretildi listesi korunur.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Niş Seç', onPress: () => setShowNichePicker(true) },
      ]
    );
  };

  const onPickNiche = async (id: string) => {
    setShowNichePicker(false);
    if (id === niche) return;
    await setActiveNiche(id as NicheId);
    await clearWeeklyGoalProgress();
    setNiche(id as NicheId);
    const updated = await getStoredNiches();
    setNichesList(updated);
    Alert.alert(
      'Aktif niş değişti ✨',
      'Yeni aktif nişin kaydedildi. Ana sayfaya döndüğünde fikirler yenilenecek.',
      [{ text: 'Tamam', onPress: () => router.replace('/(tabs)') }]
    );
  };

  const onAddNiche = async (id: string) => {
    setShowNicheAdd(false);
    if (nichesList.includes(id as NicheId)) {
      await setActiveNiche(id as NicheId);
      setNiche(id as NicheId);
      return;
    }
    await addStoredNiche(id as NicheId);
    const updated = await getStoredNiches();
    setNichesList(updated);
    Alert.alert('Niş eklendi', `${t(`niches.${id}`, id)} artık nişlerin arasında.`);
  };

  const onRemoveNiche = (id: string) => {
    if (nichesList.length <= 1) {
      Alert.alert('En az 1 niş', 'En az bir nişin olmalı. Önce yeni bir niş ekleyebilirsin.');
      return;
    }
    Alert.alert('Nişi kaldır', `${t(`niches.${id}`, id)} nişini kaldırmak istediğine emin misin?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Kaldır',
        style: 'destructive',
        onPress: async () => {
          await removeStoredNiche(id as NicheId);
          const updated = await getStoredNiches();
          setNichesList(updated);
          if (id === niche) {
            setNiche(updated[0] ?? null);
            await clearWeeklyGoalProgress();
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.title}>Profil</Text>
            <PlanBadge size="sm" refreshKey={planRefresh} />
          </View>
          <Text style={styles.subtitle}>Senin içerik koçun</Text>
        </View>
      </View>

      <View style={[styles.identityCard, { borderColor: nicheColor }]}>
        <NicheImage nicheId={niche} size={64} borderRadius={20} />
        <View style={[styles.avatar, { backgroundColor: nicheColor, display: 'none' }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.identityLabel}>İçerik Üreticisi</Text>
          <Text style={styles.identityTitle}>{nicheLabel}</Text>
          <View style={styles.identityMeta}>
            <Text style={styles.identityMetaText}>📅 {joinedAt ? formatJoinDate(joinedAt) : '—'}</Text>
            <Text style={styles.identityMetaText}>· {memberDays} gündür bizimle</Text>
          </View>
        </View>
        <Pressable onPress={onChangeNiche} style={[styles.identityEdit, { backgroundColor: nicheColor }]}>
          <Text style={styles.identityEditText}>Değiştir</Text>
        </Pressable>
      </View>

      {nichesList.length > 0 && (
        <View style={styles.nichesPanel}>
          <View style={styles.nichesPanelHeader}>
            <Text style={styles.nichesPanelTitle}>Nişlerin ({nichesList.length})</Text>
            <Pressable onPress={() => setShowNicheAdd(true)} style={styles.nichesAddBtn}>
              <Text style={styles.nichesAddBtnText}>+ Ekle</Text>
            </Pressable>
          </View>
          <View style={styles.nichesChipRow}>
            {nichesList.map((id) => {
              const n = (niches as Niche[]).find((x) => x.id === id);
              const isActive = id === niche;
              return (
                <View
                  key={id}
                  style={[
                    styles.nicheChip,
                    { borderColor: n?.color ?? '#E5E7EB', backgroundColor: isActive ? (n?.color ?? '#4D96FF') + '18' : 'white' },
                  ]}
                >
                  <Pressable
                    onPress={() => onPickNiche(id)}
                    onLongPress={() => onRemoveNiche(id)}
                    delayLongPress={500}
                    style={styles.nicheChipInner}
                  >
                    <Text style={styles.nicheChipIcon}>{n?.icon ?? '✨'}</Text>
                    <Text style={[styles.nicheChipLabel, isActive && { color: n?.color, fontWeight: '800' }]}>
                      {t(`niches.${id}`, id)}
                    </Text>
                    {isActive && <Text style={[styles.nicheChipBadge, { color: n?.color }]}>AKTİF</Text>}
                  </Pressable>
                </View>
              );
            })}
          </View>
          <Text style={styles.nichesHint}>💡 Aktif nişi değiştirmek için tıkla · kaldırmak için basılı tut</Text>
        </View>
      )}

      <View style={styles.gridWrap}>
        {tiles.map((t, i) => (
          <View key={i} style={styles.tile}>
            <Text style={styles.tileIcon}>{t.icon}</Text>
            <Text style={styles.tileValue}>{t.value}</Text>
            <Text style={styles.tileLabel}>{t.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.section}>Kişisel rekorlar</Text>
      <View style={styles.recordRow}>
        <View style={[styles.recordCard, styles.recordBest]}>
          <Text style={styles.recordIcon}>🏆</Text>
          <Text style={styles.recordLabel}>En uzun streak</Text>
          <Text style={styles.recordValue}>{streakBest} <Text style={styles.recordUnit}>gün</Text></Text>
        </View>
        <View style={styles.recordCard}>
          <Text style={styles.recordIcon}>📊</Text>
          <Text style={styles.recordLabel}>Ortalama fikir/hafta</Text>
          <Text style={styles.recordValue}>{avgPerWeek}</Text>
        </View>
        <View style={styles.recordCard}>
          <Text style={styles.recordIcon}>🎯</Text>
          <Text style={styles.recordLabel}>Tutarlılık</Text>
          <Text style={styles.recordValue}>{consistency}<Text style={styles.recordUnit}>%</Text></Text>
        </View>
      </View>

      <Text style={styles.section}>Rozetler ({earned.length}/{BADGES.length})</Text>
      {earned.length === 0 && !next && (
        <Text style={styles.badgeEmpty}>Favori ekleyip fikir üreterek ilk rozetinizi kazanın.</Text>
      )}
      <View style={styles.badgeRow}>
        {BADGES.map((b) => {
          const isEarned = earned.some((e) => e.id === b.id);
          return (
            <View
              key={b.id}
              style={[
                styles.badgeChip,
                {
                  borderColor: isEarned ? b.color : '#E5E7EB',
                  backgroundColor: isEarned ? b.color + '15' : '#F9FAFB',
                  opacity: isEarned ? 1 : 0.55,
                },
              ]}
            >
              <Text style={styles.badgeIcon}>{isEarned ? b.icon : '🔒'}</Text>
              <Text style={[styles.badgeText, { color: isEarned ? b.color : '#9CA3AF' }]}>
                {b.title}
              </Text>
            </View>
          );
        })}
      </View>
      {next && (
        <View style={styles.nextBadgeBox}>
          <Text style={styles.nextBadgeLabel}>Sıradaki rozet</Text>
          <View style={styles.nextBadgeRow}>
            <Text style={styles.nextBadgeIcon}>{next.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextBadgeTitle}>{next.title}</Text>
              <Text style={styles.nextBadgeSub}>
                {next.metric === 'fav' && `${Math.max(0, next.threshold - favCount)} favori daha`}
                {next.metric === 'streak' && `${Math.max(0, next.threshold - streak)} gün daha üret`}
                {next.metric === 'ideas' && `${Math.max(0, next.threshold - (stats?.totalIdeas ?? 0))} fikir daha üret`}
                {next.metric === 'done' && `${Math.max(0, next.threshold - doneCount)} fikir daha üretildi olarak işaretle`}
              </Text>
            </View>
          </View>
        </View>
      )}

      {planStats.planned > 0 && (
        <>
          <Text style={styles.section}>📅 Takvim Özeti</Text>
          <View style={styles.calendarCard}>
            <View style={styles.calendarRow}>
              <View style={styles.calendarStat}>
                <Text style={styles.calendarStatValue}>{planStats.planned}</Text>
                <Text style={styles.calendarStatLabel}>Planlı</Text>
              </View>
              <View style={styles.calendarStat}>
                <Text style={[styles.calendarStatValue, { color: '#10B981' }]}>{planStats.done}</Text>
                <Text style={styles.calendarStatLabel}>Üretildi</Text>
              </View>
              <View style={styles.calendarStat}>
                <Text style={[styles.calendarStatValue, { color: '#4D96FF' }]}>{planStats.upcoming}</Text>
                <Text style={styles.calendarStatLabel}>Sıradaki</Text>
              </View>
            </View>
            {nextPlanned && (
              <View style={styles.nextPlannedBox}>
                <Text style={styles.nextPlannedLabel}>⏭ Sıradaki fikir</Text>
                <Text style={styles.nextPlannedText} numberOfLines={2}>{nextPlanned.text}</Text>
                <Text style={styles.nextPlannedDate}>
                  {new Date(nextPlanned.date).toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'short' })}
                </Text>
              </View>
            )}
            <View style={styles.calendarProgressBg}>
              <View
                style={[
                  styles.calendarProgressFill,
                  { width: `${planStats.planned > 0 ? Math.round((planStats.done / planStats.planned) * 100) : 0}%` },
                ]}
              />
            </View>
            <Text style={styles.calendarProgressLabel}>
              Tamamlama oranı: {planStats.planned > 0 ? Math.round((planStats.done / planStats.planned) * 100) : 0}%
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/calendar')} style={styles.calendarOpenBtn}>
              <Text style={styles.calendarOpenBtnText}>Takvimi aç →</Text>
            </Pressable>
          </View>
        </>
      )}

      <Pressable onPress={() => router.push('/comments')} style={styles.commentsCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.commentsTitle}>💬 Yorum Şablonları</Text>
          <Text style={styles.commentsSub}>
            Sık kullandığın yorumları kaydet, tek tıkla kopyala
          </Text>
        </View>
        <Text style={styles.commentsArrow}>›</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/collections')} style={styles.collectionsCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.collectionsTitle}>📚 Fikir Paketleri</Text>
          <Text style={styles.collectionsSub}>
            Fikirlerini kendi koleksiyonlarına grupla
          </Text>
        </View>
        <Text style={styles.commentsArrow}>›</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/hashtags')} style={styles.hashtagCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hashtagTitle}># Hashtag Üretici</Text>
          <Text style={styles.hashtagSub}>
            Fikrin için 15 hashtag önerisi, seç-kopyala
          </Text>
        </View>
        <Text style={styles.commentsArrow}>›</Text>
      </Pressable>

      <Text style={styles.section}>Yolculuğun</Text>
      <View style={styles.row}>
        <View style={[styles.cardLeft, { borderLeftColor: expMeta?.color ?? '#E5E7EB' }]}>
          <Text style={styles.cardLabel}>Deneyim</Text>
          {expMeta ? (
            <View style={styles.cardRow}>
              <Text style={styles.cardIcon}>{expMeta.icon}</Text>
              <Text style={[styles.cardTitle, { color: expMeta.color }]}>{expMeta.label}</Text>
            </View>
          ) : (
            <Text style={styles.cardEmpty}>Henüz seçilmedi</Text>
          )}
        </View>
        <View style={[styles.cardLeft, { borderLeftColor: goalMeta?.color ?? '#E5E7EB' }]}>
          <Text style={styles.cardLabel}>Hedef</Text>
          {goalMeta ? (
            <View style={styles.cardRow}>
              <Text style={styles.cardIcon}>{goalMeta.icon}</Text>
              <Text style={[styles.cardTitle, { color: goalMeta.color }]}>{goalMeta.label}</Text>
            </View>
          ) : (
            <Text style={styles.cardEmpty}>Henüz seçilmedi</Text>
          )}
        </View>
      </View>

      {stats && stats.lastWeekId && (
        <View style={styles.lastWeek}>
          <Text style={styles.lastWeekLabel}>Son aktif hafta</Text>
          <Text style={styles.lastWeekValue}>{stats.lastWeekId}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.btnAlt]} onPress={() => router.push('/(tabs)/stats')}>
          <Text style={styles.btnAltText}>İstatistikleri gör</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnAlt]} onPress={() => router.push('/(tabs)/settings')}>
          <Text style={styles.btnAltText}>Ayarları aç</Text>
        </Pressable>
      </View>

      <Modal visible={showNichePicker} animationType="slide" transparent onRequestClose={() => setShowNichePicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Aktif nişini seç</Text>
              <Pressable onPress={() => setShowNichePicker(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalGrid}>
              {(niches as Niche[]).map((n) => {
                const inList = nichesList.includes(n.id as NicheId);
                const isSel = niche === n.id;
                return (
                  <Pressable
                    key={n.id}
                    onPress={() => onPickNiche(n.id)}
                    style={[
                      styles.modalCard,
                      { borderColor: isSel ? n.color : inList ? '#E5E7EB' : '#FCD34D', backgroundColor: isSel ? n.color + '15' : 'white' },
                    ]}
                  >
                    <Text style={styles.modalIcon}>{n.icon}</Text>
                    <Text style={styles.modalLabel}>{t(`niches.${n.id}`, n.id)}</Text>
                    {isSel && <Text style={[styles.modalCheck, { color: n.color }]}>✓ Aktif</Text>}
                    {!inList && <Text style={styles.modalHint}>Ekle + aktif yap</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showNicheAdd} animationType="slide" transparent onRequestClose={() => setShowNicheAdd(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Yeni niş ekle</Text>
              <Pressable onPress={() => setShowNicheAdd(false)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalGrid}>
              {(niches as Niche[])
                .filter((n) => !nichesList.includes(n.id as NicheId))
                .map((n) => (
                  <Pressable
                    key={n.id}
                    onPress={() => onAddNiche(n.id)}
                    style={[
                      styles.modalCard,
                      { borderColor: n.color, backgroundColor: n.color + '0A' },
                    ]}
                  >
                    <Text style={styles.modalIcon}>{n.icon}</Text>
                    <Text style={styles.modalLabel}>{t(`niches.${n.id}`, n.id)}</Text>
                    <Text style={[styles.modalCheck, { color: n.color }]}>+ Ekle</Text>
                  </Pressable>
                ))}
              {(niches as Niche[]).filter((n) => !nichesList.includes(n.id as NicheId)).length === 0 && (
                <Text style={styles.modalEmptyText}>Tüm nişleri zaten ekledin 🎉</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5C6B4F' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 50, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 18,
    marginBottom: 18,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { color: 'white', fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  identityLabel: { fontSize: 10, fontWeight: '800', color: '#6B7280', letterSpacing: 1, marginBottom: 2 },
  identityTitle: { fontSize: 18, fontWeight: '800', color: '#111827', textTransform: 'capitalize' },
  identityMeta: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  identityMetaText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  identityEdit: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  identityEditText: { color: 'white', fontWeight: '700', fontSize: 12 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  tile: {
    width: '48%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  tileIcon: { fontSize: 22, marginBottom: 6 },
  tileValue: { fontSize: 26, fontWeight: '800', color: '#111827' },
  tileLabel: { fontSize: 11, color: '#6B7280', marginTop: 4, fontWeight: '600' },
  section: { fontSize: 12, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
  recordRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  recordCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  recordBest: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FCD34D' },
  recordIcon: { fontSize: 18, marginBottom: 4 },
  recordLabel: { fontSize: 10, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  recordValue: { fontSize: 22, fontWeight: '800', color: '#111827', marginTop: 2 },
  recordUnit: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  cardLeft: {
    flex: 1,
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardIcon: { fontSize: 18 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardEmpty: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  lastWeek: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  lastWeekLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  lastWeekValue: { fontSize: 13, fontWeight: '800', color: '#4D96FF' },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnAlt: { backgroundColor: 'white', borderWidth: 1, borderColor: '#4D96FF' },
  btnAltText: { color: '#4D96FF', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalClose: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  modalCloseText: { fontSize: 14, color: '#374151', fontWeight: '700' },
  modalGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 8 },
  modalCard: {
    width: '48%',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 2,
    marginBottom: 10,
    alignItems: 'center',
  },
  modalIcon: { fontSize: 30, marginBottom: 4 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#111827', textAlign: 'center' },
  modalCheck: { fontSize: 11, fontWeight: '800', marginTop: 4 },
  calendarCard: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  calendarRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  calendarStat: { alignItems: 'center', flex: 1 },
  calendarStatValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  calendarStatLabel: { fontSize: 11, color: '#6B7280', marginTop: 2, fontWeight: '700' },
  nextPlannedBox: {
    backgroundColor: '#F0F9FF',
    borderColor: '#93C5FD',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  nextPlannedLabel: { fontSize: 10, fontWeight: '800', color: '#1E40AF', letterSpacing: 0.5, marginBottom: 4 },
  nextPlannedText: { fontSize: 13, fontWeight: '600', color: '#111827', lineHeight: 18 },
  nextPlannedDate: { fontSize: 11, color: '#1E40AF', marginTop: 4, fontWeight: '700', textTransform: 'capitalize' },
  calendarProgressBg: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  calendarProgressFill: { height: 6, backgroundColor: '#10B981', borderRadius: 3 },
  calendarProgressLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  calendarOpenBtn: { backgroundColor: '#4D96FF', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  calendarOpenBtnText: { color: 'white', fontWeight: '800', fontSize: 13 },
  commentsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  commentsTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 4 },
  commentsSub: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  commentsArrow: { fontSize: 28, color: '#9CA3AF', fontWeight: '300', marginLeft: 12 },
  nichesPanel: {
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  nichesPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  nichesPanelTitle: { fontSize: 13, fontWeight: '800', color: '#111827', textTransform: 'uppercase', letterSpacing: 0.5 },
  nichesAddBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#4D96FF', borderRadius: 8 },
  nichesAddBtnText: { color: 'white', fontWeight: '700', fontSize: 12 },
  nichesChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nicheChip: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nicheChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nicheChipIcon: { fontSize: 16 },
  nicheChipLabel: { fontSize: 12, fontWeight: '700', color: '#111827' },
  nicheChipBadge: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  nichesHint: { fontSize: 11, color: '#6B7280', marginTop: 10, fontStyle: 'italic' },
  modalHint: { fontSize: 10, color: '#92400E', fontWeight: '700', marginTop: 4 },
  modalEmptyText: { color: '#6B7280', textAlign: 'center', padding: 20, fontSize: 13 },
  collectionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  collectionsTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 4 },
  collectionsSub: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  hashtagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  hashtagTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 4 },
  hashtagSub: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  badgeChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14,
    borderWidth: 1.5, gap: 6, backgroundColor: 'white',
  },
  badgeIcon: { fontSize: 14 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeEmpty: { color: '#6B7280', fontSize: 13, fontStyle: 'italic', marginBottom: 12 },
  nextBadgeBox: {
    backgroundColor: 'white', padding: 14, borderRadius: 12, marginBottom: 18,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  nextBadgeLabel: { fontSize: 10, fontWeight: '800', color: '#9A3412', letterSpacing: 1, marginBottom: 6 },
  nextBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextBadgeIcon: { fontSize: 22 },
  nextBadgeTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  nextBadgeSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
