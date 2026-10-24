import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { toDay } from '../core/text';
import type { Profile } from '../core/types';
import { saveToGallery, stampPhoto } from '../lib/stampPhoto';
import { Button, colors } from './kit';

const cache = new Map<string, Promise<string>>();

/** Makes (once) the stamped copy of a photo for today. */
export function getStamped(photoUri: string, profile: Profile, day = toDay(new Date())): Promise<string> {
  const key = [photoUri, profile.sellerName, profile.sellerNumber, day].join('|');
  let p = cache.get(key);
  if (!p) {
    p = stampPhoto({ photoUri, sellerName: profile.sellerName, sellerNumber: profile.sellerNumber, day });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export function useStamped(photoUri: string | null, profile: Profile | null) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState(false);
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
  }, [photoUri, profile?.sellerName, profile?.sellerNumber]);
  return { uri, error };
}

export function StampedPhoto({ photoUri, profile }: { photoUri: string | null; profile: Profile | null }) {
  const { uri, error } = useStamped(photoUri, profile);
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(false), [uri]);
  if (!photoUri) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: colors.mossTint }}
          resizeMode="contain"
          accessibilityLabel="Stamped photo"
        />
      ) : (
        <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
          {error ? <Text style={{ color: colors.danger }}>Couldn't stamp this photo.</Text> : <ActivityIndicator color={colors.moss} />}
        </View>
      )}
      <Button
        kind="secondary"
        title={saved ? 'Saved to your photos' : 'Save stamped photo'}
        disabled={!uri}
        onPress={async () => {
          if (uri && (await saveToGallery([uri]))) setSaved(true);
        }}
        style={{ marginTop: 10 }}
      />
    </View>
  );
}
