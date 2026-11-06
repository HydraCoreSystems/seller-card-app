import { Note, Screen } from '../../ui/kit';
import { metaDemoEnabled } from '../../core/metaDemo';
import { META_COPY } from '../../core/metaDemoCopy';
import MetaComments from '../../screens/MetaComments';

export default function MetaCommentsRoute() {
  return metaDemoEnabled() ? <MetaComments /> : <Screen><Note>{META_COPY.notHere}</Note></Screen>;
}
