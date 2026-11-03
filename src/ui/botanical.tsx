import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, Pressable, Text, View, type ImageStyle, type ViewStyle } from 'react-native';
import type { Glance } from '../core/glance';
import { PHIL_SHADOW } from './styleDefs';
import { ACCENT, DISPLAY_FONT, PHIL_COLORS } from './theme';

// The plant room pieces of the Phil build. None of these render in the closed test build.

/** One leaf from the app's own icon, set at a quiet opacity. */
function Leaf({ size, opacity, rotate, style }: { size: number; opacity: number; rotate: string; style: ImageStyle }) {
  return (
    <Image
      source={require('../../assets/leaf.png')}
      accessibilityIgnoresInvertColors
      style={[{ position: 'absolute', width: size, height: (size * 195) / 230, opacity, transform: [{ rotate }] }, style]}
    />
  );
}

/**
 * Soft botanical ground behind a screen: two broad green washes and a few leaves from the app's icon, all
 * at whisper strength so a seller's own plant photos stay the heroes. `lush` is for the home screen, the
 * empty states and the setup walk, where there is room to breathe.
 */
export function Backdrop({ lush = false }: { lush?: boolean }) {
  const k = lush ? 1 : 0.55;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: -140, right: -120, width: 360, height: 360, borderRadius: 180, backgroundColor: PHIL_COLORS.mossTint, opacity: 0.55 * k }} />
      <View style={{ position: 'absolute', bottom: -160, left: -140, width: 380, height: 380, borderRadius: 190, backgroundColor: PHIL_COLORS.mossTint, opacity: 0.45 * k }} />
      <Leaf size={190} opacity={0.07 * k} rotate="18deg" style={{ top: 70, right: -46 }} />
      <Leaf size={120} opacity={0.06 * k} rotate="-28deg" style={{ bottom: 150, left: -30 }} />
      {lush ? <Leaf size={84} opacity={0.05} rotate="40deg" style={{ top: 380, left: 24 }} /> : null}
    </View>
  );
}

/** A price tag the way a good shop hangs one: a gold tag with a punched hole, the price in the display serif. */
export function PriceTag({ children, big = false }: { children: ReactNode; big?: boolean }) {
  const h = big ? 30 : 26;
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          height: h,
          paddingLeft: 8,
          paddingRight: 12,
          gap: 7,
          backgroundColor: ACCENT.gold,
          borderTopLeftRadius: h / 2,
          borderBottomLeftRadius: h / 2,
          borderTopRightRadius: 8,
          borderBottomRightRadius: 8,
        },
        PHIL_SHADOW.chip,
      ]}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: PHIL_COLORS.bg, borderWidth: 1, borderColor: 'rgba(31,42,31,0.35)' }} />
      <Text style={{ fontSize: big ? 17 : 15, fontWeight: '700', color: ACCENT.goldInk, fontFamily: DISPLAY_FONT }}>{children}</Text>
    </View>
  );
}

/** Fades and settles a card in when it is built. Short and still: nothing bounces. */
export function Reveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: ViewStyle }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 240, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

/** The home screen's sale at a glance: three numbers and the one next thing to do. */
export function GlanceCard({ glance, onNext }: { glance: Glance; onNext: () => void }) {
  return (
    <Reveal>
      <View style={[{ backgroundColor: PHIL_COLORS.card, borderRadius: 18, padding: 16, marginBottom: 14, borderTopWidth: 3, borderTopColor: ACCENT.gold }, PHIL_SHADOW.raised]}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {glance.tiles.map((t) => (
            <View key={t.id} style={{ flex: 1, backgroundColor: PHIL_COLORS.mossTint, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10 }}>
              <Text style={{ fontFamily: DISPLAY_FONT, fontSize: 26, color: ACCENT.deep }} numberOfLines={1} adjustsFontSizeToFit>
                {t.value}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: PHIL_COLORS.ink, marginTop: 2 }}>{t.label}</Text>
              <Text style={{ fontSize: 11, color: PHIL_COLORS.soft }}>{t.note}</Text>
            </View>
          ))}
        </View>
        {glance.next ? (
          <Pressable accessibilityRole="button" onPress={onNext} style={({ pressed }) => ({ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.8 : 1 })}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: PHIL_COLORS.soft }}>NEXT UP</Text>
              <Text style={{ fontSize: 15, color: PHIL_COLORS.ink, marginTop: 2 }}>{glance.next.line}</Text>
            </View>
            <View style={[{ backgroundColor: PHIL_COLORS.moss, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 }, PHIL_SHADOW.chip]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{glance.next.button}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    </Reveal>
  );
}

/** A small gear, drawn from plain shapes so it needs no icon library: a ring with eight teeth. */
export function GearIcon({ color, size = 22 }: { color: string; size?: number }) {
  const tooth = { position: 'absolute' as const, left: size * 0.42, top: 0, width: size * 0.16, height: size, borderRadius: size * 0.05, backgroundColor: color };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 45, 90, 135].map((deg) => (
        <View key={deg} style={[tooth, { transform: [{ rotate: `${deg}deg` }] }]} />
      ))}
      <View style={{ width: size * 0.72, height: size * 0.72, borderRadius: size * 0.36, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15, backgroundColor: PHIL_COLORS.card }} />
      </View>
    </View>
  );
}
