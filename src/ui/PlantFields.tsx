import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { suggestName } from '../core/nomenclature';
import { isPhil } from '../core/variant';
import { MAX_PHOTOS } from '../core/photos';
import { formatPrice, parsePrice } from '../core/text';
import { pickPhoto } from '../lib/photos';
import { Button, Choice, Field, Panel, Row, colors } from './kit';
import { ViewablePhoto } from './PhotoViewer';

export interface PlantDraft {
  name: string;
  noid: boolean;
  priceText: string;
  description: string;
  /** Every photo, first one first. The first is the one posted on the listing. */
  photoUris: string[];
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
  memory,
}: {
  draft: PlantDraft;
  onChange: (d: PlantDraft) => void;
  priceLabel?: string;
  descriptionLabel?: string;
  /** A quiet line under the price: what this plant name last sold for. */
  memory?: string | null;
}) {
  const set = <K extends keyof PlantDraft>(k: K, v: PlantDraft[K]) => onChange({ ...draft, [k]: v });
  const badPrice = draft.priceText.trim() !== '' && parsePrice(draft.priceText) === null;

  const [kept, setKept] = useState<string | null>(null);
  const phil = isPhil();
  const full = phil && draft.photoUris.length >= MAX_PHOTOS;
  const takePhoto = async (source: 'camera' | 'library') => {
    const uri = await pickPhoto(source);
    // The closed test build holds one photo, and a new one replaces it.
    if (uri) set('photoUris', phil ? [...draft.photoUris, uri] : [uri]);
  };
  // The name corrector only offers. Nothing changes until the seller taps Use this.
  const help = !phil || draft.noid || !draft.name.trim() ? null : suggestName(draft.name);
  const showHelp = help && kept !== draft.name && (help.changed || help.spelling);

  return (
    <View>
      {draft.photoUris.map((uri, i) => (
        <View key={uri} style={{ marginBottom: 10 }}>
          {draft.photoUris.length > 1 ? <Text style={{ color: colors.soft, marginBottom: 4 }}>{i === 0 ? 'Photo 1, for the listing' : `Photo ${i + 1}, for a reply`}</Text> : null}
          <ViewablePhoto uri={uri}>
            <Image
              source={{ uri }}
              style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: colors.mossTint }}
              resizeMode="cover"
              accessibilityLabel="Plant photo. Tap to view full size."
            />
          </ViewablePhoto>
          {phil ? <Button kind="quiet" title="Remove this photo" onPress={() => set('photoUris', draft.photoUris.filter((u) => u !== uri))} /> : null}
        </View>
      ))}
      <Row style={{ marginBottom: 14 }}>
        <Button title={draft.photoUris.length ? (phil ? 'Add another photo' : 'New photo') : 'Take photo'} onPress={() => takePhoto('camera')} disabled={full} style={{ flex: 1 }} />
        <Button kind="secondary" title="Choose photo" onPress={() => takePhoto('library')} disabled={full} style={{ flex: 1 }} />
      </Row>
      <Field
        label="Plant name"
        value={draft.name}
        onChangeText={(v) => set('name', v)}
        placeholder={draft.noid ? 'Hoya, or leave blank' : 'Hoya carnosa Krimson Queen'}
        autoCapitalize="words"
      />
      {showHelp ? (
        <Panel style={{ marginTop: -6 }}>
          <Text style={{ color: colors.soft, fontSize: 13 }}>You typed</Text>
          <Text style={{ color: colors.ink, marginBottom: 8 }}>{help.typed}</Text>
          {help.changed ? (
            <>
              <Text style={{ color: colors.soft, fontSize: 13 }}>Written the usual way</Text>
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{help.formatted}</Text>
              <Button kind="secondary" title="Use this" onPress={() => set('name', help.formatted)} style={{ marginVertical: 6 }} />
            </>
          ) : null}
          {help.spelling ? (
            <>
              <Text style={{ color: colors.soft, fontSize: 13 }}>Close to a name I know. Did you mean</Text>
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{help.spelling}</Text>
              <Button kind="secondary" title="Use this spelling" onPress={() => set('name', help.spelling!)} style={{ marginVertical: 6 }} />
            </>
          ) : null}
          <Button kind="quiet" title="Keep what I typed" onPress={() => setKept(draft.name)} />
        </Panel>
      ) : null}
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
      {memory && !badPrice ? <Text style={{ color: colors.soft, fontSize: 13, marginTop: -8, marginBottom: 12 }}>{memory}</Text> : null}
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
