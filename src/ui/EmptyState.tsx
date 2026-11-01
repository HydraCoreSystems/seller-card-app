import { Image, Text, View } from 'react-native';
import { colors } from './kit';

/** An empty screen's one warm line, over a faint leaf cut from the app icon. */
export function EmptyState({ line }: { line: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 }}>
      <Image source={require('../../assets/leaf.png')} style={{ width: 92, height: 78, opacity: 0.16, marginBottom: 14 }} accessibilityIgnoresInvertColors />
      <Text style={{ fontSize: 15, lineHeight: 22, textAlign: 'center', color: colors.soft }}>{line}</Text>
    </View>
  );
}
