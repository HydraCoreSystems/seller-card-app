import { Note, Screen } from '../../ui/kit';
import { metaDemoEnabled } from '../../core/metaDemo';
import { META_COPY } from '../../core/metaDemoCopy';
import MetaCreate from '../../screens/MetaCreate';

export default function MetaCreateRoute() {
  return metaDemoEnabled() ? <MetaCreate /> : <Screen><Note>{META_COPY.notHere}</Note></Screen>;
}
