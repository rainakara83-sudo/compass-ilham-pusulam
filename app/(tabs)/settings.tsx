import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
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
  exportAllData,
  getExperience,
  getGoal,
  getStoredNiche,
  getStreakShields,
  importAllData,
  setExperience,
  setGoal,
} from '../../services/storage';
import { NicheId } from '../../services/contentService';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  useEffect(() => {
    getStoredNiche().then(setNiche);
    getExperience().then(setExperienceState);
    getGoal().then(setGoalState);
    isDailyIdeaEnabled().then(setDailyIdeaState);
    AsyncStorage.getItem('@content-coach/email-summary').then(setEmail);
    getStreakShields().then(setShieldsCount);
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

  const changeNiche = () => {
    Alert.alert(t('settings.changeNiche'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.ok'),
        onPress: async () => {
          await clearStoredNiche();
          router.replace('/(onboarding)/niche-select');
        },
      },
    ]);
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
    const subject = encodeURIComponent('Content Coach — Geri bildirim');
    const body = encodeURIComponent(
      `Merhaba Content Coach ekibi,\n\nUygulama hakkındaki düşüncelerim:\n\n—\nUygulama dili: ${i18n.language}\nSürüm: v${APP_VERSION}\nNiş: ${niche ?? '-'}\n`
    );
    const url = `mailto:feedback@contentcoach.app?subject=${subject}&body=${body}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'E-posta açılamadı',
          'Cihazında e-posta uygulaması bulunamadı. Geri bildirim için bize feedback@contentcoach.app adresinden ulaşabilirsin.'
        );
      }
    } catch (e) {
      Alert.alert('Bağlantı hatası', String(e));
    }
  };

  const rateApp = () => {
    Alert.alert(
      '⭐ Uygulamayı değerlendir',
      'Content Coach\'u beğendin mi? Mağazada yorum bırakmak ister misin?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: '5 yıldız ver',
          onPress: () =>
            Linking.openURL('https://apps.apple.com/app/id000000000?action=write-review').catch(() =>
              Alert.alert('Yönlendirilemedi', 'Mağaza sayfası açılamadı.')
            ),
        },
        {
          text: 'Geri bildirim gönder',
          onPress: sendFeedback,
        },
      ]
    );
  };

  const shareApp = async () => {
    try {
      await Share.share({
        message:
          'Content Coach ile her hafta yeni içerik fikirleri al! Nişini seç, AI ya da hazır havuzdan fikir üret, hatırlatıcılarla üretimini takip et. https://contentcoach.app',
        title: 'Content Coach',
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
        `Content Coach Yedek`,
        `Tarih: ${new Date(bundle.exportedAt).toLocaleString('tr-TR')}`,
        `Niş: ${bundle.niche ?? '-'}`,
        `Favoriler: ${bundle.favorites.length}`,
        `Geçmiş haftalar: ${bundle.history.length}`,
        `Üretilenler: ${bundle.done.length}`,
        `Streak: ${bundle.streak.count} gün`,
      ].join('\n');
      const payload = JSON.stringify({ summary, data: bundle }, null, 2);
      await Share.share({
        title: 'Content Coach Yedek',
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
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
      <View style={styles.brandRow}>
        <Text style={styles.brandIcon}>✨</Text>
        <View>
          <Text style={[styles.brandName, { color: colors.text }]}>Content Coach</Text>
          <Text style={styles.brandSub}>v{APP_VERSION}</Text>
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
        <Text style={styles.cardLabel}>{t('settings.currentNiche')}</Text>
        <Text style={styles.cardValue}>{niche ? t(`niches.${niche}`, niche) : '-'}</Text>
        <Pressable onPress={changeNiche} style={styles.btn}>
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

      <Text style={styles.section}>{t('settings.about')}</Text>
      <View style={styles.card}>
        <Text style={styles.aboutText}>
          Content Coach, niş bazlı içerik üreticileri için haftalık fikir planlayıcı, hatırlatıcı ve AI asistanıdır.
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
            <Text style={styles.shieldTitle}>{shieldsCount} kalkanın var</Text>
            <Text style={styles.shieldSub}>
              Her 7 günlük seride 1 yeni kalkan kazanırsın. Bir günü kaçırırsan kalkanın seni korur.
            </Text>
          </View>
        </View>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
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
  shieldSub: { fontSize: 12, color: '#6B7280', lineHeight: 16 },
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
});