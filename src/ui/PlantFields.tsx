import { Image, Text, View } from 'react-native';
import { formatPrice, parsePrice } from '../core/text';
import { pickPhoto } from '../lib/photos';
import { Button, Choice, Field, Row, colors } from './kit';
import { ViewablePhoto } from './PhotoViewer';

export interface PlantDraft {
  name: string;
  noid: boolean;
  priceText: string;
  description: string;
  photoUri: string | null;
}

export function priceText(price: number | null): string {
  return price === null ? '' : formatPrice(price).replace('$', '');
}

export function draftPrice(d: PlantDraft): number | null {
  return parsePrice(d.priceText);
}

/** Photo, name, price and a few words. The whole of a listing. */
export function PlantFields({
  draft,
  onChange,
  priceLabel = 'Price',
  descriptionLabel = 'A few words',
}: {
  draft: PlantDraft;
  onChange: (d: PlantDraft) => void;
  priceLabel?: string;
  descriptionLabel?: string;
}) {
  const set = <K extends keyof PlantDraft>(k: K, v: PlantDraft[K]) => onChange({ ...draft, [k]: v });
  const badPrice = draft.priceText.trim() !== '' && parsePrice(draft.priceText) === null;

  const takePhoto = async (source: 'camera' | 'library') => {
    const uri = await pickPhoto(source);
    if (uri) set('photoUri', uri);
  };

  return (
    <View>
      {draft.photoUri ? (
        <ViewablePhoto uri={draft.photoUri}>
          <Image
            source={{ uri: draft.photoUri }}
            style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12, marginBottom: 10, backgroundColor: colors.mossTint }}
            resizeMode="cover"
            accessibilityLabel="Plant photo. Tap to view full size."
          />
        </ViewablePhoto>
      ) : null}
      <Row style={{ marginBottom: 14 }}>
        <Button title={draft.photoUri ? 'New photo' : 'Take photo'} onPress={() => takePhoto('camera')} style={{ flex: 1 }} />
        <Button kind="secondary" title="Choose photo" onPress={() => takePhoto('library')} style={{ flex: 1 }} />
      </Row>
      <Field
        label="Plant name"
        value={draft.name}
        onChangeText={(v) => set('name', v)}
        placeholder={draft.noid ? 'Hoya, or leave blank' : 'Hoya carnosa Krimson Queen'}
        autoCapitalize="words"
      />
      <Choice
        label="Is the name confirmed?"
        value={draft.noid ? 'noid' : 'named'}
        options={[
          { value: 'named', label: 'Yes' },
          { value: 'noid', label: 'No, it’s a NOID' },
        ]}
        onChange={(v) => set('noid', v === 'noid')}
      />
      <Field
        label={priceLabel}
        value={draft.priceText}
        onChangeText={(v) => set('priceText', v)}
        placeholder="25"
        keyboardType="decimal-pad"
      />
      {badPrice ? <Text style={{ color: colors.danger, marginTop: -8, marginBottom: 12 }}>Type the price as a number, like 25.</Text> : null}
      <Field
        label={descriptionLabel}
        value={draft.description}
        onChangeText={(v) => set('description', v)}
        placeholder="Rooted, 6 leaves, new growth"
        multiline
      />
    </View>
  );
}
