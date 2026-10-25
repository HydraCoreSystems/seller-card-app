import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { buyerKey, historyLine } from '../../../core/buyers';
import { buildRundown, salesRecordHtml, unclaimedLots, type RundownBuyer, type RundownLot } from '../../../core/rundown';
import { formatDay, formatPrice } from '../../../core/text';
import { readClaims } from '../../../lib/claimReport';
import { sharePdf } from '../../../lib/exportPdf';
import { useLeftovers, useSale, useStore } from '../../../lib/store';
import { Button, Choice, H, Note, Panel, Screen, colors, styles } from '../../../ui/kit';

export default function RundownScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const sale = useSale(id);
  const [status, setStatus] = useState<string | null>(null);
  const leftovers = useLeftovers().filter((l) => l.saleId === id);

  const rundown = useMemo(() => {
    if (!sale || !store.profile) return null;
    const report = readClaims(sale.claimText, sale, store.profile);
    return buildRundown({ sale, profile: store.profile, report, records: store.records });
  }, [sale, store.profile, store.records]);

  if (!sale || !rundown) return <Screen><Note>This showcase is gone.</Note></Screen>;

  const ties = rundown.lots.filter((l) => l.tie);

  const save = async () => {
    setStatus('Making the record');
    try {
      await sharePdf(`Sales_Record_${rundown.day}.pdf`, salesRecordHtml(rundown));
      setStatus(null);
    } catch {
      setStatus('Something went wrong');
    }
  };

  // Closing marks every clear winner sold in one go. Ties stay open for the seller's call.
  const close = () => {
    const winners = rundown.lots
      .filter((l) => l.winner && !l.ruled)
      .map((l) => ({ lotNumber: l.number, plantName: l.name, buyer: l.winner!, price: l.price }));
    store.closeSale(sale, winners, unclaimedLots(rundown, sale));
    save();
  };

  return (
    <Screen
      footer={
        <Button
          title={status ?? (sale.closedAt ? 'Save the Sales Record' : 'Close the showcase and save the record')}
          disabled={status === 'Making the record'}
          onPress={sale.closedAt ? save : close}
        />
      }
    >
      {!sale.claimText?.trim() ? (
        <Note tone="warn">Paste the comment thread in Claims first, so the rundown knows who won.</Note>
      ) : null}
      {sale.closedAt ? <Note>Closed {formatDay(sale.closedAt)}. Every clear winner is in your sales record.</Note> : null}
      {leftovers.length ? (
        <Button
          kind="secondary"
          title={`${leftovers.length} ${leftovers.length === 1 ? 'leftover' : 'leftovers'} ready to relist`}
          onPress={() => router.push('/leftovers')}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      <Panel>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink }}>
          {rundown.lotsClaimed} of {rundown.lotsOffered} lots claimed
        </Text>
        <Text style={{ color: colors.soft, marginTop: 2 }}>{formatPrice(rundown.claimedValue) || '$0'} claimed</Text>
      </Panel>

      {ties.length ? (
        <View style={{ backgroundColor: colors.warnTint, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <Text style={{ color: colors.warn, fontWeight: '700' }}>
            {ties.length === 1 ? `Lot ${ties[0].number} is a tie.` : `Lots ${ties.map((t) => t.number).join(', ')} are ties.`} Your call.
          </Text>
          <Text style={{ color: colors.warn, marginBottom: 8 }}>Tap Sold on the buyer you pick. Ties stay open until you do.</Text>
          <Button kind="secondary" title="Rule in Claims" onPress={() => router.back()} />
        </View>
      ) : null}

      <H>Buyers</H>
      {rundown.buyers.length ? (
        rundown.buyers.map((b) => <BuyerCard key={b.name} buyer={b} saleId={sale.id} closed={!!sale.closedAt} />)
      ) : (
        <Note>No winners yet.</Note>
      )}

      <H>Winners by lot</H>
      {rundown.lots.map((l) => (
        <LotLine key={l.number} lot={l} />
      ))}

      <H>Open buyer questions</H>
      {rundown.questions.length ? (
        rundown.questions.map((q, i) => (
          <Panel key={i}>
            <Text style={{ fontWeight: '600', color: colors.ink }}>
              {q.author}
              <Text style={{ color: colors.soft, fontWeight: '400' }}>
                {q.lot !== null ? `  lot ${q.lot}` : '  in the thread'}
                {q.time ? `, ${q.time}` : ''}
              </Text>
            </Text>
            <Text style={{ color: colors.ink }}>{q.text}</Text>
          </Panel>
        ))
      ) : (
        <Note>None.</Note>
      )}
    </Screen>
  );
}

type PayChoice = 'waiting' | 'paid' | 'never';

function BuyerCard({ buyer, saleId, closed }: { buyer: RundownBuyer; saleId: string; closed: boolean }) {
  const store = useStore();
  const saved = store.buyerNotes[buyerKey(buyer.name)] ?? '';
  const [note, setNote] = useState(saved);
  return (
    <Panel style={buyer.payment === 'paid' ? { opacity: 0.6 } : undefined}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{buyer.name}</Text>
        <Text style={{ fontWeight: '700', color: colors.ink }}>{formatPrice(buyer.total) || '$0'}</Text>
      </View>
      {buyer.history ? (
        <Text style={{ color: buyer.history.unpaidSales ? colors.warn : colors.moss, fontSize: 13, marginBottom: 2 }}>
          Repeat buyer: {historyLine(buyer.history)}
        </Text>
      ) : null}
      {buyer.lots.map((l) => (
        <Text key={l.number} style={{ color: colors.soft }}>
          Lot {l.number}, {l.name}
          {l.price !== null ? `, ${formatPrice(l.price)}` : ''}
        </Text>
      ))}
      <TextInput
        value={note}
        onChangeText={setNote}
        onBlur={() => note.trim() !== saved && store.saveBuyerNote(buyer.name, note)}
        maxLength={120}
        placeholder="Add a note about this buyer"
        placeholderTextColor="#9AA39A"
        accessibilityLabel={`Note about ${buyer.name}`}
        style={[styles.input, { fontSize: 14, paddingVertical: 6, marginTop: 8, marginBottom: closed ? 8 : 0 }]}
      />
      {closed ? (
        <Choice<PayChoice>
          value={buyer.payment ?? 'waiting'}
          options={[
            { value: 'waiting', label: 'Waiting' },
            { value: 'paid', label: 'Paid' },
            { value: 'never', label: 'Never paid' },
          ]}
          onChange={(v) => store.setPayment(saleId, buyer.name, v === 'waiting' ? undefined : v)}
        />
      ) : null}
    </Panel>
  );
}

function LotLine({ lot }: { lot: RundownLot }) {
  return (
    <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.line }}>
      <Text style={{ fontWeight: '600', color: colors.ink }}>
        Lot {lot.number}: {lot.name}
        {lot.price !== null ? <Text style={{ color: colors.soft, fontWeight: '400' }}>  {formatPrice(lot.price)}</Text> : null}
      </Text>
      <Text style={{ color: lot.winner ? colors.moss : lot.tie ? colors.warn : colors.soft }}>
        {lot.winner ?? (lot.tie ? `Tie: ${lot.tie.join(' or ')}` : 'Unclaimed')}
      </Text>
      {lot.line.length ? <Text style={{ color: colors.soft, fontSize: 13 }}>Next in line: {lot.line.join(', ')}</Text> : null}
    </View>
  );
}
