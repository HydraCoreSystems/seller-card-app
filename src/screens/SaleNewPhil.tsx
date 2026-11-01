import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import type { SaleKind, SaleTime } from '../core/types';
import { CONTACT_HOURS, defaultVenue, venuesOf } from '../core/venues';
import { clearSheetLots, sheetLots } from '../lib/pendingSheet';
import { newId, useLeftovers, useStore } from '../lib/store';
import { Button, Choice, Field, H, Note, Screen } from '../ui/kit';
import { WhenPicker, isComplete } from '../ui/WhenPicker';

export default function SaleNewPhil() {
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

  const rooms = venuesOf(profile);
  const first = defaultVenue(profile);
  const [venueId, setVenueId] = useState(first.id);
  const room = rooms.find((v) => v.id === venueId) ?? first;
  const [kind, setKind] = useState<SaleKind>(mostlyAuction ? 'auction' : 'sale');
  const [opens, setOpens] = useState<SaleTime | null>(null);
  const [closes, setCloses] = useState<SaleTime | null>(null);
  const [endsAt, setEndsAt] = useState<SaleTime | null>(null);
  const [closeCall, setCloseCall] = useState('');
  const [claimRules, setClaimRules] = useState(first.claimRules || profile.claimRules);
  const [crossListing, setCrossListing] = useState('');
  const [note, setNote] = useState('');
  const [contactHours, setContactHours] = useState(first.contactHours);
  const [templateName, setTemplateName] = useState('');
  const [templateId, setTemplateId] = useState('none');

  // Picking a room brings that room's own claim rules and deadline hours with it.
  const chooseRoom = (id: string) => {
    const v = rooms.find((x) => x.id === id) ?? first;
    setVenueId(v.id);
    setClaimRules(v.claimRules);
    setContactHours(v.contactHours);
  };
  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = store.templates.find((x) => x.id === id);
    if (!t) return;
    const v = rooms.find((x) => x.id === t.venueId) ?? first;
    setVenueId(v.id);
    setKind(t.kind);
    setClaimRules(t.claimRules);
    setCrossListing(t.crossListing);
    setNote(t.note);
    setContactHours(t.contactHours);
  };

  const noPrice = picked.filter((p) => p.price === null).length;

  return (
    <Screen
      footer={
        <Button
          title={picked.length ? `Build announcement and ${picked.length} lots` : 'Build announcement'}
          onPress={() => {
            const settings = {
              formatId: room.formatId,
              venueId: room.id,
              kind,
              opens: isComplete(opens) ? opens : null,
              closes: kind === 'auction' && isComplete(closes) ? closes : null,
              endsAt: store.pro && kind === 'sale' && isComplete(endsAt) ? endsAt : null,
              closeCall: kind === 'auction' ? closeCall.trim() : '',
              claimRules: claimRules.trim(),
              crossListing: crossListing.trim(),
              note: note.trim(),
              contactHours: store.pro ? contactHours : undefined,
            };
            if (templateName.trim()) {
              store.saveTemplate({
                id: newId(),
                name: templateName.trim(),
                venueId: room.id,
                kind,
                claimRules: claimRules.trim(),
                crossListing: crossListing.trim(),
                note: note.trim(),
                contactHours,
              });
            }
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
        This is the announcement, built once for the whole sale. Your shipping and payment lines come from the room
        you pick.
      </Note>
      {store.templates.length ? (
        <Choice
          label="Start from a template"
          value={templateId}
          options={[{ value: 'none', label: 'Blank' }, ...store.templates.map((t) => ({ value: t.id, label: t.name }))]}
          onChange={applyTemplate}
        />
      ) : null}
      {rooms.length > 1 ? (
        <Choice label="Room" value={room.id} options={rooms.map((v) => ({ value: v.id, label: v.name }))} onChange={chooseRoom} />
      ) : (
        <Note>Room: {room.name}</Note>
      )}
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
      {kind === 'sale' && store.pro ? (
        <>
          <WhenPicker label="When the sale ends" value={endsAt} onChange={setEndsAt} />
          <Note>With this, the buyer contact deadline in your announcement prints as a real clock time.</Note>
        </>
      ) : null}
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
      <Field
        label="A note from you"
        value={note}
        onChangeText={setNote}
        placeholder="Leave blank to print none"
        hint="Your own words, printed at the top of the announcement."
        multiline
      />
      {store.pro ? (
        <>
          <Choice
            label="Buyers get in touch within"
            value={String(contactHours)}
            options={CONTACT_HOURS.map((h) => ({ value: String(h), label: `${h} hours` }))}
            onChange={(v) => setContactHours(Number(v))}
          />
          <Note>Counted from when the sale ends, and printed in the announcement.</Note>
        </>
      ) : null}
      <H>Save these settings</H>
      <Field
        label="Template name"
        value={templateName}
        onChangeText={setTemplateName}
        placeholder="Leave blank to skip"
        hint="Saves the room, rules, note and deadline hours so your next sale starts here."
      />
      {noPrice ? (
        <Note tone="warn">
          {noPrice} of the plants {noPrice === 1 ? 'has' : 'have'} no price yet. You can add it on the lot later.
        </Note>
      ) : null}
    </Screen>
  );
}
