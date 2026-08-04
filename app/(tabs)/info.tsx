import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';

type FaqItem = { q: string; a: string };

const FAQS: FaqItem[] = [
  {
    q: 'Fikirler nereden geliyor?',
    a: 'İki kaynaktan: 1) 8 niş için önceden hazırlanmış 240+ fikir havuzu, 2) Yapay zeka modu ile nişine özel anlık üretim.',
  },
  {
    q: 'Yapay zekaya API anahtarı vermem mi gerek?',
    a: 'İstemezsen gerek yok. Sadece havuz modunu kullanabilirsin. İstersen backend-example klasöründeki örnek proxy kendi anahtarınla çalışır.',
  },
  {
    q: 'Bildirimler çalışmıyor?',
    a: 'Sistem ayarlarından bildirim iznini kontrol et. Hatırlatma eklediğinde uygulama kapalıyken de gelir.',
  },
  {
    q: 'Verilerim nerede saklanıyor?',
    a: 'Telefonunda AsyncStorage içinde. İnternet paylaşımı yapmaz. Ayarlardan dilediğin zaman sıfırlayabilirsin.',
  },
  {
    q: 'Yeni niş ekleyebilir miyim?',
    a: 'Şimdilik 8 niş destekleniyor. data/content-pool.json dosyasına yeni fikirler ekleyebilirsin.',
  },
  {
    q: 'Streak nasıl çalışıyor?',
    a: 'Ana sayfayı açtığında bugün kaydedilir. Üst üste günlere göre serini artar.',
  },
];

const APP_VERSION = (Constants.expoConfig?.version as string) ?? '1.0.0';

export default function InfoScreen() {
  const [open, setOpen] = useState<number | null>(0);

  const onFeedback = async () => {
    try {
      await Share.share({
        message: 'Compass — İlham Pusulam geri bildirim: ',
        title: 'Geri bildirim',
      });
    } catch {}
  };

  const onMail = () => {
    Linking.openURL('mailto:hello@contentcoach.app?subject=Content%20Coach%20Feedback');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 80 }}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Bilgi & Destek</Text>
          <Text style={styles.subtitle}>SSS, sürüm ve iletişim</Text>
        </View>
      </View>

      <View style={styles.aboutCard}>
        <Text style={styles.brandIcon}>🧭</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandName}>Compass</Text>
          <Text style={styles.brandSub}>İlham Pusulam · v{APP_VERSION}</Text>
        </View>
      </View>

      <Text style={styles.section}>Sık Sorulan Sorular</Text>
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

      <Text style={styles.section}>İletişim</Text>
      <Pressable onPress={onFeedback} style={styles.actionBtn}>
        <Text style={styles.actionText}>💬 Geri bildirim gönder</Text>
      </Pressable>
      <Pressable onPress={onMail} style={styles.actionBtn}>
        <Text style={styles.actionText}>📧 hello@contentcoach.app</Text>
      </Pressable>

      <Text style={styles.section}>Hakkında</Text>
      <View style={styles.aboutCard}>
        <Text style={styles.aboutBody}>
          Compass — İlham Pusulam, niş bazlı içerik üreticileri için haftalık fikir planlayıcı, hatırlatıcı ve AI asistanıdır.
          Tüm veriler cihazında saklanır.
        </Text>
      </View>

      <Text style={styles.creditText}>Made with ❤️ in 2026</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
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
