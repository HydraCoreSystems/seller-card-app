import { isPhil } from '../core/variant';
import ProfileClassic from '../screens/ProfileClassic';
import ProfilePhil from '../screens/ProfilePhil';

/** The closed test build keeps its profile screen. The Phil build has rooms and the Pro setup. */
export default function ProfileScreen() {
  return isPhil() ? <ProfilePhil /> : <ProfileClassic />;
}
