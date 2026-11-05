import { useState } from 'react';
import { Pressable, Share, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { buyerKey, historyLine } from '../../../core/buyers';
import {
  formReminder,
  mergeChances,
  noContactChances,
  noContactList,
  paidNoForm,
  profileForReminder,
  type CheckoutRow,
  type Stage,
} from '../../../core/checkout';
import { reminderMessage } from '../../../core/chase';
import { invoiceFileName, invoiceHtml } from '../../../core/invoice';
import {
  claimOrderOf,
  salesRecordHtml,
  unclaimedLots,
  type RundownBuyer,
  type RundownLot,
} from '../../../core/rundown';
import { formatDeadline, offerMessage, secondChances, windowMs, type ChanceCard } from '../../../core/secondChance';
import { formatDay, formatPrice } from '../../../core/text';
import type { Profile } from '../../../core/types';
import { sharePdf } from '../../../lib/exportPdf';
import { useLeftovers, useNow, useSale, useStore } from '../../../lib/store';
import { useCheckout } from '../../../lib/useCheckout';
import { ProExplainer } from '../../../ui/ProExplainer';
import { useSizeClass } from '../../../ui/layout';
import { Button, Choice, H, Note, Panel, Row, Screen, T, colors, styles, useCopy } from '../../../ui/kit';
import { DeadlineChip, StageChip } from '../../../ui/phil';

export default function RundownScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const sale = useSale(id);
  const [status, setStatus] = useState<string | null>(null);
  const [closedNote, setClosedNote] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const regular = useSizeClass() === 'regular';
  const leftovers = useLeftovers().filter((l) => l.saleId === id);
  const now = useNow();
  const window = windowMs(store.profile);

  const checkout = useCheckout(sale);

  if (!sale || !checkout || !store.profile) return <Screen><Note>This showcase is gone.</Note></Screen>;

  // Everything below reads the room this showcase ran in, so its shipping, payment and wording are the ones used.
  const { rundown, room: profile, rows, deadline, link } = checkout;
  const pro = store.pro;
  const rowOf = (name: string) => rows.find((r) => r.buyer === name);
  const deadlineMs = deadline.state === 'none' ? null : deadline.ms;
  const noContact = pro && sale.closedAt ? noContactList(rows, deadline) : [];
  const noForm = pro && sale.closedAt ? paidNoForm(rows) : [];
  const baseChances = secondChances(sale, store.records, window, now);
  const chances = pro && sale.closedAt ? mergeChances(baseChances, noContactChances(sale, rows, store.records, deadline)) : baseChances;
  const payBy = sale.closedMs ? sale.closedMs + window : null;
  // Marking a buyer paid moves them off the chase list and down to a single line.
  const waiting = rundown.buyers.filter((b) => !b.payment);
  const paid = rundown.buyers.filter((b) => b.payment === 'paid');
  const never = rundown.buyers.filter((b) => b.payment === 'never');

  // One tap invoice for a winner. Pro only, because it reads the checkout row.
  const invoiceFor = (name: string): (() => Promise<void>) | undefined => {
    const r = pro ? rowOf(name) : undefined;
    return r ? () => sharePdf(invoiceFileName(r.buyer, rundown.day), invoiceHtml(r, profile, sale.closedAt ?? rundown.day)) : undefined;
  };

  const save = async () => {
    setStatus('Making the record');
    try {
      await sharePdf(`Sales_Record_${rundown.day}.pdf`, salesRecordHtml(rundown));
      setStatus(null);
    } catch {
      setStatus('Something went wrong');
    }
  };

  // Closing marks every winner sold in one go. The winner is always the first claim to arrive.
  // It never opens a share sheet. The Sales Record is the seller's own, and leaves the app only on its own tap.
  const close = () => {
    const winners = rundown.lots
      .filter((l) => l.winner && !l.ruled)
      .map((l) => ({ lotNumber: l.number, plantName: l.name, buyer: l.winner!, price: l.price }));
    store.closeSale(sale, winners, unclaimedLots(rundown, sale), claimOrderOf(rundown));
    setClosedNote('The showcase is closed. Your record is kept in the app.');
  };

  const waitingNames = new Set(waiting.map((b) => b.name));
  const chosen = rundown.buyers.find((b) => b.name === pick) ?? waiting[0] ?? rundown.buyers[0];
  const detail = chosen ? (
    <BuyerCard
      key={chosen.name}
      buyer={chosen}
      saleId={sale.id}
      closed={!!sale.closedAt}
      row={pro && sale.closedAt ? rowOf(chosen.name) : undefined}
      invoice={sale.closedAt ? invoiceFor(chosen.name) : undefined}
      reminder={
        sale.closedAt && waitingNames.has(chosen.name)
          ? reminderMessage(chosen, pro && rowOf(chosen.name) ? profileForReminder(rowOf(chosen.name)!, profile) : profile, rundown.day, payBy && payBy > now ? payBy : null)
          : undefined
      }
    />
  ) : (
    <Note>{sale.closedAt ? 'No winners on this showcase.' : 'No winners yet.'}</Note>
  );

  const notices = (
    <>
      {closedNote ? <Note>{closedNote}</Note> : null}
      {!sale.claimText?.trim() ? (
        <Note tone="warn">Paste the comment thread in Claims first, so the rundown knows who won.</Note>
      ) : null}
      {sale.closedAt ? (
        <Note>
          Closed {formatDay(sale.closedAt)}. Every clear winner is in your sales record.
          {payBy && payBy > now ? ` Winners have until ${formatDeadline(payBy, profile.timeZone)} to pay.` : ''}
        </Note>
      ) : null}
      {leftovers.length ? (
        <Button
          kind="secondary"
          title={`${leftovers.length} ${leftovers.length === 1 ? 'leftover' : 'leftovers'} ready to relist`}
          onPress={() => router.push('/leftovers')}
          style={{ marginBottom: 12 }}
        />
      ) : null}

    </>
  );
  const top = (
    <>
      <Panel>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink }}>
          {rundown.lotsClaimed} of {rundown.lotsOffered} lots claimed
        </Text>
        <Text style={{ color: colors.soft, marginTop: 2 }}>{formatPrice(rundown.claimedValue) || '$0'} claimed</Text>
        {sale.closedAt && rundown.buyers.length ? (
          <Text style={{ color: colors.soft }}>
            {formatPrice(sum(paid)) || '$0'} paid, {formatPrice(sum(waiting)) || '$0'} waiting
          </Text>
        ) : null}
      </Panel>

      {sale.closedAt ? (
        pro ? (
          <ProPanel
            saleId={sale.id}
            rows={rows}
            deadlineLine={
              deadline.state === 'none'
                ? 'No contact deadline yet.'
                : deadline.state === 'open'
                  ? `Winners have until ${formatDeadline(deadline.ms, profile.timeZone)} to send the form.`
                  : `The contact deadline passed ${formatDeadline(deadline.ms, profile.timeZone)}.`
            }
            noContact={noContact.length}
            paidNoForm={noForm.map((r) => r.buyer)}
          />
        ) : (
          <ProExplainer compact />
        )
      ) : null}

    </>
  );
  const chancesNode = (
    <>
      {chances.length ? (
        <>
          <H>Second chance</H>
          {chances.map((c) => (
            <ChanceView
              key={c.lot}
              card={c}
              saleId={sale.id}
              profile={profile}
              window={window}
              reminder={
                c.kind === 'nocontact' && link.url
                  ? (() => {
                      const r = rowOf(c.buyer);
                      return r ? formReminder(r, profile, link.url, deadlineMs) : undefined;
                    })()
                  : undefined
              }
            />
          ))}
        </>
      ) : null}

    </>
  );
  const buyersNode = (
    <>
      {!sale.closedAt ? (
        <>
          <H>Buyers</H>
          {rundown.buyers.length ? (
            rundown.buyers.map((b) => <BuyerCard key={b.name} buyer={b} saleId={sale.id} closed={false} />)
          ) : (
            <Note>No winners yet.</Note>
          )}
        </>
      ) : (
        <>
          <H>Waiting on payment</H>
          {waiting.length ? (
            waiting.map((b) => (
              <BuyerCard
                key={b.name}
                buyer={b}
                saleId={sale.id}
                closed
                row={pro ? rowOf(b.name) : undefined}
                invoice={invoiceFor(b.name)}
                reminder={reminderMessage(b, pro && rowOf(b.name) ? profileForReminder(rowOf(b.name)!, profile) : profile, rundown.day, payBy && payBy > now ? payBy : null)}
              />
            ))
          ) : (
            <Note>{rundown.buyers.length ? 'Everyone’s settled up.' : 'No winners on this showcase.'}</Note>
          )}
          {paid.length ? <H>Paid</H> : null}
          {paid.map((b) => (
            <DoneLine key={b.name} buyer={b} saleId={sale.id} row={pro ? rowOf(b.name) : undefined} invoice={invoiceFor(b.name)} />
          ))}
          {never.length ? <H>Never paid</H> : null}
          {never.map((b) => (
            <DoneLine key={b.name} buyer={b} saleId={sale.id} row={pro ? rowOf(b.name) : undefined} invoice={invoiceFor(b.name)} />
          ))}
        </>
      )}

    </>
  );
  const lotsNode = (
    <>
      <H>Winners by lot</H>
      {rundown.lots.map((l) => (
        <LotLine key={l.number} lot={l} />
      ))}

    </>
  );
  const questionsNode = (
    <>
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
    </>
  );
  const footerNode = (
    <Button
      title={status ?? (sale.closedAt ? 'Save the Sales Record' : 'Close the showcase and save the record')}
      disabled={status === 'Making the record'}
      onPress={sale.closedAt ? save : close}
    />
  );

  if (regular) {
    // Open wide: the winners as a table on one side, and whoever is picked, with what to do about them, on the other.
    return (
      <Screen
        footer={footerNode}
        panes={[
          <>
            {notices}
            {top}
            <H>Winners</H>
            <WinnersTable buyers={rundown.buyers} rows={rows} pro={pro && !!sale.closedAt} chosen={chosen?.name} onPick={setPick} />
          </>,
          <>
            {detail}
            {chancesNode}
            <H>Winners by lot</H>
            <LotsTable lots={rundown.lots} />
            {questionsNode}
          </>,
        ]}
      />
    );
  }

  return (
    <Screen footer={footerNode}>
      {notices}
      {top}
      {chancesNode}
      {buyersNode}
      {lotsNode}
      {questionsNode}
    </Screen>
  );
}

