import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { StoreProvider } from '../lib/store';
import { colors } from '../ui/kit';

export default function Layout() {
  return (
    // Android draws edge to edge, so the keyboard controller needs to know the system
    // bars are translucent to measure keyboard insets correctly.
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
      <StoreProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.mossDark,
            headerTitleStyle: { fontWeight: '700', color: colors.ink },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'My plants' }} />
          <Stack.Screen name="profile" options={{ title: 'Seller profile' }} />
          <Stack.Screen name="sales" options={{ title: 'Sales record' }} />
          <Stack.Screen name="leftovers" options={{ title: 'Leftovers' }} />
          <Stack.Screen name="plant/[id]" options={{ title: 'Plant' }} />
          <Stack.Screen name="sale/new" options={{ title: 'New Grower Showcase' }} />
          <Stack.Screen name="sale/[id]/index" options={{ title: 'Grower Showcase' }} />
          <Stack.Screen name="sale/[id]/post" options={{ title: 'Post the showcase' }} />
          <Stack.Screen name="sale/[id]/lot" options={{ title: 'Lot' }} />
          <Stack.Screen name="sale/[id]/claims" options={{ title: 'Claims' }} />
          <Stack.Screen name="sale/[id]/rundown" options={{ title: 'After the showcase' }} />
        </Stack>
      </StoreProvider>
    </KeyboardProvider>
  );
}
