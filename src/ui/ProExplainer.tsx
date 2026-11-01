import { Text, View } from 'react-native';
import { PRO_POINTS, PRO_PRIVACY, PRO_TEST_NOTE, PRO_TITLE } from '../core/pro';
import { isPhil } from '../core/variant';
import { useStore } from '../lib/store';
import { Button, Note, colors } from './kit';

/**
 * What a free seller sees where the checkout chain would be: the chain explained in plain words,
 * with nothing in it that looks broken or half working. In this test build there is no payment, so
 * the seller can switch the chain on to try it.
 */
export function ProExplainer({ compact = false }: { compact?: boolean }) {
  const store = useStore();
  // The closed test build shows nothing new. The Phil build has Pro unlocked, so there is nothing to explain there.
  // The explainer stays for the shipping product, where the paywall will gate Pro.
  if (!isPhil() || store.pro) return null;
  return (
    <View style={{ backgroundColor: colors.mossTint, borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16, marginBottom: 6 }}>{PRO_TITLE}</Text>
      <Text style={{ color: colors.ink, marginBottom: 6 }}>Pro takes the second half of a sale off your plate: getting paid and getting clean shipping details in one place.</Text>
      {compact ? null : PRO_POINTS.map((p) => (
        <Text key={p} style={{ color: colors.ink, marginBottom: 4 }}>
          {'•'} {p}
        </Text>
      ))}
      <Text style={{ color: colors.mossDark, fontWeight: '600', marginTop: 6 }}>{PRO_PRIVACY}</Text>
      <Note>{PRO_TEST_NOTE}</Note>
      <Button title="Turn on Pro to try it" onPress={() => store.setPro(true)} />
    </View>
  );
}
