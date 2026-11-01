/** A plant or lot can hold several photos. The first is the one posted on the listing; the rest are extra views for replies. */
export interface HasPhotos {
  photoUri: string | null;
  photoUris?: string[];
}

export const MAX_PHOTOS = 8;

/** Every photo, first one first. Older plants hold one photo in photoUri alone. */
export function photosOf(item: HasPhotos | null | undefined): string[] {
  if (!item) return [];
  if (item.photoUris?.length) return item.photoUris;
  return item.photoUri ? [item.photoUri] : [];
}

/** The photo fields for a list of photos: photoUri stays the first so older code keeps working. */
export function photoFields(uris: string[]): { photoUri: string | null; photoUris: string[] } {
  const clean = [...new Set(uris.filter(Boolean))].slice(0, MAX_PHOTOS);
  return { photoUri: clean[0] ?? null, photoUris: clean };
}

/** Photos a plant used to hold that it no longer does, so the files can be cleared. */
export function droppedPhotos(before: HasPhotos | null | undefined, after: string[]): string[] {
  const keep = new Set(after);
  return photosOf(before).filter((u) => !keep.has(u));
}
