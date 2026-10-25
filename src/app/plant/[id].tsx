import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { getFormat } from '../../core/formats';
import { lastSold, priceMemoryLine } from '../../core/records';
import { toDay } from '../../core/text';
import type { Plant, SaleKind } from '../../core/types';
import { deletePhoto } from '../../lib/photos';
import { newId, useStore } from '../../lib/store';
import { Button, CardText, Choice, H, Note, Screen } from '../../ui/kit';
import { PlantFields, draftPrice, priceText, type PlantDraft } from '../../ui/PlantFields';
import { StampedPhoto } from '../../ui/StampedPhoto';

export default function PlantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const existing = store.plants.find((p) => p.id === id);
  const isNew = !existing;

  const [editing, setEditing] = useState(isNew);
  const [kind, setKind] = useState<SaleKind>(existing?.kind ?? 'sale');
  const [draft, setDraft] = useState<PlantDraft>({
    name: existing?.name ?? '',
    noid: existing?.noid ?? false,
    priceText: priceText(existing?.price ?? null),
    description: existing?.notes ?? '',
    photoUri: existing?.photoUri ?? null,
  });

  const canSave = draft.name.trim() !== '' || draft.noid;
  const memory = lastSold(store.records, draft.name, draft.noid);
  // Lots in a sale keep pointing at the photo, so only remove photos no sale uses.
  const dropPhoto = (uri: string | null) => {
    if (!store.sales.some((s) => s.lots.some((l) => l.photoUri === uri))) deletePhoto(uri);
  };

  const save = () => {
    const plant: Plant = {
      id: existing?.id ?? newId(),
      name: draft.name.trim(),
      noid: draft.noid,
      price: draftPrice(draft),
      kind,
      photoUri: draft.photoUri,
      notes: draft.description.trim(),
      sold: existing?.sold ?? false,
      createdAt: existing?.createdAt ?? toDay(new Date()),
    };
    if (existing && existing.photoUri && existing.photoUri !== plant.photoUri) dropPhoto(existing.photoUri);
    store.savePlant(plant);
    if (isNew) router.replace(`/plant/${plant.id}`);
    else setEditing(false);
  };

  if (!editing && existing && store.profile) {
    const format = getFormat(store.profile.defaultFormat);
    const card = format.single({
      profile: store.profile,
      sale: { kind: existing.kind },
      lot: {
        number: 1,
        plantId: existing.id,
        name: existing.name,
        noid: existing.noid,
        price: existing.price,
        description: existing.notes,
        photoUri: existing.photoUri,
      },
      claimRules: store.profile.claimRules,
    });
    return (
      <>
        <Stack.Screen options={{ title: 'Card' }} />
        <Screen
          footer={<Button kind="secondary" title="Edit plant" onPress={() => setEditing(true)} />}
        >
          <CardText text={card} copyKey="single" />
          <StampedPhoto photoUri={existing.photoUri} profile={store.profile} />
          <Note>
            This is a card for posting one plant on its own, in the {format.name} format. For several plants at
            once, start a New showcase from your plant list.
          </Note>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'Add plant' : 'Edit plant' }} />
      <Screen
        footer={<Button title={isNew ? 'Save and make card' : 'Save'} disabled={!canSave} onPress={save} />}
      >
        <PlantFields
          draft={draft}
          onChange={setDraft}
          priceLabel={kind === 'auction' ? 'Opening price' : 'Price'}
          descriptionLabel="Notes"
          memory={memory ? priceMemoryLine(memory) : null}
        />
        <Choice<SaleKind>
          label="Sell it as"
          value={kind}
          options={[
            { value: 'sale', label: 'Set price' },
            { value: 'auction', label: 'Auction' },
          ]}
          onChange={setKind}
        />
        {existing ? (
          <>
            <H>More</H>
            <Button
              kind="secondary"
              title={existing.sold ? 'Mark as not sold' : 'Mark as sold'}
              onPress={() => {
                store.savePlant({ ...existing, sold: !existing.sold });
                router.back();
              }}
              style={{ marginBottom: 10 }}
            />
            <Button
              kind="danger"
              title="Remove plant"
              onPress={() => {
                dropPhoto(existing.photoUri);
                store.deletePlant(existing.id);
                router.back();
              }}
            />
          </>
        ) : null}
      </Screen>
    </>
  );
}
