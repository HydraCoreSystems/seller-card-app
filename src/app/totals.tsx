import { useState } from 'react';
import { Text, View } from 'react-native';
import { flatShipping } from '../core/chase';
import { hasUncountedShipping, periodOf, seasonCsv, seasonTotals, type PeriodTotals, type Span } from '../core/season';
import { formatPrice, toDay } from '../core/text';
import { shareTextFile } from '../lib/exportFile';
import { useStore } from '../lib/store';
import { Button, Choice, Note, Panel, Screen, colors } from '../ui/kit';

export default function TotalsScreen() {
  const { records, sales, profile } = useStore();
  const [span, setSpan] = useState<Span>('month');
  const fallback = flatShipping(profile?.shipping ?? '');
  const today = toDay(new Date());
  const year = today.slice(0, 4);
  const periods = seasonTotals(records, sales, span, fallback);
  // The period you're in comes first, even before anything has sold in it.
  const now = periodOf(today, span);
  const current = periods.find((p) => p.key === now.key) ?? { ...now, plants: 0, gross: 0, shipping: 0, unpaid: 0 };
  const earlier = periods.filter((p) => p.key !== now.key);

  const exportYear = (y: string) => shareTextFile(`season_${y}.csv`, seasonCsv(records, sales, y, fallback), 'text/csv');

  return (
    <Screen footer={<Button title={`Export the ${year} season`} disabled={!records.length} onPress={() => exportYear(year)} />}>
      <Choice<Span>
        value={span}
        options={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'season', label: 'Season' },
        ]}
        onChange={setSpan}
      />
      <View style={{ height: 12 }} />
      <PeriodPanel period={current} big />
      {earlier.map((p) => (
        <PeriodPanel key={p.key} period={p} onExport={span === 'season' ? () => exportYear(p.key) : undefined} />
      ))}
      {!records.length ? <Note>Nothing sold yet. Totals fill in as your showcases close.</Note> : null}
      {hasUncountedShipping(records, sales) ? (
        <Note>Showcases with tiered shipping don’t add to shipping collected, since the app can’t know what each buyer paid.</Note>
      ) : null}
      <Note>The export is your season month by month with a total at the bottom, ready for a tax preparer or a spreadsheet.</Note>
    </Screen>
  );
}

function PeriodPanel({ period, big, onExport }: { period: PeriodTotals; big?: boolean; onExport?: () => void }) {
  const figures: [string, string][] = [
    ['Plants sold', String(period.plants)],
    ['Gross taken', formatPrice(period.gross) || '$0'],
    ['Shipping collected', formatPrice(period.shipping) || '$0'],
    ['Unpaid', formatPrice(period.unpaid) || '$0'],
  ];
  return (
    <Panel>
      <Text style={{ fontWeight: '700', color: colors.ink, fontSize: big ? 18 : 15, marginBottom: 6 }}>{period.label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {figures.map(([label, value]) => (
          <View key={label} style={{ width: '50%', marginBottom: 6 }}>
            <Text style={{ color: label === 'Unpaid' && period.unpaid ? colors.warn : colors.ink, fontSize: big ? 20 : 16, fontWeight: '700' }}>
              {value}
            </Text>
            <Text style={{ color: colors.soft, fontSize: 13 }}>{label}</Text>
          </View>
        ))}
      </View>
      {onExport ? <Button kind="quiet" title="Export this season" onPress={onExport} /> : null}
    </Panel>
  );
}
