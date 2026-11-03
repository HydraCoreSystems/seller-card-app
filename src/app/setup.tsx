import { useLocalSearchParams } from 'expo-router';
import SetupWalk from '../screens/SetupWalk';

/** The setup walk. No parameters is the first launch walk; mode replay or room reruns it from the profile. */
export default function SetupScreen() {
  const { mode, venue } = useLocalSearchParams<{ mode?: string; venue?: string }>();
  return <SetupWalk mode={mode === 'replay' ? 'replay' : mode === 'room' ? 'room' : 'first'} venue={venue} />;
}
