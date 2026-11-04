// The browser preview cannot read pictures, so the screenshot route is not offered there.
export const ocrAvailable = false;

export interface ScreenRead {
  screens: string[][];
  failed: number;
}

export async function readScreenshots(): Promise<ScreenRead | null> {
  return null;
}
