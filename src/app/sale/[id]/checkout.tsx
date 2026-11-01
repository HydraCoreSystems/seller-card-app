import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import { closeoutComment, contactLine, formReminder, readResponses, winnerMessage } from '../../../core/checkout';
import { PRO_PRIVACY } from '../../../core/pro';
import { sheetRowsFromBytes } from '../../../core/saleSheet';
import { formatDeadline } from '../../../core/secondChance';
import { pickSheetBytes } from '../../../lib/saleSheetFile';
import { useSale, useStore } from '../../../lib/store';
import { useCheckout } from '../../../lib/useCheckout';
import { Button, CardText, H, Note, Panel, Row, Screen, colors, useCopy } from '../../../ui/kit';
import { ProExplainer } from '../../../ui/ProExplainer';

/** The checkout form for one sale: the messages that carry the link, and the responses coming back. */
export default function CheckoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const sale = useSale(id);
  const c = useCheckout(sale);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, copy] = useCopy();

  if (!sale || !c || !store.profile) return <Screen><Note>This showcase is gone.</Note></Screen>;
  if (!store.pro) return <Screen><ProExplainer /></Screen>;

  const { room, rundown, deadline, name, match, rows, link } = c;
  const deadlineMs = deadline.state === 'none' ? null : deadline.ms;
  const imported = sale.checkout;
  const waitingForForm = rows.filter((r) => !r.contacted);
  const pairable = waitingForForm;

  const importSheet = async () => {
    setBusy(true);
    setError(null);
    try {
      const bytes = await pickSheetBytes();
      if (!bytes) return;
      const read = readResponses(sheetRowsFromBytes(bytes));
      if (!read.ok) setError(read.error);
      else store.importCheckout(sale.id, read.responses);
    } catch {
      setError('The app couldn’t open that file. In Google Sheets, choose File, Download, and pick .xlsx or .csv, then try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Note>{PRO_PRIVACY}</Note>

      <H>Buyer contact deadline</H>
      <Note>
        {deadline.state === 'none'
          ? 'No deadline yet. Add when the sale ends on the showcase screen, or close the showcase from the rundown.'
          : deadline.state === 'open'
            ? `Winners have until ${formatDeadline(deadline.ms, room.timeZone)}. That’s about ${deadline.hoursLeft} ${deadline.hoursLeft === 1 ? 'hour' : 'hours'} from now.`
            : `The deadline passed ${formatDeadline(deadline.ms, room.timeZone)}.`}
      </Note>
      <Text style={{ color: colors.soft, fontSize: 13, marginBottom: 8 }}>{contactLine(sale, room)}</Text>

      <H>Your form link for this sale</H>
      {link.url ? (
        <>
          <Text selectable style={{ color: colors.ink, marginBottom: 6 }}>{link.url}</Text>
          {link.problem ? <Note tone="warn">{link.problem}</Note> : <Note>It carries the sale name “{name}”, so responses arrive tagged.</Note>}
          <Note>The link stays out of the announcement. It goes in the two places below, after the sale closes.</Note>
        </>
      ) : (
        <>
          <Note tone="warn">{link.problem}</Note>
          <Button kind="secondary" title="Open your room’s profile" onPress={() => router.push('/profile')} />
        </>
      )}

      {link.url ? (
        <>
          <H>Closeout comment</H>
          <Note>Paste this as a comment on your main listing post once the sale closes.</Note>
          <CardText text={closeoutComment(sale, room, link.url)} copyKey="closeout" label="Copy closeout comment" />

          <H>A message to each winner</H>
          {rows.length ? (
            rows.map((r) => (
              <Panel key={r.key}>
                <Text style={{ fontWeight: '700', color: colors.ink }}>{r.buyer}</Text>
                <Text style={{ color: colors.soft }}>
                  {r.contacted ? 'Form is in.' : 'No form yet.'}
                </Text>
                {(() => {
                  const text = r.contacted ? null : winnerMessage(r, sale, room, link.url!, deadlineMs);
                  const remind = r.contacted ? null : formReminder(r, room, link.url!, deadlineMs);
                  return text ? (
                    <Row style={{ marginTop: 8 }}>
                      <Button title={copied === `m${r.key}` ? '✓ Copied' : 'Copy message'} onPress={() => copy(`m${r.key}`, text)} style={{ flex: 2 }} />
                      <Button kind="secondary" title="Send" onPress={() => Share.share({ message: text }).catch(() => undefined)} style={{ flex: 1 }} />
                      <Button kind="quiet" title={copied === `r${r.key}` ? '✓ Copied' : 'Copy a reminder instead'} onPress={() => copy(`r${r.key}`, remind!)} />
                    </Row>
                  ) : null;
                })()}
              </Panel>
            ))
          ) : (
            <Note>No winners yet. Paste the comment thread in Claims first.</Note>
          )}
        </>
      ) : null}

      <H>Responses</H>
      <Note>
        Your form’s answers land in a Google Sheet in your own account. In Sheets, choose File, Download, then .xlsx or .csv,
        and import it here. Winners are matched by the Facebook name they typed.
      </Note>
      <Button title={busy ? 'Reading the sheet' : imported ? 'Import the sheet again' : 'Import the responses'} disabled={busy} onPress={importSheet} />
      {error ? <Note tone="warn">{error}</Note> : null}

      {imported ? (
        <>
          <Note>
            {match.matched.size} of {rows.length} winners have a form in. {imported.responses.length} {imported.responses.length === 1 ? 'response' : 'responses'} read.
          </Note>
          {match.superseded.length ? (
            <Note>
              {match.superseded.length} earlier {match.superseded.length === 1 ? 'response was' : 'responses were'} replaced by a later one from the same name. The latest counts.
            </Note>
          ) : null}
          {match.otherSale.length ? (
            <Note>{match.otherSale.length} {match.otherSale.length === 1 ? 'response is' : 'responses are'} for a different sale and left out.</Note>
          ) : null}

          {match.unmatched.length ? (
            <View style={{ backgroundColor: colors.warnTint, borderRadius: 10, padding: 12, marginVertical: 12 }}>
              <Text style={{ color: colors.warn, fontWeight: '700', marginBottom: 4 }}>
                {match.unmatched.length === 1 ? 'One response matches no winner.' : `${match.unmatched.length} responses match no winner.`}
              </Text>
              <Text style={{ color: colors.warn, marginBottom: 8 }}>
                Nothing is merged or guessed. If you know who one is, pick the winner yourself. Otherwise, ask the buyer to send the form again with the name on their claim.
              </Text>
              {match.unmatched.map((r) => (
                <View key={r.row} style={{ marginBottom: 10 }}>
                  <Text style={{ color: colors.ink, fontWeight: '600' }}>
                    Row {r.row}: “{r.facebookName || 'no name'}”{r.shipToName ? `, ship to ${r.shipToName}` : ''}
                  </Text>
                  {pairable.length ? (
                    <Row style={{ marginTop: 4 }}>
                      {pairable.map((w) => (
                        <Button key={w.key} kind="secondary" title={`This is ${w.buyer}`} onPress={() => store.linkResponse(sale.id, r.row, w.key)} />
                      ))}
                    </Row>
                  ) : (
                    <Text style={{ color: colors.soft }}>Every winner already has a form in.</Text>
                  )}
                </View>
              ))}
            </View>
          ) : null}
          {Object.keys(imported.links ?? {}).length ? (
            <Button kind="quiet" title="Undo the pairings I made" onPress={() => Object.keys(imported.links ?? {}).forEach((row) => store.linkResponse(sale.id, Number(row), null))} />
          ) : null}
        </>
      ) : null}

      {waitingForForm.length && rows.length ? (
        <>
          <H>No form yet</H>
          {waitingForForm.map((r) => (
            <Text key={r.key} style={{ color: r.contactState === 'late' ? colors.warn : colors.ink, marginBottom: 4 }}>
              {r.buyer}{r.contactState === 'late' ? ', past the deadline' : ''}
            </Text>
          ))}
        </>
      ) : null}

      <Button kind="secondary" title="Back to the rundown" onPress={() => router.back()} style={{ marginTop: 16 }} />
      {rundown.lotsClaimed === 0 ? <Note>{' '}</Note> : null}
    </Screen>
  );
}
