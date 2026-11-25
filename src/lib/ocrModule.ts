import { requireOptionalNativeModule } from 'expo';
import type { TextBox } from '../core/ocrLayout';

interface SkrybixOcrNative {
  isSupported: boolean;
  recognize(uri: string): Promise<TextBox[]>;
}

/** The on device reader. Null when this build has no such module, which the app says plainly. */
export const nativeOcr: SkrybixOcrNative | null = requireOptionalNativeModule<SkrybixOcrNative>('SkrybixOcr');
