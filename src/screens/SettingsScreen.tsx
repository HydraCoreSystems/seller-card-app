import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform, Text, View } from 'react-native';
import type { BackupData } from '../core/backup';
import { PRIVACY_URL, SKRYBIX_GUIDE_URL, originLine } from '../core/brand';
import { EXPORT_FILE_NAME, exportText } from '../core/dataTools';
import { TERMS_URL } from '../core/entitlement';
import { STAMP_TEXT_LIMIT, type CardDefaults, type StampPosition, type StampStrength, BAND_ALPHA } from '../core/settings';
import { SETTINGS_COPY as C } from '../core/settingsCopy';
import { stampText } from '../core/stamp';
import { toDay } from '../core/text';
import { defaultVenue, venuesOf, withVenues } from '../core/venues';
import { META_COPY } from '../core/metaDemoCopy';
import { isPhil } from '../core/variant';
import { useBackup } from '../lib/backupContext';
import { pickDataText } from '../lib/dataFile';
import { restoreFromFileText } from '../lib/driveBackup';
import { shareTextFile } from '../lib/exportFile';
import { useStore } from '../lib/store';
import { Reveal } from '../ui/botanical';
import { FormSetup } from '../ui/FormSetup';
import { Button, Choice, Field, H, Note, Panel, Row, Screen, colors } from '../ui/kit';

/** A text field that saves what is typed when the seller leaves it, and when the screen closes. */
function SaveField({ label, value, onSave, ...rest }: { label: string; value: string; onSave: (v: string) => void; hint?: string; placeholder?: string; multiline?: boolean; maxLength?: number }) {
  const [text, setText] = useState(value);
  const latest = useRef({ text, value, onSave });
  useEffect(() => {
    latest.current = { text, value, onSave };
  });
  // A change made elsewhere, like switching rooms, replaces what is shown.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }
  useEffect(
    () => () => {
      const l = latest.current;
      if (l.text !== l.value) l.onSave(l.text);
    },
    [],
  );
  return <Field label={label} value={text} onChangeText={setText} onBlur={() => text !== value && onSave(text)} {...rest} />;
}

const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null);

