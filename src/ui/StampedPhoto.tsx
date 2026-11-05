import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { markerFor, stampFor } from '../core/marker';
import { toDay } from '../core/text';
import type { Profile } from '../core/types';
import { stampKey } from '../core/settings';
import { saveToGallery, stampPhoto } from '../lib/stampPhoto';
import { stampStyle } from '../lib/stampSettings';
import { useStore } from '../lib/store';
import { Button, colors } from './kit';
import { ViewablePhoto } from './PhotoViewer';

const cache = new Map<string, Promise<string>>();

/**
 * Makes (once) the stamped copy of a photo for today. The profile is the one resolved for the
 * room the photo is for, so the band, the number and the circle all come from that room.
 */
export function getStamped(photoUri: string, profile: Profile, day = toDay(new Date())): Promise<string> {
  const style = stampStyle();
  // With the watermark off, the photo goes out as it is: no band and no circle.
  if (!style.on) return Promise.resolve(photoUri);
  const marker = markerFor(profile);
  const auto = stampFor(profile, day);
  const text = { ...auto, main: style.text.trim() || auto.main };
  const key = [photoUri, text.main, marker ? `${marker.style}:${marker.number}:${marker.venueName}` : '', day, stampKey(style)].join('|');
  let p = cache.get(key);
  if (!p) {
    p = stampPhoto({ photoUri, text, marker, style });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export function useStamped(photoUri: string | null, profile: Profile | null) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const style = useStore().settings.stamp;
  const stampId = profile ? `${stampFor(profile, 'x').main}|${markerFor(profile)?.number ?? ''}|${markerFor(profile)?.venueName ?? ''}|${stampKey(style)}` : '';
  useEffect(() => {
    let live = true;
    setUri(null);
    setError(false);
    if (photoUri && profile) {
      getStamped(photoUri, profile)
        .then((u) => live && setUri(u))
        .catch(() => live && setError(true));
    }
    return () => {
      live = false;
    };
  }, [photoUri, stampId]);
  return { uri, error };
}

/** One photo, stamped, with its own button to save the stamped copy to the phone. */
export function StampedPhoto({ photoUri, profile, label }: { photoUri: string | null; profile: Profile | null; label?: string }) {
  const { uri, error } = useStamped(photoUri, profile);
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(false), [uri]);
  if (!photoUri) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={{ color: colors.soft, marginBottom: 4 }}>{label}</Text> : null}
      {uri ? (
        <ViewablePhoto uri={uri}>
          <Image
            source={{ uri }}
            style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: colors.mossTint }}
            resizeMode="contain"
            accessibilityLabel="Stamped photo. Tap to view full size."
          />
        </ViewablePhoto>
      ) : (
        <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
          {error ? <Text style={{ color: colors.danger }}>Couldn't stamp this photo.</Text> : <ActivityIndicator color={colors.moss} />}
        </View>
      )}
      <Button
        kind="secondary"
        title={saved ? '✓ Saved to your photos' : 'Save stamped photo'}
        disabled={!uri}
        onPress={async () => {
          if (uri && (await saveToGallery([uri]))) setSaved(true);
        }}
        style={{ marginTop: 10 }}
      />
    </View>
  );
}

/** Every photo of a plant or lot, each stamped the same way, so the extra views can go in replies. */
export function StampedPhotos({ uris, profile }: { uris: string[]; profile: Profile | null }) {
  return (
    <View>
      {uris.map((u, i) => (
        <StampedPhoto key={u} photoUri={u} profile={profile} label={uris.length > 1 ? (i === 0 ? 'Photo 1, for the listing' : `Photo ${i + 1}, for a reply`) : undefined} />
      ))}
    </View>
  );
}
