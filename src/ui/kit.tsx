import * as Clipboard from 'expo-clipboard';
import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { READABLE_WIDTH } from '../core/layout';
import { useSizeClass } from './layout';
import { buttonLook, styleDefs } from './styleDefs';
import { theme } from './theme';

/** The theme this build wears: the closed test build keeps the original look, the Phil build gets the layered one. */
export const T = theme();
export const colors = T.colors;

/** True inside the deep green action bars, where buttons switch to cream. */
const OnBar = createContext(false);

/**
 * One screen. On a compact width it is a single scrolling column. On a regular width, plain content
 * is kept to a readable column, and a screen that has two things to show side by side passes them as
 * `panes`: two equal panes that scroll on their own, with the gutter at the middle, so an open
 * foldable's fold falls between them. On a compact width the same two things simply follow each other.
 */
export function Screen({ children, footer, panes }: { children?: ReactNode; footer?: ReactNode; panes?: [ReactNode, ReactNode] }) {
  // Android draws edge to edge, so keep buttons clear of the system navigation bar.
  const { bottom } = useSafeAreaInsets();
  const regular = useSizeClass() === 'regular';
  const scrollProps = {
    keyboardShouldPersistTaps: 'handled' as const,
    // Clears the fixed footer bar (which sits outside the scroll content, on top of
    // the keyboard) so a focused field isn't hidden behind it either.
    bottomOffset: footer ? 70 : 20,
  };
  const pad = [styles.screen, !footer && { paddingBottom: 40 + bottom }];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {panes && regular ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {panes.map((pane, i) => (
            <View key={i} style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
              <KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={pad} {...scrollProps}>
                {pane}
              </KeyboardAwareScrollView>
            </View>
          ))}
        </View>
      ) : (
        <KeyboardAwareScrollView contentContainerStyle={pad} {...scrollProps}>
          <View style={regular ? { width: '100%', maxWidth: READABLE_WIDTH, alignSelf: 'center' } : undefined}>
            {panes ?? children}
          </View>
        </KeyboardAwareScrollView>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: 12 + bottom }]}>
          <OnBar.Provider value={T.name === 'phil'}>{footer}</OnBar.Provider>
        </View>
      ) : null}
    </View>
  );
}

export function H({ children }: { children: ReactNode }) {
  if (T.name === 'phil') {
    return (
      <View style={styles.headRow}>
        <View style={styles.headTick} />
        <Text style={styles.headText}>{children}</Text>
      </View>
    );
  }
  return <Text style={styles.h}>{children}</Text>;
}

export function Note({ children, tone }: { children: ReactNode; tone?: 'warn' }) {
  return <Text style={[styles.note, tone === 'warn' && { color: colors.warn }]}>{children}</Text>;
}

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#9AA39A"
        style={[styles.input, props.multiline && { minHeight: 72, textAlignVertical: 'top' }]}
        accessibilityLabel={label}
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  style,
  big,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
  /** Larger, for a screen read from arm's length, like packing with the phone propped open. */
  big?: boolean;
}) {
  const onBar = useContext(OnBar);
  const [scale] = useState(() => new Animated.Value(1));
  const animateTo = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => animateTo(0.96)}
        onPressOut={() => animateTo(1)}
        disabled={disabled}
        style={({ pressed }) => [styles.btn, buttonLook(T, kind, pressed, onBar).box, big && { paddingVertical: 20 }, disabled && { opacity: 0.4 }]}
      >
        <Text style={[styles.btnText, buttonLook(T, kind, false, onBar).text, big && { fontSize: 20 }]}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && { color: '#fff' }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Checkboxes<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T[];
  options: { value: T; label: string }[];
  onChange: (v: T[]) => void;
}) {
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={{ gap: 10 }}>
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(o.value)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <View style={[styles.checkbox, on && styles.checkboxOn]}>
                {on ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.chipText}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function useCopy(): [string | null, (key: string, text: string) => Promise<void>] {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
  };
  return [copied, copy];
}

/** A finished card: the exact text that gets pasted, with its copy button. */
export function CardText({ text, copyKey, label = 'Copy text' }: { text: string; copyKey: string; label?: string }) {
  const [copied, copy] = useCopy();
  return (
    <View style={styles.cardText}>
      <Text selectable style={styles.cardBody}>
        {text}
      </Text>
      <Button
        title={copied === copyKey ? '✓ Copied' : label}
        onPress={() => copy(copyKey, text)}
        style={{ marginTop: 10 }}
      />
    </View>
  );
}

export function Thumb({ uri, size = 56 }: { uri: string | null; size?: number }) {
  if (!uri) {
    return (
      <View style={[styles.thumb, { width: size, height: size }]}>
        <Text style={{ color: colors.soft, fontSize: 11 }}>No photo</Text>
      </View>
    );
  }
  if (T.name === 'phil') {
    // A thin inner edge, so the photo reads as set into its card.
    return (
      <View style={[styles.thumb, { width: size, height: size, overflow: 'hidden' }]}>
        <Image source={{ uri }} style={{ width: size, height: size }} />
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(31,42,31,0.16)' }}
        />
      </View>
    );
  }
  return <Image source={{ uri }} style={[styles.thumb as ImageStyle, { width: size, height: size }]} />;
}

export const styles = StyleSheet.create(styleDefs(T));
