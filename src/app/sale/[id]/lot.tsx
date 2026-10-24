import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { appendLot, nextLotNumber } from '../../../core/sale';
import { toDay } from '../../../core/text';
import { newId, useSale, useStore } from '../../../lib/store';
import { Button, Note, Screen } from '../../../ui/kit';
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
    photoUri: existing?.photoUri ?? null,
  });

  if (!sale) return <Screen><Note>This sale is gone.</Note></Screen>;
  const number = existing?.number ?? nextLotNumber(sale);
  const canSave = draft.name.trim() !== '' || draft.noid;

  const save = () => {
    const fields = {
      name: draft.name.trim(),
      noid: draft.noid,
      price: draftPrice(draft),
      description: draft.description.trim(),
      photoUri: draft.photoUri,
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
        />
      </Screen>
    </>
  );
}
