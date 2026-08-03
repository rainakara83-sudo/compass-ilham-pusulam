import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SUPPORTED_LANGUAGES, SupportedLng, setAppLanguage } from '../../i18n';

export default function LanguageSelect() {
  const router = useRouter();

  const pick = async (lng: SupportedLng) => {
    await setAppLanguage(lng);
    router.replace('/(onboarding)/niche-select');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: 80, paddingHorizontal: 20, paddingBottom: 40 }}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepText}>1 / 4</Text>
      </View>
      <Text style={styles.title}>🌍 Dilini seç</Text>
      <Text style={styles.subtitle}>Uygulama içinde kullanmak istediğin dili seç</Text>

      {SUPPORTED_LANGUAGES.map((lng) => (
        <Pressable
          key={lng.code}
          onPress={() => pick(lng.code)}
          style={styles.card}
        >
          <Text style={styles.flag}>{lng.flag}</Text>
          <View>
            <Text style={styles.cardTitle}>{lng.label}</Text>
            <Text style={styles.cardSub}>{lng.code.toUpperCase()}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  stepBadge: { alignSelf: 'flex-start', backgroundColor: '#E0E7FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 12 },
  stepText: { fontSize: 11, color: '#4338CA', fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8, marginBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  flag: { fontSize: 32 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 },
});
