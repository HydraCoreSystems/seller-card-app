import { describe, expect, it } from 'vitest';
import { formatPlantName, suggestName } from '../src/core/nomenclature';
import { DASH_PATTERN } from '../src/core/text';

describe('plant name format', () => {
  it('capitalizes the genus and lowercases the species epithet', () => {
    expect(formatPlantName('HOYA CARNOSA')).toBe('Hoya carnosa');
    expect(formatPlantName('hoya Kerrii')).toBe('Hoya kerrii');
    expect(formatPlantName('Hoya')).toBe('Hoya');
  });

  it('puts the cultivar in single quotes, each word capitalized', () => {
    expect(formatPlantName('Hoya carnosa Krimson Queen')).toBe("Hoya carnosa 'Krimson Queen'");
    expect(formatPlantName('hoya carnosa krimson queen')).toBe("Hoya carnosa 'Krimson Queen'");
    expect(formatPlantName('Hoya carnosa cv. Tricolor')).toBe("Hoya carnosa 'Tricolor'");
    expect(formatPlantName('Hoya carnosa "krimson princess"')).toBe("Hoya carnosa 'Krimson Princess'");
    expect(formatPlantName("Monstera deliciosa 'thai constellation'")).toBe("Monstera deliciosa 'Thai Constellation'");
  });

  it('keeps capitals the seller typed inside a cultivar word', () => {
    expect(formatPlantName("Hoya carnosa 'MoonStar'")).toBe("Hoya carnosa 'MoonStar'");
  });

  it('places the hybrid marker before the epithet, or before the genus', () => {
    expect(formatPlantName('Hoya carnosa x pubicalyx')).toBe('Hoya carnosa × pubicalyx');
    expect(formatPlantName('Hoya x multiflora')).toBe('Hoya × multiflora');
    expect(formatPlantName('x Hoya')).toBe('× Hoya');
  });

  it('writes rank words and qualifiers in lowercase with a period', () => {
    expect(formatPlantName('Hoya carnosa VAR. compacta')).toBe('Hoya carnosa var. compacta');
    expect(formatPlantName('Hoya AFF. carnosa')).toBe('Hoya aff. carnosa');
  });

  it('leaves what follows sp. as typed', () => {
    expect(formatPlantName('Hoya sp. Sumatra')).toBe('Hoya sp. Sumatra');
  });

  it('tidies spaces and gives nothing back for nothing', () => {
    expect(formatPlantName('  hoya   obovata ')).toBe('Hoya obovata');
    expect(formatPlantName('   ')).toBe('');
  });
});

describe('name suggestions', () => {
  it('offers the formatted name beside what was typed, and marks when it differs', () => {
    const s = suggestName('hoya carnosa krimson queen');
    expect(s.typed).toBe('hoya carnosa krimson queen');
    expect(s.formatted).toBe("Hoya carnosa 'Krimson Queen'");
    expect(s.changed).toBe(true);
    expect(suggestName("Hoya carnosa 'Krimson Queen'").changed).toBe(false);
  });

  it('suggests a close known spelling for a typo, and never an exact match', () => {
    expect(suggestName('Hoya publicalyx').spelling).toBe('Hoya pubicalyx');
    expect(suggestName('Hoya karnosa').spelling).toBe('Hoya carnosa');
    expect(suggestName('Monsterra deliciosa').spelling).toBe('Monstera deliciosa');
    expect(suggestName('Hoya pubicalyx').spelling).toBeNull();
  });

  it('stays quiet about a name it does not know', () => {
    expect(suggestName('Hoya zzzzzzzz').spelling).toBeNull();
    expect(suggestName('Kalanchoe thyrsiflora').spelling).toBeNull();
  });

  it('keeps the cultivar when it swaps a misspelled epithet', () => {
    expect(suggestName('hoya karnosa krimson queen').spelling).toBe("Hoya carnosa 'Krimson Queen'");
  });

  it('never puts a dash in a name it makes', () => {
    expect(DASH_PATTERN.test(suggestName('Hoya publicalyx').formatted)).toBe(false);
  });
});
