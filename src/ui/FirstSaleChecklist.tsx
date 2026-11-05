import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { currentStage, showsChecklist, checklistStages } from '../core/firstSale';
import { CHECKLIST_COPY as C } from '../core/guideCopy';
import type { Sale } from '../core/types';
import { dismissChecklist } from '../core/guide';
import { useStore } from '../lib/store';
import { Button, Note, Panel, colors } from './kit';

/** The checklist card for a seller's first sale. Each stage reads its done state from the sale's own data. */
export function FirstSaleChecklist({ sale }: { sale: Sale }) {
  const { sales, records, guide, pro, updateGuide } = useStore();
  if (!showsChecklist(sale, sales, records, guide, pro)) return null;
  const stages = checklistStages(sale, records, pro);
  const lit = currentStage(stages);
  return (
    <Panel>
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 4 }}>{C.title}</Text>
      <Note>{C.note}</Note>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
        {stages.map((st) => (
          <View key={st.id} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: st.done ? colors.moss : st.id === lit ? '#C9A227' : colors.line }} />
        ))}
      </View>
      {stages.map((st, i) => {
        const on = st.id === lit;
        return (
          <View key={st.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderColor: colors.line, opacity: st.done || on ? 1 : 0.45 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: st.done ? colors.moss : on ? '#C9A227' : colors.mossTint }}>
              <Text style={{ fontWeight: '700', fontSize: 12, color: st.done ? '#fff' : colors.ink }}>{st.done ? '✓' : i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: on ? '700' : '400' }}>{st.line}</Text>
              {st.done ? <Text style={{ color: colors.moss, fontSize: 12 }}>{C.done}</Text> : null}
              {on ? <Button kind="secondary" title={st.button} onPress={() => router.push(st.to === 'lot' ? `/sale/${sale.id}/lot` : `/sale/${sale.id}/${st.to}`)} style={{ marginTop: 6, alignSelf: 'flex-start' }} /> : null}
            </View>
          </View>
        );
      })}
      <Button kind="quiet" title={C.dismiss} onPress={() => updateGuide(dismissChecklist)} />
    </Panel>
  );
}
