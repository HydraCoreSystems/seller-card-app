import { router } from 'expo-router';
import { useState } from 'react';
import { FORMAT_LIST } from '../core/formats';
import { ORIGIN_LINE } from '../core/brand';
import { VERIFIED_GROWER } from '../core/formats/commons';
import { DEFAULT_PAY_WINDOW, PAY_WINDOWS } from '../core/secondChance';
import { SHORT_DAYS } from '../core/text';
import type { FormatId, Profile } from '../core/types';
import { EMPTY_PROFILE, useStore } from '../lib/store';
import { Button, Checkboxes, Choice, Field, H, Note, Screen } from '../ui/kit';

const ZONES = ['Eastern', 'Central', 'Mountain', 'Pacific', 'Alaska', 'Hawaii'];
const DAY_OPTIONS = SHORT_DAYS.map((label, value) => ({ value, label }));

export default function ProfileScreen() {
  const store = useStore();
  const [p, setP] = useState<Profile>(store.profile ?? EMPTY_PROFILE);
  const set = <K extends keyof Profile>(k: K) => (v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
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
            hint="Type it the way the desk issued it, like 001. With it, your Commons card image carries the banner and your photo copies carry the seal. The desk checks every number against the register before a listing runs."
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
      <H>On every card</H>
      <Note>{ORIGIN_LINE}</Note>
    </Screen>
  );
}
