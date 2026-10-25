import type { SaleTime } from './types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Every dash character the house style keeps out of member facing words. */
export const DASH_PATTERN = /[-‐‑‒–—―−﹘﹣－]/;

export function formatPrice(price: number | null): string {
  if (price === null || Number.isNaN(price)) return '';
  const whole = Math.round(price * 100) % 100 === 0;
  return `$${whole ? Math.round(price) : price.toFixed(2)}`;
}

/** Reads "25", "$25", "25.50" or "$1,200". Returns null for anything else. */
export function parsePrice(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}

export function plantDisplayName(name: string, noid: boolean): string {
  const trimmed = name.trim();
  if (!noid) return trimmed;
  return trimmed ? `${trimmed} NOID (no confirmed name)` : 'NOID (no confirmed name)';
}

export function parseDay(day: string): { y: number; m: number; d: number } {
  const [y, m, d] = day.split(/\D/).map(Number);
  return { y, m, d };
}

export function dayOfWeek(day: string): string {
  const { y, m, d } = parseDay(day);
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "Sunday, October 26" */
export function formatDay(day: string): string {
  const { m, d } = parseDay(day);
  return `${dayOfWeek(day)}, ${MONTHS[m - 1]} ${d}`;
}

/** "October 24, 2026", used on stamped photos. */
export function formatLongDate(day: string): string {
  const { y, m, d } = parseDay(day);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "8:00 PM" from "20:00" */
export function formatClock(time: string): string {
  const [hRaw, min] = time.split(':').map(Number);
  const suffix = hRaw >= 12 ? 'PM' : 'AM';
  const h = hRaw % 12 === 0 ? 12 : hRaw % 12;
  return `${h}:${String(min).padStart(2, '0')} ${suffix}`;
}

/** Reads "8pm", "8:30 PM", "20:00" or "8". Bare hours from 1 to 11 are read as evening. */
export function parseClock(input: string): string | null {
  const m = input.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3];
  if (min > 59 || h > 23) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    const pm = ap.startsWith('p');
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  } else if (h >= 1 && h <= 11) {
    h += 12;
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** "Sunday, October 26 at 8:00 PM Central" */
export function formatSaleTime(t: SaleTime, timeZone: string): string {
  const zone = timeZone.trim() ? ` ${timeZone.trim()}` : '';
  return `${formatDay(t.day)} at ${formatClock(t.time)}${zone}`;
}

export function toDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Joins card lines, dropping empty ones and doubled blank lines. */
export function joinLines(lines: (string | null | undefined | false)[]): string {
  const out: string[] = [];
  for (const raw of lines) {
    if (raw === null || raw === undefined || raw === false) continue;
    const line = raw.replace(/\s+$/, '');
    if (line === '' && (out.length === 0 || out[out.length - 1] === '')) continue;
    out.push(line);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

/** "Mon", "Mon and Wed", or "Mon, Wed, and Thu". */
export function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`;
}
