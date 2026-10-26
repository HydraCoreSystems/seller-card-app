import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { readSaleSheet, saleSheet, sheetRowsFromBytes, sheetTitle, type SheetRead } from '../core/saleSheet';
import { formatPrice, plantDisplayName } from '../core/text';
import { holdSheetLots } from '../lib/pendingSheet';
import { pickSheetBytes, shareSaleSheet } from '../lib/saleSheetFile';
import { useStore } from '../lib/store';
import { Button, H, Note, Panel, Screen, colors } from '../ui/kit';

/** Set a showcase up at a computer: a blank Sale Sheet out, a filled one back in. */
export default function SheetScreen() {
  const { profile } = useStore();
  const [read, setRead] = useState<SheetRead | null>(null);
  const [busy, setBusy] = useState(false);
  if (!profile) return <Screen><Note>Set up your profile first.</Note></Screen>;

  const blank = () => shareSaleSheet('Sale_Sheet_blank.xlsx', saleSheet(profile, null), sheetTitle(profile.defaultFormat)).catch(() => undefined);

  const pick = async () => {
    setBusy(true);
    try {
      const bytes = await pickSheetBytes();
      if (bytes) setRead(readSaleSheet(sheetRowsFromBytes(bytes)));
    } catch {
      setRead({ ok: false, error: 'The app couldn’t open that file. Save it from Sheets or Excel as an .xlsx or .csv file and try again.' });
    } finally {
      setBusy(false);
    }
  };

  const lots = read?.ok ? read.lots : [];
  const problems = read?.ok ? read.problems : [];
  const footer = lots.length ? (
    <Button
      title={problems.length ? `Build a showcase with the ${lots.length} good lots` : `Build a showcase with ${lots.length} lots`}
      onPress={() => {
        holdSheetLots(lots);
        router.replace({ pathname: '/sale/new', params: { sheet: '1' } });
      }}
    />
  ) : undefined;

  return (
    <Screen footer={footer}>
      {!read ? (
        <>
          <Note>
            Type a whole showcase at a keyboard. Get a blank Sale Sheet, save it to Google Drive, and fill it in with Google
            Sheets or Excel: one lot per row. Then import it here and the app builds the lots in order.
          </Note>
          <Note>Photos stay on the phone. After import, each lot waits for its photo.</Note>
          <Button kind="secondary" title="Get a blank Sale Sheet" onPress={blank} style={{ marginBottom: 10 }} />
        </>
      ) : null}
      <Button
        kind={read ? 'quiet' : 'primary'}
        title={busy ? 'Reading the sheet' : read ? 'Pick a different sheet' : 'Import a filled Sale Sheet'}
        disabled={busy}
        onPress={pick}
      />

      {read && !read.ok ? <Note tone="warn">{read.error}</Note> : null}

      {problems.length ? (
        <View style={{ backgroundColor: colors.warnTint, borderRadius: 10, padding: 12, marginVertical: 12 }}>
          <Text style={{ color: colors.warn, fontWeight: '700', marginBottom: 4 }}>
            {problems.length === 1 ? 'One row can’t come in as it is.' : `${problems.length} rows can’t come in as they are.`}
          </Text>
          {problems.map((p) => (
            <Text key={p.row} style={{ color: colors.warn, marginBottom: 2 }}>
              Row {p.row}: {p.text}
            </Text>
          ))}
          <Text style={{ color: colors.warn, marginTop: 6 }}>
            Fix them in the sheet and import it again, or build the showcase without them.
          </Text>
        </View>
      ) : null}

      {read?.ok ? (
        <>
          {read.claimsLeftOut ? <Note>Claimed by and Payment aren’t read in. A new showcase starts with no claims.</Note> : null}
          <H>{lots.length ? `${lots.length} lots, numbered as listed` : 'No lots in this sheet'}</H>
          {lots.map((l, i) => (
            <Panel key={l.row}>
              <Text style={{ fontWeight: '700', color: colors.ink }}>
                Lot {i + 1}: {plantDisplayName(l.name, l.noid) || 'Unnamed'}
              </Text>
              <Text style={{ color: l.price === null ? colors.warn : colors.soft }}>
                {l.price === null ? 'No price yet' : formatPrice(l.price)}
                {l.description ? `, ${l.description}` : ''}
              </Text>
            </Panel>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