/** One lot that can go to the next in line: offer it, or settle the offer that's out. */
function ChanceView({ card, saleId, profile, window, reminder }: { card: ChanceCard; saleId: string; profile: Profile; window: number; reminder?: string }) {
  const store = useStore();
  const [copied, copy] = useCopy();
  const runner = card.runnerUp;
  // A fresh offer gives the runner up a full window from now; one already out keeps its own.
  const message = (answerBy: number) => (runner ? offerMessage(card, runner, profile, answerBy) : '');
  const send = async (how: 'copy' | 'share') => {
    const text = message(card.offer ? card.dueMs : Date.now() + window);
    if (!card.offer) store.sendSecondChance(saleId, card.lot, card.buyer, runner);
    if (how === 'copy') await copy(`offer${card.lot}`, text);
    else await Share.share({ message: text }).catch(() => undefined);
  };
  const head = (
    <Text style={{ fontWeight: '700', color: colors.ink }}>
      Lot {card.lot}: {card.name}
      {card.price !== null ? <Text style={{ color: colors.soft, fontWeight: '400' }}>  {formatPrice(card.price)}</Text> : null}
    </Text>
  );

  if (card.kind === 'offered') {
    return (
      <Panel>
        {head}
        {T.name === 'phil' ? (
          // The answer deadline is a gold chip with the clock time, set into the same sentence.
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 4, marginBottom: 8 }}>
            <Text style={{ color: colors.soft }}>Offered to {runner}. They have until</Text>
            <DeadlineChip>{formatDeadline(card.dueMs, profile.timeZone)}</DeadlineChip>
            <Text style={{ color: colors.soft }}>to answer.</Text>
          </View>
        ) : (
          <Text style={{ color: colors.soft, marginBottom: 8 }}>
            Offered to {runner}. They have until {formatDeadline(card.dueMs, profile.timeZone)} to answer.
          </Text>
        )}
        <Row style={{ marginBottom: 6 }}>
          <Button title={`${runner} took it`} onPress={() => store.settleSecondChance(saleId, card.lot, 'took')} style={{ flex: 1 }} />
          <Button kind="secondary" title="Passed" onPress={() => store.settleSecondChance(saleId, card.lot, 'passed')} style={{ flex: 1 }} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Button kind="quiet" title={copied ? '✓ Copied' : 'Copy the offer again'} onPress={() => send('copy')} />
          <Button kind="quiet" title="Send" onPress={() => send('share')} />
        </Row>
      </Panel>
    );
  }

  return (
    <Panel style={{ borderColor: colors.warn, borderWidth: 1.5 }}>
      {head}
      <Text style={{ color: colors.warn }}>
        {card.kind === 'nocontact'
          ? `${card.buyer} hasn’t sent the checkout form, and the deadline has passed.`
          : card.kind === 'overdue'
            ? `${card.buyer} hasn’t paid.`
            : `${card.buyer} never paid.`}{' '}
        {runner ? `${runner} is next in line.` : 'Nobody is next in line.'}
      </Text>
      <Row style={{ marginTop: 8 }}>
        {runner ? (
          <>
            <Button title={`Offer it to ${runner}`} onPress={() => send('copy')} style={{ flex: 2 }} />
            <Button kind="secondary" title="Send" onPress={() => send('share')} style={{ flex: 1 }} />
          </>
        ) : (
          <Button kind="secondary" title="Back to open" onPress={() => store.sendSecondChance(saleId, card.lot, card.buyer, null)} style={{ flex: 1 }} />
        )}
      </Row>
      {card.kind === 'nocontact' && reminder ? (
        <Button kind="quiet" title={copied ? '✓ Copied' : 'Send a reminder instead'} onPress={() => copy(`remind${card.lot}`, reminder)} style={{ marginTop: 4 }} />
      ) : null}
      {card.kind === 'overdue' ? (
        <Button kind="quiet" title={`${card.buyer} paid after all`} onPress={() => store.setPayment(saleId, card.buyer, 'paid')} style={{ marginTop: 4 }} />
      ) : null}
      {runner ? <Text style={{ color: colors.soft, fontSize: 12, marginTop: 4 }}>Offering copies a message to paste to {runner}, with the price, your shipping and your payment.</Text> : null}
    </Panel>
  );
}

