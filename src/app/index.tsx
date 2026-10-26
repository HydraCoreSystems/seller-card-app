import { Link, Stack, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getFormat } from '../core/formats';
import { formatDay, formatPrice, plantDisplayName } from '../core/text';
import { useLeftovers, useStore } from '../lib/store';
import { Button, Note, Panel, Row, Screen, Thumb, colors } from '../ui/kit';
import { SealHint } from '../ui/PreviewBanner';

export default function Home() {
  const store = useStore();
  const { profile, plants, sales } = store;
  const leftovers = useLeftovers();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const available = plants.filter((p) => !p.sold);
  const sold = plants.filter((p) => p.sold);
  const ordered = [...available, ...sold];

  const footer = picking ? (
    <View style={{ gap: 8 }}>
      <Button
        title={picked.length ? `Build a showcase with ${picked.length} plant${picked.length === 1 ? '' : 's'}` : 'Pick plants for the showcase'}
        disabled={!picked.length}
        onPress={() => {
          router.push({ pathname: '/sale/new', params: { plants: picked.join(',') } });
          setPicking(false);
          setPicked([]);
        }}
      />
      <Row style={{ justifyContent: 'space-between' }}>
        <Button kind="quiet" title="Pick all for sale" onPress={() => setPicked(available.map((p) => p.id))} />
        <Button kind="quiet" title="Use a Sale Sheet" onPress={() => { setPicking(false); setPicked([]); router.push('/sheet'); }} />
        <Button kind="quiet" title="Cancel" onPress={() => { setPicking(false); setPicked([]); }} />
      </Row>
    </View>
  ) : (
    <Row>
      <Button title="Add plant" onPress={() => router.push('/plant/new')} style={{ flex: 1 }} disabled={!profile} />
      <Button
        kind="secondary"
        title="New showcase"
        onPress={() => setPicking(true)}
        style={{ flex: 1 }}
        disabled={!profile}
      />
    </Row>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Row style={{ gap: 4 }}>
              <Link href="/sales" asChild>
                <Pressable accessibilityRole="button" style={{ padding: 8 }}>
                  <Text style={{ color: colors.moss, fontWeight: '600', fontSize: 15 }}>Sales</Text>
                </Pressable>
              </Link>
              <Link href="/profile" asChild>
                <Pressable accessibilityRole="button" style={{ padding: 8 }}>
                  <Text style={{ color: colors.moss, fontWeight: '600', fontSize: 15 }}>Profile</Text>
                </Pressable>
              </Link>
            </Row>
          ),
        }}
      />
      <Screen footer={footer}>
        {!profile ? (
          <Panel style={{ backgroundColor: colors.mossTint, borderColor: colors.mossTint }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 6 }}>Welcome</Text>
            <Note>
              Save your seller details once. Every card you make pulls them in, so you never type your shipping
              or payment terms again.
            </Note>
            <Button title="Set up my profile" onPress={() => router.push('/profile')} />
            <Button kind="quiet" title="Look around a sample showcase first" onPress={store.openSample} />
          </Panel>
        ) : null}

        {store.sample && !picking ? (
          <Panel style={{ backgroundColor: colors.mossTint, borderColor: colors.mossTint }}>
            <Note>
              You’re looking around a sample showcase. The seller and buyers are made up, and nothing you do here is
              saved. Open it, the claims and the rundown to see each step full.
            </Note>
            <SealHint />
            <Button kind="secondary" title="Leave the sample" onPress={store.leaveSample} />
          </Panel>
        ) : null}

        {!picking && sales.length ? (
          <View style={{ marginBottom: 8 }}>
            {sales.slice(0, 2).map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                onPress={() => router.push(`/sale/${s.id}`)}
                style={{
                  backgroundColor: colors.mossTint,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 15 }}>
                  {s.kind === 'auction' ? 'Grower Showcase auction' : 'Grower Showcase'}, {s.lots.length} lots
                  {s.opens ? `, ${formatDay(s.opens.day)}` : ''}
                </Text>
                <Text style={{ color: colors.soft, fontSize: 13 }}>{getFormat(s.formatId).name} format. Tap to open.</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!picking && leftovers.length ? (
          <Button
            kind="secondary"
            title={`${leftovers.length} ${leftovers.length === 1 ? 'leftover' : 'leftovers'} ready to relist`}
            onPress={() => router.push('/leftovers')}
            style={{ marginBottom: 12 }}
          />
        ) : null}

        {picking ? <Note>Tap plants in the order you want the lots numbered.</Note> : null}

        {profile && !plants.length ? (
          <Note>No plants yet. Add one with a photo and a price, and the card is ready right away.</Note>
        ) : null}

        {ordered.map((p) => {
          const index = picked.indexOf(p.id);
          const on = index >= 0;
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityState={picking ? { selected: on } : undefined}
              disabled={picking && p.sold}
              onPress={() => (picking ? toggle(p.id) : router.push(`/plant/${p.id}`))}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.card,
                  borderWidth: 1.5,
                  borderColor: on ? colors.moss : colors.line,
                  marginBottom: 8,
                  opacity: p.sold ? 0.55 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <Thumb uri={p.photoUri} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }} numberOfLines={2}>
                  {plantDisplayName(p.name, p.noid) || 'Unnamed plant'}
                </Text>
                <Text style={{ color: colors.soft, fontSize: 14 }}>
                  {p.price === null ? 'No price yet' : `${p.kind === 'auction' ? 'Opens at ' : ''}${formatPrice(p.price)}`}
                  {p.sold ? '  Sold' : ''}
                </Text>
              </View>
              {picking && on ? (
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: colors.moss,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{index + 1}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </Screen>
    </>
  );
}
