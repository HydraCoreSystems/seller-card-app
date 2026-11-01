import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { photoFields, photosOf } from '../../../core/photos';
import { lastSold, priceMemoryLine } from '../../../core/records';
import { appendLot, nextLotNumber } from '../../../core/sale';
import { toDay } from '../../../core/text';
import { newId, useSale, useStore } from '../../../lib/store';
import { isPhil } from '../../../core/variant';
import { resolveProfile } from '../../../core/venues';
import { Button, H, Note, Screen } from '../../../ui/kit';
import { StampedPhotos } from '../../../ui/StampedPhoto';
import { PlantFields, draftPrice, priceText, type PlantDraft } from '../../../ui/PlantFields';

/** Adds a lot during the sale, or changes one. Photo, name, price, a few words. */
export default function LotScreen() {
  const { id, n } = useLocalSearchParams<{ id: string; n?: string }>();
  const store = useStore();
  const sale = useSale(id);
  const existing = sale?.lots.find((l) => String(l.number) === n);
  const [draft, setDraft] = useState<PlantDraft>({
    name: existing?.name ?? '',
    noid: existing?.noid ?? false,
    priceText: priceText(existing?.price ?? null),
    description: existing?.description ?? '',
    photoUris: photosOf(existing),
  });

  if (!sale) return <Screen><Note>This showcase is gone.</Note></Screen>;
  const number = existing?.number ?? nextLotNumber(sale);
  const canSave = draft.name.trim() !== '' || draft.noid;
  const memory = lastSold(store.records, draft.name, draft.noid, sale.id);

  const save = () => {
    const fields = {
      name: draft.name.trim(),
      noid: draft.noid,
      price: draftPrice(draft),
      description: draft.description.trim(),
      ...photoFields(draft.photoUris),
    };
    if (existing) {
      store.saveSale({ ...sale, lots: sale.lots.map((l) => (l.number === existing.number ? { ...l, ...fields } : l)) });
      router.back();
      return;
    }
    // A plant added during the sale joins the plant list too.
    const plantId = newId();
    store.savePlant({
      id: plantId,
      name: fields.name,
      noid: fields.noid,
      price: fields.price,
      kind: sale.kind,
      photoUri: fields.photoUri,
      photoUris: fields.photoUris,
      notes: fields.description,
      sold: false,
      createdAt: toDay(new Date()),
    });
    store.saveSale(appendLot(sale, { ...fields, plantId }));
    router.replace({ pathname: '/sale/[id]/post', params: { id: sale.id, lot: String(number) } });
  };

  return (
    <>
      <Stack.Screen options={{ title: `Lot ${number}` }} />
      <Screen footer={<Button title={existing ? 'Save lot' : `Add lot ${number}`} disabled={!canSave} onPress={save} />}>
        <PlantFields
          draft={draft}
          onChange={setDraft}
          priceLabel={sale.kind === 'auction' ? 'Opening bid' : 'Price'}
          memory={memory ? priceMemoryLine(memory) : null}
        />
        {isPhil() && draft.photoUris.length && store.profile ? (
          <>
            <H>{draft.photoUris.length === 1 ? 'Your stamped photo' : 'Your stamped photos'}</H>
            <Note>Save {draft.photoUris.length === 1 ? 'it' : 'them'} to your phone right here, stamped for this showcase’s room.</Note>
            <StampedPhotos uris={draft.photoUris} profile={resolveProfile(store.profile, sale)} />
          </>
        ) : null}
      </Screen>
    </>
  );
}
