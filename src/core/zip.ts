import { ZIP_DATA } from './zipData';

/** A city and state, as the ZIP lookup knows them. */
export type Place = { city: string; state: string };

let table: Map<string, Place> | null = null;

/** Reads the bundled data once, the first time a ZIP is looked up. No network, no storage. */
function load(): Map<string, Place> {
  if (table) return table;
  const map = new Map<string, Place>();
  for (const line of ZIP_DATA.split('\n')) {
    const [state, city, nums] = line.split('|');
    let zip = 0;
    nums.split(',').forEach((n, i) => {
      zip = i === 0 ? parseInt(n, 36) : zip + parseInt(n, 36);
      map.set(String(zip).padStart(5, '0'), { city, state });
    });
  }
  table = map;
  return map;
}

/** The five digits of a complete US ZIP ("46804" or "46804-1234"), or null while it is incomplete or not a ZIP. */
export function zipDigits(zip: string): string | null {
  return /^(\d{5})(?:-\d{4})?$/.exec(zip.trim())?.[1] ?? null;
}

/** The main mailing city and state for a complete US ZIP. Null for an unknown or unfinished ZIP. */
export function lookupZip(zip: string): Place | null {
  const digits = zipDigits(zip);
  return digits ? (load().get(digits) ?? null) : null;
}

export type PlaceFields = { zip: string; city: string; state: string };

/**
 * What the city and state become when the ZIP changes to `nextZip`.
 *
 * The app only ever fills a field it filled itself. A city or state is refilled when it is blank, when it still
 * equals the last thing the app filled in (`lastFill`), or when it still equals what the ZIP being replaced
 * gives. Anything the seller typed over stays exactly as typed. An unknown or unfinished ZIP changes nothing.
 * `fill` is the app's new memory of what it last filled, to hand back in on the next change.
 */
export function fillFromZip(
  before: PlaceFields,
  nextZip: string,
  lastFill: Place | null,
): { city: string; state: string; fill: Place | null } {
  const hit = lookupZip(nextZip);
  if (!hit) return { city: before.city, state: before.state, fill: lastFill };
  const was = lookupZip(before.zip);
  const mine = (value: string, key: keyof Place) => {
    const v = value.trim();
    return v === '' || v === lastFill?.[key] || v === was?.[key];
  };
  const city = mine(before.city, 'city') ? hit.city : before.city;
  const state = mine(before.state, 'state') ? hit.state : before.state;
  return {
    city,
    state,
    fill: { city: city === hit.city ? hit.city : (lastFill?.city ?? ''), state: state === hit.state ? hit.state : (lastFill?.state ?? '') },
  };
}
