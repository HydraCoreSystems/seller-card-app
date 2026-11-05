import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { BackupData } from '../../core/backup';
import { addressLines, buildLabelFile, packingListHtml, packingRows, type CheckoutRow } from '../../core/checkout';
import { checkoutModel } from '../../core/checkoutModel';
import { applyFulfillment, applyPayment, applyPlantCost, applySaleCosts } from '../../core/mutations';
import { keptWords, profitPeriods, saleMoney } from '../../core/profit';
import { COSTS_BLANK, PROFIT_COUNTED } from '../../core/profitCopy';
import { formatDay, formatPrice, toDay } from '../../core/text';
import type { Sale } from '../../core/types';
import { CostBox } from '../CostBox';
import { Button, Choice, H, Note, Panel, Row, colors, styles } from '../kit';

export interface ViewProps {
  data: BackupData;
  now: number;
  commit: (change: (d: BackupData) => BackupData) => Promise<void>;
  saving: boolean;
}

const dollars = (n: number) => formatPrice(n) || '$0';

/** Closed showcases first, newest first, the way the seller will want them. */
function orderedSales(sales: Sale[]): Sale[] {
  return [...sales].sort((a, b) => (b.closedAt ?? b.createdAt).localeCompare(a.closedAt ?? a.createdAt));
}

