import type { SheetLot } from '../core/saleSheet';

/** Lots read from a Sale Sheet, waiting on the new showcase screen. Held only until the app closes. */
let pending: SheetLot[] | null = null;

export function holdSheetLots(lots: SheetLot[]): void {
  pending = lots;
}

export function sheetLots(): SheetLot[] | null {
  return pending;
}

export function clearSheetLots(): void {
  pending = null;
}
