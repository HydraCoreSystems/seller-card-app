import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FORMAT_LIST } from '../../core/formats';
import type { FormatId, SaleKind, SaleTime } from '../../core/types';
import { clearSheetLots, sheetLots } from '../../lib/pendingSheet';
import { useLeftovers, useStore } from '../../lib/store';
import { Button, Choice, Field, Note, Screen } from '../../ui/kit';
import { WhenPicker, isComplete } from '../../ui/WhenPicker';

export default function NewSale() {
  const { plants: param, leftovers: leftoverParam, sheet } = useLocalSearchParams<{ plants?: string; leftovers?: string; sheet?: string }>();
  const store = useStore();
  const profile = store.profile!;
  const waiting = useLeftovers();
  const plantIds = (param ?? '').split(',').filter(Boolean);
  const leftoverKeys = (leftoverParam ?? '').split(',').filter((k) => waiting.some((l) => l.key === k));
  const fromSheet = sheet ? sheetLots() : null;
  const plants = plantIds.map((id) => store.plants.find((p) => p.id === id)).filter((p) => !!p);
  // Leftovers come back as lots, so only plants say whether they were up for auction.
  const picked: { price: number | null }[] = fromSheet
    ? fromSheet
    : leftoverKeys.length
      ? leftoverKeys.map((k) => waiting.find((l) => l.key === k)!.lot)
      : plants;
  const mostlyAuction = plants.filter((p) => p.kind === 'auction').length > plants.length / 2;

  const [formatId, setFormatId] = useState<FormatId>(profile.defaultFormat);
  const [kind, setKind] = useState<SaleKind>(mostlyAuction ? 'auction' : 'sale');
  const [opens, setOpens] = useState<SaleTime | null>(null);
  const [closes, setCloses] = useState<SaleTime | null>(null);
  const [closeCall, setCloseCall] = useState('');
  const [claimRules, setClaimRules] = useState(profile.claimRules);
  const [crossListing, setCrossListing] = useState('');

  const noPrice = picked.filter((p) => p.price === null).length;

  return (
    <Screen
      footer={
        <Button
          title={picked.length ? `Build announcement and ${picked.length} lots` : 'Build announcement'}
          onPress={() => {
            const settings = {
              formatId,
              kind,
              opens: isComplete(opens) ? opens : null,
              closes: kind === 'auction' && isComplete(closes) ? closes : null,
              closeCall: kind === 'auction' ? closeCall.trim() : '',
              claimRules: claimRules.trim(),
              crossListing: crossListing.trim(),
            };
            const sale = fromSheet
              ? store.importSale(fromSheet, settings)
              : leftoverKeys.length
                ? store.relistLeftovers(leftoverKeys, settings)
                : store.createSale(plantIds, settings);
            if (fromSheet) clearSheetLots();
            router.replace(`/sale/${sale.id}`);
          }}
        />
      }
    >
      <Note>
        This is the announcement, built once for the whole sale. Your shipping and payment lines come from your
        profile.
      </Note>
      <Choice<FormatId>
        label="Format"
        value={formatId}
        options={FORMAT_LIST.map((f) => ({ value: f.id, label: f.name }))}
        onChange={setFormatId}
      />
      <Choice<SaleKind>
        label="Kind of sale"
        value={kind}
        options={[
          { value: 'sale', label: 'Set prices' },
          { value: 'auction', label: 'Auction' },
        ]}
        onChange={setKind}
      />
      <WhenPicker label="When it opens" value={opens} onChange={setOpens} />
      {kind === 'auction' ? (
        <>
          <WhenPicker label="When it closes" value={closes} onChange={setCloses} />
          <Field
            label="How the close is called"
            value={closeCall}
            onChangeText={setCloseCall}
            placeholder="By the clock on my phone. Last bid showing wins."
            multiline
          />
        </>
      ) : null}
      <Field
        label={kind === 'auction' ? 'Bidding rules' : 'Claim rules'}
        value={claimRules}
        onChangeText={setClaimRules}
        placeholder="First clear claim wins. Pay within 24 hours."
        multiline
      />
      <Field
        label="Also listed in"
        value={crossListing}
        onChangeText={setCrossListing}
        placeholder="Leave blank if this is the only place"
        hint="Any other room or site where these plants are up."
      />
      {noPrice ? (
        <Note tone="warn">
          {noPrice} of the plants {noPrice === 1 ? 'has' : 'have'} no price yet. You can add it on the lot later.
        </Note>
      ) : null}
    </Screen>
  );
}
