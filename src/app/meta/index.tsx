import { Note, Screen } from '../../ui/kit';
import { metaDemoEnabled } from '../../core/metaDemo';
import { META_COPY } from '../../core/metaDemoCopy';
import MetaConnect from '../../screens/MetaConnect';

/** The Facebook Page demonstration lives in Phil's build only. */
export default function MetaConnectRoute() {
  return metaDemoEnabled() ? <MetaConnect /> : <Screen><Note>{META_COPY.notHere}</Note></Screen>;
}
