import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appName, originLine } from '../src/core/brand';
import type { Plant } from '../src/core/types';
import { BrandBand, DeadlineChip, PlantRow, SoldChip, StageChip } from '../src/ui/phil';
import { buttonLook, PHIL_SHADOW, styleDefs } from '../src/ui/styleDefs';
import { ACCENT, CLOSED_COLORS, DISPLAY_FONT, mixHex, PHIL_COLORS, STAGE_LOOK, theme, themeFor } from '../src/ui/theme';

const saved = process.env.EXPO_PUBLIC_APP_VARIANT;
const setVariant = (v: 'phil' | undefined) => {
  if (v) process.env.EXPO_PUBLIC_APP_VARIANT = v;
  else delete process.env.EXPO_PUBLIC_APP_VARIANT;
};
beforeEach(() => setVariant('phil'));
afterEach(() => {
  if (saved === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
  else process.env.EXPO_PUBLIC_APP_VARIANT = saved;
});

const plant = (extra: Partial<Plant> = {}): Plant => ({
  id: 'p1', name: 'Hoya carnosa Krimson Queen', noid: false, price: 25, kind: 'sale', photoUri: null, notes: '', sold: false, createdAt: '2026-11-01', ...extra,
});

describe('which theme each build wears', () => {
  it('gives the Phil build the layered theme and everyone else the original', () => {
    setVariant('phil');
    expect(theme().name).toBe('phil');
    expect(theme().colors).toEqual(PHIL_COLORS);
    expect(theme().display).toBe(DISPLAY_FONT);
    setVariant(undefined);
    expect(theme().name).toBe('closedTest');
    expect(theme().colors).toEqual(CLOSED_COLORS);
    expect(theme().display).toBeUndefined();
    process.env.EXPO_PUBLIC_APP_VARIANT = 'something else';
    expect(theme().name).toBe('closedTest');
    expect(themeFor('closedTest').name).toBe('closedTest');
    expect(themeFor('phil').name).toBe('phil');
  });

  it('keeps the closed test palette exactly as it shipped', () => {
    expect(themeFor('closedTest').colors).toEqual({
      bg: '#F6F4EE', card: '#FFFFFF', ink: '#1F2A1F', soft: '#5E6B5E', line: '#DCD8CC', moss: '#3E6B3A', mossDark: '#2C4F29',
      mossTint: '#E4EEDF', warn: '#9A5B00', warnTint: '#FFF1D6', danger: '#A33A2B',
    });
  });

  it('keeps every closed test style exactly as it shipped', () => {
    const c = themeFor('closedTest').colors;
    const lift = { shadowColor: '#1F2A1F', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 };
    expect(styleDefs(themeFor('closedTest'))).toStrictEqual({
      screen: { padding: 16, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
      footer: { padding: 12, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.card },
      h: { fontSize: 18, fontWeight: '700', color: c.ink, marginTop: 8, marginBottom: 10 },
      note: { fontSize: 14, color: c.soft, marginBottom: 12, lineHeight: 20 },
      label: { fontSize: 14, fontWeight: '600', color: c.ink, marginBottom: 6 },
      hint: { fontSize: 12, color: c.soft, marginTop: 4 },
      input: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: c.ink },
      btn: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
      btnText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
      chip: { borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
      chipOn: { backgroundColor: c.moss, borderColor: c.moss },
      chipText: { fontSize: 14, color: c.ink, fontWeight: '500' },
      panel: { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.line, padding: 14, marginBottom: 12, ...lift },
      cardText: { backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.line, padding: 14, marginBottom: 12, ...lift },
      cardBody: { fontSize: 15, lineHeight: 22, color: c.ink },
      thumb: { borderRadius: 8, backgroundColor: c.mossTint, alignItems: 'center', justifyContent: 'center' },
      checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: c.line, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
      checkboxOn: { backgroundColor: c.moss, borderColor: c.moss },
      checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
    });
  });

  it('keeps the closed test buttons exactly as they shipped, even inside an action bar', () => {
    const t = themeFor('closedTest');
    const c = t.colors;
    for (const onDark of [false, true]) {
      expect(buttonLook(t, 'primary', false, onDark)).toStrictEqual({ box: { backgroundColor: c.moss }, text: { color: '#fff' } });
      expect(buttonLook(t, 'primary', true, onDark).box).toStrictEqual({ backgroundColor: c.mossDark });
      expect(buttonLook(t, 'secondary', false, onDark)).toStrictEqual({ box: { backgroundColor: c.card, borderColor: c.moss, borderWidth: 1.5 }, text: { color: c.moss } });
      expect(buttonLook(t, 'secondary', true, onDark).box).toStrictEqual({ backgroundColor: c.mossTint, borderColor: c.moss, borderWidth: 1.5 });
      expect(buttonLook(t, 'quiet', false, onDark)).toStrictEqual({ box: { backgroundColor: 'transparent', paddingHorizontal: 8 }, text: { color: c.moss } });
      expect(buttonLook(t, 'danger', false, onDark)).toStrictEqual({ box: { backgroundColor: 'transparent', borderColor: c.danger, borderWidth: 1 }, text: { color: c.danger } });
    }
  });
});

describe('the Phil theme’s layers', () => {
  const t = themeFor('phil');
  const defs = styleDefs(t);

  it('recesses the background and keeps the cream family', () => {
    expect(PHIL_COLORS.bg).toBe('#F0EBDD');
    expect(PHIL_COLORS.card).toBe('#FFFFFF');
    expect(PHIL_COLORS.bg).not.toBe(CLOSED_COLORS.bg);
  });

  it('raises cards and panels: white, 18 point radius, the layered shadow, no hairline border', () => {
    for (const key of ['panel', 'cardText']) {
      expect(defs[key]).toMatchObject({ backgroundColor: '#FFFFFF', borderRadius: 18, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } });
      expect(defs[key]).not.toHaveProperty('borderWidth');
      expect(defs[key]).not.toHaveProperty('borderColor');
    }
  });

  it('presses fields in: a fill under card white and a darker inner top edge', () => {
    expect(defs.input.backgroundColor).toBe(ACCENT.inset);
    expect(defs.input.backgroundColor).not.toBe(PHIL_COLORS.card);
    expect(defs.input.borderTopWidth).toBeGreaterThan(defs.input.borderWidth as number);
    expect(defs.input.borderTopColor).toBe(ACCENT.insetTop);
  });

  it('floats the bars and primary buttons highest, with chips lightest', () => {
    expect(PHIL_SHADOW.floating.shadowOpacity).toBeGreaterThan(PHIL_SHADOW.raised.shadowOpacity);
    expect(PHIL_SHADOW.floating.shadowRadius).toBeGreaterThan(PHIL_SHADOW.raised.shadowRadius);
    expect(PHIL_SHADOW.chip.shadowRadius).toBeLessThan(PHIL_SHADOW.raised.shadowRadius);
    expect(defs.footer.backgroundColor).toBe('#1E4D3B');
    expect(buttonLook(t, 'primary', false, false).box).toMatchObject({ shadowOpacity: PHIL_SHADOW.floating.shadowOpacity });
    expect(buttonLook(t, 'primary', false, true).box).toMatchObject({ backgroundColor: ACCENT.cream, shadowOpacity: PHIL_SHADOW.floating.shadowOpacity });
  });

  it('uses gold only as an accent, always with dark text', () => {
    expect(ACCENT.gold).toBe('#C9A227');
    expect(ACCENT.deep).toBe('#1E4D3B');
    expect(ACCENT.deepDark).toBe('#143629');
    expect(ACCENT.goldInk).toBe(PHIL_COLORS.ink);
    expect(defs.headTick.backgroundColor).toBe(ACCENT.gold);
    expect(defs.headText).toMatchObject({ textTransform: 'uppercase', letterSpacing: 1.4, color: PHIL_COLORS.soft });
  });

  it('colors the rundown statuses as briefed', () => {
    expect(STAGE_LOOK.won).toEqual({ backgroundColor: '#E4EEDF', color: '#1F2A1F' });
    expect(STAGE_LOOK.contacted).toEqual({ backgroundColor: '#FFF1D6', color: '#1F2A1F' });
    expect(STAGE_LOOK.paid).toEqual({ backgroundColor: '#3E6B3A', color: '#FFFFFF' });
    expect(STAGE_LOOK.shipped).toEqual({ backgroundColor: '#1E4D3B', color: '#FFFFFF' });
  });

  it('blends the band gradient from the deep green down to the darker one', () => {
    expect(mixHex(ACCENT.deep, ACCENT.deepDark, 0)).toBe('#1E4D3B');
    expect(mixHex(ACCENT.deep, ACCENT.deepDark, 1)).toBe('#143629');
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('the Phil pieces render', () => {
  it('prints the app name in the header band and keeps the maker line for the cards the app makes', () => {
    setVariant('phil');
    const html = renderToStaticMarkup(<BrandBand />);
    expect(html).toContain('Skrybix');
    expect(html).not.toContain(originLine());
    expect(html).not.toContain('Made with');
    expect(appName()).toBe('Skrybix');
  });

  it('puts a SOLD chip on a sold plant and none on a plant for sale', () => {
    const thumb = <span />;
    const row = (p: Plant) => renderToStaticMarkup(<PlantRow plant={p} picking={false} on={false} index={-1} thumb={thumb} onPress={() => undefined} />);
    const sold = row(plant({ sold: true }));
    expect(sold).toContain('SOLD');
    expect(sold).toContain('Hoya carnosa Krimson Queen');
    expect(sold).toContain('$25');
    expect(row(plant())).not.toContain('SOLD');
    expect(renderToStaticMarkup(<SoldChip />)).toContain('SOLD');
  });

  it('shows a price in a pill, or plain words when there is no price yet', () => {
    const row = (p: Plant) => renderToStaticMarkup(<PlantRow plant={p} picking={false} on={false} index={-1} thumb={<span />} onPress={() => undefined} />);
    expect(row(plant({ price: 12.5 }))).toContain('$12.50');
    expect(row(plant({ price: 40, kind: 'auction' }))).toContain('Opens at $40');
    expect(row(plant({ price: null }))).toContain('No price yet');
  });

  it('writes each status chip and the deadline chip with their words intact', () => {
    expect(renderToStaticMarkup(<StageChip stage="paid" reached>Paid</StageChip>)).toContain('Paid');
    expect(renderToStaticMarkup(<StageChip stage="shipped" reached={false}>Shipped</StageChip>)).toContain('Shipped');
    expect(renderToStaticMarkup(<DeadlineChip>Monday, November 2 at 7:00 PM Eastern</DeadlineChip>)).toContain('7:00 PM Eastern');
  });
});
