/**
 * The name corrector. A seller types a plant name any way it comes out; the app offers the
 * correctly formatted version beside it and, where a name is close to one it knows, a spelling
 * suggestion. It only ever offers. The seller sees both and chooses, and nothing is rewritten
 * without a tap.
 *
 * Format: genus capitalized, species epithet lowercase, cultivar in single quotes with each word
 * capitalized, hybrid marker (×) placed right: before the epithet for a species hybrid, before the
 * genus for a hybrid between genera.
 */

/** Rank words that stay lowercase and are followed by a lowercase epithet. */
const RANKS = new Set(['subsp', 'ssp', 'var', 'f', 'forma']);
/** Qualifiers that sit before an epithet and stay lowercase. */
const QUALIFIERS = new Set(['aff', 'cf', 'sp']);
const HYBRID_MARKS = new Set(['x', '×', 'X']);

/**
 * A short list of genera and species sellers in the Facebook plant rooms meet most. It's a
 * starting point for spelling help, not a register: a name that isn't here is never called wrong.
 */
export const KNOWN_GENERA = [
  'Hoya', 'Dischidia', 'Ceropegia', 'Monstera', 'Philodendron', 'Anthurium', 'Epipremnum', 'Scindapsus',
  'Rhaphidophora', 'Syngonium', 'Alocasia', 'Calathea', 'Hoya', 'Peperomia', 'Begonia', 'Tradescantia',
  'Aeschynanthus', 'Columnea', 'Nematanthus', 'Rhipsalis', 'Hatiora', 'Schlumbergera', 'Orchidaceae',
  'Phalaenopsis', 'Dendrobium', 'Paphiopedilum', 'Oncidium', 'Cattleya', 'Sansevieria', 'Dracaena',
];

export const KNOWN_EPITHETS: Record<string, string[]> = {
  Hoya: [
    'carnosa', 'kerrii', 'obovata', 'linearis', 'pubicalyx', 'polyneura', 'australis', 'bella', 'curtisii',
    'lacunosa', 'retusa', 'serpens', 'multiflora', 'macrophylla', 'verticillata', 'wayetii', 'heuschkeliana',
    'sunrise', 'compacta', 'imperialis', 'finlaysonii', 'lauterbachii', 'memoria', 'nummularioides',
    'burtoniae', 'krohniana', 'fungii', 'sigillatis', 'pachyclada', 'cumingiana', 'diversifolia', 'incrassata',
    'latifolia', 'mindorensis', 'parasitica', 'rotundiflora', 'shepherdii', 'sussuela', 'tsangii', 'vitellinoides',
  ],
  Dischidia: ['ruscifolia', 'nummularia', 'oiantha', 'imbricata', 'ovata', 'platyphylla', 'milnei'],
  Monstera: ['deliciosa', 'adansonii', 'obliqua', 'dubia', 'siltepecana', 'standleyana', 'acuminata'],
  Philodendron: ['hederaceum', 'bipinnatifidum', 'gloriosum', 'verrucosum', 'melanochrysum', 'erubescens', 'brandtianum'],
  Epipremnum: ['aureum', 'pinnatum'],
  Scindapsus: ['pictus', 'treubii'],
  Ceropegia: ['woodii', 'linearis', 'sandersonii', 'ampliata', 'fusca'],
  Anthurium: ['clarinervium', 'crystallinum', 'warocqueanum', 'andraeanum', 'veitchii'],
};

export interface NameSuggestion {
  /** The name as the seller typed it. */
  typed: string;
  /** The same name, correctly formatted. Always offered when it differs from what was typed. */
  formatted: string;
  /** A close known spelling, when the genus or epithet looks like a typo. Null when nothing is close. */
  spelling: string | null;
  /** True when the formatted version differs from what was typed. */
  changed: boolean;
}

const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w);
const lower = (w: string) => w.toLowerCase();
const stripDots = (w: string) => w.replace(/\.+$/, '');

