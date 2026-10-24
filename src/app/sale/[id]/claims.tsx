import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { cleanMentions, showTime, trackClaims, type Claim } from '../../../core/claims';
import { formatPrice, plantDisplayName, toDay } from '../../../core/text';
import type { Lot } from '../../../core/types';
import { lotRecorded, useSale, useStore } from '../../../lib/store';
import { Button, H, Note, Panel, Row, Screen, colors, styles } from '../../../ui/kit';

export default function ClaimsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const sale = useSale(id);
  const [text, setText] = useState(sale?.claimText ?? '');
  const [shown, setShown] = useState(sale?.claimText ?? '');

  const report = useMemo(() => {
    if (!sale || !shown.trim()) return null;
    const maxLot = sale.lots.reduce((m, l) => Math.max(m, l.number), 0) || undefined;
    return trackClaims(shown, {
      sellerName: store.profile?.facebookName?.trim() || store.profile?.sellerName,
      lots: sale.lots.map((l) => ({ number: l.number, name: l.name })),
      maxLot,
    });
  }, [shown, sale, store.profile?.facebookName, store.profile?.sellerName]);

  if (!sale) return <Screen><Note>This sale is gone.</Note></Screen>;

  const lotFor = (n: number): Lot | undefined => sale.lots.find((l) => l.number === n);
  const record = (lot: Lot | undefined, lotNumber: number, buyer: string, label?: string | null) => {
    store.recordSold(
      {
        saleId: sale.id,
        lotNumber,
        plantName: lot ? plantDisplayName(lot.name, lot.noid) : label ?? `Lot ${lotNumber}`,
        buyer,
        price: lot?.price ?? priceIn(label),
        date: toDay(new Date()),
      },
      lot?.plantId,
    );
  };

  const read = () => {
    setShown(text);
    store.saveSale({ ...sale, claimText: text });
  };

  return (
    <Screen>
      <Note>
        Open your sale post, copy all the comments, and paste them here. Claims come back in thread order, lot by lot.
      </Note>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Paste the comment thread"
        placeholderTextColor="#9AA39A"
        accessibilityLabel="Comment thread"
        style={[styles.input, { minHeight: 140, maxHeight: 260, textAlignVertical: 'top', marginBottom: 10 }]}
      />
      <Row style={{ marginBottom: 16 }}>
        <Button title="Read claims" disabled={!text.trim()} onPress={read} style={{ flex: 2 }} />
        <Button kind="secondary" title="Clear" onPress={() => { setText(''); setShown(''); }} style={{ flex: 1 }} />
      </Row>

      {report && !report.lots.length && !report.unplaced.length ? (
        <Note tone="warn">No claims found in that paste. Check that the whole thread was copied.</Note>
      ) : null}

      {report?.lots.map((entry) => {
        const lot = lotFor(entry.lot);
        const done = lot ? lotRecorded(store.records, sale.id, lot) : undefined;
        const tied = new Set(entry.tie?.map((c) => c.commentIndex) ?? []);
        return (
          <Panel key={entry.lot} style={entry.tie && !done ? { borderColor: colors.warn, borderWidth: 1.5 } : undefined}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 4 }}>
              Lot {entry.lot}
              {lot ? `: ${plantDisplayName(lot.name, lot.noid)}` : entry.label ? `: ${entry.label}` : ''}
              {lot?.price != null ? `  ${formatPrice(lot.price)}` : ''}
            </Text>
            {done ? (
              <Text style={{ color: colors.moss, fontWeight: '600', marginBottom: 6 }}>Sold to {done.buyer}</Text>
            ) : entry.tie ? (
              <View style={{ backgroundColor: colors.warnTint, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <Text style={{ color: colors.warn, fontWeight: '700' }}>Tie. Your call.</Text>
                <Text style={{ color: colors.warn }}>
                  {entry.tieKind === 'minute'
                    ? `These claims landed inside the same minute. Thread order puts ${entry.tie[0].author} first.`
                    : 'These claims sit in different parts of the thread, so their order can\u2019t be read from it.'}
                </Text>
              </View>
            ) : !entry.queue.length ? (
              <Text style={{ color: colors.soft, marginBottom: 4 }}>No claims. Still available.</Text>
            ) : null}
            {entry.queue.map((c, i) => (
              <ClaimRow
                key={`${c.commentIndex}-${c.lot}`}
                claim={c}
                place={i + 1}
                tied={tied.has(c.commentIndex)}
                canPick={!done && (entry.tie ? tied.has(c.commentIndex) : i === 0)}
                onPick={() => record(lot, entry.lot, c.author, entry.label)}
              />
            ))}
            {entry.released.map((c) => (
              <Text key={`r${c.commentIndex}`} style={{ color: colors.soft, marginTop: 4 }}>
                <Text style={{ textDecorationLine: 'line-through' }}>{c.author}</Text> took it back
              </Text>
            ))}
            {entry.others.length ? (
              <View style={{ marginTop: 8, borderTopWidth: 1, borderColor: colors.line, paddingTop: 6 }}>
                <Text style={{ color: colors.soft, fontSize: 12, marginBottom: 2 }}>Also said under this lot</Text>
                {entry.others.map((o) => (
                  <Text key={`o${o.index}`} style={{ color: colors.soft, fontSize: 13 }}>
                    {o.author}: {cleanMentions(o.body)}
                  </Text>
                ))}
              </View>
            ) : null}
          </Panel>
        );
      })}

      {report?.unplaced.length ? (
        <>
          <H>Couldn't place these</H>
          <Note>They read like claims or take backs, but the app can't tell which lot they mean.</Note>
          {report.unplaced.map((c) => (
            <Panel key={c.index}>
              <Text style={{ fontWeight: '600', color: colors.ink }}>{c.author}{c.timeHint ? `  (${showTime(c.timeHint)})` : ''}</Text>
              <Text style={{ color: colors.ink }}>{cleanMentions(c.body)}</Text>
            </Panel>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function priceIn(label: string | null | undefined): number | null {
  const m = label?.match(/\$\s?(\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : null;
}

function ClaimRow({
  claim,
  place,
  tied,
  canPick,
  onPick,
}: {
  claim: Claim;
  place: number;
  tied: boolean;
  canPick: boolean;
  onPick: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: place > 1 ? 1 : 0, borderColor: colors.line }}>
      <Text style={{ width: 22, fontWeight: '700', color: tied ? colors.warn : colors.soft }}>{tied ? '=' : place}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600', color: colors.ink }}>
          {claim.author}
          {claim.kind === 'backup' ? <Text style={{ color: colors.soft, fontWeight: '400' }}>  next in line</Text> : null}
          {claim.timeHint ? <Text style={{ color: colors.soft, fontWeight: '400' }}>  {showTime(claim.timeHint)}</Text> : null}
        </Text>
        <Text style={{ color: colors.soft }} numberOfLines={2}>
          {claim.text}
        </Text>
      </View>
      {canPick ? <Button kind="secondary" title="Sold" onPress={onPick} style={{ paddingVertical: 8 }} /> : null}
    </View>
  );
}
