import { router } from 'expo-router';
import { Text } from 'react-native';
import { summary } from '../core/backup';
import {
  BACKUP_ASK,
  BACKUP_INTRO,
  BACKUP_NOT_HERE,
  BACKUP_PRIVACY,
  BACKUP_SAMPLE,
  BACKUP_TITLE,
} from '../core/backupCopy';
import { useBackup } from '../lib/backupContext';
import { useStore } from '../lib/store';
import { Button, H, Note, Panel, Screen, colors } from '../ui/kit';

const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null);
const whenIso = (iso: string) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'earlier');

/** Connect Google once, then the backup runs itself. This is also where a new phone gets everything back. */
export default function BackupScreen() {
  const store = useStore();
  const b = useBackup();
  const working = b.status === 'working';

  return (
    <Screen footer={<Button kind="secondary" title="Done" onPress={() => router.back()} />}>
      <H>{BACKUP_TITLE}</H>
      {!store.pro ? (
        <Panel>
          <Note>{BACKUP_INTRO}</Note>
          <Note>Automatic backup is part of Skrybix Pro.</Note>
          <Button title="See Skrybix Pro" onPress={() => router.push('/paywall')} />
        </Panel>
      ) : !b.available ? (
        <Note>{BACKUP_NOT_HERE}</Note>
      ) : !b.email ? (
        <>
          <Note>{BACKUP_INTRO}</Note>
          <Note>{BACKUP_PRIVACY}</Note>
          <Button title={working ? 'Working' : 'Connect Google Drive'} disabled={working} onPress={() => b.connect()} />
        </>
      ) : (
        <>
          <Panel>
            <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>Connected</Text>
            <Text style={{ color: colors.soft, marginBottom: 8 }}>{b.email}</Text>
            <Text style={{ color: colors.ink, marginBottom: 8 }}>
              {working ? 'Backing up now.' : b.lastAt ? `Last backup ${when(b.lastAt)}.` : 'No backup from this phone yet.'}
            </Text>
            <Button title={working ? 'Working' : 'Back up now'} disabled={working || store.sample || !!b.conflict} onPress={() => b.backUpNow()} />
            {store.sample ? <Note>{BACKUP_SAMPLE}</Note> : null}
          </Panel>

          {b.conflict ? (
            <Panel>
              <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>Two copies</Text>
              <Note>{BACKUP_ASK}</Note>
              <Text style={{ color: colors.ink, marginBottom: 8 }}>
                The Drive copy was saved {whenIso(b.conflict.savedAt)} from {b.conflict.savedBy === 'computer' ? 'your computer' : 'a phone'}.
              </Text>
              <Button title="Use the Drive copy" disabled={working} onPress={() => b.useDriveCopy()} />
              <Button kind="secondary" title="Keep this phone" disabled={working} onPress={() => b.keepThisPhone()} />
            </Panel>
          ) : null}

          {b.offer ? (
            <Panel>
              <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 16 }}>Your backup is here</Text>
              <Text style={{ color: colors.ink, marginBottom: 8 }}>
                {summary(b.offer.backup)}, saved {whenIso(b.offer.backup.savedAt)}.
              </Text>
              <Button title="Bring it all back" disabled={working} onPress={() => b.useDriveCopy()} />
            </Panel>
          ) : (
            <Button kind="quiet" title="Look for a backup on this Drive" disabled={working} onPress={() => b.look()} />
          )}

          <Note>{BACKUP_PRIVACY}</Note>
          <Button kind="quiet" title="Disconnect Google Drive" disabled={working} onPress={() => b.disconnect()} />
        </>
      )}
      {b.message ? <Note tone="warn">{b.message}</Note> : null}
    </Screen>
  );
}
