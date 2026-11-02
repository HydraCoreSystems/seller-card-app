import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { announcementFor } from '../../../core/announce';
import { contactDeadlineText, contactHoursOf, saleName } from '../../../core/checkout';
import { photosOf } from '../../../core/photos';
import { lastSold, priceMemoryLine } from '../../../core/records';
import { buildRundown } from '../../../core/rundown';
import { saleSheet, sheetState, sheetTitle } from '../../../core/saleSheet';
import { readClaims } from '../../../core/claimReport';
import { shareSaleSheet } from '../../../lib/saleSheetFile';
import { formatPrice, plantDisplayName } from '../../../core/text';
import { isPhil } from '../../../core/variant';
import { CONTACT_HOURS, resolveProfile, venueOf } from '../../../core/venues';
import { CardImageButton } from '../../../ui/CardImageButton';
import { saveToGallery } from '../../../lib/stampPhoto';
import { lotRecorded, useSale, useStore } from '../../../lib/store';
import { Button, CardText, Choice, Field, H, Note, Row, Screen, T, Thumb, colors } from '../../../ui/kit';
import { PHIL_SHADOW } from '../../../ui/styleDefs';
import { getStamped } from '../../../ui/StampedPhoto';
import { WhenPicker, isComplete } from '../../../ui/WhenPicker';

export default function SaleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const sale = useSale(id);
  const [saving, setSaving] = useState<string | null>(null);

  if (!sale || !store.profile) return <Screen><Note>This showcase is gone.</Note></Screen>;
  const profile = resolveProfile(store.profile, sale);
  const room = venueOf(store.profile, sale);
  const announcement = announcementFor(store.profile, sale, store.pro);
  const allPhotos = sale.lots.flatMap((l) => photosOf(l));

  const saveAll = async () => {
    setSaving('Stamping photos');
    try {
      const uris: string[] = [];
      for (const photo of allPhotos) uris.push(await getStamped(photo, profile));
      setSaving('Saving');
      const ok = await saveToGallery(uris);
      setSaving(ok ? `Saved ${uris.length} photos` : 'Photos not allowed');
    } catch {
      setSaving('Something went wrong');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: `${sale.kind === 'auction' ? 'Grower Showcase auction' : 'Grower Showcase'}, ${sale.lots.length} lots` }} />
      <Screen
        footer={
          <Row>
            <Button title="Post the Market Listings" onPress={() => router.push(`/sale/${sale.id}/post`)} style={{ flex: 1 }} />
            <Button kind="secondary" title="Claims" onPress={() => router.push(`/sale/${sale.id}/claims`)} style={{ flex: 1 }} />
          </Row>
        }
      >
        {isPhil() ? <Note>Room: {room.name}</Note> : null}
        <Field
          label="A note from you"
          value={sale.note ?? ''}
          onChangeText={(note) => store.saveSale({ ...sale, note })}
          placeholder="Leave blank to print none"
          hint="Your own words, printed at the top of the announcement. Change it any time before you copy."
          multiline
        />
        {store.pro ? (
          <>
            {sale.kind === 'sale' ? (
              <>
                <WhenPicker label="When the sale ends" value={sale.endsAt ?? null} onChange={(t) => store.saveSale({ ...sale, endsAt: isComplete(t) ? t : null })} />
                {!sale.endsAt ? <Note tone="warn">Add when the sale ends and the buyer contact deadline prints as a real clock time.</Note> : null}
              </>
            ) : null}
            <Choice
              label="Buyers get in touch within"
              value={String(contactHoursOf(sale, profile))}
              options={CONTACT_HOURS.map((h) => ({ value: String(h), label: `${h} hours` }))}
              onChange={(v) => store.saveSale({ ...sale, contactHours: Number(v) })}
            />
            {contactDeadlineText(sale, profile) ? <Note>The deadline prints as {contactDeadlineText(sale, profile)}.</Note> : null}
            <Field
              label="What your checkout form calls this sale"
              value={sale.name ?? ''}
              onChangeText={(name) => store.saveSale({ ...sale, name })}
              placeholder={saleName({ ...sale, name: '' }, profile)}
              hint="Leave blank to use the name above. Winners’ forms arrive tagged with it."
            />
          </>
        ) : null}
        <H>Announcement</H>
        <CardText text={announcement} copyKey="announcement" label="Copy announcement" />
        {isPhil() ? null : <CardImageButton text={announcement} profile={profile} formatId={sale.formatId} />}

        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <H>Lots</H>
          <Button kind="quiet" title="Add a lot" onPress={() => router.push(`/sale/${sale.id}/lot`)} />
        </Row>
        {allPhotos.length ? (
          <Button
            kind="secondary"
            title={saving ?? `Save all ${allPhotos.length} stamped photos`}
            disabled={saving === 'Stamping photos' || saving === 'Saving'}
            onPress={saveAll}
            style={{ marginBottom: 12 }}
          />
        ) : null}
        {sale.lots.map((lot) => {
          const record = lotRecorded(store.records, sale.id, lot);
          const memory = record ? null : lastSold(store.records, lot.name, lot.noid, sale.id);
          return (
            <Pressable
              key={lot.number}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/sale/[id]/post', params: { id: sale.id, lot: String(lot.number) } })}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.line,
                  marginBottom: 8,
                },
                // The Phil build's lot rows are raised cards, with no outline.
                T.name === 'phil' ? { borderRadius: 16, padding: 12, borderWidth: 0, marginBottom: 12, ...PHIL_SHADOW.raised } : null,
              ]}
            >
              <Thumb uri={lot.photoUri} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.ink }} numberOfLines={1}>
                  Lot {lot.number}: {plantDisplayName(lot.name, lot.noid) || 'Unnamed'}
                </Text>
                <Text style={{ color: record ? colors.moss : lot.price === null ? colors.warn : colors.soft }}>
                  {record
                    ? `Sold to ${record.buyer}`
                    : lot.price === null
                      ? 'No price yet'
                      : `${sale.kind === 'auction' ? 'Opening bid ' : ''}${formatPrice(lot.price)}`}
                </Text>
                {memory ? <Text style={{ color: colors.soft, fontSize: 12 }}>{priceMemoryLine(memory)}</Text> : null}
              </View>
            </Pressable>
          );
        })}
        {!sale.lots.length ? <Note>No lots yet. Add one with a photo, a name and a price.</Note> : null}
        {sale.lots.length ? (
          <Button
            kind="secondary"
            title="Export the Sale Sheet"
            onPress={() => {
              // A showcase that's run carries who claimed what and who's paid.
              const run = sale.claimText?.trim()
                ? buildRundown({ sale, profile, report: readClaims(sale.claimText, sale, profile), records: store.records })
                : null;
              const sheet = saleSheet(profile, sale, run ? sheetState(run.lots, !!sale.closedAt) : undefined);
              const day = sale.opens?.day ?? sale.createdAt;
              shareSaleSheet(`Sale_Sheet_${day}.xlsx`, sheet, sheetTitle(sale.formatId)).catch(() => undefined);
            }}
            style={{ marginTop: 16 }}
          />
        ) : null}
        <Button
          kind="danger"
          title="Delete this showcase"
          onPress={() => {
            store.deleteSale(sale.id);
            router.back();
          }}
          style={{ marginTop: 24 }}
        />
      </Screen>
    </>
  );
}
