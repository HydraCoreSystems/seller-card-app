import type { Lot, Plant, Sale } from './types';

export function lotFromPlant(plant: Plant, number: number): Lot {
  return {
    number,
    plantId: plant.id,
    name: plant.name,
    noid: plant.noid,
    price: plant.price,
    description: plant.notes,
    photoUri: plant.photoUri,
  };
}

/** Numbers the lots in the order the plants were picked, starting at 1. */
export function numberLots(plants: Plant[], startAt = 1): Lot[] {
  return plants.map((p, i) => lotFromPlant(p, startAt + i));
}

export function nextLotNumber(sale: Pick<Sale, 'lots'>): number {
  return sale.lots.reduce((max, l) => Math.max(max, l.number), 0) + 1;
}

/** Lot numbers stay fixed once given, so a posted lot never changes number. */
export function appendLot(sale: Sale, lot: Omit<Lot, 'number'>): Sale {
  return { ...sale, lots: [...sale.lots, { ...lot, number: nextLotNumber(sale) }] };
}
