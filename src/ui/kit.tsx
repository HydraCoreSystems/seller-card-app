import * as Clipboard from 'expo-clipboard';
import { useState, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

export const colors = {
  bg: '#F6F4EE',
  card: '#FFFFFF',
  ink: '#1F2A1F',
  soft: '#5E6B5E',
  line: '#DCD8CC',
  moss: '#3E6B3A',
  mossDark: '#2C4F29',
  mossTint: '#E4EEDF',
  warn: '#9A5B00',
  warnTint: '#FFF1D6',
  danger: '#A33A2B',
};

export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

export function H({ children }: { children: ReactNode }) {
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
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' && { backgroundColor: pressed ? colors.mossDark : colors.moss },
        kind === 'secondary' && { backgroundColor: pressed ? colors.mossTint : colors.card, borderColor: colors.moss, borderWidth: 1.5 },
        kind === 'quiet' && { backgroundColor: 'transparent', paddingHorizontal: 8 },
        kind === 'danger' && { backgroundColor: 'transparent', borderColor: colors.danger, borderWidth: 1 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          kind === 'primary' && { color: '#fff' },
          (kind === 'secondary' || kind === 'quiet') && { color: colors.moss },
          kind === 'danger' && { color: colors.danger },
        ]}
      >
        {title}
      </Text>
    </Pressable>
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
        title={copied === copyKey ? 'Copied' : label}
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
  return <Image source={{ uri }} style={[styles.thumb, { width: size, height: size }]} />;
}

export const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
  footer: { padding: 12, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  h: { fontSize: 18, fontWeight: '700', color: colors.ink, marginTop: 8, marginBottom: 10 },
  note: { fontSize: 14, color: colors.soft, marginBottom: 12, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.soft, marginTop: 4 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  btn: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '600' },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.moss, borderColor: colors.moss },
  chipText: { fontSize: 14, color: colors.ink, fontWeight: '500' },
  panel: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 12,
  },
  cardText: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 12,
  },
  cardBody: { fontSize: 15, lineHeight: 22, color: colors.ink },
  thumb: {
    borderRadius: 8,
    backgroundColor: colors.mossTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