function SalePicker({ sales, value, onChange }: { sales: Sale[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <Row style={{ marginBottom: 10 }}>
      {sales.slice(0, 12).map((s) => (
        <Button key={s.id} kind={s.id === value ? 'primary' : 'secondary'} title={s.name?.trim() || formatDay(s.closedAt ?? s.createdAt)} onPress={() => onChange(s.id)} />
      ))}
    </Row>
  );
}

/** The sale being looked at, and everything worked out for it. */
function useSaleView(data: BackupData, now: number) {
  const sales = useMemo(() => orderedSales(data.sales), [data.sales]);
  const [picked, setPicked] = useState<string | null>(null);
  const sale = sales.find((s) => s.id === picked) ?? sales[0] ?? null;
  const model = useMemo(() => (sale && data.profile ? checkoutModel(sale, data.profile, data.records, now) : null), [sale, data.profile, data.records, now]);
  return { sales, sale, model, setPicked };
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function printHtml(html: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

const NOTHING = <Note>Nothing here yet. Close a showcase on your phone and let it back up, then reload this page.</Note>;

/* ---------- rundown ---------- */

function BuyerRow({ row, saleId, commit, saving }: { row: CheckoutRow } & Pick<ViewProps, 'commit' | 'saving'> & { saleId: string }) {
  const [tracking, setTracking] = useState(row.tracking);
  const payment = row.paid ? 'paid' : row.neverPaid ? 'never' : 'waiting';
  return (
    <Panel>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>{row.buyer}</Text>
        <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>{dollars(row.totalOwed)}</Text>
      </View>
      <Text style={{ color: colors.soft, marginBottom: 4 }}>
        {row.lots.map((l) => `Lot ${l.number}, ${l.name}`).join('. ')}
      </Text>
      <Text style={{ color: colors.soft, fontSize: 13, marginBottom: 6 }}>
        Stage: {row.stage}. {row.contacted ? 'Checkout form is in.' : 'No checkout form yet.'}{' '}
        {row.pickup ? 'Local pickup.' : row.totalKnown ? `${dollars(row.plantsTotal)} in plants, ${dollars(row.shippingCharge ?? 0)} shipping.` : 'Shipping is not added up yet.'}
      </Text>
      <Choice
        value={payment}
        options={[
          { value: 'waiting', label: 'Waiting' },
          { value: 'paid', label: 'Paid' },
          { value: 'never', label: 'Never paid' },
        ]}
        onChange={(v) => commit((d) => applyPayment(d, saleId, row.buyer, v === 'waiting' ? undefined : (v as 'paid' | 'never'), toDay(new Date())))}
      />
      {row.paid ? (
        <Row style={{ alignItems: 'center', marginTop: 4 }}>
          <Button
            kind={row.shipped ? 'primary' : 'secondary'}
            title={row.shipped ? 'Shipped, tap to undo' : 'Mark shipped'}
            disabled={saving}
            onPress={() => commit((d) => applyFulfillment(d, saleId, row.key, { shipped: !row.shipped }))}
          />
          <TextInput
            value={tracking}
            onChangeText={setTracking}
            onBlur={() => tracking.trim() !== row.tracking && commit((d) => applyFulfillment(d, saleId, row.key, { tracking: tracking.trim() }))}
            placeholder="Tracking number"
            placeholderTextColor="#9AA39A"
            accessibilityLabel={`Tracking for ${row.buyer}`}
            style={[styles.input, { flex: 1, minWidth: 200 }]}
          />
        </Row>
      ) : null}
    </Panel>
  );
}

export function RundownView(p: ViewProps) {
  const { sales, sale, model, setPicked } = useSaleView(p.data, p.now);
  if (!sale || !model) return NOTHING;
  const { rundown, rows } = model;
  return (
    <>
      <SalePicker sales={sales} value={sale.id} onChange={setPicked} />
      <Panel>
        <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 18 }}>{model.name}</Text>
        <Text style={{ color: colors.soft }}>
          {rundown.lotsClaimed} of {rundown.lotsOffered} lots claimed, {dollars(rundown.claimedValue)} in plants.
          {sale.closedAt ? ` Closed ${formatDay(sale.closedAt)}.` : ' Not closed yet. Close it on your phone.'}
        </Text>
      </Panel>
      {rows.length ? rows.map((r) => <BuyerRow key={r.key} row={r} saleId={sale.id} commit={p.commit} saving={p.saving} />) : <Note>No winners on this showcase yet.</Note>}
    </>
  );
}

/* ---------- packing ---------- */

export function PackingView(p: ViewProps) {
  const { sales, sale, model, setPicked } = useSaleView(p.data, p.now);
  if (!sale || !model) return NOTHING;
  const toPack = packingRows(model.rows);
  const waiting = model.rows.filter((r) => !toPack.includes(r));
  const title = `Packing list ${model.rundown.day}`;
  return (
    <>
      <SalePicker sales={sales} value={sale.id} onChange={setPicked} />
      <Note>Buyers show up here once their form is in and you have marked them paid. Everyone else is listed below, so nobody drops out of sight.</Note>
      <Button title="Print the packing list" disabled={!toPack.length} onPress={() => printHtml(packingListHtml(toPack, title, model.room))} />
      <H>{`To pack (${toPack.length})`}</H>
      {toPack.length ? (
        toPack.map((r) => (
          <Panel key={r.key}>
            <Text style={{ fontWeight: '700', color: colors.ink }}>{r.buyer}{r.shipped ? ', shipped' : ''}</Text>
            {r.lots.map((l) => (
              <Text key={l.number} style={{ color: colors.soft }}>Lot {l.number}, {l.name}</Text>
            ))}
            <Text style={{ color: colors.ink, marginTop: 4 }}>{r.pickup ? 'Local pickup' : r.response ? addressLines(r.response).join(', ') : ''}</Text>
          </Panel>
        ))
      ) : (
        <Note>Nobody is ready to pack yet.</Note>
      )}
      {waiting.length ? (
        <>
          <H>Not ready</H>
          {waiting.map((r) => (
            <Note key={r.key}>{`${r.buyer}: ${r.neverPaid ? 'never paid' : !r.paid ? 'not marked paid yet' : 'no checkout form yet'}`}</Note>
          ))}
        </>
      ) : null}
    </>
  );
}

/* ---------- label file ---------- */

export function LabelsView(p: ViewProps) {
  const { sales, sale, model, setPicked } = useSaleView(p.data, p.now);
  if (!sale || !model) return NOTHING;
  const label = buildLabelFile(model.rows);
  return (
    <>
      <SalePicker sales={sales} value={sale.id} onChange={setPicked} />
      <Note>
        Only buyers marked paid go in the file. The first time you upload it, Pirate Ship asks you to match its columns to ours: Name, Address Line 1, City, State, Zip and Weight (oz). After that it remembers.
      </Note>
      <Button
        title={`Download ${label.included.length} ${label.included.length === 1 ? 'label' : 'labels'}`}
        disabled={!label.included.length}
        onPress={() => download(`Pirate_Ship_${model.rundown.day}.csv`, label.csv, 'text/csv')}
      />
      {label.noWeight ? <Note>{`${label.noWeight} ${label.noWeight === 1 ? 'row has' : 'rows have'} no weight. Set a default weight in your profile, or fill it in on Pirate Ship.`}</Note> : null}
      {label.skipped.length ? (
        <>
          <H>Left out</H>
          {label.skipped.map((s) => (
            <Note key={s.buyer}>{`${s.buyer}: ${s.reason}`}</Note>
          ))}
        </>
      ) : null}
    </>
  );
}

/* ---------- what you kept ---------- */

export function ProfitView(p: ViewProps) {
  const { data, commit } = p;
  const months = useMemo(() => profitPeriods(data.records, data.sales, data.plants, 'month'), [data]);
  const { sales, sale, setPicked } = useSaleView(data, p.now);
  const money = sale ? saleMoney(sale, data.records, data.plants) : null;
  return (
    <>
      <Note>{PROFIT_COUNTED}</Note>
      {months.length ? (
        months.map((m) => (
          <Panel key={m.key}>
            <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16, marginBottom: 6 }}>{m.label}</Text>
            <View style={{ flexDirection: 'row' }}>
              {([['Taken in', m.takenIn], ['Costs', m.costs], [keptWords(m), m.kept]] as [string, number][]).map(([label, value]) => (
                <View key={label} style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '700' }}>{dollars(value)}</Text>
                  <Text style={{ color: colors.soft, fontSize: 13 }}>{label}</Text>
                </View>
              ))}
            </View>
          </Panel>
        ))
      ) : (
        NOTHING
      )}
      {sale && money && money.lots.length ? (
        <>
          <H>Costs for one showcase</H>
          <SalePicker sales={sales} value={sale.id} onChange={setPicked} />
          <Panel>
            <View style={{ flexDirection: 'row' }}>
              {([['Taken in', money.takenIn], ['Costs', money.costs], [keptWords(money), money.kept]] as [string, number][]).map(([label, value]) => (
                <View key={label} style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '700' }}>{dollars(value)}</Text>
                  <Text style={{ color: colors.soft, fontSize: 13 }}>{label}</Text>
                </View>
              ))}
            </View>
          </Panel>
          {money.lots.map((l) =>
            l.plantId ? (
              <CostBox key={`${sale.id}${l.number}${l.buyer}`} label={`Lot ${l.number}, ${l.name}, ${dollars(l.price)}`} value={l.cost} onValue={(n) => commit((d) => applyPlantCost(d, l.plantId!, n))} />
            ) : null,
          )}
          <CostBox key={`ship${sale.id}`} label="What shipping cost you" value={sale.shippingCost} onValue={(n) => commit((d) => applySaleCosts(d, sale.id, { shippingCost: n }))} />
          <CostBox key={`other${sale.id}`} label="Anything else" value={sale.otherCosts} onValue={(n) => commit((d) => applySaleCosts(d, sale.id, { otherCosts: n }))} />
          <Note>{COSTS_BLANK}</Note>
        </>
      ) : null}
    </>
  );
}
