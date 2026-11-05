import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { announcementFor, listingFor } from '../../../core/announce';
import { photosOf } from '../../../core/photos';
import { toDay } from '../../../core/text';
import { isPhil } from '../../../core/variant';
import { resolveProfile } from '../../../core/venues';
import { CardImageButton } from '../../../ui/CardImageButton';
import { useSale, useStore } from '../../../lib/store';
import { useSizeClass } from '../../../ui/layout';
import { Button, CardText, H, Note, Row, Screen } from '../../../ui/kit';
import { StampedPhotos } from '../../../ui/StampedPhoto';

/** Walks the seller through the paste: the announcement first, then each lot in order. */
export default function PostScreen() {
  const { id, lot: lotParam } = useLocalSearchParams<{ id: string; lot?: string }>();
  const store = useStore();
  const sale = useSale(id);
  const startIndex = sale && lotParam ? sale.lots.findIndex((l) => String(l.number) === lotParam) + 1 : 0;
  const regular = useSizeClass() === 'regular';
  // Side by side, the announcement stays in view and the lots step through beside it, starting at lot 1.
  const [step, setStep] = useState(Math.max(regular ? 1 : 0, startIndex));

  // Reaching the last card means the seller has posted. The first sale checklist reads this.
  const reachedEnd = !!sale && sale.lots.length > 0 && step >= sale.lots.length;
  const { saveSale } = store;
  useEffect(() => {
    if (sale && reachedEnd && !sale.postedAt) saveSale({ ...sale, postedAt: toDay(new Date()) });
  }, [sale, reachedEnd, saveSale]);

  if (!sale || !store.profile) return <Screen><Note>This showcase is gone.</Note></Screen>;
  const profile = resolveProfile(store.profile, sale);
  const total = sale.lots.length;
  const side = regular && total > 0;
  const at = side ? Math.max(1, step) : step;
  const lot = at > 0 ? sale.lots[at - 1] : null;
  const last = at >= total;

  const nav = (
    <Row>
      <Button kind="secondary" title="Back" disabled={at <= (side ? 1 : 0)} onPress={() => setStep(at - 1)} style={{ flex: 1 }} />
      {last ? (
        <Button title="Done" onPress={() => router.back()} style={{ flex: 2 }} />
      ) : (
        <Button title={at === 0 ? 'Next: lot 1' : `Next: lot ${sale.lots[at].number}`} onPress={() => setStep(at + 1)} style={{ flex: 2 }} />
      )}
    </Row>
  );

  const announcement = (
    <>
      {side ? <H>Announcement</H> : null}
      <Note>Start the Grower Showcase post with this. Then go lot by lot.</Note>
      <CardText text={announcementFor(store.profile, sale, store.pro)} copyKey="announcement" label="Copy announcement" />
      {isPhil() ? null : <CardImageButton text={announcementFor(store.profile, sale, store.pro)} profile={profile} formatId={sale.formatId} />}
    </>
  );

  const lotCard = lot ? (
    <>
      {side ? <H>{`Lot ${lot.number} of ${total}`}</H> : null}
      <Note>Comment on your Grower Showcase post: attach the photo, paste the Market Listing.</Note>
      {photosOf(lot).length > 1 ? <Note>Photo 1 goes with the listing. Post the others as replies under it.</Note> : null}
      <StampedPhotos uris={photosOf(lot)} profile={profile} />
      <CardText text={listingFor(store.profile, sale, lot)} copyKey={`lot${lot.number}`} />
      <Button
        kind="quiet"
        title="Change this lot"
        onPress={() => router.push({ pathname: '/sale/[id]/lot', params: { id: sale.id, n: String(lot.number) } })}
      />
    </>
  ) : null;

  return (
    <>
      <Stack.Screen options={{ title: side ? 'Post the showcase' : lot ? `Lot ${lot.number} of ${total}` : 'Announcement' }} />
      {side && lotCard ? <Screen footer={nav} panes={[announcement, lotCard]} /> : <Screen footer={nav}>{lotCard ?? announcement}</Screen>}
    </>
  );
}
