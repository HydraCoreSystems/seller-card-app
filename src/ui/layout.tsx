import { Children, useState, type ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { columnsFor, sizeClassFor, type SizeClass } from '../core/layout';

/** Compact or regular, for the window the app is in right now. */
export function useSizeClass(): SizeClass {
  return sizeClassFor(useWindowDimensions().width);
}

/** Even columns for cards that look best at about `min` points wide, given the room the grid really has. */
export function Grid({ children, min = 260, gap = 12, max = 4 }: { children: ReactNode; min?: number; gap?: number; max?: number }) {
  const { width } = useWindowDimensions();
  const [room, setRoom] = useState(width - 32);
  const cols = columnsFor(room, min, gap, max);
  const items = Children.toArray(children);
  return (
    <View onLayout={(e) => setRoom(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 }}>
        {items.map((child, i) => (
          <View key={i} style={{ width: `${100 / cols}%`, paddingHorizontal: gap / 2 }}>
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}
