import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { PRIVACY_URL } from '../core/brand';
import {
  PAYWALL_TITLE,
  PRO_ANNUAL,
  SUBSCRIPTION_TERMS,
  TERMS_URL,
  planLine,
  trialBadge,
  trialLength,
} from '../core/entitlement';
import { PRO_POINTS, PRO_PRIVACY, PRO_TITLE } from '../core/pro';
import { buy, iapAvailable, loadPlans, manage, restore, type Plans } from '../lib/iap';
import { useStore } from '../lib/store';
import { Button, H, Note, Panel, Screen, colors } from '../ui/kit';

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; plans: Plans };

/** Where a locked checkout feature sends the seller: what Pro is, what it costs, and how to start or get back what they bought. */
export default function Paywall() {
  const store = useStore();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const available = iapAvailable();

  useEffect(() => {
    if (!available) return;
    let live = true;
    loadPlans()
      .then((plans) => live && setLoad({ state: plans.products.length ? 'ready' : 'failed', plans } as Load))
      .catch(() => live && setLoad({ state: 'failed' }));
    return () => {
      live = false;
    };
  }, [available]);

  const start = async (sku: string) => {
    setBusy(sku);
    setMessage(null);
    try {
      await buy(sku);
    } catch {
      setMessage('The purchase did not go through. You were not charged.');
    } finally {
      setBusy(null);
    }
  };

  const bring = async () => {
    setBusy('restore');
    setMessage(null);
    try {
      const on = await restore();
      setMessage(on ? 'Pro is back on.' : 'No Pro subscription was found on this Apple Account.');
    } catch {
      setMessage('Could not reach the App Store. Try again in a moment.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen footer={<Button kind={store.pro ? 'primary' : 'secondary'} title={store.pro ? 'Done' : 'Not now'} onPress={() => router.back()} />}>
      <H>{PAYWALL_TITLE}</H>
      <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16, marginBottom: 6 }}>{PRO_TITLE}</Text>
      {PRO_POINTS.map((p) => (
        <Text key={p} style={{ color: colors.ink, marginBottom: 4 }}>
          {'•'} {p}
        </Text>
      ))}
      <Text style={{ color: colors.mossDark, fontWeight: '600', marginVertical: 8 }}>{PRO_PRIVACY}</Text>
      <Note>Everything else in Skrybix stays free: your plants, cards, announcements, claims and sales record.</Note>

      {store.pro ? (
        <Panel>
          <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>Pro is on.</Text>
          <Text style={{ color: colors.soft, marginBottom: 8 }}>Thank you. The checkout tools are unlocked.</Text>
          {available ? <Button kind="secondary" title="Manage subscription" onPress={() => manage().catch(() => undefined)} /> : null}
        </Panel>
      ) : !available ? (
        <Note>Pro subscriptions are sold in the iPhone and iPad app. They are not available in this version yet.</Note>
      ) : load.state === 'loading' ? (
        <Note>Getting the plans from the App Store.</Note>
      ) : load.state === 'failed' ? (
        <Note tone="warn">The plans could not be loaded from the App Store. Check your connection and open this screen again.</Note>
      ) : (
        load.plans.products.map((p) => {
          const annual = p.id === PRO_ANNUAL;
          const trial = trialLength(p, load.plans.eligible) !== null;
          return (
            <Panel key={p.id}>
              <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>
                {annual ? 'Annual' : 'Monthly'}
                {trialBadge(p, load.plans.eligible) ? `, ${trialBadge(p, load.plans.eligible)}` : ''}
              </Text>
              <Text style={{ color: colors.soft, marginBottom: 8 }}>{planLine(p, load.plans.eligible)}</Text>
              <Button
                title={busy === p.id ? 'Working' : trial ? 'Start the free trial' : 'Subscribe'}
                disabled={busy !== null}
                onPress={() => start(p.id)}
              />
            </Panel>
          );
        })
      )}

      {message ? <Note>{message}</Note> : null}
      {available && !store.pro ? (
        <Button kind="quiet" title={busy === 'restore' ? 'Checking' : 'Restore purchases'} disabled={busy !== null} onPress={bring} />
      ) : null}

      {available ? (
        <View style={{ marginTop: 10 }}>
          {SUBSCRIPTION_TERMS.map((t) => (
            <Text key={t} style={{ color: colors.soft, fontSize: 12, marginBottom: 4 }}>
              {t}
            </Text>
          ))}
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
            <Button kind="quiet" title="Terms of Use" onPress={() => Linking.openURL(TERMS_URL).catch(() => undefined)} />
            {PRIVACY_URL ? <Button kind="quiet" title="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => undefined)} /> : null}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
