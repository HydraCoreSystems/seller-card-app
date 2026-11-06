import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { BackupProvider } from '../lib/backupContext';
import { StoreProvider } from '../lib/store';
import { T, colors } from '../ui/kit';
import { PreviewBanner } from '../ui/PreviewBanner';
import { ResumeTracker } from '../ui/ResumeTracker';
import { TitleScreen } from '../ui/TitleScreen';
import { DISPLAY_FONT } from '../ui/theme';

// Headings and the wordmark use Fraunces in the Phil build. The closed test build loads no fonts at all.
const FONTS = T.name === 'phil' ? { [DISPLAY_FONT]: require('../../assets/fonts/Fraunces_600SemiBold.ttf') } : {};

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  // Wait for the font, but never get stuck on it: if it fails to load, headings quietly use the system font.
  if (T.name === 'phil' && !fontsLoaded && !fontError) return null;
  return (
    // Android draws edge to edge, so the keyboard controller needs to know the system
    // bars are translucent to measure keyboard insets correctly.
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
      <StoreProvider>
        <BackupProvider>
        <StatusBar style="dark" />
        <PreviewBanner />
        <ResumeTracker />
        <Stack
          screenOptions={{
            // The Phil build changes screens with a short fade. Nothing slides far or bounces.
            ...(T.name === 'phil' ? { animation: 'fade' as const, animationDuration: 220 } : {}),
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.mossDark,
            headerTitleStyle: T.display
              ? { fontFamily: T.display, fontWeight: 'normal', fontSize: 19, color: colors.ink }
              : { fontWeight: '700', color: colors.ink },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'My plants' }} />
          <Stack.Screen name="profile" options={{ title: 'Seller profile' }} />
          <Stack.Screen name="sales" options={{ title: 'Sales record' }} />
          <Stack.Screen name="leftovers" options={{ title: 'Leftovers' }} />
          <Stack.Screen name="totals" options={{ title: 'Season totals' }} />
          <Stack.Screen name="sheet" options={{ title: 'Sale Sheet' }} />
          <Stack.Screen name="plant/[id]" options={{ title: 'Plant' }} />
          <Stack.Screen name="sale/new" options={{ title: 'New Grower Showcase' }} />
          <Stack.Screen name="sale/[id]/index" options={{ title: 'Grower Showcase' }} />
          <Stack.Screen name="sale/[id]/post" options={{ title: 'Post the showcase' }} />
          <Stack.Screen name="sale/[id]/lot" options={{ title: 'Lot' }} />
          <Stack.Screen name="sale/[id]/claims" options={{ title: 'Claims' }} />
          <Stack.Screen name="sale/[id]/rundown" options={{ title: 'After the showcase' }} />
          <Stack.Screen name="sale/[id]/checkout" options={{ title: 'Buyer checkout' }} />
          <Stack.Screen name="sale/[id]/packing" options={{ title: 'Packing' }} />
          <Stack.Screen name="sale/[id]/money" options={{ title: 'What you kept' }} />
          <Stack.Screen name="desk" options={{ title: 'Skrybix on your computer', headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="setup" options={{ title: 'Setup' }} />
          <Stack.Screen name="backup" options={{ title: 'Backup' }} />
          <Stack.Screen name="meta/index" options={{ title: 'Facebook Page' }} />
          <Stack.Screen name="meta/create" options={{ title: 'Demonstration sale' }} />
          <Stack.Screen name="meta/posts" options={{ title: 'Page posts' }} />
          <Stack.Screen name="meta/comments" options={{ title: 'Comments' }} />
          <Stack.Screen name="paywall" options={{ title: 'Skrybix Pro', presentation: 'modal' }} />
        </Stack>
        <TitleScreen />
        </BackupProvider>
      </StoreProvider>
    </KeyboardProvider>
  );
}
