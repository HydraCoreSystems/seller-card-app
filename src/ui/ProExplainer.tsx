import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { PRO_POINTS, PRO_PRIVACY, PRO_TITLE } from '../core/pro';
import { useStore } from '../lib/store';
import { Button, colors } from './kit';

/**
 * What a free seller sees where the checkout chain would be: the chain explained in plain words,
 * with nothing in it that looks broken or half working, and a way to the paywall. The Phil build
 * has Pro always on, so it never shows this.
 */
export function ProExplainer({ compact = false }: { compact?: boolean }) {
  const store = useStore();
  if (store.pro) return null;
  return (
    <View style={{ backgroundColor: colors.mossTint, borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16, marginBottom: 6 }}>{PRO_TITLE}</Text>
      <Text style={{ color: colors.ink, marginBottom: 6 }}>Pro takes the second half of a sale off your plate: getting paid and getting clean shipping details in one place.</Text>
      {compact ? null : PRO_POINTS.map((p) => (
        <Text key={p} style={{ color: colors.ink, marginBottom: 4 }}>
          {'•'} {p}
        </Text>
      ))}
      <Text style={{ color: colors.mossDark, fontWeight: '600', marginTop: 6, marginBottom: 8 }}>{PRO_PRIVACY}</Text>
      <Button title="See Skrybix Pro" onPress={() => router.push('/paywall')} />
    </View>
  );
}
