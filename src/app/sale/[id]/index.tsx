import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getFormat } from '../../../core/formats';
import { lastSold, priceMemoryLine } from '../../../core/records';
import { buildRundown } from '../../../core/rundown';
import { saleSheet, sheetState, sheetTitle } from '../../../core/saleSheet';
import { readClaims } from '../../../lib/claimReport';
import { shareSaleSheet } from '../../../lib/saleSheetFile';
import { formatPrice, plantDisplayName } from '../../../core/text';
import { saveToGallery } from '../../../lib/stampPhoto';
import { lotRecorded, useSale, useStore } from '../../../lib/store';
import { Button, CardText, H, Note, Row, Screen, Thumb, colors } from '../../../ui/kit';
import { getStamped } from '../../../ui/StampedPhoto';

export default function SaleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const sale = useSale(id);
  const [saving, setSaving] = useState<string | null>(null);

  if (!sale || !store.profile) return <Screen><Note>This showcase is gone.</Note></Screen>;
  const profile = store.profile;
  const format = getFormat(sale.formatId);
  const announcement = format.announcement({ profile, sale });
  const withPhotos = sale.lots.filter((l) => l.photoUri);

  const saveAll = async () => {
    setSaving('Stamping photos');
    try {
      const uris: string[] = [];
      for (const lot of withPhotos) uris.push(await getStamped(lot.photoUri!, profile));
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
        <H>Announcement</H>
        <CardText text={announcement} copyKey="announcement" label="Copy announcement" />

        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <H>Lots</H>
          <Button kind="quiet" title="Add a lot" onPress={() => router.push(`/sale/${sale.id}/lot`)} />
        </Row>
        {withPhotos.length ? (
          <Button
            kind="secondary"
            title={saving ?? `Save all ${withPhotos.length} stamped photos`}
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
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 10,
                borderRadius: 12,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.line,
                marginBottom: 8,
              }}
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
