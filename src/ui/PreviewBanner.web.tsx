import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useStore } from '../lib/store';
import { Note, colors } from './kit';

/**
 * The browser preview's label, across the top of every screen: a taste of the Android app for
 * iPhone waitlisters. It makes no promise the web matches the phone app.
 */
export function PreviewBanner() {
  // The sample lives in memory only, so a refresh or an automatic tab reload on one of its screens
  // finds it missing. Those land on the welcome screen instead.
  const path = usePathname();
  const { sample } = useStore();
  const ready = !!useRootNavigationState()?.key;
  useEffect(() => {
    if (ready && !sample && /^\/(sale|plant)\/sample-/.test(path)) router.replace('/');
  }, [ready, sample, path]);

  return (
    <View style={{ backgroundColor: colors.mossDark, paddingVertical: 8, paddingHorizontal: 16 }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>Preview in your browser</Text>
      <Text style={{ color: '#E4EEDF', fontSize: 12, textAlign: 'center' }}>
        A taste of the Android app only. Some things work differently here, and nothing you do is a real sale.
      </Text>
    </View>
  );
}

/** In the preview, where to find the grower seal, since it needs a format switch and a photo. */
export function SealHint() {
  return (
    <Note>
      To see the grower seal, open Profile, pick Hoya and Orchid Commons as the card format, type any grower number,
      and give a plant a photo.
    </Note>
  );
}
