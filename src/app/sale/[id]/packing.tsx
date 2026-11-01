import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, Text, TextInput, View } from 'react-native';
import { addressLines, buildLabelFile, packingListHtml, packingRows, shippedMessage, type CheckoutRow } from '../../../core/checkout';
import { formatPrice } from '../../../core/text';
import { sharePdf } from '../../../lib/exportPdf';
import { shareTextFile } from '../../../lib/exportFile';
import { useSale, useStore } from '../../../lib/store';
import { useCheckout } from '../../../lib/useCheckout';
import { Button, H, Note, Panel, Row, Screen, colors, styles, useCopy } from '../../../ui/kit';
import { ProExplainer } from '../../../ui/ProExplainer';

/** Paid winners with a form in: what goes in each box, where it goes, and the label file for Pirate Ship. */
export default function PackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const sale = useSale(id);
  const c = useCheckout(sale);
  const [status, setStatus] = useState<string | null>(null);

  if (!sale || !c) return <Screen><Note>This showcase is gone.</Note></Screen>;
  if (!store.pro) return <Screen><ProExplainer /></Screen>;

  const { rows, room, rundown } = c;
  const toPack = packingRows(rows);
  const label = buildLabelFile(rows);
  const title = `Packing list ${rundown.day}`;

  const print = async () => {
    setStatus('Making the list');
    try {
      await sharePdf(`Packing_List_${rundown.day}.pdf`, packingListHtml(toPack, title, room));
      setStatus(null);
    } catch {
      setStatus('Something went wrong');
    }
  };

  const exportLabels = async () => {
    setStatus('Making the file');
    try {
      await shareTextFile(`Pirate_Ship_${rundown.day}.csv`, label.csv, 'text/csv');
      setStatus(null);
    } catch {
      setStatus('Something went wrong');
    }
  };

  return (
    <Screen>
      <Note>Buyers show up here once their form is in and you have marked them paid. Everyone else is listed below, so nobody drops out of sight.</Note>

      <Button title={status === 'Making the list' ? status : 'Print the packing list'} disabled={!toPack.length || !!status} onPress={print} />

      <H>To pack ({toPack.length})</H>
      {toPack.length ? toPack.map((r) => <PackCard key={r.key} row={r} saleId={sale.id} />) : <Note>Nobody is ready to pack yet.</Note>}

      <H>Label file for Pirate Ship</H>
      <Note>
        Only buyers marked paid go in the file. The first time you upload it, Pirate Ship asks you to match its columns to ours:
        Name, Address Line 1, City, State, Zip and Weight (oz). After that it remembers.
      </Note>
      <Button
        kind="secondary"
        title={status === 'Making the file' ? status : `Export ${label.included.length} ${label.included.length === 1 ? 'label' : 'labels'}`}
        disabled={!label.included.length || !!status}
        onPress={exportLabels}
      />
      {label.noWeight ? (
        <Note>
          {label.noWeight} {label.noWeight === 1 ? 'row has' : 'rows have'} no weight. Set a default weight in your room’s profile, or type one on the buyer, or fill it in on Pirate Ship.
        </Note>
      ) : null}
      {label.skipped.length ? (
        <>
          <H>Not in the file</H>
          {label.skipped.map((s) => (
            <Text key={s.buyer} style={{ color: colors.soft, marginBottom: 4 }}>
              {s.buyer}: {s.reason}
            </Text>
          ))}
        </>
      ) : null}
      {status === 'Something went wrong' ? <Note tone="warn">Something went wrong. Try again.</Note> : null}

      <Button kind="quiet" title="Back to the rundown" onPress={() => router.back()} style={{ marginTop: 12 }} />
    </Screen>
  );
}

function PackCard({ row, saleId }: { row: CheckoutRow; saleId: string }) {
  const store = useStore();
  const [copied, copy] = useCopy();
  const [tracking, setTracking] = useState(row.tracking);
  const [weight, setWeight] = useState(row.weightOz === null ? '' : String(row.weightOz));
  const address = row.response ? addressLines(row.response) : [];
  const message = shippedMessage({ buyer: row.buyer, lots: row.lots, tracking: tracking.trim() });

  return (
    <Panel>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{row.buyer}</Text>
        <Text style={{ color: colors.soft }}>{row.pickup ? 'Local pickup' : row.shipped ? 'Shipped' : row.packed ? 'Packed' : 'To pack'}</Text>
      </View>
      {row.lots.map((l) => (
        <Text key={l.number} style={{ color: colors.ink }}>
          Lot {l.number}, {l.name}
          {l.price !== null ? `, ${formatPrice(l.price)}` : ''}
        </Text>
      ))}
      {!row.pickup && address.length ? (
        <View style={{ marginTop: 6 }}>
          {address.map((line, i) => (
            <Text key={i} selectable style={{ color: colors.ink }}>{line}</Text>
          ))}
        </View>
      ) : null}
      {row.response?.note ? <Text style={{ color: colors.soft, marginTop: 4 }}>Buyer’s note: {row.response.note}</Text> : null}

      <Row style={{ marginTop: 8 }}>
        <Button
          kind={row.packed ? 'secondary' : 'primary'}
          title={row.packed ? 'Packed ✓' : 'Mark packed'}
          onPress={() => store.setFulfillment(saleId, row.key, { packed: !row.packed })}
          style={{ flex: 1 }}
        />
      </Row>

      {row.pickup ? null : (
        <>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            onBlur={() => {
              const n = parseFloat(weight);
              store.setFulfillment(saleId, row.key, { weightOz: Number.isFinite(n) && n > 0 ? n : null });
            }}
            keyboardType="decimal-pad"
            placeholder="Box weight in ounces"
            placeholderTextColor="#9AA39A"
            accessibilityLabel={`Box weight for ${row.buyer}`}
            style={[styles.input, { fontSize: 14, paddingVertical: 6, marginTop: 8 }]}
          />
          <TextInput
            value={tracking}
            onChangeText={setTracking}
            onBlur={() => store.setFulfillment(saleId, row.key, { tracking: tracking.trim() })}
            autoCapitalize="characters"
            placeholder="Paste the tracking number"
            placeholderTextColor="#9AA39A"
            accessibilityLabel={`Tracking number for ${row.buyer}`}
            style={[styles.input, { fontSize: 14, paddingVertical: 6, marginTop: 8 }]}
          />
        </>
      )}

      <Row style={{ marginTop: 8 }}>
        <Button
          kind={row.shipped ? 'secondary' : 'primary'}
          title={row.shipped ? 'Shipped ✓' : row.pickup ? 'Mark handed over' : 'Mark shipped'}
          onPress={() => store.setFulfillment(saleId, row.key, { shipped: !row.shipped, tracking: tracking.trim() })}
          style={{ flex: 1 }}
        />
      </Row>
      {row.shipped ? (
        <Row style={{ marginTop: 6 }}>
          <Button title={copied ? '✓ Copied' : 'Copy shipped message'} onPress={() => copy('ship', message)} style={{ flex: 2 }} />
          <Button kind="secondary" title="Send" onPress={() => Share.share({ message }).catch(() => undefined)} style={{ flex: 1 }} />
        </Row>
      ) : null}
    </Panel>
  );
}
