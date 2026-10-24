import { router } from 'expo-router';
import { useState } from 'react';
import { FORMAT_LIST } from '../core/formats';
import { ORIGIN_LINE } from '../core/brand';
import type { FormatId, Profile } from '../core/types';
import { EMPTY_PROFILE, useStore } from '../lib/store';
import { Button, Choice, Field, H, Note, Screen } from '../ui/kit';

const ZONES = ['Eastern', 'Central', 'Mountain', 'Pacific', 'Alaska', 'Hawaii'];

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
        placeholder="USPS Priority, $12 flat, ships Mondays"
        multiline
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
        hint="Goes on every sale announcement. You can change it for any one sale."
      />
      <Choice<FormatId>
        label="Card format you use most"
        value={p.defaultFormat}
        options={FORMAT_LIST.map((f) => ({ value: f.id, label: f.name }))}
        onChange={set('defaultFormat')}
      />
      <H>On every card</H>
      <Note>{ORIGIN_LINE}</Note>
    </Screen>
  );
}