type PayChoice = 'waiting' | 'paid' | 'never';

const sum = (buyers: RundownBuyer[]) => buyers.reduce((n, b) => n + b.total, 0);

/** A buyer who's paid or never paid: one line, opened back up with a tap. */
function DoneLine({ buyer, saleId, row, invoice }: { buyer: RundownBuyer; saleId: string; row?: CheckoutRow; invoice?: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  if (open) return <BuyerCard buyer={buyer} saleId={saleId} closed row={row} invoice={invoice} onFold={() => setOpen(false)} />;
  return (
    <Pressable
      onPress={() => setOpen(true)}
      accessibilityRole="button"
      style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.line }}
    >
      <Text style={{ color: colors.ink, flex: 1 }}>{buyer.name}</Text>
      <Text style={{ color: colors.soft }}>{formatPrice(buyer.total) || '$0'}  ›</Text>
    </Pressable>
  );
}

function BuyerCard({
  buyer,
  saleId,
  closed,
  reminder,
  row,
  invoice,
  onFold,
}: {
  buyer: RundownBuyer;
  saleId: string;
  closed: boolean;
  /** The payment reminder, for a buyer still waiting to pay. */
  reminder?: string;
  /** The Pro checkout row for this buyer: stage, total with shipping, payment method. */
  row?: CheckoutRow;
  /** Builds this buyer's invoice and opens the share sheet. Pro. */
  invoice?: () => Promise<void>;
  onFold?: () => void;
}) {
  const store = useStore();
  const [making, setMaking] = useState<'' | 'making' | 'failed'>('');
  const saved = store.buyerNotes[buyerKey(buyer.name)] ?? '';
  const [note, setNote] = useState(saved);
  const [copied, copy] = useCopy();
  return (
    <Panel>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{buyer.name}</Text>
        <Text style={{ fontWeight: '700', color: colors.ink }}>{formatPrice(row ? row.totalOwed : buyer.total) || '$0'}</Text>
      </View>
      {row ? <CheckoutLines row={row} saleId={saleId} closed={closed} /> : null}
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
      {invoice ? (
        <Button
          kind="secondary"
          title={making === 'making' ? 'Making the invoice' : 'Invoice'}
          disabled={making === 'making'}
          onPress={() => {
            setMaking('making');
            invoice().then(() => setMaking(''), () => setMaking('failed'));
          }}
          style={{ marginTop: 8 }}
        />
      ) : null}
      {making === 'failed' ? <Text style={{ color: colors.warn, fontSize: 13 }}>The invoice could not be made. Try again.</Text> : null}
      {reminder ? (
        <Row style={{ marginTop: 8 }}>
          <Button
            title={copied ? '✓ Reminder copied' : 'Copy payment reminder'}
            onPress={() => copy('reminder', reminder)}
            style={{ flex: 2 }}
          />
          <Button kind="secondary" title="Send" onPress={() => Share.share({ message: reminder }).catch(() => undefined)} style={{ flex: 1 }} />
        </Row>
      ) : null}
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
      {onFold ? <Button kind="quiet" title="Fold up" onPress={onFold} style={{ marginTop: 4 }} /> : null}
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
      <Text style={{ color: lot.winner ? colors.moss : colors.soft }}>
        {lot.winner ? `Winner: ${lot.winner}` : 'Unclaimed'}
      </Text>
      {lot.line.length ? <Text style={{ color: colors.soft, fontSize: 13 }}>Alternates, in order: {lot.line.map((n, i) => `${i + 2}. ${n}`).join(', ')}</Text> : null}
    </View>
  );
}

