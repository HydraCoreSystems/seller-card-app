import { Linking } from 'react-native';
import { SKRYBIX_GUIDE_URL } from '../core/brand';
import { HELP_COPY, WALK_COPY } from '../core/guideCopy';
import { Button, H, Note } from './kit';

/** The profile's entries for the guide: the setup walkthrough, and Help when a guide is hosted. */
export function GuideEntries({ onWalk, onRoomWalk }: { onWalk: () => void; onRoomWalk?: () => void }) {
  return (
    <>
      <H>{WALK_COPY.replay}</H>
      <Note>{WALK_COPY.replayNote}</Note>
      <Button kind="secondary" title={WALK_COPY.replay} onPress={onWalk} style={{ marginBottom: 6 }} />
      {onRoomWalk ? <Button kind="secondary" title={WALK_COPY.addRoomWalk} onPress={onRoomWalk} style={{ marginBottom: 6 }} /> : null}
      {SKRYBIX_GUIDE_URL ? (
        <>
          <H>{HELP_COPY.title}</H>
          <Note>{HELP_COPY.note}</Note>
          <Button kind="secondary" title={HELP_COPY.button} onPress={() => Linking.openURL(SKRYBIX_GUIDE_URL).catch(() => undefined)} />
        </>
      ) : null}
    </>
  );
}