/** Each word of a cultivar name capitalized, keeping inner capitals the seller typed on a word that already has them. */
function cultivarCase(words: string[]): string {
  return words
    .map((w) => {
      const base = w.replace(/^['‘’"“”]+|['‘’"“”]+$/g, '');
      if (!base) return '';
      // A word typed with its own capitals, like "McKenzie" or "MoonStar", keeps them.
      return /[A-Z]/.test(base.slice(1)) ? base[0].toUpperCase() + base.slice(1) : cap(base);
    })
    .filter(Boolean)
    .join(' ');
}

/** The quoted cultivar in the text, if the seller already quoted it, and what's left once it's taken out. */
function takeQuoted(text: string): { rest: string; cultivar: string | null } {
  const m = text.match(/['‘"“]([^'’"”]+)['’"”]/);
  if (!m) return { rest: text, cultivar: null };
  return { rest: (text.slice(0, m.index) + ' ' + text.slice((m.index ?? 0) + m[0].length)).trim(), cultivar: m[1].trim() };
}

/** Formats a plant name. Returns the typed text, trimmed, when there's nothing to format. */
export function formatPlantName(typed: string): string {
  const original = typed.trim().replace(/\s+/g, ' ');
  if (!original) return '';

  const quoted = takeQuoted(original);
  // "cv." marks a cultivar the seller didn't quote.
  let rest = quoted.rest;
  let cultivar = quoted.cultivar;
  const cv = rest.match(/\bcv\.?\s+(.+)$/i);
  if (cv && !cultivar) {
    cultivar = cv[1];
    rest = rest.slice(0, cv.index).trim();
  }

  const words = rest.split(' ').filter(Boolean);
  const out: string[] = [];
  let i = 0;
  let sawEpithet = false;
  let genusSeen = false;

  // A hybrid between genera: "x Genus" or "× Genus" leads the name.
  if (words[i] && HYBRID_MARKS.has(words[i]) && words[i + 1]) {
    out.push('×');
    i += 1;
  }
  if (words[i]) {
    out.push(cap(words[i]));
    genusSeen = true;
    i += 1;
  }
  // Words after the genus: a hybrid mark, qualifiers and ranks, an epithet, then anything left is the cultivar.
  const leftover: string[] = [];
  let verbatim = false;
  for (; i < words.length; i++) {
    const w = words[i];
    const bare = stripDots(w);
    // A hybrid mark: a cross like "carnosa x pubicalyx" puts the mark before the second epithet.
    if (genusSeen && HYBRID_MARKS.has(w) && words[i + 1]) {
      out.push('×');
      sawEpithet = false;
      continue;
    }
    // "sp." means a species nobody has named yet, so whatever follows (a locality, a collector's number) is left as typed.
    if (lower(bare) === 'sp' && !sawEpithet) {
      out.push('sp.');
      leftover.push(...words.slice(i + 1));
      verbatim = true;
      break;
    }
    if (QUALIFIERS.has(lower(bare)) && !sawEpithet) {
      out.push(`${lower(bare)}.`);
      continue;
    }
    if (RANKS.has(lower(bare)) && sawEpithet) {
      out.push(`${lower(bare)}.`);
      sawEpithet = false;
      continue;
    }
    if (!sawEpithet && /^[a-zA-Z-]+$/.test(bare)) {
      out.push(lower(bare));
      sawEpithet = true;
      continue;
    }
    // A word after a rank word is its epithet.
    if (!sawEpithet && out.length && /\.$/.test(out[out.length - 1]) && /^[a-zA-Z-]+$/.test(bare)) {
      out.push(lower(bare));
      sawEpithet = true;
      continue;
    }
    leftover.push(w);
  }
  if (verbatim) {
    const tail = leftover.join(' ');
    return [out.join(' '), tail, cultivar ? `'${cultivarCase(cultivar.split(/\s+/))}'` : ''].filter(Boolean).join(' ');
  }
  if (!cultivar && leftover.length) cultivar = leftover.join(' ');
  else if (leftover.length) cultivar = `${cultivar} ${leftover.join(' ')}`;

  // A cross like "Hoya carnosa x pubicalyx": the mark sits before the second epithet.
  const name = out.join(' ').replace(/ × /g, ' × ').trim();
  const quotedCultivar = cultivar ? cultivarCase(cultivar.split(/\s+/)) : '';
  return quotedCultivar ? `${name} '${quotedCultivar}'` : name;
}

/** Edit distance between two lowercase words. */
function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/** The closest known word within a small distance, not counting an exact match. */
function closest(word: string, known: string[]): string | null {
  const w = word.toLowerCase();
  if (w.length < 4) return null;
  const limit = w.length >= 8 ? 2 : 1;
  let best: { word: string; d: number } | null = null;
  for (const k of known) {
    const kl = k.toLowerCase();
    if (kl === w) return null;
    const d = distance(w, kl);
    if (d <= limit && (!best || d < best.d)) best = { word: k, d };
  }
  return best?.word ?? null;
}

/**
 * The formatted name plus a spelling suggestion, when the genus or epithet is close to a known
 * one. The suggestion is the formatted name with that one word swapped.
 */
export function suggestName(typed: string): NameSuggestion {
  const original = typed.trim().replace(/\s+/g, ' ');
  const formatted = formatPlantName(original);
  let spelling: string | null = null;

  const parts = formatted.replace(/^× /, '').split(' ');
  const genusWord = parts[0];
  if (genusWord) {
    const genus = closest(genusWord, KNOWN_GENERA);
    const knownGenus = KNOWN_GENERA.find((g) => g.toLowerCase() === genusWord.toLowerCase());
    const useGenus = genus ?? knownGenus ?? genusWord;
    const epithet = parts[1] && /^[a-z-]+$/.test(parts[1]) ? parts[1] : null;
    const epithetFix = epithet && KNOWN_EPITHETS[useGenus] ? closest(epithet, KNOWN_EPITHETS[useGenus]) : null;
    if (genus || epithetFix) {
      let swapped = formatted;
      if (genus) swapped = swapped.replace(genusWord, genus);
      if (epithetFix && epithet) swapped = swapped.replace(` ${epithet}`, ` ${epithetFix}`);
      if (swapped !== formatted) spelling = swapped;
    }
  }
  return { typed: original, formatted, spelling, changed: formatted !== original };
}
