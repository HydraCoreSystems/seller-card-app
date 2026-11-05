import { Stack, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { WALK_COPY as C } from '../core/guideCopy';
import { FORMAT_LIST } from '../core/formats';
import { announcementFor } from '../core/announce';
import { finishWalk, firstUnfinished, passStep, setDraft, skipWalk, walkSteps, type StepId } from '../core/guide';
import { ROOM_PRESETS } from '../core/venues';
import { applyWalk, chooseRoom, previewSale, walkValues, zoneLabelFor, type WalkValues } from '../core/setupWalk';
import { fillFromZip, type Place } from '../core/zip';
import type { FormatId } from '../core/types';
import { isPhil } from '../core/variant';
import { EMPTY_PROFILE, newId, useStore } from '../lib/store';
import { Button, Choice, Field, H, Note, Panel, Row, Screen, colors } from '../ui/kit';
import { FormSetup } from '../ui/FormSetup';

/**
 * The setup walk. One thing per screen, a sentence of why, Next and Back, and a step count.
 * mode first: the first launch walk, which remembers where the seller got to.
 * mode replay: the same walk for the current room, with its values filled in.
 * mode room: the same walk for a new room, with the seller's name filled in and the room's lines blank.
 */
export default function SetupWalk({ mode, venue }: { mode: 'first' | 'replay' | 'room'; venue?: string }) {
  const store = useStore();
  const rooms = isPhil();
  const steps = walkSteps({ pro: store.pro });
  const counted: StepId[] = steps.filter((s) => s !== 'welcome' && s !== 'done');

  // The room being worked on: the one replayed, the default room when resuming, or none yet for a new room.
  const startVenue = mode === 'replay' ? venue ?? store.profile?.defaultVenueId ?? null : mode === 'first' && rooms ? store.profile?.defaultVenueId ?? null : null;
  const [venueId, setVenueId] = useState<string | null>(startVenue);
  const [values, setValues] = useState<WalkValues>(() => {
    const v = walkValues(store.profile, rooms, mode === 'room' ? '__new__' : startVenue);
    if (mode === 'first' && !store.profile && store.guide.draft) return { ...v, roomName: store.guide.draft.roomName, formatId: store.guide.draft.formatId };
    // A replay in a build with rooms starts from the room being replayed.
    return mode === 'replay' && !rooms ? walkValues(store.profile, false) : v;
  });
  const [step, setStep] = useState<StepId>(() => (mode === 'first' ? firstUnfinished(store.guide, steps) : 'room'));
  const zipFill = useRef<Place | null>(null);
  const finished = useRef(false);
  const set = <K extends keyof WalkValues>(k: K) => (v: WalkValues[K]) => setValues((x) => ({ ...x, [k]: v }));

  const index = steps.indexOf(step);
  const first = mode === 'first';

  // Writes what the seller has typed so far into their profile. Waits for a name, so no half empty profile is ever saved.
  const commit = (next: WalkValues = values): string | null => {
    if (!next.sellerName.trim()) return venueId;
    const base = store.profile ?? EMPTY_PROFILE;
    const zone = zoneLabelFor(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const out = applyWalk(base, next, { rooms, venueId, newId, timeZone: zone });
    store.saveProfile(out.profile);
    if (out.venueId) setVenueId(out.venueId);
    return out.venueId;
  };

  const goTo = (to: StepId) => setStep(to);
  const advance = () => {
    if (first) store.updateGuide((g) => passStep(g, step));
    goTo(steps[index + 1]);
  };

  const onNext = () => {
    if (step === 'room' && first && !store.profile) store.updateGuide((g) => setDraft(g, { roomName: values.roomName, formatId: values.formatId as 'commons' | 'generic' }));
    if (step !== 'room' || store.profile || mode !== 'first') commit();
    advance();
  };

  // The walk ends once, on the last screen.
  useEffect(() => {
    if (step === 'done' && first && !finished.current) {
      finished.current = true;
      store.updateGuide((g) => finishWalk(g, steps));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const profile = store.profile;
  const preview = step === 'done' && profile ? announcementFor(profile, previewSale(profile, venueId, values.formatId), false) : '';

  const pickPreset = (preset: (typeof ROOM_PRESETS)[number]) => {
    const made = chooseRoom(store.profile, { preset }, newId);
    const existing = store.profile?.venues?.find((v) => v.id === made.id);
    if (existing) {
      setVenueId(existing.id);
      setValues(walkValues(store.profile, true, existing.id));
    } else {
      setVenueId(null);
      setValues((x) => ({ ...x, roomName: preset.name, formatId: preset.formatId }));
    }
  };

  const wrap = (title: string, why: string, children: React.ReactNode) => (
    <>
      <Text style={{ color: colors.soft, fontWeight: '600', marginBottom: 6 }}>
        {counted.includes(step) ? C.stepCount(counted.indexOf(step) + 1, counted.length) : ''}
      </Text>
      {/* One gold segment for each step passed or under way, so the walk reads as a path. */}
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 10 }}>
        {counted.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= counted.indexOf(step) ? '#C9A227' : colors.line }} />
        ))}
      </View>
      <H>{title}</H>
      <Note>{why}</Note>
      {children}
    </>
  );

  const nextDisabled =
    (step === 'room' && rooms && !values.roomName.trim()) ||
    (step === 'seller' && !values.sellerName.trim());

  let body: React.ReactNode = null;
  if (step === 'welcome') {
    body = (
      <>
        <H>{C.welcomeTitle}</H>
        <Note>{C.welcome}</Note>
        <Note>{C.welcomeSkipNote}</Note>
      </>
    );
  } else if (step === 'room') {
    body = rooms
      ? wrap(C.roomTitle, C.roomWhy, (
          <>
            <Row style={{ marginBottom: 12 }}>
              {ROOM_PRESETS.map((p) => (
                <Button key={p.key} kind={values.roomName.trim().toLowerCase() === p.name.toLowerCase() ? 'primary' : 'secondary'} title={p.name} onPress={() => pickPreset(p)} style={{ flex: 1 }} />
              ))}
            </Row>
            <Field label={C.roomNameLabel} value={values.roomName} onChangeText={(t) => { setVenueId(null); set('roomName')(t); }} placeholder={C.roomNamePlaceholder} />
            {venueId && mode === 'first' ? <Note>{C.roomExists}</Note> : null}
            <Choice<FormatId>
              label="Card wording"
              value={values.formatId}
              options={FORMAT_LIST.map((f) => ({ value: f.id, label: f.name }))}
              onChange={set('formatId')}
            />
          </>
        ))
      : wrap(C.formatTitle, C.formatWhy, (
          <Choice<FormatId> value={values.formatId} options={FORMAT_LIST.map((f) => ({ value: f.id, label: f.name }))} onChange={set('formatId')} />
        ));
  } else if (step === 'seller') {
    body = wrap(C.sellerTitle, C.sellerWhy, (
      <>
        <Field label={C.sellerNameLabel} value={values.sellerName} onChangeText={set('sellerName')} placeholder={C.sellerNamePlaceholder} autoFocus />
        <Field label={C.numberLabel} value={values.number} onChangeText={set('number')} keyboardType="number-pad" hint={C.numberHint} />
      </>
    ));
  } else if (step === 'location') {
    body = wrap(C.locationTitle, C.locationWhy, (
      <>
        <Field
          label={C.zipLabel}
          value={values.zip}
          keyboardType="number-pad"
          placeholder="46802"
          onChangeText={(zip) => {
            const next = fillFromZip({ zip: values.zip, city: values.city, state: values.state }, zip, zipFill.current);
            zipFill.current = next.fill;
            setValues((x) => ({ ...x, zip, city: next.city, state: next.state }));
          }}
        />
        <Field label={C.cityLabel} value={values.city} onChangeText={set('city')} placeholder="Fort Wayne" />
        <Field label={C.stateLabel} value={values.state} onChangeText={set('state')} placeholder="IN" autoCapitalize="characters" autoCorrect={false} maxLength={2} />
      </>
    ));
  } else if (step === 'lines') {
    body = wrap(C.linesTitle, C.linesWhy, (
      <>
        <Field label={C.shippingLabel} value={values.shipping} onChangeText={set('shipping')} placeholder={C.shippingPlaceholder} multiline />
        <Field label={C.paymentLabel} value={values.payment} onChangeText={set('payment')} placeholder={C.paymentPlaceholder} multiline />
      </>
    ));
  } else if (step === 'form') {
    body = wrap(C.formTitle, C.formWhy, (
      <>
        <FormSetup link={values.formLink} resetKey={venueId ?? 'walk'} onLink={set('formLink')} perRoom={rooms} />
        <Button kind="quiet" title={C.formSkip} onPress={() => { commit({ ...values, formLink: '' }); advance(); }} />
        <Note>{C.formLater}</Note>
      </>
    ));
  } else {
    body = (
      <>
        <H>{C.doneTitle}</H>
        <Note>{C.doneWhy}</Note>
        {preview ? (
          <Panel>
            <Text style={{ fontSize: 12, color: colors.soft, marginBottom: 6 }}>{C.previewLabel}</Text>
            <Text style={{ color: colors.ink }}>{preview}</Text>
          </Panel>
        ) : null}
      </>
    );
  }

  const footer =
    step === 'welcome' ? (
      <View style={{ gap: 8 }}>
        <Button title={C.start} onPress={advance} />
        <Button kind="quiet" title={C.skip} onPress={() => { store.updateGuide(skipWalk); leave(); }} />
      </View>
    ) : step === 'done' ? (
      <View style={{ gap: 8 }}>
        <Button
          title={C.doneStart}
          onPress={() => {
            const ids = store.plants.filter((p) => !p.sold).map((p) => p.id);
            if (ids.length) router.replace({ pathname: '/sale/new', params: { plants: ids.join(',') } });
            else router.replace('/plant/new');
          }}
        />
        <Button kind="secondary" title={C.doneHome} onPress={() => router.replace('/')} />
      </View>
    ) : (
      <Row>
        <Button
          kind="secondary"
          title={C.back}
          disabled={!first && step === 'room'}
          onPress={() => goTo(steps[Math.max(0, index - 1)] === 'welcome' && !first ? 'room' : steps[Math.max(0, index - 1)])}
          style={{ flex: 1 }}
        />
        <Button title={C.next} disabled={nextDisabled} onPress={onNext} style={{ flex: 2 }} />
      </Row>
    );

  return (
    <>
      <Stack.Screen options={{ title: C.title }} />
      <Screen footer={footer} lush>
        {body}
      </Screen>
    </>
  );
}

