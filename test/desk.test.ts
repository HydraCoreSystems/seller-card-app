import { describe, expect, it } from 'vitest';
import { EMPTY_BACKUP_DATA, packBackup, type Backup, type BackupData } from '../src/core/backup';
import { writeBackup, type DrivePort } from '../src/core/backupRun';
import { NO_BACKUP, createDesk, type DeskPort } from '../src/core/desk';
import { applyFulfillment, applyPayment, applyPlantCost, applySaleCosts } from '../src/core/mutations';
import type { Plant, Sale, SaleRecord } from '../src/core/types';

const plant: Plant = { id: 'p1', name: 'Fern', noid: false, price: 20, kind: 'sale', photoUri: null, notes: '', sold: true, createdAt: '2026-11-01' };
const sale = { id: 's1', lots: [{ number: 1, plantId: 'p1', name: 'Fern', noid: false, price: 20, description: '', photoUri: null }], createdAt: '2026-11-01' } as unknown as Sale;
const record: SaleRecord = { id: 'r1', saleId: 's1', lotNumber: 1, plantName: 'Fern', buyer: 'Ann Lee', price: 20, date: '2026-11-01' };
const base = (): BackupData => ({ ...EMPTY_BACKUP_DATA, plants: [plant], sales: [sale], records: [record] });

function memory(start: Backup | null): DeskPort & { saved: Backup[]; current: () => Backup | null; set: (b: Backup) => void } {
  let cur = start;
  const saved: Backup[] = [];
  return {
    saved,
    current: () => cur,
    set: (b) => void (cur = b),
    read: async () => cur,
    write: async (b) => {
      saved.push(b);
      cur = b;
    },
  };
}

describe('changes made away from the phone', () => {
  it('marks a buyer paid, and hands the plant back when they never pay', () => {
    const paid = applyPayment(base(), 's1', 'ann lee', 'paid', '2026-11-02');
    expect(paid.records[0]).toMatchObject({ payment: 'paid', paidDate: '2026-11-02' });
    const never = applyPayment(base(), 's1', 'Ann Lee', 'never', '2026-11-02');
    expect(never.plants[0].sold).toBe(false);
    expect(applyPayment(never, 's1', 'Ann Lee', undefined, '2026-11-03').records[0].payment).toBeUndefined();
  });

  it('keeps shipped marks and tracking per buyer, and costs on plants and sales', () => {
    const d = applyFulfillment(applyFulfillment(base(), 's1', 'ann', { shipped: true }), 's1', 'ann', { tracking: '9400' });
    expect(d.sales[0].fulfillment?.ann).toEqual({ shipped: true, tracking: '9400' });
    expect(applyPlantCost(base(), 'p1', 4).plants[0].cost).toBe(4);
    expect(applySaleCosts(base(), 's1', { shippingCost: 9 }).sales[0].shippingCost).toBe(9);
  });
});

describe('the desk', () => {
  const start = () => ({ ...packBackup(base(), { revision: 3, now: 0, pro: true }), photos: ['a.jpg'] });

  it('says so when there is no backup', async () => {
    await expect(createDesk(memory(null)).load()).rejects.toThrow(NO_BACKUP);
  });

  it('saves a change as the next revision, written by the computer, keeping photos and the Pro marker', async () => {
    const port = memory(start());
    const desk = createDesk(port, () => 5000);
    await desk.load();
    const { backup, fresher } = await desk.commit((d) => applyPayment(d, 's1', 'Ann Lee', 'paid', '2026-11-02'));
    expect(fresher).toBe(false);
    expect(backup).toMatchObject({ revision: 4, savedBy: 'computer', photos: ['a.jpg'], meta: { pro: true }, savedAt: new Date(5000).toISOString() });
    expect(port.current()!.data.records[0].payment).toBe('paid');
  });

  it('lands a change on top of what the phone saved in the meantime', async () => {
    const port = memory(start());
    const desk = createDesk(port);
    await desk.load();
    // The phone backs up a new plant after the desk loaded.
    const phone = start();
    port.set({ ...phone, revision: 4, savedBy: 'phone', data: { ...phone.data, plants: [...phone.data.plants, { ...plant, id: 'p2', name: 'Pothos' }] } });
    const { backup, fresher } = await desk.commit((d) => applyFulfillment(d, 's1', 'ann', { shipped: true }));
    expect(fresher).toBe(true);
    expect(backup.revision).toBe(5);
    expect(backup.data.plants.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(backup.data.sales[0].fulfillment?.ann.shipped).toBe(true);
  });

  it('makes changes one at a time, so none is lost', async () => {
    const port = memory(start());
    const desk = createDesk(port);
    await desk.load();
    await Promise.all([
      desk.commit((d) => applyFulfillment(d, 's1', 'ann', { shipped: true })),
      desk.commit((d) => applyFulfillment(d, 's1', 'ann', { tracking: 'T1' })),
      desk.commit((d) => applyPlantCost(d, 'p1', 3)),
    ]);
    const end = port.current()!;
    expect(end.revision).toBe(6);
    expect(end.data.sales[0].fulfillment?.ann).toEqual({ shipped: true, tracking: 'T1' });
    expect(end.data.plants[0].cost).toBe(3);
  });

  it('writes the backup file over the one on Drive', async () => {
    const files = new Map([['skrybix-backup.json', 'id1']]);
    let wrote: { name: string; text: string; id?: string } | null = null;
    const drive = {
      folder: async () => 'f1',
      files: async () => files,
      writeText: async (_f: string, name: string, text: string, id?: string) => ((wrote = { name, text, id }), { id: 'id1' }),
    } as unknown as DrivePort;
    await writeBackup(drive, start());
    expect(wrote).toMatchObject({ name: 'skrybix-backup.json', id: 'id1' });
    expect(JSON.parse(wrote!.text).revision).toBe(3);
  });
});

describe('the computer version words and sign in', () => {
  it('keep the desk copy free of dashes', async () => {
    const copy = await import('../src/core/deskCopy');
    const { DASH_PATTERN } = await import('../src/core/text');
    for (const t of Object.values(copy)) expect(DASH_PATTERN.test(t)).toBe(false);
  });

  it('uses one Web client from the same project, and is the Skrybix Web client of the same project', async () => {
    const { webClient, iosClientFor } = await import('../src/core/googleAuthConfig');
    expect(webClient(undefined)).toBe('289863330767-7qu9f3pa40mjhdti8mc2tpubn3vgd99e.apps.googleusercontent.com');
    expect(webClient('1-abc.apps.googleusercontent.com')).toBe('1-abc.apps.googleusercontent.com');
    expect(webClient('nonsense')).toBeNull();
    expect(iosClientFor(false)).toMatch(/^289863330767-73jn/);
    expect(iosClientFor(true)).toMatch(/^289863330767-9dqb/);
    expect(iosClientFor(true, '1-x.apps.googleusercontent.com')).toBe('1-x.apps.googleusercontent.com');
  });

  it('opens a sample from made up data that already has a paid buyer with a form', async () => {
    const { sampleDesk } = await import('../src/core/deskSample');
    const { checkoutModel } = await import('../src/core/checkoutModel');
    const d = sampleDesk(new Date('2026-11-02T12:00:00'));
    const m = checkoutModel(d.sales[0], d.profile!, d.records, Date.now());
    expect(m.rows.find((r) => r.buyer === 'Jada Winslow')).toMatchObject({ paid: true, contacted: true });
  });
});
