import type { TextStyle, ViewStyle } from 'react-native';
import { ACCENT, type Theme } from './theme';

type Def = ViewStyle & TextStyle;
type Defs = Record<string, Def>;

// A soft lift so cards read as raised, not just outlined boxes. (The closed test build's, unchanged.)
const closedCardShadow = {
  shadowColor: '#1F2A1F',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 2,
};

/** Three layers: cards and panels are raised, buttons and bars float highest, chips are small raised pieces. */
export const PHIL_SHADOW = {
  raised: { shadowColor: ACCENT.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 },
  floating: { shadowColor: ACCENT.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 10 },
  bar: { shadowColor: ACCENT.shadow, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 14 },
  chip: { shadowColor: ACCENT.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.14, shadowRadius: 3, elevation: 1 },
};

/** Every shared style of the app. The closed test build gets exactly what it always had. */
export function styleDefs(t: Theme): Defs {
  const c = t.colors;
  if (t.name === 'closedTest') {
    return {
      screen: { padding: 16, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
      footer: { padding: 12, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.card },
      h: { fontSize: 18, fontWeight: '700', color: c.ink, marginTop: 8, marginBottom: 10 },
      note: { fontSize: 14, color: c.soft, marginBottom: 12, lineHeight: 20 },
      label: { fontSize: 14, fontWeight: '600', color: c.ink, marginBottom: 6 },
      hint: { fontSize: 12, color: c.soft, marginTop: 4 },
      input: {
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: c.ink,
      },
      btn: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
      btnText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
      chip: {
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.card,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
      },
      chipOn: { backgroundColor: c.moss, borderColor: c.moss },
      chipText: { fontSize: 14, color: c.ink, fontWeight: '500' },
      panel: {
        backgroundColor: c.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.line,
        padding: 14,
        marginBottom: 12,
        ...closedCardShadow,
      },
      cardText: {
        backgroundColor: c.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.line,
        padding: 14,
        marginBottom: 12,
        ...closedCardShadow,
      },
      cardBody: { fontSize: 15, lineHeight: 22, color: c.ink },
      thumb: { borderRadius: 8, backgroundColor: c.mossTint, alignItems: 'center', justifyContent: 'center' },
      checkbox: {
        width: 22,
        height: 22,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: c.line,
        backgroundColor: c.card,
        alignItems: 'center',
        justifyContent: 'center',
      },
      checkboxOn: { backgroundColor: c.moss, borderColor: c.moss },
      checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
    };
  }

  const card = { backgroundColor: c.card, borderRadius: 16, padding: 16, marginBottom: 14, ...PHIL_SHADOW.raised };
  return {
    screen: { padding: 16, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
    footer: {
      padding: 12,
      backgroundColor: ACCENT.deep,
      borderTopWidth: 2,
      borderTopColor: ACCENT.gold,
      ...PHIL_SHADOW.bar,
    },
    h: { fontSize: 18, fontWeight: '700', color: c.ink, marginTop: 8, marginBottom: 10, ...(t.display ? { fontFamily: t.display, fontWeight: 'normal' } : {}) },
    // Section headers: small, spaced capitals in the soft color, with a short gold tick ahead of the words.
    headRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 10 },
    headTick: { width: 14, height: 3, borderRadius: 2, backgroundColor: ACCENT.gold, marginRight: 8 },
    headText: { flexShrink: 1, fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: c.soft },
    note: { fontSize: 14, color: c.soft, marginBottom: 12, lineHeight: 20 },
    label: { fontSize: 14, fontWeight: '600', color: c.ink, marginBottom: 6 },
    hint: { fontSize: 12, color: c.soft, marginTop: 4 },
    // Fields are pressed in: a fill under card white and a darker edge along the top, where an inset catches shadow.
    input: {
      backgroundColor: ACCENT.inset,
      borderWidth: 1,
      borderColor: ACCENT.insetEdge,
      borderTopWidth: 2,
      borderTopColor: ACCENT.insetTop,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: c.ink,
    },
    btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
    btnText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
    chip: { backgroundColor: c.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, ...PHIL_SHADOW.chip },
    chipOn: { backgroundColor: c.moss },
    chipText: { fontSize: 14, color: c.ink, fontWeight: '500' },
    panel: card,
    cardText: card,
    cardBody: { fontSize: 15, lineHeight: 22, color: c.ink },
    thumb: { borderRadius: 12, backgroundColor: c.mossTint, alignItems: 'center', justifyContent: 'center' },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: ACCENT.insetTop,
      backgroundColor: ACCENT.inset,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: c.moss, borderColor: c.moss },
    checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  };
}

export type ButtonKind = 'primary' | 'secondary' | 'quiet' | 'danger';

/** How a button looks. onDark is true inside the deep green action bars. Closed test: exactly the old look. */
export function buttonLook(t: Theme, kind: ButtonKind, pressed: boolean, onDark: boolean): { box: ViewStyle; text: TextStyle } {
  const c = t.colors;
  if (t.name === 'closedTest') {
    return {
      box:
        kind === 'primary'
          ? { backgroundColor: pressed ? c.mossDark : c.moss }
          : kind === 'secondary'
            ? { backgroundColor: pressed ? c.mossTint : c.card, borderColor: c.moss, borderWidth: 1.5 }
            : kind === 'quiet'
              ? { backgroundColor: 'transparent', paddingHorizontal: 8 }
              : { backgroundColor: 'transparent', borderColor: c.danger, borderWidth: 1 },
      text:
        kind === 'primary' ? { color: '#fff' } : kind === 'danger' ? { color: c.danger } : { color: c.moss },
    };
  }
  if (onDark) {
    // On the deep green bars the main button is cream and floats; the others sit on the bar in cream.
    return {
      box:
        kind === 'primary'
          ? { backgroundColor: pressed ? '#E6DFC8' : ACCENT.cream, ...PHIL_SHADOW.floating }
          : kind === 'secondary'
            ? { backgroundColor: pressed ? 'rgba(246,241,226,0.16)' : 'transparent', borderColor: ACCENT.cream, borderWidth: 1.5 }
            : kind === 'quiet'
              ? { backgroundColor: 'transparent', paddingHorizontal: 8 }
              : { backgroundColor: 'transparent', borderColor: '#F2B8AE', borderWidth: 1 },
      text:
        kind === 'primary' ? { color: ACCENT.deep } : kind === 'danger' ? { color: '#F2B8AE' } : { color: ACCENT.cream },
    };
  }
  return {
    box:
      kind === 'primary'
        ? { backgroundColor: pressed ? c.mossDark : c.moss, ...PHIL_SHADOW.floating }
        : kind === 'secondary'
          ? { backgroundColor: pressed ? c.mossTint : c.card, borderColor: c.moss, borderWidth: 1.5, ...PHIL_SHADOW.chip }
          : kind === 'quiet'
            ? { backgroundColor: 'transparent', paddingHorizontal: 8 }
            : { backgroundColor: 'transparent', borderColor: c.danger, borderWidth: 1 },
    text: kind === 'primary' ? { color: '#fff' } : kind === 'danger' ? { color: c.danger } : { color: c.moss },
  };
}
