import { useState } from 'react';
import { parsePrice } from '../core/text';
import { Field } from './kit';

/** One cost box. It saves as the seller types, so there is no save step to forget. */
export function CostBox({ label, value, onValue, hint }: { label: string; value: number | null | undefined; onValue: (n: number | null) => void; hint?: string }) {
  const [t, setT] = useState(value == null ? '' : String(value));
  return (
    <Field
      label={label}
      value={t}
      placeholder="Not entered"
      keyboardType="decimal-pad"
      hint={hint}
      onChangeText={(v) => {
        setT(v);
        onValue(parsePrice(v));
      }}
    />
  );
}