const STAGES: { stage: Stage; label: string }[] = [
  { stage: 'won', label: 'Won' },
  { stage: 'contacted', label: 'Contacted' },
  { stage: 'paid', label: 'Paid' },
  { stage: 'shipped', label: 'Shipped' },
];

/** The four states for one buyer, what they owe with shipping, and how they said they would pay. */
function CheckoutLines({ row, saleId, closed }: { row: CheckoutRow; saleId: string; closed: boolean }) {
  const store = useStore();
  const [via, setVia] = useState(row.paidVia);
  const [charge, setCharge] = useState(row.shippingCharge === null ? '' : String(row.shippingCharge));
  const reached = STAGES.findIndex((x) => x.stage === row.stage);
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6, marginVertical: 4 }}>
        {STAGES.map((x, i) => T.name === 'phil' ? (
          <StageChip key={x.stage} stage={x.stage} reached={i <= reached}>
            {x.label}
          </StageChip>
        ) : (
          <Text
            key={x.stage}
            style={{
              fontSize: 12,
              fontWeight: '600',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 10,
              overflow: 'hidden',
              backgroundColor: i <= reached ? colors.mossTint : colors.line,
              color: i <= reached ? colors.mossDark : colors.soft,
            }}
          >
            {x.label}
          </Text>
        ))}
      </View>
      {row.contactState === 'late' ? <Text style={{ color: colors.warn, fontSize: 13 }}>No form by the deadline.</Text> : null}
      {row.contactState === 'waiting' && closed ? <Text style={{ color: colors.soft, fontSize: 13 }}>No form yet.</Text> : null}
      <Text style={{ color: colors.soft, fontSize: 13 }}>
        {row.pickup
          ? `Local pickup. Owes ${formatPrice(row.totalOwed) || '$0'}.`
          : row.totalKnown
            ? `${formatPrice(row.plantsTotal) || '$0'} in plants, ${formatPrice(row.shippingCharge ?? 0) || '$0'} shipping. Owes ${formatPrice(row.totalOwed) || '$0'}.`
            : `${formatPrice(row.plantsTotal) || '$0'} in plants. Shipping isn’t added up yet${row.shippingNote ? ` (${row.shippingNote})` : ''}.`}
      </Text>
      {!row.pickup && row.shippingCharge === null && closed ? (
        <TextInput
          value={charge}
          onChangeText={setCharge}
          onBlur={() => {
            const n = parseFloat(charge);
            store.setFulfillment(saleId, row.key, { shippingCharge: Number.isFinite(n) && n >= 0 ? n : null });
          }}
          keyboardType="decimal-pad"
          placeholder="Shipping for this buyer, in dollars"
          placeholderTextColor="#9AA39A"
          accessibilityLabel={`Shipping charge for ${row.buyer}`}
          style={[styles.input, { fontSize: 14, paddingVertical: 6, marginTop: 6 }]}
        />
      ) : null}
      {row.intendedMethod ? <Text style={{ color: colors.soft, fontSize: 13 }}>Plans to pay with: {row.intendedMethod}</Text> : null}
      {closed && row.paid ? (
        <TextInput
          value={via}
          onChangeText={setVia}
          onBlur={() => store.setFulfillment(saleId, row.key, { paidVia: via.trim() })}
          placeholder="Paid with"
          placeholderTextColor="#9AA39A"
          accessibilityLabel={`What ${row.buyer} paid with`}
          style={[styles.input, { fontSize: 14, paddingVertical: 6, marginTop: 6 }]}
        />
      ) : null}
      {row.methodMismatch ? (
        <Text style={{ color: colors.warn, fontSize: 13 }}>
          The form said {row.intendedMethod} and you marked {row.paidVia}. Worth a look.
        </Text>
      ) : null}
    </View>
  );
}

