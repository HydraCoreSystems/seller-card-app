import { useState } from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';
import { formatClock, parseClock, parseDay, toDay } from '../core/text';
import type { SaleTime } from '../core/types';
import { Field, colors, styles } from './kit';

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function nextDays(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    out.push(toDay(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function chipLabel(day: string, i: number): string {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  const { y, m, d } = parseDay(day);
  return `${SHORT_DAYS[new Date(y, m - 1, d).getDay()]} ${SHORT_MONTHS[m - 1]} ${d}`;
}

/** A day row and a time box. Typing "8pm" works. */
export function WhenPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SaleTime | null;
  onChange: (t: SaleTime | null) => void;
}) {
  const days = nextDays(21);
  const [timeText, setTimeText] = useState(value ? formatClock(value.time) : '');
  const parsed = parseClock(timeText);
  const day = value?.day ?? null;

  const emit = (d: string | null, t: string | null) => onChange(d && t ? { day: d, time: t } : d ? { day: d, time: t ?? '' } : null);

  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 8 }}>
        {days.map((d, i) => {
          const on = d === day;
          return (
            <Pressable
              key={d}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => emit(on ? null : d, parsed)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && { color: '#fff' }]}>{chipLabel(d, i)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {day ? (
        <Field
          label="Time"
          value={timeText}
          onChangeText={(t) => {
            setTimeText(t);
            emit(day, parseClock(t));
          }}
          placeholder="8pm"
          hint={timeText && !parsed ? 'Try a time like 8pm or 7:30 PM.' : parsed ? formatClock(parsed) : undefined}
        />
      ) : null}
      {day && !parsed && timeText === '' ? <Text style={{ color: colors.soft, marginTop: -8, marginBottom: 10 }}>Add a time to finish.</Text> : null}
    </View>
  );
}

export function isComplete(t: SaleTime | null): t is SaleTime {
  return !!t && /^\d{4}-\d{2}-\d{2}$/.test(t.day) && /^\d{2}:\d{2}$/.test(t.time);
}
