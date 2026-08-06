import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { setAppLanguage, SUPPORTED_LANGUAGES, SupportedLng } from '../../i18n';
import {
  ContentGoal,
  ExperienceLevel,
  BackupBundle,
  clearHistory,
  clearStoredNiche,
  clearCopyHistory,
  clearUserPlan,
  exportAllData,
  getExperience,
  getGoal,
  getMonthlyUsage,
  getUserPlan,
  getStoredNiche,
  getStreakShields,
  importAllData,
  MonthlyUsage,
  setExperience,
  setGoal,
  setStoredNiche,
  setUserPlan,
  UserPlan,
} from '../../services/storage';
import { NicheId } from '../../services/contentService';
import nichesData from '../../data/niches.json';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NicheImage } from '../../components/NicheImage';
import PlanBadge from '../../components/PlanBadge';
import { ThemeMode, useTheme } from '../../services/theme';
import {
  isDailyIdeaEnabled,
  setDailyIdeaEnabled as setDailyIdeaPref,
} from '../../services/notificationService';

const APP_VERSION = (Constants.expoConfig?.version as string) ?? '1.0.0';

const LEVEL_LABEL: Record<ExperienceLevel, string> = {
  beginner: '🌱 Yeni başlıyorum',
  intermediate: '🚀 Büyüyorum',
  pro: '👑 Profesyonelim',
};

const GOAL_LABEL: Record<ContentGoal, string> = {
  growth: '📈 Büyümek',
  engagement: '💬 Etkileşim',
  monetize: '💰 Gelir',
  community: '🤝 Topluluk',
};

type Niche = { id: string; icon: string; color: string; description?: string };
const NICHES: Niche[] = nichesData as Niche[];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { mode, setMode, colors } = useTheme();
  const [niche, setNiche] = useState<NicheId | null>(null);
  const [experience, setExperienceState] = useState<ExperienceLevel | null>(null);
  const [goal, setGoalState] = useState<ContentGoal | null>(null);
  const [dailyIdea, setDailyIdeaState] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [shieldsCount, setShieldsCount] = useState<number>(0);
  const [showShieldModal, setShowShieldModal] = useState<boolean>(false);
  const [nichePickerOpen, setNichePickerOpen] = useState(false);
  const [plan, setPlan] = useState<UserPlan>('free');
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);
  const [planRefresh, setPlanRefresh] = useState(0);

  useEffect(() => {
    getStoredNiche().then(setNiche);
    getExperience().then(setExperienceState);
    getGoal().then(setGoalState);
    isDailyIdeaEnabled().then(setDailyIdeaState);
    AsyncStorage.getItem('@content-coach/email-summary').then(setEmail);
    getStreakShields().then(setShieldsCount);
    getUserPlan().then(setPlan);
    getMonthlyUsage().then(setUsage);
  }, []);

  const changeLang = async (lng: SupportedLng) => {
    await setAppLanguage(lng);
  };

  const openLanguagePicker = () => {
    Alert.alert(
      'Uygulama dilini seç',
      'Tüm desteklenen diller',
      [
        ...SUPPORTED_LANGUAGES.map((lng) => ({
          text: `${lng.flag} ${lng.label}`,
          onPress: async () => {
            await changeLang(lng.code);
          },
        })),
        { text: t('common.cancel'), style: 'cancel' as const },
      ]
    );
  };

  const addEmail = () => {
    Alert.prompt(
      'Haftalık özet e-postası',
      'Haftanın fikirlerini ve streak durumunu gönderelim.\n(Bu özellik yakında aktif olacak)',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Kaydet',
          onPress: async (val?: string) => {
            const trimmed = (val ?? '').trim();
            if (!trimmed.includes('@')) return;
            await AsyncStorage.setItem('@content-coach/email-summary', trimmed);
            setEmail(trimmed);
          },
        },
      ],
      'plain-text',
      email ?? ''
    );
  };

  const changeExperience = () => {
    const options: ExperienceLevel[] = ['beginner', 'intermediate', 'pro'];
    Alert.alert(
      'Deneyim seviyesi',
      'Mevcut deneyimini seç',
      [
        ...options.map((l) => ({
          text: LEVEL_LABEL[l],
          onPress: async () => {
            await setExperience(l);
            setExperienceState(l);
          },
        })),
        { text: t('common.cancel'), style: 'cancel' as const },
      ]
    );
  };

  const changeGoal = () => {
    const options: ContentGoal[] = ['growth', 'engagement', 'monetize', 'community'];
    Alert.alert(
      'Hedefin',
      'İçerik üretimindeki asıl hedefin',
      [
        ...options.map((g) => ({
          text: GOAL_LABEL[g],
          onPress: async () => {
            await setGoal(g);
            setGoalState(g);
          },
        })),
        { text: t('common.cancel'), style: 'cancel' as const },
      ]
    );
  };

  const openNichePicker = () => setNichePickerOpen(true);