/** The checkout summary for a closed sale: the deadline, forms in, and the two screens. */
function ProPanel({
  saleId,
  rows,
  deadlineLine,
  noContact,
  paidNoForm,
}: {
  saleId: string;
  rows: CheckoutRow[];
  deadlineLine: string;
  noContact: number;
  paidNoForm: string[];
}) {
  const inCount = rows.filter((r) => r.contacted).length;
  return (
    <Panel>
      <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>Buyer checkout</Text>
      <Text style={{ color: colors.soft }}>{deadlineLine}</Text>
      <Text style={{ color: colors.ink, marginTop: 2 }}>
        {inCount} of {rows.length} winners have sent the form.
      </Text>
      {noContact ? (
        <Text style={{ color: colors.warn }}>
          {noContact} {noContact === 1 ? 'winner has' : 'winners have'} not sent it. Their lots are in Second chance below.
        </Text>
      ) : null}
      {paidNoForm.length ? (
        <Text style={{ color: colors.warn }}>Paid but no address yet: {paidNoForm.join(', ')}.</Text>
      ) : null}
      <Row style={{ marginTop: 8 }}>
        <Button title="Checkout form" onPress={() => router.push({ pathname: '/sale/[id]/checkout', params: { id: saleId } })} style={{ flex: 1 }} />
        <Button kind="secondary" title="Packing" onPress={() => router.push({ pathname: '/sale/[id]/packing', params: { id: saleId } })} style={{ flex: 1 }} />
        <Button kind="secondary" title="Money" onPress={() => router.push({ pathname: '/sale/[id]/money', params: { id: saleId } })} style={{ flex: 1 }} />
      </Row>
    </Panel>
  );
}

