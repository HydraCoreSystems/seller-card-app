import { useState } from 'react';
import { growerNumber } from '../core/formats/commons';
import type { FormatId, Profile } from '../core/types';
import { makeCardImage } from '../lib/cardImage';
import { saveToGallery } from '../lib/stampPhoto';
import { Button } from './kit';

/**
 * Saves the card as an image with the Commons Verified Grower banner across the top.
 * Shows only in the Commons format, and only once the seller has entered a grower number.
 */
export function CardImageButton({ text, profile, formatId }: { text: string; profile: Profile; formatId: FormatId }) {
  // The label belongs to the card it was made for; a changed card starts fresh.
  const [made, setMade] = useState<{ text: string; label: string } | null>(null);
  const state = made?.text === text ? made.label : null;
  const setState = (label: string) => setMade({ text, label });
  const number = growerNumber(profile, formatId);
  if (!number) return null;
  const busy = state === 'Making the card image';
  return (
    <Button
      kind="secondary"
      title={state ?? 'Save the card image'}
      disabled={busy}
      onPress={async () => {
        setState('Making the card image');
        try {
          const uri = await makeCardImage(text, { number, name: profile.sellerName, business: profile.growerBusiness ?? '' });
          setState((await saveToGallery([uri])) ? '✓ Saved to your photos' : 'Photos not allowed');
        } catch {
          setState('Something went wrong');
        }
      }}
      style={{ marginBottom: 12 }}
    />
  );
}
