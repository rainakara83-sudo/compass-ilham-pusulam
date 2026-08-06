import React from 'react';
import { Image, ImageStyle, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import nichesData from '../data/niches.json';

const FITNESS_IMG = require('../assets/niches/fitness.png');
const FOOD_IMG = require('../assets/niches/food.png');
const TECH_IMG = require('../assets/niches/tech.png');
const FASHION_IMG = require('../assets/niches/fashion.png');
const TRAVEL_IMG = require('../assets/niches/travel.png');
const GAMING_IMG = require('../assets/niches/gaming.png');
const PD_IMG = require('../assets/niches/personal_dev.png');
const BEAUTY_IMG = require('../assets/niches/beauty.png');
const ASTROLOGY_IMG = require('../assets/niches/astrology.png');

const IMG_MAP: Record<string, number> = {
  fitness: FITNESS_IMG,
  food: FOOD_IMG,
  tech: TECH_IMG,
  fashion: FASHION_IMG,
  travel: TRAVEL_IMG,
  gaming: GAMING_IMG,
  personal_dev: PD_IMG,
  beauty: BEAUTY_IMG,
  astrology: ASTROLOGY_IMG,
};

type Niche = {
  id: string;
  icon: string;
  color: string;
  description?: string;
  image?: string;
};

const NICHES = nichesData as Niche[];

export function getNiche(id: string | null | undefined): Niche | null {
  if (!id) return null;
  return NICHES.find((n) => n.id === id) ?? null;
}

type NicheImageProps = {
  nicheId: string | null | undefined;
  size?: number;
  style?: ImageStyle;
  borderRadius?: number;
};

export function NicheImage({ nicheId, size = 64, style, borderRadius = 14 }: NicheImageProps) {
  const n = getNiche(nicheId);
  if (!n || !IMG_MAP[n.id]) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: n?.color ? n.color + '22' : '#C5D2A0',
            justifyContent: 'center',
            alignItems: 'center',
          },
          style,
        ]}
      >
        <Text style={{ fontSize: size * 0.4 }}>{n?.icon ?? '·'}</Text>
      </View>
    );
  }
  return (
    <Image
      source={IMG_MAP[n.id]}
      style={[
        {
          width: size,
          height: size,
          borderRadius,
          aspectRatio: 1,
          backgroundColor: n.color + '22',
        },
        style,
      ]}
      resizeMode="cover"
    />
  );
}

type NicheCardProps = {
  nicheId: string;
  selected?: boolean;
  onPress?: () => void;
  size?: number;
  label?: string;
  containerStyle?: ViewStyle;
};

export function NicheCard({ nicheId, selected, onPress, size = 88, label, containerStyle }: NicheCardProps) {
  const n = getNiche(nicheId);
  if (!n) return null;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          width: size + 16,
          opacity: selected === undefined ? 1 : selected ? 1 : 0.7,
          borderColor: selected ? n.color : 'transparent',
        },
        containerStyle,
      ]}
    >
      <NicheImage nicheId={nicheId} size={size} borderRadius={16} />
      {label !== undefined && (
        <Text style={styles.cardLabel} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  cardLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: '#2F3E2C',
    textAlign: 'center',
  },
});
