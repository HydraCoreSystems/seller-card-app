import { Note, Screen } from '../../ui/kit';
import { metaDemoEnabled } from '../../core/metaDemo';
import { META_COPY } from '../../core/metaDemoCopy';
import MetaPosts from '../../screens/MetaPosts';

export default function MetaPostsRoute() {
  return metaDemoEnabled() ? <MetaPosts /> : <Screen><Note>{META_COPY.notHere}</Note></Screen>;
}