export default function SettingsScreen() {
  const store = useStore();
  const backup = useBackup();
  const { profile, settings, updateSettings } = store;
  const rooms = isPhil();
  const room = profile ? (rooms ? defaultVenue(profile) : null) : null;
  const working = backup.status === 'working';
  const [note, setNote] = useState<string | null>(null);

  const setStamp = (patch: Partial<typeof settings.stamp>) => updateSettings((s) => ({ ...s, stamp: { ...s.stamp, ...patch } }));
  const setCard = (patch: Partial<CardDefaults>) => updateSettings((s) => ({ ...s, card: { ...s.card, ...patch } }));

  // Seller defaults live in the profile, in the room new sales start in, so a new sale and every card read the same lines.
  const saveLine = (key: 'shipping' | 'payment' | 'formLink', value: string) => {
    if (!profile) return;
    if (room) {
      const list = venuesOf(profile).map((v) => (v.id === room.id ? { ...v, [key]: value } : v));
      store.saveProfile(withVenues(profile, list, room.id));
    } else store.saveProfile({ ...profile, [key]: value });
  };
  const chooseRoom = (id: string) => profile && store.saveProfile(withVenues(profile, venuesOf(profile), id));
  const lineOf = (key: 'shipping' | 'payment' | 'formLink') => (room ? room[key] : profile?.[key] ?? '');

  const data: BackupData = {
    profile: store.profile, plants: store.plants, sales: store.sales, records: store.records,
    buyerNotes: store.buyerNotes, leftoversDone: store.leftoversDone, templates: store.templates,
  };
  const doExport = () => shareTextFile(EXPORT_FILE_NAME, exportText(data, { now: Date.now(), pro: store.pro }), 'application/json').catch(() => setNote('The file could not be made.'));
  const doRestore = async () => {
    const text = await pickDataText().catch(() => null);
    if (!text) return;
    const out = restoreFromFileText(text);
    if (!out.ok) return setNote(out.error);
    const empty = !out.data.profile && !out.data.plants.length && !out.data.sales.length;
    if (empty) return setNote(C.restoreNothing);
    const go = () => {
      store.restoreData(out.data);
      setNote(C.restored + (out.missingPhotos ? ` ${C.restoredMissing(out.missingPhotos)}` : ''));
    };
    if (Platform.OS === 'web') go();
    else Alert.alert(C.restoreButton, C.restoreAsk, [{ text: C.restoreCancel, style: 'cancel' }, { text: C.restoreConfirm, style: 'destructive', onPress: go }]);
  };

  const s = settings.stamp;
  const sample = stampText(profile?.sellerName || 'Your name', '', toDay(new Date()), null, room?.name ?? '').main;

  return (
    <Screen footer={<Button kind="secondary" title="Done" onPress={() => router.back()} />} lush>
      <Reveal>
        <Note>{C.intro}</Note>
      </Reveal>

      <H>{C.defaultsTitle}</H>
      {!profile ? (
        <Panel>
          <Note>Set up your profile and these lines fill in here.</Note>
          <Button title="Set up your profile" onPress={() => router.push('/setup')} />
        </Panel>
      ) : (
        <Panel>
          <Note>{C.defaultsNote}</Note>
          {rooms && venuesOf(profile).length > 1 ? (
            <Choice label={C.roomLabel} value={defaultVenue(profile).id} options={venuesOf(profile).map((v, i) => ({ value: v.id, label: v.name.trim() || `Room ${i + 1}` }))} onChange={chooseRoom} />
          ) : null}
          <SaveField label={C.shippingLabel} value={lineOf('shipping')} onSave={(v) => saveLine('shipping', v)} placeholder={C.shippingPlaceholder} multiline />
          <SaveField label={C.paymentLabel} value={lineOf('payment')} onSave={(v) => saveLine('payment', v)} placeholder={C.paymentPlaceholder} multiline />
          <Note>{C.moreInProfile}</Note>
          <Button kind="secondary" title={C.openProfile} onPress={() => router.push('/profile')} />
        </Panel>
      )}

      <H>{C.stampTitle}</H>
      <Panel>
        <Note>{C.stampNote}</Note>
        <Choice<'on' | 'off'> value={s.on ? 'on' : 'off'} options={[{ value: 'on', label: C.stampOn }, { value: 'off', label: C.stampOff }]} onChange={(v) => setStamp({ on: v === 'on' })} />
        {s.on ? (
          <>
            <SaveField label={C.stampTextLabel} value={s.text} onSave={(v) => setStamp({ text: v.slice(0, STAMP_TEXT_LIMIT) })} hint={C.stampTextHint} placeholder={C.stampTextPlaceholder} maxLength={STAMP_TEXT_LIMIT} />
            <Choice<StampPosition> label={C.positionLabel} value={s.position} options={[{ value: 'bottom', label: C.positionBottom }, { value: 'top', label: C.positionTop }]} onChange={(v) => setStamp({ position: v })} />
            <Choice<StampStrength> label={C.strengthLabel} value={s.strength} options={[{ value: 'light', label: C.strengthLight }, { value: 'medium', label: C.strengthMedium }, { value: 'strong', label: C.strengthStrong }]} onChange={(v) => setStamp({ strength: v })} />
            <Text style={{ fontSize: 12, color: colors.soft, marginBottom: 6 }}>{C.previewLabel}</Text>
            <View style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 14, overflow: 'hidden', backgroundColor: '#7FA37A' }}>
              <View style={{ position: 'absolute', left: '22%', top: '18%', width: '56%', height: '60%', borderRadius: 60, backgroundColor: '#3E6B3A', transform: [{ rotate: '24deg' }] }} />
              <View style={{ position: 'absolute', left: 0, right: 0, [s.position === 'top' ? 'top' : 'bottom']: 0, backgroundColor: `rgba(0,0,0,${BAND_ALPHA[s.strength]})`, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }} numberOfLines={1}>{s.text.trim() || sample}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 9 }}>{originLine()}</Text>
              </View>
            </View>
          </>
        ) : (
          <Note>{C.stampOffNote}</Note>
        )}
      </Panel>

      <H>{C.cardTitle}</H>
      <Panel>
        <Note>{C.cardNote}</Note>
        <Choice<CardDefaults['kind']> label={C.kindLabel} value={settings.card.kind} options={[{ value: 'auto', label: C.kindAuto }, { value: 'sale', label: C.kindSale }, { value: 'auction', label: C.kindAuction }]} onChange={(v) => setCard({ kind: v })} />
        {rooms ? <SaveField label={C.noteLabel} value={settings.card.note} onSave={(v) => setCard({ note: v })} placeholder={C.notePlaceholder} multiline /> : null}
        <SaveField label={C.crossLabel} value={settings.card.crossListing} onSave={(v) => setCard({ crossListing: v })} placeholder={C.crossPlaceholder} />
      </Panel>

      {store.pro && profile ? (
        <>
          <H>{C.formTitle}</H>
          <Panel>
            <Note>{C.formNote}</Note>
            <FormSetup link={lineOf('formLink')} resetKey={room?.id ?? 'profile'} onLink={(v) => saveLine('formLink', v)} perRoom={rooms} />
          </Panel>
        </>
      ) : null}

      <H>{C.backupTitle}</H>
      <Panel>
        {!store.pro ? (
          <>
            <Note>{C.backupProNote}</Note>
            <Button title="See Skrybix Pro" onPress={() => router.push('/paywall')} />
          </>
        ) : !backup.available ? (
          <Note>{C.backupNotHere}</Note>
        ) : backup.email ? (
          <>
            <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>{C.backupOn}</Text>
            <Text style={{ color: colors.soft }}>{C.backupAccount}: {backup.email}</Text>
            <Text style={{ color: colors.ink, marginBottom: 10 }}>{working ? 'Backing up now.' : backup.lastAt ? `${C.backupLast}: ${when(backup.lastAt)}` : C.backupNever}</Text>
            <Row>
              <Button title={working ? 'Working' : C.backupNow} disabled={working || store.sample || !!backup.conflict} onPress={() => backup.backUpNow()} style={{ flex: 1 }} />
              <Button kind="secondary" title={C.backupTurnOff} disabled={working} onPress={() => backup.disconnect()} style={{ flex: 1 }} />
            </Row>
            {store.sample ? <Note>{C.backupSample}</Note> : null}
            <Button kind="quiet" title={C.backupMore} onPress={() => router.push('/backup')} />
          </>
        ) : (
          <>
            <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>{C.backupOff}</Text>
            <Note>{C.backupOffNote}</Note>
            <Button title={working ? 'Working' : C.backupTurnOn} disabled={working} onPress={() => backup.connect()} />
          </>
        )}
      </Panel>

      {isPhil() ? (
        <>
          <H>{META_COPY.settingsTitle}</H>
          <Panel>
            <Note>{META_COPY.settingsNote}</Note>
            <Button title={META_COPY.settingsOpen} onPress={() => router.push('/meta')} />
          </Panel>
        </>
      ) : null}

      <H>{C.dataTitle}</H>
      <Panel>
        <Note>{C.dataNote}</Note>
        <Row>
          <Button title={C.exportButton} onPress={doExport} style={{ flex: 1 }} />
          <Button kind="secondary" title={C.restoreButton} disabled={store.sample} onPress={doRestore} style={{ flex: 1 }} />
        </Row>
        {store.sample ? <Note>{C.restoreSample}</Note> : null}
        {note ? <Note>{note}</Note> : null}
      </Panel>

      <H>{C.infoTitle}</H>
      <Panel>
        <Text style={{ color: colors.ink, marginBottom: 8 }}>{C.version} {Constants.expoConfig?.version ?? ''}</Text>
        {SKRYBIX_GUIDE_URL ? <Button kind="quiet" title={C.guide} onPress={() => Linking.openURL(SKRYBIX_GUIDE_URL).catch(() => undefined)} /> : null}
        {PRIVACY_URL ? <Button kind="quiet" title={C.privacy} onPress={() => Linking.openURL(PRIVACY_URL).catch(() => undefined)} /> : null}
        <Button kind="quiet" title={C.terms} onPress={() => Linking.openURL(TERMS_URL).catch(() => undefined)} />
      </Panel>
    </Screen>
  );
}

