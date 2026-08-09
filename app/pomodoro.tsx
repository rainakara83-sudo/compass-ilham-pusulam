import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
  PomodoroEntry,
  PomodoroSettings,
  PomodoroMode,
  PomodoroStreakStats,
  addPomodoroEntry,
  clearPomodoroHistory,
  getPomodoroHistory,
  getPomodoroSettings,
  getPomodoroStats,
  getStoredNiche,
  savePomodoroSettings,
} from '../services/storage';
import { NicheId } from '../services/contentService';

const formatMMSS = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const dateLabel = (key: string): string => {
  const [y, m, d] = key.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const lng = (i18n.language || 'en').split('-')[0];
  let dayShort: string;
  try {
    dayShort = new Intl.DateTimeFormat(lng, { weekday: 'short' }).format(dt);
  } catch {
    dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()];
  }
  const isToday = (() => {
    const t = new Date();
    return t.getFullYear() === y && t.getMonth() === (m ?? 1) - 1 && t.getDate() === d;
  })();
  if (isToday) {
    try {
      return new Intl.DateTimeFormat(lng, { weekday: 'long' }).format(dt);
    } catch {
      return 'Today';
    }
  }
  return `${dayShort} ${d}/${m}`;
};

export default function PomodoroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ idea?: string; niche?: string }>();
  const passedIdea = typeof params.idea === 'string' ? decodeURIComponent(params.idea) : null;
  const passedNiche = typeof params.niche === 'string' ? (params.niche as NicheId) : null;

  const [niche, setNiche] = useState<NicheId | null>(passedNiche);
  const [settings, setSettings] = useState<PomodoroSettings | null>(null);
  const [stats, setStats] = useState<PomodoroStreakStats | null>(null);
  const [history, setHistory] = useState<PomodoroEntry[]>([]);
  const [mode, setMode] = useState<PomodoroMode>('focus');
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sessionIdea, setSessionIdea] = useState<string | null>(passedIdea);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(async () => {
    const [s, st, hist] = await Promise.all([
      getPomodoroSettings(),
      getPomodoroStats(14),
      getPomodoroHistory(),
    ]);
    setSettings(s);
    setStats(st);
    setHistory(hist);
    setSecondsLeft(s.focusMinutes * 60);
  }, []);

  useEffect(() => {
    (async () => {
      if (!niche) {
        const n = await getStoredNiche();
        setNiche(n);
      }
      await reload();
    })();
  }, [reload, niche]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const totalSeconds = useMemo(() => {
    if (!settings) return 0;
    return (mode === 'focus' ? settings.focusMinutes : settings.breakMinutes) * 60;
  }, [mode, settings]);

  const progress = useMemo(() => {
    if (totalSeconds === 0) return 0;
    return Math.min(1, 1 - secondsLeft / totalSeconds);
  }, [secondsLeft, totalSeconds]);

  const switchMode = useCallback(
    (next: PomodoroMode) => {
      if (!settings) return;
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      setRunning(false);
      setMode(next);
      setSecondsLeft((next === 'focus' ? settings.focusMinutes : settings.breakMinutes) * 60);
      setSessionStartedAt(null);
    },
    [settings]
  );

  const startTicking = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (tickRef.current) {
            clearInterval(tickRef.current);
            tickRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const onComplete = useCallback(async () => {
    if (!settings) return;
    const minutes = mode === 'focus' ? settings.focusMinutes : settings.breakMinutes;
    const today = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const entry: PomodoroEntry = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mode,
      durationMinutes: minutes,
      idea: mode === 'focus' ? sessionIdea : null,
      niche,
      completedAt: Date.now(),
      dateKey: today,
    };
    const next = await addPomodoroEntry(entry);
    setHistory(next);
    const newStats = await getPomodoroStats(14);
    setStats(newStats);
    if (mode === 'focus') {
      const wasAchieved = newStats.todayFocus >= settings.dailyGoal && newStats.todayFocus - 1 < settings.dailyGoal;
      if (wasAchieved) {
        Alert.alert('🎉 Günlük hedefe ulaştın!', `${settings.dailyGoal} pomodoro tamamladın. Mola ver!`);
      } else if (newStats.todayFocus === settings.dailyGoal) {
        Alert.alert('🎯 Hedef tamam!', `Bugün ${settings.dailyGoal} pomodoro yaptın. Harika iş!`);
      }
    }
    const nextMode: PomodoroMode = mode === 'focus' ? 'break' : 'focus';
    setMode(nextMode);
    setSecondsLeft((nextMode === 'focus' ? settings.focusMinutes : settings.breakMinutes) * 60);
    setRunning(false);
    setSessionStartedAt(null);
  }, [settings, mode, sessionIdea, niche]);

  useEffect(() => {
    if (secondsLeft === 0 && running && sessionStartedAt !== null) {
      onComplete();
    }
  }, [secondsLeft, running, sessionStartedAt, onComplete]);

  const onToggle = () => {
    if (!settings) return;
    if (!running) {
      if (sessionStartedAt === null) setSessionStartedAt(Date.now());
      setRunning(true);
      startTicking();
    } else {
      setRunning(false);
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
  };

  const onReset = () => {
    if (!settings) return;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRunning(false);
    setSecondsLeft((mode === 'focus' ? settings.focusMinutes : settings.breakMinutes) * 60);
    setSessionStartedAt(null);
  };

  const onSaveSettings = async (next: PomodoroSettings) => {
    await savePomodoroSettings(next);
    setSettings(next);
    setSecondsLeft((mode === 'focus' ? next.focusMinutes : next.breakMinutes) * 60);
  };

  const onClearHistory = () => {
    if (history.length === 0) return;
    Alert.alert('Geçmişi temizle', 'Tüm pomodoro kayıtların silinecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Temizle',
        style: 'destructive',
        onPress: async () => {
          await clearPomodoroHistory();
          await reload();
        },
      },
    ]);
  };

  if (!settings || !stats) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#EF4444" />
      </View>
    );
  }

  const focusColor = '#EF4444';
  const breakColor = '#10B981';
  const activeColor = mode === 'focus' ? focusColor : breakColor;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: '⏱ Odaklanma Zamanlayıcısı',
          headerStyle: { backgroundColor: '#fff' },
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.modeSwitchRow}>
            <Pressable
              onPress={() => switchMode('focus')}
              style={[styles.modeBtn, mode === 'focus' && styles.modeBtnActive]}
            >
              <Text style={[styles.modeBtnText, mode === 'focus' && styles.modeBtnTextActive]}>
                🎯 Odak ({settings.focusMinutes}dk)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchMode('break')}
              style={[styles.modeBtn, mode === 'break' && styles.modeBtnActiveBreak]}
            >
              <Text style={[styles.modeBtnText, mode === 'break' && styles.modeBtnTextActive]}>
                ☕ Mola ({settings.breakMinutes}dk)
              </Text>
            </Pressable>
          </View>

          <View style={styles.timerRing}>
            <View
              style={[
                styles.timerRingFill,
                {
                  borderColor: activeColor,
                  transform: [{ rotate: `${progress * 360}deg` }],
                },
              ]}
            />
            <View style={styles.timerInner}>
              <Text style={[styles.timerText, { color: activeColor }]}>{formatMMSS(secondsLeft)}</Text>
              <Text style={styles.timerSub}>
                {running ? '⏳ İlerliyor' : '⏸ Beklemede'}
              </Text>
            </View>
          </View>

          {mode === 'focus' && (
            <View style={styles.ideaRow}>
              <Text style={styles.ideaRowLabel}>📝 Çalışılan fikir:</Text>
              {sessionIdea ? (
                <View style={styles.ideaRowContent}>
                  <Text style={styles.ideaRowText} numberOfLines={2}>{sessionIdea}</Text>
                  <Pressable onPress={() => setSessionIdea(null)} hitSlop={6}>
                    <Text style={styles.ideaRowClear}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => router.push('/search')}
                  style={styles.ideaRowPickBtn}
                >
                  <Text style={styles.ideaRowPickBtnText}>Fikir seç →</Text>
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.timerActions}>
            <Pressable onPress={onReset} style={styles.resetBtn} disabled={running}>
              <Text style={styles.resetBtnText}>↺ Sıfırla</Text>
            </Pressable>
            <Pressable
              onPress={onToggle}
              style={[styles.primaryBtn, { backgroundColor: activeColor }]}
            >
              <Text style={styles.primaryBtnText}>
                {running ? '⏸ Duraklat' : secondsLeft === 0 ? '✓ Bitti' : '▶ Başla'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.todayStrip}>
            <View style={styles.todayStripItem}>
              <Text style={styles.todayStripValue}>{stats.todayFocus}</Text>
              <Text style={styles.todayStripLabel}>Bugün / {stats.todayGoal}</Text>
            </View>
            <View style={styles.todayStripDivider} />
            <View style={styles.todayStripItem}>
              <Text style={styles.todayStripValue}>{stats.todayMinutes}</Text>
              <Text style={styles.todayStripLabel}>Dakika</Text>
            </View>
            <View style={styles.todayStripDivider} />
            <View style={styles.todayStripItem}>
              <Text style={[styles.todayStripValue, { color: stats.todayAchieved ? '#10B981' : '#111827' }]}>
                {stats.todayAchieved ? '✓' : `${Math.max(0, stats.todayGoal - stats.todayFocus)}`}
              </Text>
              <Text style={styles.todayStripLabel}>
                {stats.todayAchieved ? 'Hedef tamam' : 'kalan'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.streakCard}>
          <View style={styles.streakItem}>
            <Text style={styles.streakIcon}>🔥</Text>
            <Text style={styles.streakValue}>{stats.currentStreakDays}</Text>
            <Text style={styles.streakLabel}>Güncel seri</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakItem}>
            <Text style={styles.streakIcon}>🏆</Text>
            <Text style={styles.streakValue}>{stats.bestStreakDays}</Text>
            <Text style={styles.streakLabel}>En iyi seri</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakItem}>
            <Text style={styles.streakIcon}>⏱</Text>
            <Text style={styles.streakValue}>{stats.totalFocusMinutes}</Text>
            <Text style={styles.streakLabel}>Toplam dk</Text>
          </View>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.chartTitle}>📊 Son 14 gün</Text>
              <Text style={styles.chartSub}>
                {stats.totalFocus} odak seansı · {stats.ideasFocusedOn} fikir üzerinde çalışıldı
              </Text>
            </View>
          </View>
          <View style={styles.barRow}>
            {stats.dailyHistory.map((day) => {
              const maxCount = Math.max(
                settings.dailyGoal * 1.5,
                ...stats.dailyHistory.map((d) => d.focusCount)
              );
              const heightPct = Math.min(100, (day.focusCount / maxCount) * 100);
              const color = day.goalAchieved
                ? '#10B981'
                : day.focusCount > 0
                ? '#FCA5A5'
                : '#F3F4F6';
              return (
                <View key={day.dateKey} style={styles.barCol}>
                  {day.focusCount > 0 && (
                    <Text style={styles.barValue}>{day.focusCount}</Text>
                  )}
                  <View style={styles.barBg}>
                    <View
                      style={[
                        styles.bar,
                        { height: `${heightPct}%`, backgroundColor: color },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{dateLabel(day.dateKey)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <Pressable onPress={() => setShowSettings((s) => !s)} style={styles.settingsToggle}>
          <Text style={styles.settingsToggleText}>
            {showSettings ? '▲ Ayarları gizle' : '▼ Ayarları göster'}
          </Text>
        </Pressable>

        {showSettings && (
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>⚙️ Süreler ve Hedef</Text>

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Odak süresi</Text>
                <Text style={styles.settingHint}>Bir pomodoro ne kadar sürsün?</Text>
              </View>
              <View style={styles.settingStepper}>
                <Pressable
                  onPress={() => onSaveSettings({ ...settings, focusMinutes: Math.max(5, settings.focusMinutes - 5) })}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stepValue}>{settings.focusMinutes}</Text>
                <Pressable
                  onPress={() => onSaveSettings({ ...settings, focusMinutes: Math.min(60, settings.focusMinutes + 5) })}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Mola süresi</Text>
                <Text style={styles.settingHint}>Odak seansları arasında dinlenme</Text>
              </View>
              <View style={styles.settingStepper}>
                <Pressable
                  onPress={() => onSaveSettings({ ...settings, breakMinutes: Math.max(3, settings.breakMinutes - 1) })}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stepValue}>{settings.breakMinutes}</Text>
                <Pressable
                  onPress={() => onSaveSettings({ ...settings, breakMinutes: Math.min(15, settings.breakMinutes + 1) })}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Günlük hedef</Text>
                <Text style={styles.settingHint}>Kaç pomodoro = "güzel gün"?</Text>
              </View>
              <View style={styles.settingStepper}>
                <Pressable
                  onPress={() => onSaveSettings({ ...settings, dailyGoal: Math.max(1, settings.dailyGoal - 1) })}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stepValue}>{settings.dailyGoal}</Text>
                <Pressable
                  onPress={() => onSaveSettings({ ...settings, dailyGoal: Math.min(12, settings.dailyGoal + 1) })}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.presetRow}>
              <Text style={styles.presetLabel}>Hazır setler:</Text>
              <View style={styles.presetChips}>
                {[
                  { focusMinutes: 25, breakMinutes: 5, dailyGoal: 4, label: 'Klasik' },
                  { focusMinutes: 50, breakMinutes: 10, dailyGoal: 4, label: 'Derin' },
                  { focusMinutes: 15, breakMinutes: 3, dailyGoal: 6, label: 'Hızlı' },
                  { focusMinutes: 90, breakMinutes: 15, dailyGoal: 2, label: 'Akış' },
                ].map((p) => {
                  const isActive =
                    settings.focusMinutes === p.focusMinutes &&
                    settings.breakMinutes === p.breakMinutes &&
                    settings.dailyGoal === p.dailyGoal;
                  return (
                    <Pressable
                      key={p.label}
                      onPress={() => onSaveSettings(p)}
                      style={[styles.presetChip, isActive && styles.presetChipActive]}
                    >
                      <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                        {p.label}
                      </Text>
                      <Text style={styles.presetChipSub}>
                        {p.focusMinutes}/{p.breakMinutes}dk · {p.dailyGoal}×
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {history.length > 0 && (
          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyTitle}>📜 Son seanslar</Text>
                <Text style={styles.historySub}>{history.length} kayıt</Text>
              </View>
              <Pressable onPress={onClearHistory} hitSlop={8}>
                <Text style={styles.historyClear}>Temizle</Text>
              </Pressable>
            </View>
            {history.slice(0, 8).map((h) => (
              <View
                key={h.id}
                style={[
                  styles.historyItem,
                  { borderLeftColor: h.mode === 'focus' ? focusColor : breakColor },
                ]}
              >
                <View style={styles.historyLeft}>
                  <Text style={styles.historyMode}>
                    {h.mode === 'focus' ? '🎯 Odak' : '☕ Mola'}
                  </Text>
                  {h.idea && (
                    <Text style={styles.historyIdea} numberOfLines={1}>{h.idea}</Text>
                  )}
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyMinutes}>{h.durationMinutes}dk</Text>
                  <Text style={styles.historyDate}>{dateLabel(h.dateKey)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 İpucu</Text>
          <Text style={styles.tipText}>
            Çalışmaya başlamadan önce bir fikir seç. Pomodoro bittiğinde o fikir üzerinde ürettiğin bir içerik olursa
            otomatik olarak "üretildi" olarak işaretlenebilir. Şimdilik fikir aklında kalır — sadece odağı artırır.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#EF4444',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: '#EF4444' },
  modeBtnActiveBreak: { backgroundColor: '#10B981' },
  modeBtnText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  modeBtnTextActive: { color: '#fff' },
  timerRing: {
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 8,
    borderColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  timerRingFill: {
    position: 'absolute',
    width: '50%',
    height: '100%',
    right: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 8,
    borderColor: 'transparent',
    borderRadius: 110,
  },
  timerInner: { alignItems: 'center' },
  timerText: { fontSize: 56, fontWeight: '900', letterSpacing: 2 },
  timerSub: { fontSize: 12, color: '#6B7280', marginTop: 4, fontWeight: '700', letterSpacing: 0.5 },
  ideaRow: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  ideaRowLabel: { fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 1, marginBottom: 6 },
  ideaRowContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ideaRowText: { flex: 1, fontSize: 13, color: '#111827', fontWeight: '600', lineHeight: 18 },
  ideaRowClear: { fontSize: 16, color: '#9CA3AF', fontWeight: '700', padding: 4 },
  ideaRowPickBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  ideaRowPickBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  timerActions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  resetBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
  },
  resetBtnText: { fontSize: 14, color: '#374151', fontWeight: '700' },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  todayStrip: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  todayStripItem: { flex: 1, alignItems: 'center' },
  todayStripValue: { fontSize: 20, fontWeight: '900', color: '#111827' },
  todayStripLabel: { fontSize: 10, color: '#6B7280', fontWeight: '700', marginTop: 2 },
  todayStripDivider: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  streakCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  streakItem: { flex: 1, alignItems: 'center' },
  streakIcon: { fontSize: 22, marginBottom: 4 },
  streakValue: { fontSize: 18, fontWeight: '900', color: '#EF4444' },
  streakLabel: { fontSize: 10, color: '#6B7280', fontWeight: '700', marginTop: 2, textAlign: 'center' },
  streakDivider: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 8 },
  chartCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  chartTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  chartSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  barRow: { flexDirection: 'row', height: 140, alignItems: 'flex-end', gap: 4 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  barValue: { fontSize: 9, fontWeight: '800', color: '#111827', marginBottom: 2 },
  barBg: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: { fontSize: 8, color: '#9CA3AF', fontWeight: '700', marginTop: 4 },
  settingsToggle: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  settingsToggleText: { fontSize: 12, color: '#6B7280', fontWeight: '700' },
  settingsCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  settingsTitle: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 14 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLabel: { fontSize: 13, fontWeight: '700', color: '#111827' },
  settingHint: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  settingStepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: { fontSize: 18, color: '#111827', fontWeight: '800' },
  stepValue: { fontSize: 16, fontWeight: '800', color: '#EF4444', minWidth: 30, textAlign: 'center' },
  presetRow: { marginTop: 14 },
  presetLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 8 },
  presetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  presetChipActive: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
  presetChipText: { fontSize: 12, fontWeight: '800', color: '#111827' },
  presetChipTextActive: { color: '#EF4444' },
  presetChipSub: { fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: '600' },
  historyCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  historyTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  historySub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  historyClear: { fontSize: 12, color: '#EF4444', fontWeight: '700' },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FAFAFB',
    marginBottom: 6,
    borderLeftWidth: 3,
  },
  historyLeft: { flex: 1 },
  historyMode: { fontSize: 12, fontWeight: '800', color: '#111827' },
  historyIdea: { fontSize: 11, color: '#6B7280', marginTop: 2, fontWeight: '500' },
  historyRight: { alignItems: 'flex-end' },
  historyMinutes: { fontSize: 12, fontWeight: '800', color: '#EF4444' },
  historyDate: { fontSize: 10, color: '#9CA3AF', marginTop: 2, fontWeight: '600' },
  tipCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 14,
    borderRadius: 12,
  },
  tipTitle: { fontSize: 13, fontWeight: '800', color: '#991B1B', marginBottom: 6 },
  tipText: { fontSize: 11, color: '#7F1D1D', lineHeight: 16 },
});