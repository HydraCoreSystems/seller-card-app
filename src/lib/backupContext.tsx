/**
 * Keeps the seller's Drive backup going. It watches the data, backs up after a sale closes and at
 * most every ten minutes while the app is in use, and exposes the few actions the backup screen needs.
 * The rules it follows are in core/backup.ts and core/backupRun.ts, which are tested.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { digest, hasData, shouldBackUp, type BackupData } from '../core/backup';
import type { Found } from '../core/backupRun';
import { BACKUP_NEWER, BACKUP_RECONNECT, BACKUP_RETRY } from '../core/backupCopy';
import { DriveError } from '../core/drive';
import { backupNow, findRemoteBackup, forgetBackupState, loadBackupState, restoreRemote } from './driveBackup';
import { connectGoogle, connectedEmail, disconnectGoogle, googleReady } from './googleAuth';
import { useStore } from './store';

export type BackupStatus = 'off' | 'idle' | 'working' | 'ok' | 'changed' | 'problem';

interface Conflict {
  savedAt: string;
  savedBy: 'phone' | 'computer';
}

interface Backup {
  /** True when this build can back up at all: an iPhone or iPad build with a Google client. */
  available: boolean;
  email: string | null;
  status: BackupStatus;
  /** A plain sentence about a problem, or null. */
  message: string | null;
  lastAt: number | null;
  /** Set when the backup on Drive was changed by another device, and the seller has to choose. */
  conflict: Conflict | null;
  /** A backup found on Drive that a phone with nothing on it can pull down. */
  offer: Found | null;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  backUpNow(): Promise<void>;
  /** The seller chose this phone's data over the Drive copy. */
  keepThisPhone(): Promise<void>;
  /** The seller chose the Drive copy over this phone's data, or accepted the offer on a new phone. */
  useDriveCopy(): Promise<void>;
  /** Looks for a backup on Drive without touching anything. */
  look(): Promise<void>;
}

const Ctx = createContext<Backup | null>(null);

const problemText = (e: unknown): string => {
  if (e instanceof DriveError && (e.status === 401 || e.status === 403)) return BACKUP_RECONNECT;
  if (e instanceof Error && /Not connected|no longer/i.test(e.message)) return BACKUP_RECONNECT;
  return BACKUP_RETRY;
};

export function BackupProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const available = googleReady();
  const [email, setEmail] = useState<string | null>(() => (available ? connectedEmail() : null));
  const [status, setStatus] = useState<BackupStatus>(() => (available && connectedEmail() ? 'idle' : 'off'));
  const [message, setMessage] = useState<string | null>(null);
  const [lastAt, setLastAt] = useState<number | null>(() => loadBackupState().lastAt);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [offer, setOffer] = useState<Found | null>(null);

  const data = useMemo<BackupData>(
    () => ({
      profile: store.profile,
      plants: store.plants,
      sales: store.sales,
      records: store.records,
      buyerNotes: store.buyerNotes,
      leftoversDone: store.leftoversDone,
      templates: store.templates,
    }),
    [store.profile, store.plants, store.sales, store.records, store.buyerNotes, store.leftoversDone, store.templates],
  );
  const dataRef = useRef(data);

  const busy = useRef(false);
  const backedUp = useRef<string | null>(loadBackupState().stamp ?? null);
  const lastTry = useRef<number | null>(null);
  const closed = useRef(store.sales.filter((s) => s.closedAt).length);
  const closedNow = useRef(false);
  const live = useRef({ pro: store.pro, sample: store.sample, email, conflict });
  const offerRef = useRef<Found | null>(null);
  // Kept in step after each render, so the timers always read the latest values.
  useEffect(() => {
    dataRef.current = data;
    live.current = { pro: store.pro, sample: store.sample, email, conflict };
    offerRef.current = offer;
  });

  const run = useCallback(async (force: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setStatus('working');
    setMessage(null);
    const sent = digest(dataRef.current);
    try {
      const r = await backupNow(dataRef.current, force);
      if (r.status === 'ok') {
        backedUp.current = sent;
        setLastAt(Date.now());
        setConflict(null);
        setStatus('ok');
      } else if (r.status === 'changed') {
        setConflict({ savedAt: r.savedAt, savedBy: r.savedBy });
        setStatus('changed');
      } else {
        setMessage(BACKUP_NEWER);
        setStatus('problem');
      }
    } catch (e) {
      setMessage(problemText(e));
      setStatus('problem');
    } finally {
      busy.current = false;
      lastTry.current = Date.now();
      closedNow.current = false;
    }
  }, []);

  const tick = useCallback(() => {
    const l = live.current;
    const dirty = backedUp.current !== digest(dataRef.current);
    const go = shouldBackUp({
      connected: !!l.email,
      allowed: l.pro && !l.sample,
      dirty,
      lastAt: lastTry.current,
      now: Date.now(),
      closedNow: closedNow.current,
      blocked: busy.current || !!l.conflict,
    });
    if (go) void run(false);
  }, [run]);

  // A sale closing is the moment that matters most, so it backs up without waiting out the gap.
  useEffect(() => {
    const n = store.sales.filter((s) => s.closedAt).length;
    if (n > closed.current && !store.sample) closedNow.current = true;
    closed.current = n;
    tick();
  }, [store.sales, store.sample, data, tick]);

  useEffect(() => {
    const timer = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [tick]);

  const look = useCallback(async () => {
    try {
      const found = await findRemoteBackup();
      setOffer(found);
    } catch (e) {
      setOffer(null);
      setMessage(e instanceof Error && /newer Skrybix/.test(e.message) ? BACKUP_NEWER : problemText(e));
    }
  }, []);

  const connect = useCallback(async () => {
    setMessage(null);
    try {
      const who = await connectGoogle();
      if (!who) return;
      setEmail(who);
      setStatus('idle');
      // A phone with nothing on it is offered the backup. A phone with data is told if the two differ.
      if (!hasData(dataRef.current)) await look();
    } catch (e) {
      setMessage(e instanceof Error && e.message ? e.message : BACKUP_RETRY);
      setStatus('problem');
    }
  }, [look]);

  const disconnect = useCallback(async () => {
    await disconnectGoogle();
    forgetBackupState();
    backedUp.current = null;
    setEmail(null);
    setStatus('off');
    setConflict(null);
    setOffer(null);
    setMessage(null);
    setLastAt(null);
  }, []);

  const useDriveCopy = useCallback(async () => {
    setMessage(null);
    setStatus('working');
    try {
      const found = offerRef.current ?? (await findRemoteBackup());
      if (!found) {
        setMessage('There is no backup on this Drive yet.');
        setStatus('idle');
        return;
      }
      const restored = await restoreRemote(found);
      store.restoreData(restored);
      backedUp.current = null;
      setOffer(null);
      setConflict(null);
      setLastAt(Date.now());
      setStatus('ok');
    } catch (e) {
      setMessage(e instanceof Error && /newer Skrybix/.test(e.message) ? BACKUP_NEWER : problemText(e));
      setStatus('problem');
    }
  }, [store]);

  const value = useMemo<Backup>(
    () => ({
      available,
      email,
      status,
      message,
      lastAt,
      conflict,
      offer,
      connect,
      disconnect,
      backUpNow: () => run(false),
      keepThisPhone: () => run(true),
      useDriveCopy,
      look,
    }),
    [available, email, status, message, lastAt, conflict, offer, connect, disconnect, run, useDriveCopy, look],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBackup(): Backup {
  const b = useContext(Ctx);
  if (!b) throw new Error('useBackup outside BackupProvider');
  return b;
}
