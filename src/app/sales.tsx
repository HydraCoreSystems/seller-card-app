import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { searchRecords, recordsToCsv } from '../core/records';
import { formatDay, formatPrice, parsePrice, toDay } from '../core/text';
import { shareTextFile } from '../lib/exportFile';
import { useStore } from '../lib/store';
import { Button, Field, H, Note, Panel, Row, Screen, colors, styles } from '../ui/kit';

export default function SalesScreen() {
  const store = useStore();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [plantName, setPlantName] = useState('');
  const [buyer, setBuyer] = useState('');
  const [price, setPrice] = useState('');
  const shown = searchRecords(store.records, query);
  const total = shown.reduce((sum, r) => sum + (r.price ?? 0), 0);

  return (
    <Screen>
      <Field label="Search" value={query} onChangeText={setQuery} placeholder="Plant, buyer or date" />
      <Row style={{ marginBottom: 12 }}>
        <Button
          kind="secondary"
          title="Export file"
          disabled={!store.records.length}
          onPress={() => shareTextFile(`sales_${toDay(new Date())}.csv`, recordsToCsv(store.records), 'text/csv')}
          style={{ flex: 1 }}
        />
        <Button kind="secondary" title={adding ? 'Cancel' : 'Add by hand'} onPress={() => setAdding(!adding)} style={{ flex: 1 }} />
      </Row>

      {adding ? (
        <Panel>
          <Field label="Plant" value={plantName} onChangeText={setPlantName} />
          <Field label="Buyer" value={buyer} onChangeText={setBuyer} />
          <Field label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <Button
            title="Add to record"
            disabled={!plantName.trim() || !buyer.trim()}
            onPress={() => {
              store.recordSold({
                saleId: null,
                lotNumber: null,
                plantName: plantName.trim(),
                buyer: buyer.trim(),
                price: parsePrice(price),
                date: toDay(new Date()),
              });
              setPlantName('');
              setBuyer('');
              setPrice('');
              setAdding(false);
            }}
          />
        </Panel>
      ) : null}

      {shown.length ? (
        <Note>
          {shown.length} sold, {formatPrice(total) || '$0'} in all
        </Note>
      ) : (
        <Note>{store.records.length ? 'Nothing matches that search.' : 'Nothing sold yet. Sales you mark from the claim tracker show up here.'}</Note>
      )}
      {shown.map((r) => (
        <View key={r.id} style={[styles.panel, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '600', color: colors.ink }}>{r.plantName}</Text>
            <Text style={{ color: colors.soft }}>
              {r.buyer}
              {r.price !== null ? `, ${formatPrice(r.price)}` : ''}, {formatDay(r.date)}
              {r.lotNumber !== null ? `, lot ${r.lotNumber}` : ''}
              {r.payment === 'paid' ? ', paid' : r.payment === 'never' ? ', never paid' : ''}
            </Text>
          </View>
          <Button kind="quiet" title="Remove" onPress={() => store.deleteRecord(r.id)} />
        </View>
      ))}

      {store.sales.length ? (
        <>
          <H>Your Grower Showcases</H>
          {store.sales.map((s) => (
            <Pressable key={s.id} accessibilityRole="button" onPress={() => router.push(`/sale/${s.id}`)} style={styles.panel}>
              <Text style={{ fontWeight: '600', color: colors.ink }}>
                {s.kind === 'auction' ? 'Grower Showcase auction' : 'Grower Showcase'} of {s.lots.length} lots
              </Text>
              <Text style={{ color: colors.soft }}>Made {formatDay(s.createdAt)}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
