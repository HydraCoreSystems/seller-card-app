import { Image, Text, View } from 'react-native';
import { DISPLAY_FONT } from './theme';
import { T, colors } from './kit';

/** An empty screen's one warm line, over a faint leaf cut from the app icon. */
export function EmptyState({ line }: { line: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 }}>
      <Image source={require('../../assets/leaf.png')} style={T.name === 'phil' ? { width: 132, height: 112, opacity: 0.22, marginBottom: 16 } : { width: 92, height: 78, opacity: 0.16, marginBottom: 14 }} accessibilityIgnoresInvertColors />
      <Text style={{ fontSize: T.name === 'phil' ? 17 : 15, lineHeight: 24, textAlign: 'center', color: colors.soft, ...(T.name === 'phil' ? { fontFamily: DISPLAY_FONT, color: colors.ink } : {}) }}>{line}</Text>
    </View>
  );
}
