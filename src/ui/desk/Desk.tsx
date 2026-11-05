import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { packBackup, type Backup, type BackupData } from '../../core/backup';
import { createDesk, type Desk as DeskSession } from '../../core/desk';
import {
  DESK_FRESHER,
  DESK_INTRO,
  DESK_NEEDS_PRO,
  DESK_NOT_SET_UP,
  DESK_PRIVACY,
  DESK_SAMPLE,
  DESK_SAVED,
  DESK_TITLE,
} from '../../core/deskCopy';
import { createDrive } from '../../core/drive';
import { sampleDesk } from '../../core/deskSample';
import { driveDeskPort } from '../../lib/deskPort';
import { signInWeb, signOutWeb, webSignInReady, webToken } from '../../lib/googleWeb';
import { Button, Note, Panel, Row, colors } from '../kit';
import { LabelsView, PackingView, ProfitView, RundownView, type ViewProps } from './views';

type Tab = 'rundown' | 'packing' | 'labels' | 'profit';
const TABS: { id: Tab; label: string }[] = [
  { id: 'rundown', label: 'Rundown' },
  { id: 'packing', label: 'Packing' },
  { id: 'labels', label: 'Label file' },
  { id: 'profit', label: 'What you kept' },
];

interface Session {
  desk: DeskSession;
  who: string;
  sample: boolean;
}

/** The computer version: sign in, load the backup from Drive, and work on it in four views. */
export function Desk() {
  const [session, setSession] = useState<Session | null>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [tab, setTab] = useState<Tab>('rundown');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const open = useCallback(async (s: Session) => {
    setBusy('Loading your backup');
    setProblem(null);
    try {
      const b = await s.desk.load();
      setSession(s);
      setBackup(b);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not read your backup.');
    } finally {
      setBusy(null);
    }
  }, []);

  const signIn = async () => {
    setBusy('Signing in');
    setProblem(null);
    try {
      const who = await signInWeb();
      await open({ desk: createDesk(driveDeskPort(createDrive(webToken))), who, sample: false });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not sign in.');
      setBusy(null);
    }
  };

  const trySample = () => {
    const mem = { current: packBackup(sampleDesk(), { revision: 1, now: Date.now(), pro: true }) as Backup };
    const desk = createDesk(
      {
        read: async () => mem.current,
        write: async (b) => void (mem.current = b),
      },
      Date.now,
    );
    void open({ desk, who: 'a sample', sample: true });
  };

  const commit = useCallback(async (change: (d: BackupData) => BackupData) => {
    const s = session;
    if (!s) return;
    setBusy('Saving');
    setProblem(null);
    try {
      const r = await s.desk.commit(change);
      setBackup(r.backup);
      setMessage(r.fresher ? DESK_FRESHER : s.sample ? null : DESK_SAVED);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not save that. Try again.');
    } finally {
      setBusy(null);
    }
  }, [session]);

  const leave = () => {
    if (!session?.sample) signOutWeb();
    setSession(null);
    setBackup(null);
    setMessage(null);
  };

  const view: ViewProps | null = backup ? { data: backup.data, now, commit, saving: busy === 'Saving' } : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 980 }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color: colors.ink, marginBottom: 4 }}>{DESK_TITLE}</Text>

        {!session || !backup || !view ? (
          <>
            <Note>{DESK_INTRO}</Note>
            <Note>{DESK_PRIVACY}</Note>
            {webSignInReady() ? (
              <Button title={busy ?? 'Sign in with Google'} disabled={!!busy} onPress={signIn} />
            ) : (
              <Note>{DESK_NOT_SET_UP}</Note>
            )}
            <Button kind="quiet" title="Look at a sample" disabled={!!busy} onPress={trySample} />
            {busy && !webSignInReady() ? <Note>{busy}</Note> : null}
          </>
        ) : !backup.meta.pro ? (
          <Panel>
            <Note>{DESK_NEEDS_PRO}</Note>
            <Button kind="secondary" title="Sign out" onPress={leave} />
          </Panel>
        ) : (
          <>
            <Row style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: colors.soft }}>
                {session.sample ? 'Sample' : `Signed in as ${session.who}`}, backup revision {backup.revision}, saved {new Date(backup.savedAt).toLocaleString()} by your {backup.savedBy}
              </Text>
              <Button kind="quiet" title={session.sample ? 'Leave the sample' : 'Sign out'} onPress={leave} />
            </Row>
            {session.sample ? <Note>{DESK_SAMPLE}</Note> : null}
            <Row style={{ marginBottom: 8 }}>
              {TABS.map((t) => (
                <Button key={t.id} kind={tab === t.id ? 'primary' : 'secondary'} title={t.label} onPress={() => setTab(t.id)} />
              ))}
            </Row>
            {busy ? <Note>{busy}</Note> : message ? <Note>{message}</Note> : null}
            {tab === 'rundown' ? <RundownView {...view} /> : null}
            {tab === 'packing' ? <PackingView {...view} /> : null}
            {tab === 'labels' ? <LabelsView {...view} /> : null}
            {tab === 'profit' ? <ProfitView {...view} /> : null}
          </>
        )}
        {problem ? <Note tone="warn">{problem}</Note> : null}
      </View>
    </ScrollView>
  );
}
