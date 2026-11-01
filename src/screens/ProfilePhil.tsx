import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { CHECKOUT_FORM_TEMPLATE_URL, ORIGIN_LINE, SUGGESTIONS_URL } from '../core/brand';
import { formFields, prefilledLink, FORM_TOKEN } from '../core/checkout';
import { FORMAT_LIST } from '../core/formats';
import { VERIFIED_GROWER } from '../core/formats/commons';
import { PRO_PRIVACY, PRO_TEST_NOTE } from '../core/pro';
import { DEFAULT_PAY_WINDOW, PAY_WINDOWS } from '../core/secondChance';
import { SHORT_DAYS } from '../core/text';
import type { FormatId, Profile, Venue } from '../core/types';
import { CONTACT_HOURS, defaultVenue, emptyVenue, venuesOf, withVenues } from '../core/venues';
import { EMPTY_PROFILE, newId, useStore } from '../lib/store';
import { Button, Checkboxes, Choice, Field, H, Note, Panel, Row, Screen, colors, useCopy } from '../ui/kit';
import { ProExplainer } from '../ui/ProExplainer';

const ZONES = ['Eastern', 'Central', 'Mountain', 'Pacific', 'Alaska', 'Hawaii'];
const DAY_OPTIONS = SHORT_DAYS.map((label, value) => ({ value, label }));

