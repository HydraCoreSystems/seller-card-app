import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Text, View } from 'react-native';
import { appName } from '../core/brand';
import { TITLE_FADE_MS, titleLiftAt } from '../core/title';
import { onAppReady, readyAfter, sinceLaunch } from '../lib/appReady';
import { Backdrop } from './botanical';
import { ACCENT, DISPLAY_FONT, PHIL_COLORS } from './theme';

// True once the title has run in this launch. A cold open starts a fresh process, so it shows again then.
let shownThisLaunch = false;

/**
 * The cover of the app: the name, large, on the plant room ground with a gold rule and a thin gold frame.
 * It sits over everything for about two seconds on a cold open, then fades away on its own. No tap, no
 * button, no spinner, no other words. The app mounts underneath, so the setup walk or the home screen is
 * already in place when the cover lifts.
 *
 * The home screen reports when it is up (lib/appReady.ts). If that takes longer than the hold, the cover waits,
 * up to the cap in core/title.ts.
 */
export function TitleScreen() {
  const [gone, setGone] = useState(shownThisLaunch);
  const [name] = useState(() => new Animated.Value(0));
  const [rule] = useState(() => new Animated.Value(0));
  const [leave] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (gone) return;
    Animated.timing(name, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(rule, { toValue: 1, duration: 600, delay: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [gone, name, rule]);

  useEffect(() => {
    if (gone) return;
    let timer: ReturnType<typeof setTimeout>;
    const lift = () => {
      Animated.timing(leave, { toValue: 0, duration: TITLE_FADE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(() => {
        shownThisLaunch = true;
        setGone(true);
      });
    };
    // Counted from launch, so a slow start eats into the hold instead of adding to it.
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(lift, Math.max(0, titleLiftAt(readyAfter()) - sinceLaunch()));
    };
    schedule();
    const off = onAppReady(schedule);
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [gone, leave]);

  if (gone) return null;
  const serif = DISPLAY_FONT_OR_SYSTEM();
  return (
    <Animated.View
      accessibilityViewIsModal
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: PHIL_COLORS.bg, opacity: leave, alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
    >
      <Backdrop lush />
      <View pointerEvents="none" style={{ position: 'absolute', top: 18, left: 18, right: 18, bottom: 18, borderWidth: 1, borderColor: ACCENT.gold, borderRadius: 6, opacity: 0.7 }} />
      <Animated.View style={{ alignItems: 'center', opacity: name, transform: [{ translateY: name.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        <Text accessibilityRole="header" style={{ fontFamily: serif, fontWeight: 'normal', fontSize: 58, letterSpacing: 1, color: ACCENT.deep }}>
          {appName()}
        </Text>
      </Animated.View>
      <Animated.View style={{ marginTop: 18, width: 84, height: 2, borderRadius: 1, backgroundColor: ACCENT.gold, opacity: rule, transform: [{ scaleX: rule }] }} />
    </Animated.View>
  );
}

/** Fraunces where it is loaded (the Phil build), otherwise the system serif so the closed test build loads nothing new. */
function DISPLAY_FONT_OR_SYSTEM(): string {
  return process.env.EXPO_PUBLIC_APP_VARIANT === 'phil' ? DISPLAY_FONT : Platform.select({ ios: 'Georgia', default: 'serif' });
}
