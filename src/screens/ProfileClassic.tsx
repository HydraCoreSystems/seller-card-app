import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Text } from 'react-native';
import { PRO_PRIVACY } from '../core/pro';
import { CONTACT_HOURS } from '../core/venues';
import { FORMAT_LIST } from '../core/formats';
import { originLine, SUGGESTIONS_URL } from '../core/brand';
import { VERIFIED_GROWER } from '../core/formats/commons';
import { DEFAULT_PAY_WINDOW, PAY_WINDOWS } from '../core/secondChance';
import { SHORT_DAYS } from '../core/text';
import { fillFromZip, type Place } from '../core/zip';
import type { FormatId, Profile } from '../core/types';
import { EMPTY_PROFILE, useStore } from '../lib/store';
import { FormSetup } from '../ui/FormSetup';
import { GuideEntries } from '../ui/GuideEntries';
import { Button, Checkboxes, Choice, Field, H, Note, Panel, Screen, colors } from '../ui/kit';
import { ProExplainer } from '../ui/ProExplainer';

const ZONES = ['Eastern', 'Central', 'Mountain', 'Pacific', 'Alaska', 'Hawaii'];
const DAY_OPTIONS = SHORT_DAYS.map((label, value) => ({ value, label }));

export default function ProfileClassic() {
  const store = useStore();
  const [p, setP] = useState<Profile>(store.profile ?? EMPTY_PROFILE);
  const set = <K extends keyof Profile>(k: K) => (v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  // What the ZIP last filled in, so only the app's own fill is ever replaced, never the seller's words.
  const zipFill = useRef<Place | null>(null);
  const setZip = (zip: string) => {
    const next = fillFromZip({ zip: p.zip ?? '', city: p.city ?? '', state: p.state ?? '' }, zip, zipFill.current);
    zipFill.current = next.fill;
    setP((x) => ({ ...x, zip, city: next.city, state: next.state }));
  };
  const zoneIsListed = ZONES.includes(p.timeZone);
  const ready = p.sellerName.trim().length > 0;

  return (
    <Screen
      footer={
        <Button
          title="Save profile"
          disabled={!ready}
          onPress={() => {
            store.saveProfile({ ...p, sellerName: p.sellerName.trim() });
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
      <Field
        label="Seller number"
        value={p.sellerNumber}
        onChangeText={set('sellerNumber')}
        placeholder="Leave blank if your room doesn't use one"
        keyboardType="number-pad"
      />
      <Field label="ZIP code" value={p.zip ?? ''} onChangeText={setZip} placeholder="46802" keyboardType="number-pad" hint="Type your ZIP first. The city and state fill in. City and ZIP print on your cards as a location line. Leave them blank to print none." />
      <Field label="City" value={p.city ?? ''} onChangeText={set('city')} placeholder="Fort Wayne" hint="Type over it if your cards should show a different city. Yours is what saves and prints." />
      <Field label="State" value={p.state ?? ''} onChangeText={set('state')} placeholder="IN" autoCapitalize="characters" autoCorrect={false} maxLength={2} />
      <Text style={{ fontSize: 12, color: colors.soft, marginTop: -8, marginBottom: 14 }}>
        ZIP lookup data from{' '}
        <Text style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://simplemaps.com/data/us-zips').catch(() => undefined)}>
          SimpleMaps
        </Text>
        , used under CC BY 4.0.
      </Text>
      <Field
        label="Shipping"
        value={p.shipping}
        onChangeText={set('shipping')}
        placeholder="USPS Priority, $12 flat"
        multiline
      />
      <Checkboxes
        label="Ships on"
        value={p.shippingDays}
        options={DAY_OPTIONS}
        onChange={set('shippingDays')}
      />
      <Field
        label="Payment"
        value={p.payment}
        onChangeText={set('payment')}
        placeholder="PayPal Goods and Services, Venmo"
        multiline
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
      <Field
        label="Claim rules"
        value={p.claimRules}
        onChangeText={set('claimRules')}
        placeholder="First clear claim wins. Pay within 24 hours."
        multiline
        hint="Goes on every Grower Showcase announcement. You can change it for any one showcase."
      />
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
      <Choice<FormatId>
        label="Card format you use most"
        value={p.defaultFormat}
        options={FORMAT_LIST.map((f) => ({ value: f.id, label: f.name }))}
        onChange={set('defaultFormat')}
      />
      {p.defaultFormat === 'commons' ? (
        <>
          <Field
            label={`${VERIFIED_GROWER} No.`}
            value={p.growerNumber ?? ''}
            onChangeText={set('growerNumber')}
            placeholder="Leave blank until the desk issues one"
            keyboardType="number-pad"
            hint="Type it the way the desk issued it, like 001. With it, your Commons card image carries the banner, and your photo copies carry the seal with this number in the stamp in place of your seller number. The desk checks every number against the register before a listing runs."
          />
          <Field
            label="Vetted business name"
            value={p.growerBusiness ?? ''}
            onChangeText={set('growerBusiness')}
            placeholder="also DBA Fern Hollow Plants"
            hint="Only the business name the desk vetted. Leave blank if you have none."
          />
        </>
      ) : null}
      <H>Checkout</H>
      {store.pro ? (
        <Panel>
          <Choice
            label="Buyers get in touch within"
            value={String(p.contactHours ?? 24)}
            options={CONTACT_HOURS.map((h) => ({ value: String(h), label: `${h} hours` }))}
            onChange={(v) => set('contactHours')(Number(v))}
          />
          <Note>This prints in your announcement as a real clock time, counted from when the sale ends. You can change it for any one sale.</Note>
          <Field
            label="Default box weight, in ounces"
            value={p.weightOz == null ? '' : String(p.weightOz)}
            onChangeText={(t) => set('weightOz')(/^\d+(\.\d+)?$/.test(t.trim()) ? Number(t.trim()) : null)}
            placeholder="12"
            keyboardType="decimal-pad"
            hint="Goes in your label file for any box you don't give its own weight."
          />
          <FormSetup link={p.formLink ?? ''} resetKey="profile" perRoom={false} onLink={set('formLink')} />
          <Note>{PRO_PRIVACY}</Note>
        </Panel>
      ) : (
        <ProExplainer />
      )}

      <GuideEntries
        onWalk={() => {
          // The walk writes to the saved profile, so what is typed here is saved first.
          if (ready) store.saveProfile({ ...p, sellerName: p.sellerName.trim() });
          router.replace({ pathname: '/setup', params: { mode: 'replay' } });
        }}
      />

      <H>Backup</H>
      <Note>Keep a copy of everything in your own Google Drive.</Note>
      <Button kind="secondary" title="Backup to Google Drive" onPress={() => router.push('/backup')} />

      <H>On every card</H>
      <Note>{originLine()}</Note>
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
