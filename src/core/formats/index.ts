import type { FormatId } from '../types';
import { commons } from './commons';
import { generic } from './generic';
import type { CardFormat } from './types';

export type { CardFormat } from './types';

/** Every format the app knows. Format packs register here. */
export const FORMATS: Record<FormatId, CardFormat> = { commons, generic };

export const FORMAT_LIST: CardFormat[] = [commons, generic];

export function getFormat(id: FormatId): CardFormat {
  return FORMATS[id] ?? generic;
}