const cell = { paddingVertical: 10, paddingHorizontal: 6 } as const;

/** Every winner on one table: who, how many lots, what they owe, where they stand. The picked row opens beside it. */
function WinnersTable({ buyers, rows, pro, chosen, onPick }: { buyers: RundownBuyer[]; rows: CheckoutRow[]; pro: boolean; chosen?: string; onPick: (name: string) => void }) {
  if (!buyers.length) return <Note>No winners yet.</Note>;
  const head = { color: colors.soft, fontSize: 12, fontWeight: '600' as const };
  const state = (b: RundownBuyer) => {
    const r = pro ? rows.find((x) => x.buyer === b.name) : undefined;
    if (b.payment === 'never') return 'Never paid';
    if (r) return r.stage === 'won' ? 'Won' : r.stage === 'contacted' ? 'Contacted' : r.stage === 'paid' ? 'Paid' : 'Shipped';
    return b.payment === 'paid' ? 'Paid' : 'Waiting';
  };
  return (
    <View accessibilityRole="table">
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.line }}>
        <Text style={[cell, head, { flex: 3 }]}>Buyer</Text>
        <Text style={[cell, head, { flex: 1, textAlign: 'right' }]}>Lots</Text>
        <Text style={[cell, head, { flex: 2, textAlign: 'right' }]}>Total</Text>
        <Text style={[cell, head, { flex: 3, textAlign: 'right' }]}>Status</Text>
      </View>
      {buyers.map((b) => {
        const row = pro ? rows.find((x) => x.buyer === b.name) : undefined;
        const on = b.name === chosen;
        return (
          <Pressable
            key={b.name}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onPick(b.name)}
            style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: colors.line, backgroundColor: on ? colors.mossTint : 'transparent' }}
          >
            <Text style={[cell, { flex: 3, color: colors.ink, fontWeight: '600' }]} numberOfLines={1}>{b.name}</Text>
            <Text style={[cell, { flex: 1, textAlign: 'right', color: colors.soft }]}>{b.lots.length}</Text>
            <Text style={[cell, { flex: 2, textAlign: 'right', color: colors.ink }]}>{formatPrice(row ? row.totalOwed : b.total) || '$0'}</Text>
            <Text style={[cell, { flex: 3, textAlign: 'right', color: b.payment === 'never' ? colors.warn : colors.soft }]} numberOfLines={1}>{state(b)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The lots as a table: number, plant, price, and who has it. */
function LotsTable({ lots }: { lots: RundownLot[] }) {
  const head = { color: colors.soft, fontSize: 12, fontWeight: '600' as const };
  return (
    <View accessibilityRole="table">
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.line }}>
        <Text style={[cell, head, { width: 36 }]}>Lot</Text>
        <Text style={[cell, head, { flex: 3 }]}>Plant</Text>
        <Text style={[cell, head, { flex: 1, textAlign: 'right' }]}>Price</Text>
        <Text style={[cell, head, { flex: 2, textAlign: 'right' }]}>Winner</Text>
      </View>
      {lots.map((l) => (
        <View key={l.number} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: colors.line }}>
          <Text style={[cell, { width: 36, color: colors.soft }]}>{l.number}</Text>
          <Text style={[cell, { flex: 3, color: colors.ink }]} numberOfLines={2}>{l.name}</Text>
          <Text style={[cell, { flex: 1, textAlign: 'right', color: colors.soft }]}>{l.price !== null ? formatPrice(l.price) : ''}</Text>
          <Text style={[cell, { flex: 2, textAlign: 'right', color: l.winner ? colors.moss : colors.soft }]} numberOfLines={2}>
            {l.winner ?? 'Unclaimed'}
          </Text>
        </View>
      ))}
    </View>
  );
}