export default function ProfilePhil() {
  const store = useStore();
  const start = store.profile ?? EMPTY_PROFILE;
  const [p, setP] = useState<Profile>(start);
  const [venues, setVenues] = useState<Venue[]>(() => venuesOf(start).map((v, i) => (v.name ? v : { ...v, name: i === 0 ? 'My main room' : '' })));
  const [defaultId, setDefaultId] = useState(() => defaultVenue(start).id);
  const [editingId, setEditingId] = useState(defaultId);
  const set = <K extends keyof Profile>(k: K) => (v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  const zoneIsListed = ZONES.includes(p.timeZone);
  const ready = p.sellerName.trim().length > 0;
  const room = venues.find((v) => v.id === editingId) ?? venues[0];
  const setRoom = <K extends keyof Venue>(k: K) => (v: Venue[K]) => setVenues((all) => all.map((x) => (x.id === room.id ? { ...x, [k]: v } : x)));

  const addRoom = () => {
    const id = newId();
    setVenues((all) => [...all, emptyVenue(id, '')]);
    setEditingId(id);
  };
  const removeRoom = () => {
    const rest = venues.filter((v) => v.id !== room.id);
    setVenues(rest);
    if (defaultId === room.id) setDefaultId(rest[0].id);
    setEditingId(rest[0].id);
  };

  return (
    <Screen
      footer={
        <Button
          title="Save profile"
          disabled={!ready}
          onPress={() => {
            // A room with no name yet is called what it says it is, so it never shows up blank.
            const named = venues.map((v, i) => ({ ...v, name: v.name.trim() || `Room ${i + 1}`, contactHours: v.contactHours || 24 }));
            store.saveProfile(withVenues({ ...p, sellerName: p.sellerName.trim() }, named, defaultId));
            router.back();
          }}
        />
      }
    >
      <Note>You only do this once. Every card pulls these lines in for you.</Note>
      <Field label="Seller name" value={p.sellerName} onChangeText={set('sellerName')} placeholder="Your name or shop name" />
      <Field
        label="Your name on Facebook"
        value={p.facebookName ?? ''}
        onChangeText={set('facebookName')}
        placeholder={p.sellerName || 'As it shows on your comments'}
        hint="Leave blank if it's the same as your seller name. The claim tracker uses it to spot your lot comments."
      />
      <Choice
        label="Your time zone"
        value={zoneIsListed ? p.timeZone : 'other'}
        options={[...ZONES.map((z) => ({ value: z, label: z })), { value: 'other', label: 'Other' }]}
        onChange={(v) => set('timeZone')(v === 'other' ? '' : v)}
      />
      {!zoneIsListed ? (
        <Field label="Time zone as it should read on cards" value={p.timeZone} onChangeText={set('timeZone')} placeholder="UK time" />
      ) : null}
      <Choice
        label="Winners pay within"
        value={String(p.payWindowHours ?? DEFAULT_PAY_WINDOW)}
        options={PAY_WINDOWS.map((h) => ({ value: String(h), label: `${h} hours` }))}
        onChange={(v) => set('payWindowHours')(Number(v))}
      />
      <Note>
        After that, a lot nobody paid for can go to the next in line at the same price. The next buyer gets the
        same time to answer.
      </Note>

      <H>Your rooms</H>
      <Note>
        One profile for each room you sell in. A sale picks a room, and its cards, stamped photos and announcement
        use that room’s lines.
      </Note>
      <Choice
        value={room.id}
        options={venues.map((v, i) => ({ value: v.id, label: (v.name.trim() || `Room ${i + 1}`) + (v.id === defaultId ? ' (main)' : '') }))}
        onChange={setEditingId}
      />
      <Panel>
        <Field label="Room name" value={room.name} onChangeText={setRoom('name')} placeholder="The group’s name, the way you’d say it" hint="Type whatever the room is called today. It prints on your stamped photo circle." />
        <Choice<FormatId>
          label="Card wording"
          value={room.formatId}
          options={FORMAT_LIST.map((f) => ({ value: f.id, label: f.name }))}
          onChange={setRoom('formatId')}
        />
        <Field
          label={room.formatId === 'commons' ? `${VERIFIED_GROWER} No.` : 'Grower or seller number'}
          value={room.number}
          onChangeText={setRoom('number')}
          placeholder="Leave blank if this room doesn't issue one"
          keyboardType="number-pad"
          hint={
            room.formatId === 'commons'
              ? 'Type it the way the desk issued it, like 001. With it, your photo copies carry the seal and this number in the stamp. The desk checks every number against the register before a listing runs.'
              : 'With a number, your photo copies carry a circle with the room name and this number. With none, the stamp carries the room name and no circle.'
          }
        />
        {room.formatId === 'commons' ? (
          <Field
            label="Vetted business name"
            value={room.business}
            onChangeText={setRoom('business')}
            placeholder="also DBA Fern Hollow Plants"
            hint="Only the business name the desk vetted. Leave blank if you have none."
          />
        ) : null}
        <Field label="City" value={room.city} onChangeText={setRoom('city')} placeholder="Fort Wayne" hint="City and ZIP print on your cards as a location line. Leave both blank to print none." />
        <Field label="ZIP code" value={room.zip} onChangeText={setRoom('zip')} placeholder="46802" keyboardType="number-pad" />
        <Field label="Shipping" value={room.shipping} onChangeText={setRoom('shipping')} placeholder="USPS Priority, $12 flat" multiline />
        <Checkboxes label="Ships on" value={room.shippingDays} options={DAY_OPTIONS} onChange={setRoom('shippingDays')} />
        <Field label="Payment" value={room.payment} onChangeText={setRoom('payment')} placeholder="PayPal Goods and Services, Venmo" multiline />
        <Field
          label="Claim rules"
          value={room.claimRules}
          onChangeText={setRoom('claimRules')}
          placeholder="First clear claim wins. Pay within 24 hours."
          multiline
          hint="Goes on every Grower Showcase announcement in this room. You can change it for any one showcase."
        />
        <Row>
          {room.id !== defaultId ? <Button kind="secondary" title="Make this my main room" onPress={() => setDefaultId(room.id)} /> : null}
          {venues.length > 1 ? <Button kind="danger" title="Remove this room" onPress={removeRoom} /> : null}
        </Row>
      </Panel>
      <Button kind="secondary" title="Add a room" onPress={addRoom} style={{ marginBottom: 6 }} />

      <H>Checkout for {room.name.trim() || 'this room'}</H>
      {store.pro ? (
        <Panel>
          <Choice
            label="Buyers get in touch within"
            value={String(room.contactHours)}
            options={CONTACT_HOURS.map((h) => ({ value: String(h), label: `${h} hours` }))}
            onChange={(v) => setRoom('contactHours')(Number(v))}
          />
          <Note>This prints in your announcement as a real clock time, counted from when the sale ends. You can change it for any one sale.</Note>
          <Field
            label="Default box weight, in ounces"
            value={room.weightOz === null ? '' : String(room.weightOz)}
            onChangeText={(t) => setRoom('weightOz')(/^\d+(\.\d+)?$/.test(t.trim()) ? Number(t.trim()) : null)}
            placeholder="12"
            keyboardType="decimal-pad"
            hint="Goes in your label file for any box you don't give its own weight."
          />
          <FormSetup room={room} onLink={setRoom('formLink')} />
          <Note>{PRO_PRIVACY}</Note>
        </Panel>
      ) : (
        <ProExplainer />
      )}
      {store.pro ? <Note>{PRO_TEST_NOTE}</Note> : null}

      <H>On every card</H>
      <Note>{ORIGIN_LINE}</Note>
      <H>Try it out</H>
      {store.sample ? (
        <Button kind="secondary" title="Leave the sample showcase" onPress={() => { store.leaveSample(); router.back(); }} />
      ) : (
        <>
          <Note>
            A finished sample showcase with a made up seller and buyers: claims, a rundown, one lot paid, one
            waiting and two leftovers. Your own plants and records wait safely aside until you leave it.
          </Note>
          <Button kind="secondary" title="Open a sample showcase" onPress={() => { store.openSample(); router.back(); }} />
        </>
      )}
      <H>Got an idea?</H>
      <Note>
        Tell us what would make sale night easier. We read every suggestion each week, and if you leave your name,
        we’ll tell you when yours ships.
      </Note>
      <Button kind="secondary" title="Suggest a feature" onPress={() => Linking.openURL(SUGGESTIONS_URL).catch(() => undefined)} />
    </Screen>
  );
}

/** Walks the seller through the standing form: make a copy, make the pre-filled link, paste it once. */
function FormSetup({ room, onLink }: { room: Venue; onLink: (link: string) => void }) {
  const [copied, copy] = useCopy();
  const [open, setOpen] = useState(false);
  const fields = formFields({ payment: room.payment });
  const spec = fields.map((f, i) => `${i + 1}. ${f.label}. ${f.setup}`).join('\n');
  const check = room.formLink.trim() ? prefilledLink(room.formLink, 'Test sale') : null;
  return (
    <View>
      <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 4 }}>Your checkout form</Text>
      <Note>
        One short form for your winners, kept in your own Google account. You make it once and paste its link here.
      </Note>
      <Button kind="secondary" title={open ? 'Hide the steps' : 'Show me the steps'} onPress={() => setOpen(!open)} style={{ marginBottom: 10 }} />
      {open ? (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: '600', color: colors.ink }}>1. Make your own copy of the form</Text>
          {CHECKOUT_FORM_TEMPLATE_URL ? (
            <Button kind="secondary" title="Open the template and make a copy" onPress={() => Linking.openURL(CHECKOUT_FORM_TEMPLATE_URL).catch(() => undefined)} style={{ marginVertical: 6 }} />
          ) : (
            <>
              <Note>In Google Forms, start a blank form and add these questions in this order. Tap Copy to paste the list somewhere you can read it while you build.</Note>
              {fields.map((f, i) => (
                <Text key={f.label} style={{ color: colors.ink, marginBottom: 2 }}>
                  {i + 1}. {f.label}. <Text style={{ color: colors.soft }}>{f.setup}</Text>
                </Text>
              ))}
              <Button kind="quiet" title={copied === 'spec' ? '✓ Copied' : 'Copy the question list'} onPress={() => copy('spec', spec)} />
            </>
          )}
          <Text style={{ fontWeight: '600', color: colors.ink, marginTop: 8 }}>2. Make the pre-filled link</Text>
          <Note>
            In your form, tap the three dots, then Get pre-filled link. Type {FORM_TOKEN} in the Sale name box, tap Get link, and copy it.
          </Note>
          <Text style={{ fontWeight: '600', color: colors.ink }}>3. Paste it below, once</Text>
        </View>
      ) : null}
      <Field
        label="Your pre-filled form link"
        value={room.formLink}
        onChangeText={onLink}
        placeholder="https://docs.google.com/forms/..."
        autoCapitalize="none"
        autoCorrect={false}
        hint="Each sale swaps the sale name into this link, so responses arrive tagged by sale."
      />
      {check ? (
        <Text style={{ color: check.problem ? colors.warn : colors.moss, marginTop: -8, marginBottom: 10 }}>
          {check.problem ?? 'This link carries the sale name. Looks good.'}
        </Text>
      ) : null}
    </View>
  );
}
