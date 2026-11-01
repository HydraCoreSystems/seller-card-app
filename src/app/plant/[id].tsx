import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { getFormat } from '../../core/formats';
import { droppedPhotos, photoFields, photosOf } from '../../core/photos';
import { lastSold, priceMemoryLine } from '../../core/records';
import { toDay } from '../../core/text';
import type { Plant, SaleKind } from '../../core/types';
import { deletePhoto } from '../../lib/photos';
import { newId, useStore } from '../../lib/store';
import { Button, CardText, Choice, H, Note, Screen } from '../../ui/kit';
import { PlantFields, draftPrice, priceText, type PlantDraft } from '../../ui/PlantFields';
import { StampedPhotos } from '../../ui/StampedPhoto';
import { CardImageButton } from '../../ui/CardImageButton';
import { isPhil } from '../../core/variant';
import { resolveDefault } from '../../core/venues';

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
    photoUris: photosOf(existing),
  });

  const canSave = draft.name.trim() !== '' || draft.noid;
  const memory = lastSold(store.records, draft.name, draft.noid);
  // Plants and lots are stamped for the main room. A sale stamps for its own room when it posts.
  const room = store.profile ? resolveDefault(store.profile) : null;
  // Lots in a sale keep pointing at the photo, so only remove photos no sale uses.
  const dropPhoto = (uri: string | null) => {
    if (!store.sales.some((s) => s.lots.some((l) => photosOf(l).includes(uri ?? '')))) deletePhoto(uri);
  };

  const save = () => {
    const photos = photoFields(draft.photoUris);
    const plant: Plant = {
      id: existing?.id ?? newId(),
      name: draft.name.trim(),
      noid: draft.noid,
      price: draftPrice(draft),
      kind,
      photoUri: photos.photoUri,
      photoUris: photos.photoUris,
      notes: draft.description.trim(),
      sold: existing?.sold ?? false,
      createdAt: existing?.createdAt ?? toDay(new Date()),
    };
    droppedPhotos(existing, photos.photoUris).forEach(dropPhoto);
    store.savePlant(plant);
    if (isNew) router.replace(`/plant/${plant.id}`);
    else setEditing(false);
  };

  if (!editing && existing && store.profile && room) {
    const format = getFormat(room.defaultFormat);
    const card = format.single({
      profile: room,
      sale: { kind: existing.kind },
      lot: {
        number: 1,
        plantId: existing.id,
        name: existing.name,
        noid: existing.noid,
        price: existing.price,
        description: existing.notes,
        photoUri: existing.photoUri,
        photoUris: photosOf(existing),
      },
      claimRules: room.claimRules,
    });
    return (
      <>
        <Stack.Screen options={{ title: 'Card' }} />
        <Screen
          footer={<Button kind="secondary" title="Edit plant" onPress={() => setEditing(true)} />}
        >
          <CardText text={card} copyKey="single" />
          {isPhil() ? null : <CardImageButton text={card} profile={store.profile} formatId={store.profile.defaultFormat} />}
          <StampedPhotos uris={photosOf(existing)} profile={room} />
          <Note>
            {isPhil()
              ? `This is a card for posting one plant on its own, in the ${format.name} format for ${room.venueName}. For several plants at once, start a New showcase from your plant list.`
              : `This is a card for posting one plant on its own, in the ${format.name} format. For several plants at once, start a New showcase from your plant list.`}
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
        {isPhil() && draft.photoUris.length && room ? (
          <>
            <H>{draft.photoUris.length === 1 ? 'Your stamped photo' : 'Your stamped photos'}</H>
            <Note>
              {draft.photoUris.length === 1 ? 'This is the copy to post.' : 'These are the copies to post.'} Save {draft.photoUris.length === 1 ? 'it' : 'them'} to your phone right here.
              Your own photo{draft.photoUris.length === 1 ? ' is' : 's are'} never changed.
            </Note>
            <StampedPhotos uris={draft.photoUris} profile={room} />
          </>
        ) : null}
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
                photosOf(existing).forEach(dropPhoto);
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
