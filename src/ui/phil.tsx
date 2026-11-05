import type { ReactNode } from 'react';
import { Image, Pressable, Text, View, type ViewStyle } from 'react-native';
import { appName } from '../core/brand';
import { formatPrice, plantDisplayName } from '../core/text';
import type { Plant } from '../core/types';
import { PriceTag } from './botanical';
import { PHIL_SHADOW } from './styleDefs';
import { ACCENT, DISPLAY_FONT, mixHex, PHIL_COLORS, STAGE_LOOK } from './theme';

// The pieces of the Phil build's layered look. None of these render in the closed test build.

const STRIPS = 16;

/** A vertical gradient from deep green down to the darker green, drawn as thin strips so it needs no extra library. */
export function BandGradient() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {Array.from({ length: STRIPS }, (_, i) => (
        // Each strip runs a little past its own slot and the next one paints over it, so no seam shows between them.
        <View
          key={i}
          style={{ position: 'absolute', left: 0, right: 0, top: `${(i * 100) / STRIPS}%`, height: `${100 / STRIPS + 4}%`, backgroundColor: mixHex(ACCENT.deep, ACCENT.deepDark, i / (STRIPS - 1)) }}
        />
      ))}
    </View>
  );
}

/**
 * The home screen's brand moment: the app name in the display serif and a thin gold rule. The maker line
 * belongs on the cards the app makes, not inside the app. The first card on the screen is pulled up over its bottom edge.
 */
export function BrandBand({ style }: { style?: ViewStyle }) {
  return (
    <View style={[{ overflow: 'hidden', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 }, style]}>
      <BandGradient />
      <Text
        accessibilityRole="header"
        style={{ fontFamily: DISPLAY_FONT, fontWeight: 'normal', fontSize: 36, letterSpacing: 0.4, color: ACCENT.cream }}
      >
        {appName()}
      </Text>
      <View style={{ marginTop: 12, width: 56, height: 2, borderRadius: 1, backgroundColor: ACCENT.gold }} />
    </View>
  );
}

/** The price on a plant card: a small raised gold pill with dark text. */
export function PriceChip({ children }: { children: ReactNode }) {
  return (
    <View style={[{ alignSelf: 'flex-start', backgroundColor: ACCENT.gold, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 2 }, PHIL_SHADOW.chip]}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: ACCENT.goldInk }}>{children}</Text>
    </View>
  );
}

/** A sold plant's mark: an outlined stamp set at a slight angle, in the spirit of the photo stamp. */
export function SoldChip({ style }: { style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(255,255,255,0.94)',
          borderWidth: 1.5,
          borderColor: PHIL_COLORS.danger,
          borderRadius: 5,
          paddingHorizontal: 7,
          paddingVertical: 2,
          transform: [{ rotate: '-8deg' }],
        },
        PHIL_SHADOW.chip,
        style,
      ]}
    >
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: PHIL_COLORS.danger }}>SOLD</Text>
    </View>
  );
}

export type StageName = keyof typeof STAGE_LOOK;

/** One rundown status for a winner: won, contacted, paid or shipped. A stage not reached yet stays quiet. */
export function StageChip({ stage, reached, children }: { stage: StageName; reached: boolean; children: ReactNode }) {
  const look = reached ? STAGE_LOOK[stage] : { backgroundColor: PHIL_COLORS.line, color: PHIL_COLORS.soft };
  return (
    <View style={[{ backgroundColor: look.backgroundColor, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }, reached ? PHIL_SHADOW.chip : null]}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: look.color }}>{children}</Text>
    </View>
  );
}

/** A deadline's clock time as a gold chip with dark text. */
export function DeadlineChip({ children }: { children: ReactNode }) {
  return (
    <View style={[{ backgroundColor: ACCENT.gold, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 }, PHIL_SHADOW.chip]}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: ACCENT.goldInk }}>{children}</Text>
    </View>
  );
}

/**
 * One plant on the home list: a photo forward raised card with the name, the price in a gold pill, and a
 * slanted SOLD chip on a sold plant. The photo comes in as a slot so the card stays plain to render.
 */
export function PlantRow({
  plant,
  picking,
  on,
  index,
  thumb,
  onPress,
}: {
  plant: Plant;
  picking: boolean;
  on: boolean;
  index: number;
  thumb: ReactNode;
  onPress: () => void;
}) {
  const priceText = plant.price === null ? 'No price yet' : `${plant.kind === 'auction' ? 'Opens at ' : ''}${formatPrice(plant.price)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={picking ? { selected: on } : undefined}
      disabled={picking && plant.sold}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 12,
          borderRadius: 18,
          backgroundColor: PHIL_COLORS.card,
          borderWidth: 2,
          borderColor: on ? PHIL_COLORS.moss : 'transparent',
          marginBottom: 12,
          opacity: pressed ? 0.85 : 1,
        },
        PHIL_SHADOW.raised,
      ]}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: plant.sold ? 0.6 : 1 }}>
        {thumb}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontSize: 18, fontFamily: DISPLAY_FONT, color: PHIL_COLORS.ink, paddingRight: plant.sold ? 50 : 0 }} numberOfLines={2}>
            {plantDisplayName(plant.name, plant.noid) || 'Unnamed plant'}
          </Text>
          {plant.price === null ? <Text style={{ color: PHIL_COLORS.soft, fontSize: 14 }}>{priceText}</Text> : <PriceTag>{priceText}</PriceTag>}
        </View>
      </View>
      {plant.sold ? <SoldChip style={{ position: 'absolute', top: 10, right: 12 }} /> : null}
      {picking && on ? (
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: PHIL_COLORS.moss, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{index + 1}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * One lot of a sale in the Phil build: the plant's photo leads, large, edge to edge on the card, and
 * the name and price sit under it like a price tag in a good shop.
 */
export function LotCard({
  photo,
  number,
  name,
  price,
  soldTo,
  note,
  onPress,
}: {
  photo: string | null;
  number: number;
  name: string;
  /** Text for the price tag, or null when the lot has no price yet. */
  price: string | null;
  soldTo: string | null;
  note: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        { borderRadius: 18, backgroundColor: PHIL_COLORS.card, marginBottom: 14, overflow: 'hidden', opacity: pressed ? 0.88 : 1 },
        PHIL_SHADOW.raised,
      ]}
    >
      <View style={{ width: '100%', aspectRatio: 4 / 3, backgroundColor: PHIL_COLORS.mossTint, alignItems: 'center', justifyContent: 'center' }}>
        {photo ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ color: PHIL_COLORS.soft, fontSize: 12 }}>No photo</Text>}
        <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(30,77,59,0.9)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Text style={{ color: ACCENT.cream, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 }}>LOT {number}</Text>
        </View>
        {soldTo ? <SoldChip style={{ position: 'absolute', top: 12, right: 12 }} /> : null}
      </View>
      <View style={{ padding: 14, gap: 8 }}>
        <Text style={{ fontSize: 18, fontFamily: DISPLAY_FONT, color: PHIL_COLORS.ink }} numberOfLines={2}>
          {name}
        </Text>
        {soldTo ? (
          <Text style={{ color: PHIL_COLORS.moss, fontWeight: '600' }}>Sold to {soldTo}</Text>
        ) : price ? (
          <PriceTag big>{price}</PriceTag>
        ) : (
          <Text style={{ color: PHIL_COLORS.warn, fontWeight: '600' }}>No price yet</Text>
        )}
        {note ? <Text style={{ color: PHIL_COLORS.soft, fontSize: 12 }}>{note}</Text> : null}
      </View>
    </Pressable>
  );
}
