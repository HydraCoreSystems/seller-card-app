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
import { buttonLook, styleDefs } from './styleDefs';
import { theme } from './theme';

/** The theme this build wears: the closed test build keeps the original look, the Phil build gets the layered one. */
export const T = theme();
export const colors = T.colors;

/** True inside the deep green action bars, where buttons switch to cream. */
const OnBar = createContext(false);

export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  // Android draws edge to edge, so keep buttons clear of the system navigation bar.
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.screen, !footer && { paddingBottom: 40 + bottom }]}
        keyboardShouldPersistTaps="handled"
        // Clears the fixed footer bar (which sits outside the scroll content, on top of
        // the keyboard) so a focused field isn't hidden behind it either.
        bottomOffset={footer ? 70 : 20}
      >
        {children}
      </KeyboardAwareScrollView>
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
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
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
        style={({ pressed }) => [styles.btn, buttonLook(T, kind, pressed, onBar).box, disabled && { opacity: 0.4 }]}
      >
        <Text style={[styles.btnText, buttonLook(T, kind, false, onBar).text]}>{title}</Text>
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
