import { Platform } from 'react-native';
import { DESK_PHONE_ONLY } from '../core/deskCopy';
import { Desk } from '../ui/desk/Desk';
import { Note, Screen } from '../ui/kit';

/** The computer version. It runs in a desktop browser; on the phone this page only says so. */
export default function DeskRoute() {
  if (Platform.OS !== 'web') {
    return (
      <Screen>
        <Note>{DESK_PHONE_ONLY}</Note>
      </Screen>
    );
  }
  return <Desk />;
}
