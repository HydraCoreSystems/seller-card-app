/**
 * The guide: what the app remembers about a seller's setup walk and first sale checklist.
 *
 * It lives in the same phone storage as the profile, under its own key, and stays on the phone. It is
 * never part of a backup, so a restore onto a new phone does not replay the walk.
 */

export type StepId = 'welcome' | 'room' | 'seller' | 'location' | 'lines' | 'form' | 'done';

export interface WalkFlags {
  /** True when the checkout chain is on: always in the Phil build, and in the store product with Pro. */
  pro: boolean;
}

/** The steps of the setup walk in order. The checkout form step exists only where the checkout chain does. */
export function walkSteps({ pro }: WalkFlags): StepId[] {
  return ['welcome', 'room', 'seller', 'location', 'lines', ...(pro ? (['form'] as const) : []), 'done'];
}

/** What the seller typed in the room step before there is a profile to hold it. */
export interface WalkDraft {
  roomName: string;
  formatId: 'commons' | 'generic';
}

export interface GuideState {
  version: 1;
  /**
   * new: a fresh install that has not seen the walk. active: started. skipped: the seller chose to
   * skip. done: finished once, so it never opens by itself again.
   */
  walk: 'new' | 'active' | 'skipped' | 'done';
  /** Steps the seller has moved past. Resuming lands on the first step not in here. */
  done: StepId[];
  /** The room step's answer, held until the seller's name makes a profile. */
  draft: WalkDraft | null;
  /** True once the seller says they know their way around, or the first sale ends. Per install. */
  checklistDismissed: boolean;
}

export const FRESH_GUIDE: GuideState = { version: 1, walk: 'new', done: [], draft: null, checklistDismissed: false };

const STEP_IDS: StepId[] = ['welcome', 'room', 'seller', 'location', 'lines', 'form', 'done'];
const WALKS = ['new', 'active', 'skipped', 'done'];

/**
 * Reads what was saved. A phone with no saved guide that already has a profile belongs to someone
 * who set up before the walk existed: their walk counts as done, and a checklist is only for a sale
 * that has not started yet.
 */
export function readGuide(raw: unknown, ctx: { hasProfile: boolean; hasSales: boolean }): GuideState {
  const r = raw as Partial<GuideState> | null;
  if (!r || typeof r !== 'object' || r.version !== 1 || !WALKS.includes(r.walk as string)) {
    return ctx.hasProfile ? { ...FRESH_GUIDE, walk: 'done', checklistDismissed: ctx.hasSales } : FRESH_GUIDE;
  }
  return {
    version: 1,
    walk: r.walk as GuideState['walk'],
    done: Array.isArray(r.done) ? r.done.filter((s): s is StepId => STEP_IDS.includes(s as StepId)) : [],
    draft: r.draft && typeof r.draft.roomName === 'string' ? { roomName: r.draft.roomName, formatId: r.draft.formatId === 'commons' ? 'commons' : 'generic' } : null,
    checklistDismissed: !!r.checklistDismissed,
  };
}

/** The first step the seller has not moved past. Once every step before the last is done, that is the last. */
export function firstUnfinished(state: GuideState, steps: StepId[]): StepId {
  return steps.find((s) => !state.done.includes(s)) ?? steps[steps.length - 1];
}

/** Moves past one step. A walk that was new or skipped is now under way. A finished walk stays finished. */
export function passStep(state: GuideState, step: StepId): GuideState {
  if (state.walk === 'done') return state;
  return { ...state, walk: 'active', done: state.done.includes(step) ? state.done : [...state.done, step] };
}

export function skipWalk(state: GuideState): GuideState {
  return state.walk === 'done' ? state : { ...state, walk: 'skipped' };
}

/** The seller reached the last screen. The walk is done for good and never opens by itself again. */
export function finishWalk(state: GuideState, steps: StepId[]): GuideState {
  return { ...state, walk: 'done', done: steps, draft: null };
}

export function setDraft(state: GuideState, draft: WalkDraft | null): GuideState {
  return state.walk === 'done' ? state : { ...state, draft };
}

export function dismissChecklist(state: GuideState): GuideState {
  return { ...state, checklistDismissed: true };
}

/** The lines a first card cannot be built without. A seller who typed them in Profile is set up, walk or not. */
export function hasCoreLines(profile: { sellerName: string; shipping: string; payment: string } | null): boolean {
  return !!profile && !!profile.sellerName.trim() && !!profile.shipping.trim() && !!profile.payment.trim();
}

export function setupComplete(state: GuideState, profile: { sellerName: string; shipping: string; payment: string } | null): boolean {
  return state.walk === 'done' || hasCoreLines(profile);
}

/** First launch on a fresh install opens the walk once. Nothing opens it over the sample or over a restored profile. */
export function opensByItself(state: GuideState, ctx: { hasProfile: boolean; sample: boolean }): boolean {
  return state.walk === 'new' && !ctx.hasProfile && !ctx.sample;
}

/** The resumable entry on Home: shown until setup is complete, and never over the sample. */
export function showsResume(state: GuideState, profile: { sellerName: string; shipping: string; payment: string } | null, sample: boolean): boolean {
  return !sample && !setupComplete(state, profile);
}

/** A fresh state that meets an existing profile (a restore, say) has nothing to walk through. */
export function settleGuide(state: GuideState, hasProfile: boolean): GuideState {
  return state.walk === 'new' && hasProfile ? { ...state, walk: 'done', draft: null } : state;
}
