import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { getFormat } from '../../../core/formats';
import { useSale, useStore } from '../../../lib/store';
import { Button, CardText, Note, Row, Screen } from '../../../ui/kit';
import { StampedPhoto } from '../../../ui/StampedPhoto';

/** Walks the seller through the paste: the announcement first, then each lot in order. */
export default function PostScreen() {
  const { id, lot: lotParam } = useLocalSearchParams<{ id: string; lot?: string }>();
  const store = useStore();
  const sale = useSale(id);
  const startIndex = sale && lotParam ? sale.lots.findIndex((l) => String(l.number) === lotParam) + 1 : 0;
  const [step, setStep] = useState(Math.max(0, startIndex));

  if (!sale || !store.profile) return <Screen><Note>This showcase is gone.</Note></Screen>;
  const profile = store.profile;
  const format = getFormat(sale.formatId);
  const total = sale.lots.length;
  const lot = step > 0 ? sale.lots[step - 1] : null;
  const last = step >= total;

  const nav = (
    <Row>
      <Button kind="secondary" title="Back" disabled={step === 0} onPress={() => setStep(step - 1)} style={{ flex: 1 }} />
      {last ? (
        <Button title="Done" onPress={() => router.back()} style={{ flex: 2 }} />
      ) : (
        <Button title={step === 0 ? 'Next: lot 1' : `Next: lot ${sale.lots[step].number}`} onPress={() => setStep(step + 1)} style={{ flex: 2 }} />
      )}
    </Row>
  );

  return (
    <>
      <Stack.Screen options={{ title: lot ? `Lot ${lot.number} of ${total}` : 'Announcement' }} />
      <Screen footer={nav}>
        {lot ? (
          <>
            <Note>Comment on your Grower Showcase post: attach the photo, paste the Market Listing.</Note>
            <StampedPhoto photoUri={lot.photoUri} profile={profile} />
            <CardText text={format.listing({ profile, sale, lot })} copyKey={`lot${lot.number}`} />
            <Button
              kind="quiet"
              title="Change this lot"
              onPress={() => router.push({ pathname: '/sale/[id]/lot', params: { id: sale.id, n: String(lot.number) } })}
            />
          </>
        ) : (
          <>
            <Note>Start the Grower Showcase post with this. Then go lot by lot.</Note>
            <CardText text={format.announcement({ profile, sale })} copyKey="announcement" label="Copy announcement" />
          </>
        )}
      </Screen>
    </>
  );
}
