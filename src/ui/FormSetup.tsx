import { useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { CHECKOUT_FORM_TEMPLATE_URL } from '../core/brand';
import { FORM_TOKEN, isPlainFormLink, prefilledLink } from '../core/checkout';
import { buildTaggedLink } from '../lib/formPage';
import { Button, Field, Note, colors } from './kit';

/**
 * The standing form, in three one time moves: copy the template, link the copy to Sheets, paste the
 * form link once per room. A plain link gets its sale name tagged link built from the form page.
 */
export function FormSetup({ link: formLink, resetKey, onLink, perRoom = true }: { link: string; resetKey: string; onLink: (link: string) => void; perRoom?: boolean }) {
  const [open, setOpen] = useState(false);
  // What the last automatic build did: the plain link it started from, and the tagged link it made, or null when it couldn't.
  const [tried, setTried] = useState<{ from: string; to: string | null } | null>(null);
  const latestOnLink = useRef(onLink);
  useEffect(() => {
    latestOnLink.current = onLink;
  });
  const link = formLink.trim();
  const check = link ? prefilledLink(link, 'Test sale') : null;
  const plain = isPlainFormLink(link);
  const working = plain && tried?.from !== link;
  const failed = plain && tried?.from === link && tried.to === null;
  const built = !!tried?.to && tried.to === link;

  // A plain form link gets the sale name added by reading the form page, so nobody has to find the pre filled link menus.
  useEffect(() => {
    if (!isPlainFormLink(link)) return;
    let live = true;
    const timer = setTimeout(() => {
      buildTaggedLink(link).then((to) => {
        if (!live) return;
        if (to) latestOnLink.current(to);
        setTried({ from: link, to });
      });
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [link, resetKey]);

  return (
    <View>
      <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 4 }}>Your checkout form</Text>
      <Note>
        One short form for your winners, kept in your own Google account. Set it up in three moves, each done once. After that,
        each sale asks one thing of you: import the form’s sheet into the sale.
      </Note>
      <Button kind="secondary" title={open ? 'Hide the three moves' : 'Show me the three moves'} onPress={() => setOpen(!open)} style={{ marginBottom: 10 }} />
      {open ? (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: '600', color: colors.ink }}>1. Tap the template and make a copy</Text>
          <Button kind="secondary" title="Open the template and make a copy" onPress={() => Linking.openURL(CHECKOUT_FORM_TEMPLATE_URL).catch(() => undefined)} style={{ marginVertical: 6 }} />
          <Note>
            Use the copy as it is, or change anything you like. Keep the Facebook name question, because that is how an answer is matched to its winner.
          </Note>
          <Text style={{ fontWeight: '600', color: colors.ink, marginTop: 8 }}>2. In your copy, link it to Sheets</Text>
          <Note>
            Open Responses and tap Link to Sheets, once. From then on every answer lands in that sheet, in your own Google Drive, on its own.
          </Note>
          <Text style={{ fontWeight: '600', color: colors.ink, marginTop: 8 }}>3. Paste your form link below, once{perRoom ? ' per room' : ''}</Text>
          <Note>
            Tap Send in your form, copy the link, and leave Shorten URL unticked. The app adds the sale name to it for you.
          </Note>
        </View>
      ) : null}
      <Field
        label="Your form link"
        value={formLink}
        onChangeText={onLink}
        placeholder="https://docs.google.com/forms/..."
        autoCapitalize="none"
        autoCorrect={false}
        hint="Each sale swaps its own name into this link, so answers arrive tagged by sale."
      />
      {working ? (
        <Text style={{ color: colors.soft, marginTop: -8, marginBottom: 10 }}>Adding the sale name to your link.</Text>
      ) : failed ? (
        <Text style={{ color: colors.warn, marginTop: -8, marginBottom: 10 }}>
          I couldn’t add the sale name to this link by myself. As a fallback, make it by hand: in your form tap the three dots, choose Get pre filled link,
          type {FORM_TOKEN} in the Sale name box, tap Get link, and paste that link here in its place.
        </Text>
      ) : check ? (
        <Text style={{ color: check.problem ? colors.warn : colors.moss, marginTop: -8, marginBottom: 10 }}>
          {check.problem ?? (built ? 'I added the sale name to your link. Looks good.' : 'This link carries the sale name. Looks good.')}
        </Text>
      ) : null}
    </View>
  );
}
