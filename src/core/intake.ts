import {
  isConnectorExport,
  SCREENSHOT_TIME,
  parseThread,
  trackComments,
  type ClaimOptions,
  type ClaimReport,
  type ThreadComment,
} from './claims';

/**
 * Bringing claims in without typing. Three routes end at the same parser and the same order logic:
 * the paste box, the clipboard, and screenshots read on the device. This file is the screenshot route
 * and the clipboard check. Order is the order of arrival, which for screenshots is top to bottom, screenshot
 * by screenshot in the order the seller picked them. Nothing here lets the seller move a claim.
 */

/** A comment read from a screenshot, remembering where it came from. */
export interface IntakeComment extends ThreadComment {
  /** Stable number across edits: its place among everything the screenshots showed. */
  origin: number;
  /** Which screenshot it was on, from 0 in the order they were picked. */
  screen: number;
}

/** What the seller has decided about the flagged ones. Saved with the sale so a knock out loses nothing. */
export interface IntakeDraft {
  /** The text the device read from each screenshot, in the order they were picked. */
  screens: string[][];
  /** Comments the seller took off the list, by origin. */
  removed: number[];
  /** Comments the seller filled in by hand, by origin. They keep their place. */
  added: Record<number, { name: string; lot: number; kind: 'claim' | 'next' }>;
}

export const EMPTY_DRAFT: IntakeDraft = { screens: [], removed: [], added: {} };

/** The lines of what a screenshot read, one per line however the device grouped them. */
export function linesOf(blocks: string[]): string[] {
  return blocks.flatMap((b) => b.split(/\r?\n/)).map((l) => l.trim()).filter(Boolean);
}

/** An author line that could not be a name: a sentence, a number, a stray mark. */
export function unreadableName(author: string): boolean {
  const a = author.trim();
  if (a.length < 2 || a.length > 40) return true;
  if (!/[a-z]/i.test(a)) return true;
  if (/[.!?,:;]$/.test(a)) return true;
  if (a.split(/\s+/).length > 5) return true;
  return false;
}

/** The comments the screenshots showed, in order, with no times: their place is their order. */
export function commentsFromScreens(screens: string[][], sellerName = ''): IntakeComment[] {
  const out: IntakeComment[] = [];
  screens.forEach((blocks, screen) => {
    for (const c of parseThread(linesOf(blocks).join('\n'), sellerName)) {
      out.push({ ...c, index: out.length, origin: out.length, screen, timeHint: null, parent: null });
    }
  });
  return out;
}

/** A comment the seller could not rely on the device to read, and why. */
export interface Flagged {
  comment: IntakeComment;
  /** The name could not be read, or the lot could not be told. */
  why: 'name' | 'lot';
}

export interface Intake {
  /** What counts: readable comments plus the ones filled in by hand, in order. */
  kept: IntakeComment[];
  report: ClaimReport;
  /** Held out of the list until the seller adds them by hand or skips them. */
  flagged: Flagged[];
  /** Which screenshot each claim came from, by comment index in `kept`. */
  screenOf: (commentIndex: number) => number;
}

/** Reads the draft into a claim list, flagging whatever could not be read instead of guessing. */
export function readIntake(draft: IntakeDraft, options: ClaimOptions = {}): Intake {
  const all = commentsFromScreens(draft.screens, options.sellerName ?? '');
  const removed = new Set(draft.removed);
  const flaggedOrigins = new Set<number>();
  const kept: IntakeComment[] = [];
  const held: IntakeComment[] = [];

  for (const c of all) {
    if (removed.has(c.origin)) continue;
    const added = draft.added[c.origin];
    if (added) {
      kept.push({ ...c, author: added.name.trim(), body: `${added.kind === 'next' ? 'next' : 'claim'} lot ${added.lot}`, fromSeller: false });
    } else if (!c.fromSeller && unreadableName(c.author)) {
      held.push(c);
      flaggedOrigins.add(c.origin);
    } else {
      kept.push(c);
    }
  }
  const numbered = kept.map((c, i) => ({ ...c, index: i }));
  const report = trackComments(numbered, options);

  // A comment that sounds like a claim but names no lot waits for the seller to say which lot.
  const unplaced = new Set(report.unplaced.map((c) => (c as IntakeComment).origin));
  const flagged: Flagged[] = [
    ...held.map((comment) => ({ comment, why: 'name' as const })),
    ...numbered.filter((c) => unplaced.has(c.origin)).map((comment) => ({ comment, why: 'lot' as const })),
  ].sort((a, b) => a.comment.origin - b.comment.origin);
  return { kept: numbered, report, flagged, screenOf: (i) => numbered[i]?.screen ?? 0 };
}

/** The thread as text the app already reads, with the comments in the order they sit. */
export function serializeThread(comments: ThreadComment[], connector = false, sellerName = ''): string {
  if (connector) {
    const head = sellerName.trim() ? [`Author: ${sellerName.trim()}`] : [];
    const rows = comments.flatMap((c, i) => [`[${i + 1}] ${c.author} | ${SCREENSHOT_TIME}`, c.body]);
    return [...head, ...rows].join('\n');
  }
  return comments
    .flatMap((c) => [c.author, ...(c.fromSeller ? ['Author'] : []), c.body, 'Like', 'Reply'])
    .filter((l) => l !== '')
    .join('\n');
}

/**
 * What to save when the seller confirms: what was already saved, then the confirmed comments after it.
 * They arrived after it, so they come after it. A comment the saved thread already has by the same buyer on
 * the same lot loses to the earlier one in the claim logic, so overlapping screenshots do no harm.
 */
export function mergeIntoThread(existing: string | undefined, intake: Intake, sellerName = ''): string {
  const before = (existing ?? '').trim();
  const connector = before ? isConnectorExport(before.split('\n')) : false;
  const added = serializeThread(intake.kept, connector, connector && /^Author:/m.test(before) ? '' : sellerName);
  return [before, added].filter(Boolean).join('\n');
}

/**
 * True when text from the clipboard reads as a claim thread: at least one comment that claims or says next
 * and names a lot, or one that sounds like a claim. It must also be different from what is already saved,
 * so the button does not offer the same thread twice.
 */
export function looksLikeThread(text: string | null | undefined, options: ClaimOptions = {}, saved = ''): boolean {
  const t = (text ?? '').trim();
  if (t.length < 8 || t.length > 400_000 || t === saved.trim()) return false;
  const report = trackComments(parseThread(t, options.sellerName ?? ''), options);
  return report.lots.some((l) => l.queue.length > 0) || report.unplaced.length > 0;
}