const closeNichePicker = () => setNichePickerOpen(false);

const pickNiche = async (id: string) => {
    await setStoredNiche(id as NicheId);
    setNiche(id as NicheId);
    setNichePickerOpen(false);
};

  const toggleDailyIdea = async (val: boolean) => {
    setDailyIdeaState(val);
    await setDailyIdeaPref(val);
  };

  const resetFavorites = () => {
    Alert.alert('Favorileri sil', 'Tüm favori fikirlerin silinir.', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('@content-coach/favorites');
          Alert.alert('Favoriler silindi.');
        },
      },
    ]);
  };

  const resetHistory = () => {
    Alert.alert('Geçmişi sil', 'Haftalık üretilen tüm fikir geçmişi silinir.', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await clearHistory();
          Alert.alert('Geçmiş silindi.');
        },
      },
    ]);
  };

  const resetStreak = () => {
    Alert.alert('Streak sıfırla', 'Üst üste gün serini sıfırlar.', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Sıfırla',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('@content-coach/streak');
          await AsyncStorage.removeItem('@content-coach/streak-last');
          Alert.alert('Streak sıfırlandı.');
        },
      },
    ]);
  };

  const resetCopies = () => {
    Alert.alert('Kopyalama geçmişini sil', 'Son kopyaladığın 20 fikir silinir.', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await clearCopyHistory();
          Alert.alert('Kopyalama geçmişi silindi.');
        },
      },
    ]);
  };

  const sendFeedback = async () => {
    const subject = encodeURIComponent('Compass (İlham Pusulam) — Geri bildirim');
    const body = encodeURIComponent(
      `Merhaba Compass ekibi,\n\nUygulama hakkındaki düşüncelerim:\n\n—\nUygulama dili: ${i18n.language}\nSürüm: v${APP_VERSION}\nNiş: ${niche ?? '-'}\n`
    );
    const url = `mailto:feedback@contentcoach.app?subject=${subject}&body=${body}`;
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
      Alert.alert(
        'E-posta açılamadı',
        'Cihazında e-posta uygulaması bulunamadı. Geri bildirim için bize feedback@contentcoach.app adresinden ulaşabilirsin.'
      );
    } catch (e) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = url;
        return;
      }
      Alert.alert('Bağlantı hatası', String(e));
    }
  };

  const rateApp = async () => {
    const appStoreUrl = 'https://apps.apple.com/app/id000000000?action=write-review';
    const playStoreUrl = 'https://play.google.com/store/apps/details?id=app.contentcoach.compass';
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(appStoreUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      const target = Platform.OS === 'ios' ? appStoreUrl : playStoreUrl;
      const supported = await Linking.canOpenURL(target);
      if (supported) {
        await Linking.openURL(target);
      } else {
        window?.open?.(appStoreUrl, '_blank');
      }
    } catch (e) {
      Alert.alert('Yönlendirilemedi', 'Mağaza sayfası açılamadı. Lütfen daha sonra tekrar dene.');
    }
  };

  const shareApp = async () => {
    try {
      await Share.share({
        message:
          'Compass — İlham Pusulam ile her hafta yeni içerik fikirleri al! Nişini seç, AI ya da hazır havuzdan fikir üret, hatırlatıcılarla üretimini takip et. https://contentcoach.app',
        title: 'Compass — İlham Pusulam',
      });
    } catch (e) {
      console.warn('share app error', e);
    }
  };

  const resetAll = () => {
    Alert.alert(
      'Tüm verileri sıfırla',
      'Niş, dil, favoriler ve hatırlatıcılar silinir. Emin misin?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace('/(onboarding)/niche-select');
          },
        },
      ]
    );
  };

  const onExportBackup = async () => {
    try {
      const bundle = await exportAllData();
      const summary = [
        `Compass — İlham Pusulam Yedek`,
        `Tarih: ${new Date(bundle.exportedAt).toLocaleString('tr-TR')}`,
        `Niş: ${bundle.niche ?? '-'}`,
        `Favoriler: ${bundle.favorites.length}`,
        `Geçmiş haftalar: ${bundle.history.length}`,
        `Üretilenler: ${bundle.done.length}`,
        `Streak: ${bundle.streak.count} gün`,
      ].join('\n');
      const payload = JSON.stringify({ summary, data: bundle }, null, 2);
      await Share.share({
        title: 'Compass — İlham Pusulam Yedek',
        message: payload,
      });
    } catch (e) {
      Alert.alert('Yedek oluşturulamadı', String(e));
    }
  };

  const onImportBackup = () => {
    Alert.prompt(
      'Geri yükle',
      'Daha önce dışa aktardığın JSON yedeği buraya yapıştır.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Geri yükle',
          onPress: async (val?: string) => {
            const raw = (val ?? '').trim();
            if (!raw) return;
            let bundle: BackupBundle | null = null;
            try {
              const parsed = JSON.parse(raw);
              const candidate = parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed;
              bundle = candidate as BackupBundle;
            } catch {
              Alert.alert('Geçersiz JSON', 'Yedek çözümlenemedi. İçeriği kontrol et.');
              return;
            }
            const result = await importAllData(bundle);
            if (result.ok) {
              Alert.alert('Geri yüklendi', 'Veriler başarıyla geri yüklendi. Uygulamayı yeniden başlat.', [
                {
                  text: 'Tamam',
                  onPress: () => router.replace('/(onboarding)/niche-select'),
                },
              ]);
            } else {
              Alert.alert('Geri yükleme başarısız', result.error ?? 'Bilinmeyen hata');
            }
          },
        },
      ],
      'plain-text',
      '',
      'default'
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
      <View style={styles.brandRow}>
        <Text style={styles.brandIcon}>🧭</Text>
        <View>
          <Text style={[styles.brandName, { color: colors.text }]}>Compass</Text>
          <Text style={styles.brandSub}>İlham Pusulam · v{APP_VERSION}</Text>
        </View>
      </View>

      <Text style={styles.section}>{t('settings.language')}</Text>
      <View style={styles.langGrid}>
        {SUPPORTED_LANGUAGES.map((lng) => {
          const isActive = i18n.language === lng.code;
          return (
            <Pressable
              key={lng.code}
              onPress={() => changeLang(lng.code)}
              style={[styles.langChip, isActive && styles.chipActive]}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {lng.flag} {lng.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={openLanguagePicker} style={styles.linkBtn}>
        <Text style={styles.linkBtnText}>Yeniden seç (tüm diller) →</Text>
      </Pressable>

      <Text style={styles.section}>Tema</Text>
      <View style={styles.row}>
        {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[styles.chip, mode === m && styles.chipActive]}
          >
            <Text style={[styles.chipText, mode === m && styles.chipTextActive]}>
              {m === 'light' ? '☀️ Açık' : m === 'dark' ? '🌙 Koyu' : '⚙️ Sistem'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>{t('settings.niche')}</Text>
      <View style={styles.card}>
        <View style={styles.nicheCurrentRow}>
          <NicheImage nicheId={niche} size={56} borderRadius={14} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.cardLabel}>{t('settings.currentNiche')}</Text>
            <Text style={styles.cardValue}>{niche ? t(`niches.${niche}`, niche) : '-'}</Text>
          </View>
        </View>
        <Pressable onPress={openNichePicker} style={styles.btn}>
          <Text style={styles.btnText}>{t('settings.changeNiche')}</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Profil</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Deneyim seviyesi</Text>
        <Text style={styles.cardValue}>
          {experience ? LEVEL_LABEL[experience] : '-'}
        </Text>
        <Pressable onPress={changeExperience} style={styles.btn}>
          <Text style={styles.btnText}>Değiştir</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Hedefin</Text>
        <Text style={styles.cardValue}>{goal ? GOAL_LABEL[goal] : '-'}</Text>
        <Pressable onPress={changeGoal} style={styles.btn}>
          <Text style={styles.btnText}>Değiştir</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Plan</Text>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>Mevcut Plan</Text>
            <Text style={styles.cardValue}>
              {plan === 'free' ? 'Free' : plan === 'pro_monthly' ? 'Pro Monthly' : 'Pro Yearly'}
            </Text>
            {plan === 'free' && usage && (
              <Text style={styles.aboutSmall}>
                Bu ay {usage.count}/{usage.limit} fikir kullanıldı
              </Text>
            )}
          </View>
          <PlanBadge refreshKey={planRefresh} />
        </View>
        <Pressable onPress={() => router.push('/pricing')} style={styles.btn}>
          <Text style={styles.btnText}>{plan === 'free' ? '⭐ Pro\'ya Yükselt' : 'Planı Yönet'}</Text>
        </Pressable>
        <View style={[styles.emailSub, { marginTop: 8 }]}>
          <Text style={styles.comingSoon}>Demo</Text>
          {plan === 'free' ? (
            <Pressable
              onPress={async () => {
                await setUserPlan('pro_monthly');
                const [p, u] = await Promise.all([getUserPlan(), getMonthlyUsage()]);
                setPlan(p);
                setUsage(u);
                setPlanRefresh((x) => x + 1);
              }}
              style={[styles.dangerOutline, { marginTop: 6, alignItems: 'center' }]}
            >
              <Text style={styles.dangerOutlineText}>Demo: Pro Monthly'ye Geç</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={async () => {
                await clearUserPlan();
                const [p, u] = await Promise.all([getUserPlan(), getMonthlyUsage()]);
                setPlan(p);
                setUsage(u);
                setPlanRefresh((x) => x + 1);
              }}
              style={[styles.dangerOutline, { marginTop: 6, alignItems: 'center' }]}
            >
              <Text style={styles.dangerOutlineText}>Demo: Free'e Dön</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Text style={styles.section}>{t('settings.about')}</Text>
      <View style={styles.card}>
        <Text style={styles.aboutText}>
          Compass — İlham Pusulam, niş bazlı içerik üreticileri için haftalık fikir planlayıcı, hatırlatıcı ve AI asistanıdır.
        </Text>
        <Text style={styles.aboutSmall}>Sürüm: v{APP_VERSION}</Text>
      </View>

      <Text style={styles.section}>Haftalık Özet</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>E-posta</Text>
        <Text style={styles.cardValue}>{email || '— ekle —'}</Text>
        <Pressable onPress={addEmail} style={styles.btn}>
          <Text style={styles.btnText}>{email ? 'Değiştir' : 'E-posta ekle'}</Text>
        </Pressable>
        {email && (
          <View style={styles.emailSub}>
            <Text style={styles.emailSubText}>
              ✉️ Her Pazartesi 08:00'de haftanın fikirleri ve streak özeti gönderilecek.
            </Text>
            <Text style={styles.comingSoon}>Yakında</Text>
          </View>
        )}
      </View>

      <Text style={styles.section}>Bildirimler</Text>
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>Günün fikri</Text>
          <Text style={styles.toggleSub}>Her sabah 8:00'de tek bildirim</Text>
        </View>
        <Switch
          value={dailyIdea}
          onValueChange={toggleDailyIdea}
          trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
          thumbColor={dailyIdea ? '#4D96FF' : '#F3F4F6'}
        />
      </View>

      <Text style={styles.section}>Seçici Sıfırlama</Text>
      <Pressable onPress={resetFavorites} style={styles.dangerOutline}>
        <Text style={styles.dangerOutlineText}>Favorileri sil</Text>
      </Pressable>
      <Pressable onPress={resetHistory} style={styles.dangerOutline}>
        <Text style={styles.dangerOutlineText}>Gecmisi sil</Text>
      </Pressable>
      <Pressable onPress={resetStreak} style={styles.dangerOutline}>
        <Text style={styles.dangerOutlineText}>Streak sifirla</Text>
      </Pressable>
      <Pressable onPress={resetCopies} style={styles.dangerOutline}>
        <Text style={styles.dangerOutlineText}>Kopyalama gecmisini sil</Text>
      </Pressable>

      <Text style={styles.section}>🛡 Streak Kalkanları</Text>
      <View style={styles.card}>
        <View style={styles.shieldRow}>
          <Text style={styles.shieldIcon}>🛡</Text>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.shieldTitle}>{shieldsCount} / 3 kalkanın var</Text>
            <Text style={styles.shieldSub}>Streak Kalkanları serini korur!</Text>
          </View>
        </View>

        <View style={styles.shieldProgressRow}>
          {[0, 1, 2].map((i) => {
            const filled = i < shieldsCount;
            return (
              <View
                key={i}
                style={[
                  styles.shieldSlot,
                  filled ? styles.shieldSlotFilled : styles.shieldSlotEmpty,
                ]}
              >
                <Text style={styles.shieldSlotIcon}>{filled ? '🛡' : '○'}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.shieldProgressBar}>
          <View
            style={[
              styles.shieldProgressFill,
              { width: `${Math.min(100, (shieldsCount / 3) * 100)}%` },
            ]}
          />
        </View>

        <Text style={styles.shieldDetail}>
          • Her 7 gün üst üste içerik ürettiğinde 1 yeni kalkan kazanırsın (max 3).{'\n'}
          • 1 günü kaçırırsan kalkan otomatik kullanılır, serin sıfırlanmaz.{'\n'}
          • 7 günde 1 kalkan = %100 koruma. Şansını kaçırma!
        </Text>

        <Pressable style={styles.shieldFaqBtn} onPress={() => setShowShieldModal(true)}>
          <Text style={styles.shieldFaqText}>❓ Kalkan nasıl kullanılır?</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Yedekleme</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Verilerini yedekle</Text>
        <Text style={styles.backupHint}>
          Tüm favorileri, geçmişi, üretilenleri ve streak'i tek bir JSON dosyası olarak paylaş.
        </Text>
        <View style={styles.backupRow}>
          <Pressable onPress={onExportBackup} style={[styles.btn, styles.backupBtn]}>
            <Text style={styles.backupBtnText}>📤 Dışa aktar</Text>
          </Pressable>
          <Pressable onPress={onImportBackup} style={[styles.btn, styles.backupBtnAlt]}>
            <Text style={styles.backupBtnAltText}>📥 Geri yükle</Text>
          </Pressable>
        </View>
        <Text style={styles.backupSub}>
          Dışa aktardığın JSON'ı bir yere kaydet (e-posta, Notlar, Drive). Geri yüklemek için yapıştırman yeterli.
        </Text>
      </View>

      <Text style={styles.section}>Destek & Paylaş</Text>
      <Pressable onPress={rateApp} style={styles.supportBtn}>
        <Text style={styles.supportBtnIcon}>⭐</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.supportBtnTitle}>Uygulamayı değerlendir</Text>
          <Text style={styles.supportBtnSub}>Mağazada 5 yıldız bırak ya da bize yaz</Text>
        </View>
        <Text style={styles.supportChev}>›</Text>
      </Pressable>
      <Pressable onPress={sendFeedback} style={styles.supportBtn}>
        <Text style={styles.supportBtnIcon}>💌</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.supportBtnTitle}>Geri bildirim gönder</Text>
          <Text style={styles.supportBtnSub}>Öneri, hata bildirimi ya da teşekkür</Text>
        </View>
        <Text style={styles.supportChev}>›</Text>
      </Pressable>
      <Pressable onPress={shareApp} style={styles.supportBtn}>
        <Text style={styles.supportBtnIcon}>↗</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.supportBtnTitle}>Uygulamayı paylaş</Text>
          <Text style={styles.supportBtnSub}>Arkadaşlarınla da içerik fikri üretsin</Text>
        </View>
        <Text style={styles.supportChev}>›</Text>
      </Pressable>

      <Text style={styles.section}>Tehlikeli Bölge</Text>
      <Pressable onPress={resetAll} style={styles.dangerBtn}>
        <Text style={styles.dangerBtnText}>Tüm Uygulama Verisini Sıfırla</Text>
      </Pressable>
    </ScrollView>

    <Modal visible={showShieldModal} transparent animationType="fade" onRequestClose={() => setShowShieldModal(false)}>
      <Pressable style={styles.shieldModalBackdrop} onPress={() => setShowShieldModal(false)}>
        <Pressable style={styles.shieldModalCard} onPress={() => {}}>
          <Text style={styles.shieldModalTitle}>🛡️ Kalkan Nasıl Kullanılır?</Text>
          <Text style={styles.shieldModalSub}>Kalkanlar serini korur</Text>

          <View style={styles.shieldStep}>
            <Text style={styles.shieldStepNum}>1</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.shieldStepTitle}>+1 Kalkan Kazan 🛡</Text>
              <Text style={styles.shieldStepDesc}>Her 7 gün üst üste içerik üret, 1 yeni kalkan kazan.</Text>
            </View>
          </View>

          <View style={styles.shieldStep}>
            <Text style={styles.shieldStepNum}>2</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.shieldStepTitle}>Maks 3 Kalkan</Text>
              <Text style={styles.shieldStepDesc}>En fazla 3 kalkan biriktirebilirsin. Fazlası birikmez.</Text>
            </View>
          </View>

          <View style={styles.shieldStep}>
            <Text style={styles.shieldStepNum}>3</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.shieldStepTitle}>Otomatik Koruma</Text>
              <Text style={styles.shieldStepDesc}>1 günü kaçırırsan kalkan otomatik kullanılır, serin sıfırlanmaz.</Text>
            </View>
          </View>

          <View style={styles.shieldStep}>
            <Text style={styles.shieldStepNum}>4</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.shieldStepTitle}>Streak'e Devam Et!</Text>
              <Text style={styles.shieldStepDesc}>Yeni kalkan kazanmak için üretim serisine devam et.</Text>
            </View>
          </View>

          <Pressable style={styles.shieldModalBtn} onPress={() => setShowShieldModal(false)}>
            <Text style={styles.shieldModalBtnText}>Anladım ✓</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>

    {nichePickerOpen && (
      <NichePickerOverlay
        currentNiche={niche}
        niches={NICHES}
        onClose={closeNichePicker}
        onPick={pickNiche}
        title={t('settings.changeNiche')}
        t={t}
      />
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#5C6B4F' },
  nicheCurrentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  nichePickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nicheGridItem: {
    width: '48%',
    padding: 8,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 10,
    alignItems: 'center',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginTop: 50, marginBottom: 16, gap: 12 },
  brandIcon: { fontSize: 40 },
  brandName: { fontSize: 22, fontWeight: '800', color: '#111827' },
  brandSub: { fontSize: 12, color: '#6B7280' },
  section: { fontSize: 13, fontWeight: '700', color: '#6B7280', marginTop: 18, marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 10 },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'white', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  linkBtn: { paddingVertical: 10, paddingHorizontal: 14, marginTop: 10, alignItems: 'flex-start' },
  linkBtnText: { color: '#4D96FF', fontWeight: '700', fontSize: 13 },
  chip: { flex: 1, paddingVertical: 14, backgroundColor: 'white', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#4D96FF', borderColor: '#4D96FF' },
  chipText: { fontWeight: '600', color: '#111827' },
  chipTextActive: { color: 'white' },
  card: { backgroundColor: 'white', padding: 18, borderRadius: 16 },
  cardLabel: { fontSize: 12, color: '#6B7280', fontWeight: '700' },
  shieldRow: { flexDirection: 'row', alignItems: 'center' },
  shieldIcon: { fontSize: 36 },
  shieldTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 4 },
  shieldSub: { fontSize: 12, color: '#4A5D3F', lineHeight: 16, fontWeight: '600' },
  shieldProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 10, paddingHorizontal: 4 },
  shieldSlot: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  shieldSlotFilled: { backgroundColor: '#C5D2A0', borderColor: '#2F3B25' },
  shieldSlotEmpty: { backgroundColor: '#F0F4ED', borderColor: '#C5D2A0' },
  shieldSlotIcon: { fontSize: 28, color: '#2F3B25' },
  shieldProgressBar: { height: 8, backgroundColor: '#E8E4D2', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  shieldProgressFill: { height: 8, backgroundColor: '#2F3B25', borderRadius: 4 },
  shieldDetail: { fontSize: 12, color: '#2F3B25', lineHeight: 19, fontWeight: '500', marginBottom: 10 },
  shieldFaqBtn: { alignSelf: 'flex-start', backgroundColor: '#F0F4ED', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 4 },
  shieldFaqText: { color: '#2F3B25', fontSize: 12, fontWeight: '700' },
  shieldModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  shieldModalCard: { backgroundColor: 'white', borderRadius: 20, padding: 22, width: '100%', maxWidth: 420 },
  shieldModalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  shieldModalSub: { fontSize: 13, color: '#6B7280', marginBottom: 18, fontWeight: '600' },
  shieldStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  shieldStepNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#C5D2A0', color: '#2F3B25', fontSize: 14, fontWeight: '800', textAlign: 'center', lineHeight: 32 },
  shieldStepTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  shieldStepDesc: { fontSize: 12, color: '#4A5D3F', lineHeight: 17 },
  shieldModalBtn: { backgroundColor: '#2F3B25', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  shieldModalBtnText: { color: 'white', fontWeight: '800', fontSize: 14 },
  cardValue: { fontSize: 18, color: '#111827', fontWeight: '700', marginTop: 4, marginBottom: 12, textTransform: 'capitalize' },
  btn: { backgroundColor: '#F3F4F6', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#4D96FF', fontWeight: '700' },
  aboutText: { color: '#374151', fontSize: 14, lineHeight: 20 },
  aboutSmall: { color: '#6B7280', fontSize: 12, marginTop: 8 },
  dangerBtn: { backgroundColor: '#FEE2E2', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  dangerBtnText: { color: '#DC2626', fontWeight: '700' },
  dangerOutline: { backgroundColor: 'white', borderWidth: 1, borderColor: '#FCA5A5', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 8 },
  dangerOutlineText: { color: '#DC2626', fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 14, borderRadius: 14, gap: 12 },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  toggleSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  emailSub: { marginTop: 12, padding: 12, backgroundColor: '#F0F9FF', borderRadius: 10 },
  emailSubText: { fontSize: 12, color: '#0C4A6E', marginBottom: 6 },
  comingSoon: {
    alignSelf: 'flex-start', fontSize: 10, fontWeight: '800', color: '#92400E',
    backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    letterSpacing: 0.5,
  },
  backupHint: { fontSize: 12, color: '#6B7280', marginTop: 4, marginBottom: 12, lineHeight: 17 },
  backupRow: { flexDirection: 'row', gap: 10 },
  backupBtn: { flex: 1, backgroundColor: '#4D96FF' },
  backupBtnText: { color: 'white', fontWeight: '700' },
  backupBtnAlt: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#4D96FF' },
  backupBtnAltText: { color: '#4D96FF', fontWeight: '700' },
  backupSub: { fontSize: 11, color: '#9CA3AF', marginTop: 10, fontStyle: 'italic' },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  supportBtnIcon: { fontSize: 24 },
  supportBtnTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  supportBtnSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  supportChev: { fontSize: 22, color: '#9CA3AF', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalBackdropPress: { flex: 1 },
  modalSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '700',
  },
  modalHint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  modalList: { maxHeight: 460 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: 'white',
    marginBottom: 8,
    gap: 12,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalIcon: { fontSize: 22 },
  modalItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  modalItemDesc: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  modalCheck: {
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 6,
  },
});

type NichePickerProps = {
  currentNiche: string | null;
  niches: Niche[];
  onClose: () => void;
  onPick: (id: string) => void;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
};

function NichePickerOverlay({
  currentNiche,
  niches,
  onClose,
  onPick,
  title,
  t,
}: NichePickerProps) {
  const { height } = Dimensions.get('window');
  const sheetHeight = Math.min(Math.round(height * 0.78), 640);

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
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </View>
      <View
        style={{
          backgroundColor: 'white',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 24,
          height: sheetHeight,
          ...Platform.select({
            web: {
              boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.18)',
            },
            default: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.18,
              shadowRadius: 12,
            },
          }),
        }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>{title}</Text>
          <Pressable
            onPress={onClose}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}
            hitSlop={8}
          >
            <Text style={{ fontSize: 14, color: '#374151', fontWeight: '700' }}>✕</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 12, lineHeight: 18 }}>
          İçerik fikirleri ve planlar bu nişe göre hazırlanır.
        </Text>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
          {niches.map((n) => {
            const isSel = currentNiche === n.id;
            return (
              <Pressable
                key={n.id}
                onPress={() => onPick(n.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 10,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: isSel ? n.color : '#E5E7EB',
                  backgroundColor: isSel ? n.color + '14' : 'white',
                  marginBottom: 8,
                  gap: 12,
                }}
              >
                <NicheImage nicheId={n.id} size={56} borderRadius={12} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>{t(`niches.${n.id}`, n.id)}</Text>
                  {n.description && (
                    <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{n.description}</Text>
                  )}
                </View>
                {isSel && (
                  <Text style={{ fontSize: 22, fontWeight: '800', marginLeft: 6, color: n.color }}>✓</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}