import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { buyerHistory, buyerKey, historyLine } from '../../../core/buyers';
import { cleanMentions, showTime, type Claim } from '../../../core/claims';
import { priceIn } from '../../../core/rundown';
import { formatPrice, plantDisplayName, toDay } from '../../../core/text';
import type { Lot } from '../../../core/types';
import { claimOptions, readClaims } from '../../../core/claimReport';
import { EMPTY_DRAFT, looksLikeThread, mergeIntoThread, readIntake, type IntakeDraft } from '../../../core/intake';
import { INTAKE_COPY as IC } from '../../../core/intakeCopy';
import { clipboardText } from '../../../lib/clipboardText';
import { ocrAvailable, readScreenshots } from '../../../lib/screenOcr';
import { IntakeReview } from '../../../ui/IntakeReview';
import { lotRecorded, useSale, useStore } from '../../../lib/store';
import { useSizeClass } from '../../../ui/layout';
import { Button, H, Note, Panel, Row, Screen, colors, styles } from '../../../ui/kit';

export default function ClaimsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const sale = useSale(id);
  const regular = useSizeClass() === 'regular';
  const [text, setText] = useState(sale?.claimText ?? '');
  const [shown, setShown] = useState(sale?.claimText ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // A thread copied from Facebook, waiting on the clipboard. Checked when the screen opens and whenever the app comes back to the front.
  const saved = sale?.claimText ?? '';
  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);
  const sellerName = store.profile?.facebookName?.trim() || store.profile?.sellerName;
  const [clip, setClip] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const check = async () => {
      const text = await clipboardText();
      if (live) setClip(text && looksLikeThread(text, { sellerName }, savedRef.current) ? text : null);
    };
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      live = false;
      sub.remove();
    };
  }, [sellerName]);

  const report = useMemo(() => (sale ? readClaims(shown, sale, store.profile) : null), [shown, sale, store.profile]);
  const past = useMemo(() => buyerHistory(store.records, id), [store.records, id]);
  const memory = (author: string): { text: string; warn: boolean } | null => {
    const h = past.get(buyerKey(author));
    const note = store.buyerNotes[buyerKey(author)];
    const text = [h ? `Back again: ${historyLine(h)}` : null, note].filter(Boolean).join('. ');
    return text ? { text, warn: !!h?.unpaidSales } : null;
  };

  if (!sale) return <Screen><Note>This showcase is gone.</Note></Screen>;
  // Once read, the paste folds down to a few lines so the claims below stay in easy reach on a small
  // screen. Editing the paste opens it back up.
  const isRead = !!shown.trim() && shown === text;

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

  // All three ways in end at the same saved claimText and the same reader.
  const options = claimOptions(sale, store.profile);
  const draft = sale.intakeDraft;
  const fromClipboard = () => {
    if (!clip) return;
    setText(clip);
    setShown(clip);
    store.saveSale({ ...sale, claimText: clip });
    setClip(null);
    setStatus(null);
  };
  const fromScreenshots = async () => {
    setBusy(IC.reading);
    setStatus(null);
    try {
      const got = await readScreenshots();
      if (!got) return;
      if (got.screens.every((s) => s.length === 0)) {
        setStatus(IC.nothingRead);
        return;
      }
      // More screenshots after an unfinished batch come after it, because they arrived after it.
      const base = draft ?? EMPTY_DRAFT;
      store.saveSale({ ...sale, intakeDraft: { ...base, screens: [...base.screens, ...got.screens] } });
      if (got.failed) setStatus(IC.someFailed(got.failed));
    } catch {
      setStatus(IC.nothingRead);
    } finally {
      setBusy(null);
    }
  };
  const changeDraft = (next: IntakeDraft) => store.saveSale({ ...sale, intakeDraft: next });
  const saveDraft = () => {
    if (!draft) return;
    const merged = mergeIntoThread(sale.claimText, readIntake(draft, options), sellerName ?? '');
    setText(merged);
    setShown(merged);
    store.saveSale({ ...sale, claimText: merged, intakeDraft: undefined });
    setStatus(IC.saved);
  };

  const thread = (
    <>
      {clip && clip.trim() !== saved.trim() && !draft ? (
        <>
          <Button title={IC.clipboard} onPress={fromClipboard} />
          <Note>{IC.clipboardNote}</Note>
        </>
      ) : null}
      {ocrAvailable ? (
        <>
          <Button kind="secondary" title={busy ?? IC.screenshots} disabled={!!busy} onPress={fromScreenshots} />
          <Note>{IC.screenshotsNote}</Note>
        </>
      ) : null}
      {status ? <Note tone={status === IC.saved ? undefined : 'warn'}>{status}</Note> : null}
      {draft ? (
        <IntakeReview
          draft={draft}
          options={options}
          lotNumbers={sale.lots.map((l) => l.number)}
          onChange={changeDraft}
          onSave={saveDraft}
          onDiscard={() => store.saveSale({ ...sale, intakeDraft: undefined })}
        />
      ) : null}
      <Note>
        Open your Grower Showcase post, copy all the comments, and paste them here. Claims come back in thread order, lot by lot.
      </Note>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          // Kept the moment it is pasted, so a thread is never lost to a crash before Read claims is tapped.
          store.saveSale({ ...sale, claimText: t });
        }}
        multiline
        placeholder="Paste the comment thread"
        placeholderTextColor="#9AA39A"
        accessibilityLabel="Comment thread"
        // Side by side, the thread keeps its whole height. Alone, it folds down once read so the claims stay in reach.
        style={[styles.input, { ...(regular ? { minHeight: 420 } : isRead ? { height: 96 } : { minHeight: 140, maxHeight: 260 }), textAlignVertical: 'top', marginBottom: 10 }]}
      />
      <Row style={{ marginBottom: 16 }}>
        <Button title="Read claims" disabled={!text.trim()} onPress={read} style={{ flex: 2 }} />
        <Button kind="secondary" title="Clear" onPress={() => { setText(''); setShown(''); }} style={{ flex: 1 }} />
      </Row>
    </>
  );

  const results = (
    <>
      {report && !report.lots.length && !report.unplaced.length ? (
        <Note tone="warn">No claims found in that paste. Check that the whole thread was copied.</Note>
      ) : null}

      {report?.lots.map((entry) => {
        const lot = lotFor(entry.lot);
        const done = lot ? lotRecorded(store.records, sale.id, lot) : undefined;
        return (
          <Panel key={entry.lot}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 4 }}>
              Lot {entry.lot}
              {lot ? `: ${plantDisplayName(lot.name, lot.noid)}` : entry.label ? `: ${entry.label}` : ''}
              {lot?.price != null ? `  ${formatPrice(lot.price)}` : ''}
            </Text>
            {done ? (
              <Text style={{ color: colors.moss, fontWeight: '600', marginBottom: 6 }}>Sold to {done.buyer}</Text>
            ) : !entry.queue.length ? (
              <Text style={{ color: colors.soft, marginBottom: 4 }}>No claims. Still available.</Text>
            ) : null}
            {entry.queue.map((c, i) => (
              <ClaimRow
                key={`${c.commentIndex}-${c.lot}`}
                claim={c}
                memory={memory(c.author)}
                place={i + 1}
                canPick={!done && i === 0}
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
    </>
  );

  return (
    <Screen
      footer={report ? <Button title="After the showcase" onPress={() => router.push(`/sale/${sale.id}/rundown`)} /> : undefined}
      panes={[thread, results]}
    />
  );
}

function ClaimRow({
  claim,
  place,
  canPick,
  onPick,
  memory,
}: {
  claim: Claim;
  place: number;
  canPick: boolean;
  onPick: () => void;
  memory: { text: string; warn: boolean } | null;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: place > 1 ? 1 : 0, borderColor: colors.line }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: place === 1 ? colors.moss : colors.mossTint }}>
        <Text style={{ fontWeight: '700', fontSize: 13, color: place === 1 ? '#fff' : colors.mossDark }}>{place}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600', color: colors.ink }}>
          {claim.author}
          <Text style={{ color: place === 1 ? colors.moss : colors.soft, fontWeight: '700', fontSize: 12 }}>{place === 1 ? '  WINNER' : '  ALTERNATE'}</Text>
          {claim.kind === 'backup' ? <Text style={{ color: colors.soft, fontWeight: '400' }}>  next in line</Text> : null}
          {claim.timeHint ? <Text style={{ color: colors.soft, fontWeight: '400' }}>  {showTime(claim.timeHint)}</Text> : null}
        </Text>
        <Text style={{ color: colors.soft }} numberOfLines={2}>
          {claim.text}
        </Text>
        {memory ? (
          <Text style={{ color: memory.warn ? colors.warn : colors.moss, fontSize: 12 }} numberOfLines={1}>
            {memory.text}
          </Text>
        ) : null}
      </View>
      {canPick ? <Button kind="secondary" title="Sold" onPress={onPick} style={{ paddingVertical: 8 }} /> : null}
    </View>
  );
}
