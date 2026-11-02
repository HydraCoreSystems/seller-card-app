import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { COSTS_BLANK, COST_HINT, PROFIT_COUNTED, PROFIT_TEASER } from '../../../core/profitCopy';
import { keptWords, saleMoney } from '../../../core/profit';
import { formatPrice, parsePrice } from '../../../core/text';
import { useSale, useStore } from '../../../lib/store';
import { Button, Field, H, Note, Panel, Screen, colors } from '../../../ui/kit';

const dollars = (n: number) => formatPrice(n) || '$0';
const text = (n: number | null | undefined) => (n == null ? '' : String(n));

/** One cost box. It saves as the seller types, so there is no save step to forget. */
function CostBox({ label, value, onValue, hint }: { label: string; value: number | null | undefined; onValue: (n: number | null) => void; hint?: string }) {
  const [t, setT] = useState(text(value));
  return (
    <Field
      label={label}
      value={t}
      placeholder="Not entered"
      keyboardType="decimal-pad"
      hint={hint}
      onChangeText={(v) => {
        setT(v);
        onValue(parsePrice(v));
      }}
    />
  );
}

function Figure({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: warn ? colors.warn : colors.ink, fontSize: 20, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: colors.soft, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

/** What one showcase brought in, what it cost, and what the seller kept. */
export default function MoneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const sale = useSale(id);
  if (!sale) return <Screen><Note>This showcase is gone.</Note></Screen>;

  if (!store.pro) {
    return (
      <Screen footer={<Button kind="secondary" title="Back" onPress={() => router.back()} />}>
        <H>What you kept</H>
        <Panel>
          <Note>{PROFIT_TEASER}</Note>
          <Button title="See Skrybix Pro" onPress={() => router.push('/paywall')} />
        </Panel>
      </Screen>
    );
  }

  const m = saleMoney(sale, store.records, store.plants);
  const setCost = (plantId: string, cost: number | null) => {
    const p = store.plants.find((x) => x.id === plantId);
    if (p) store.savePlant({ ...p, cost });
  };

  return (
    <Screen footer={<Button title="Done" onPress={() => router.back()} />}>
      <H>What you kept</H>
      {!m.lots.length ? (
        <Note>Nothing to add up yet. Close the showcase from the rundown first.</Note>
      ) : (
        <>
          <Panel>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Figure label="Taken in" value={dollars(m.takenIn)} />
              <Figure label="Costs" value={dollars(m.costs)} />
              <Figure label={keptWords(m)} value={dollars(m.kept)} />
            </View>
            <Text style={{ color: colors.soft, marginTop: 8 }}>
              {dollars(m.claimed)} in plants{m.shippingCharged ? `, ${dollars(m.shippingCharged)} shipping charged` : ''}.
            </Text>
            {m.waiting ? <Text style={{ color: colors.warn }}>{dollars(m.waiting)} of it is still waiting to be paid.</Text> : null}
          </Panel>

          <H>Plant costs</H>
          {m.lots.map((l) => (
            <View key={`${l.number}${l.buyer}`}>
              {l.plantId ? (
                <CostBox
                  label={`Lot ${l.number}, ${l.name}, ${dollars(l.price)}`}
                  value={l.cost}
                  onValue={(n) => setCost(l.plantId!, n)}
                />
              ) : (
                <Note>{`Lot ${l.number}, ${l.name}, ${dollars(l.price)}: this plant is no longer on your list, so there is no cost to enter.`}</Note>
              )}
            </View>
          ))}
          <Note>{COST_HINT}</Note>

          <H>Other costs for this showcase</H>
          <CostBox label="What shipping cost you" value={sale.shippingCost} onValue={(n) => store.saveSale({ ...sale, shippingCost: n })} hint="The postage you paid, all together." />
          <CostBox label="Anything else" value={sale.otherCosts} onValue={(n) => store.saveSale({ ...sale, otherCosts: n })} hint="Boxes, fees, anything you want counted. One amount." />
          <Note>{COSTS_BLANK}</Note>
          <Note>{PROFIT_COUNTED}</Note>
        </>
      )}
    </Screen>
  );
}
