import { useState } from 'react';
import { Text, View } from 'react-native';
import { showTime } from '../core/claims';
import { readIntake, type Flagged, type IntakeDraft } from '../core/intake';
import { INTAKE_COPY as C } from '../core/intakeCopy';
import type { ClaimOptions } from '../core/claims';
import { Button, Choice, Field, H, Note, Panel, Row, colors } from './kit';

/**
 * The claims read from screenshots, for the seller to confirm or trim before they are saved. The order is
 * not theirs to change: there is no way to move a claim here, only to take one off or fill one in at the
 * place it was seen. Every change is saved on the sale as it is made.
 */
export function IntakeReview({
  draft,
  options,
  lotNumbers,
  onChange,
  onSave,
  onDiscard,
}: {
  draft: IntakeDraft;
  options: ClaimOptions;
  lotNumbers: number[];
  onChange: (next: IntakeDraft) => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const intake = readIntake(draft, options);
  return (
    <>
      <H>{C.reviewTitle}</H>
      <Note>{C.reviewNote}</Note>
      {intake.report.lots.every((l) => !l.queue.length) ? <Note>{C.noClaims}</Note> : null}
      {intake.report.lots.map((entry) =>
        entry.queue.length ? (
          <Panel key={entry.lot}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 4 }}>
              Lot {entry.lot}
              {entry.label ? `: ${entry.label.replace(/^lot\s*#?\d+\s*[:.)]?\s*/i, '')}` : ''}
            </Text>
            {entry.queue.map((c, i) => (
              <View key={`${c.commentIndex}-${c.lot}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: i > 0 ? 1 : 0, borderColor: colors.line }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: i === 0 ? colors.moss : colors.mossTint }}>
                  <Text style={{ fontWeight: '700', fontSize: 13, color: i === 0 ? '#fff' : colors.mossDark }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: colors.ink }}>
                    {c.author}
                    <Text style={{ color: i === 0 ? colors.moss : colors.soft, fontWeight: '700', fontSize: 12 }}>{i === 0 ? `  ${C.winner}` : `  ${C.alternate}`}</Text>
                    {c.kind === 'backup' ? <Text style={{ color: colors.soft, fontWeight: '400' }}>  next in line</Text> : null}
                    {showTime(c.timeHint) ? <Text style={{ color: colors.soft, fontWeight: '400' }}>  {showTime(c.timeHint)}</Text> : null}
                  </Text>
                  <Text style={{ color: colors.soft, fontSize: 12 }}>{C.screenLabel(intake.screenOf(c.commentIndex) + 1)}</Text>
                </View>
                <Button
                  kind="quiet"
                  title={C.remove}
                  onPress={() => onChange({ ...draft, removed: [...draft.removed, intake.kept[c.commentIndex].origin] })}
                />
              </View>
            ))}
          </Panel>
        ) : null,
      )}

      {intake.flagged.length ? (
        <>
          <H>{C.flaggedTitle}</H>
          <Note>{C.flaggedNote}</Note>
          {intake.flagged.map((f) => (
            <FlaggedRow key={f.comment.origin} flagged={f} lotNumbers={lotNumbers} onAdd={(added) => onChange({ ...draft, added: { ...draft.added, [f.comment.origin]: added } })} onSkip={() => onChange({ ...draft, removed: [...draft.removed, f.comment.origin] })} />
          ))}
        </>
      ) : null}

      <Row style={{ marginVertical: 12 }}>
        <Button title={C.save} onPress={onSave} style={{ flex: 2 }} disabled={!intake.report.lots.some((l) => l.queue.length)} />
        <Button kind="secondary" title={C.discard} onPress={onDiscard} style={{ flex: 1 }} />
      </Row>
    </>
  );
}

function FlaggedRow({
  flagged,
  lotNumbers,
  onAdd,
  onSkip,
}: {
  flagged: Flagged;
  lotNumbers: number[];
  onAdd: (a: { name: string; lot: number; kind: 'claim' | 'next' }) => void;
  onSkip: () => void;
}) {
  const { comment, why } = flagged;
  // A readable name is kept. An unreadable one starts empty, because the app does not guess it.
  const [name, setName] = useState(why === 'lot' ? comment.author : '');
  const [lot, setLot] = useState<string>('');
  const ready = name.trim() !== '' && lot !== '';
  return (
    <Panel>
      <Text style={{ color: colors.warn, fontWeight: '700', marginBottom: 2 }}>{why === 'name' ? C.whyName : C.whyLot}</Text>
      <Text style={{ color: colors.ink }}>{[comment.author, comment.body].filter(Boolean).join(': ')}</Text>
      <Text style={{ color: colors.soft, fontSize: 12, marginBottom: 8 }}>{C.screenLabel(comment.screen + 1)}</Text>
      <Field label={C.nameLabel} value={name} onChangeText={setName} />
      <Choice label={C.lotLabel} value={lot} options={lotNumbers.map((n) => ({ value: String(n), label: String(n) }))} onChange={setLot} />
      <Row>
        <Button title={C.addClaim} disabled={!ready} onPress={() => onAdd({ name: name.trim(), lot: Number(lot), kind: 'claim' })} style={{ flex: 1 }} />
        <Button kind="secondary" title={C.addNext} disabled={!ready} onPress={() => onAdd({ name: name.trim(), lot: Number(lot), kind: 'next' })} style={{ flex: 1 }} />
        <Button kind="quiet" title={C.skip} onPress={onSkip} />
      </Row>
    </Panel>
  );
}
