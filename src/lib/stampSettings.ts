import { DEFAULT_SETTINGS, type StampStyle } from '../core/settings';

/**
 * The watermark style stamped photos are made with right now. The store keeps it current, so a photo
 * stamped anywhere in the app follows Settings without every caller passing it along.
 */
let current: StampStyle = DEFAULT_SETTINGS.stamp;

export const setStampStyle = (s: StampStyle): void => {
  current = s;
};

export const stampStyle = (): StampStyle => current;
