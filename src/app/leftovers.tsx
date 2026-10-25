import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { formatDay, formatPrice, plantDisplayName } from '../core/text';
import { useLeftovers, useStore } from '../lib/store';
import { Button, Note, Screen, Thumb, colors, styles } from '../ui/kit';

export default function LeftoversScreen() {
  const store = useStore();
  const leftovers = useLeftovers();

  return (
    <Screen
      footer={
        leftovers.length ? (
          <Button
            title={`Relist ${leftovers.length === 1 ? 'it' : `all ${leftovers.length}`} in a new sale`}
            onPress={() => router.push({ pathname: '/sale/new', params: { leftovers: leftovers.map((l) => l.key).join(',') } })}
          />
        ) : undefined
      }
    >
      <Note>
        {leftovers.length
          ? 'What didn’t sell, and what a buyer never paid for. They go up again with the same cards and prices, numbered from 1. Change anything on the lot after.'
          : 'Nothing left over. Lots nobody claims, and lots a buyer never pays for, show up here when you close a sale.'}
      </Note>
      {leftovers.map((l) => (
        <View key={l.key} style={[styles.panel, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
          <Thumb uri={l.lot.photoUri} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.ink }} numberOfLines={2}>
              {plantDisplayName(l.lot.name, l.lot.noid) || 'Unnamed'}
              {l.lot.price !== null ? <Text style={{ color: colors.soft, fontWeight: '400' }}>  {formatPrice(l.lot.price)}</Text> : null}
            </Text>
            <Text style={{ color: colors.soft, fontSize: 13 }}>
              {l.why === 'unpaid' ? 'Never paid for' : 'Unclaimed'}, lot {l.lotNumber} of the sale closed {formatDay(l.closedAt)}
            </Text>
            <Text style={{ color: l.times > 1 ? colors.warn : colors.soft, fontSize: 13 }}>
              Left over {l.times === 1 ? 'once' : l.times === 2 ? 'twice' : `${l.times} times`}
            </Text>
          </View>
          <Button kind="quiet" title="Remove" onPress={() => store.removeLeftover(l.key)} />
        </View>
      ))}
    </Screen>
  );
}
