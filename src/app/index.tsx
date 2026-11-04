import { googleReady } from '../lib/googleAuth';
import { Grid } from '../ui/layout';
import { Link, Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Fragment, useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getFormat } from '../core/formats';
import { opensByItself, settleGuide, showsResume } from '../core/guide';
import { WALK_COPY } from '../core/guideCopy';
import { isPhil } from '../core/variant';
import { venueOf } from '../core/venues';
import { formatDay, formatPrice, plantDisplayName } from '../core/text';
import { useLeftovers, useStore } from '../lib/store';
import { EmptyState } from '../ui/EmptyState';
import { Button, Note, Panel, Row, Screen, T, Thumb, colors } from '../ui/kit';
import { BrandBand, PlantRow } from '../ui/phil';
import { GearIcon, GlanceCard } from '../ui/botanical';
import { glanceFor, type NextRoute } from '../core/glance';
import { SealHint } from '../ui/PreviewBanner';
import { markAppReady, markResumed, resumedThisLaunch } from '../lib/appReady';
import { RESUME_COPY, resumeName, resumeTarget, screenName } from '../core/resume';

import { ACCENT } from '../ui/theme';
import { PHIL_SHADOW } from '../ui/styleDefs';

const NO_PLANTS_YET = 'No plants yet. Add your first plant and it will live here.';

export default function Home() {
  useEffect(markAppReady, []);
  const phil = T.name === 'phil';
  // The closed test build has no wrapper at all, so its screen is built exactly as it was.
  const Wrap: ElementType = phil ? View : Fragment;
  const store = useStore();
  const { profile, plants, sales } = store;
  const leftovers = useLeftovers();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  // The sale the seller has open right now, if any. It is the way back in, and it sits at the top of Home.
  const liveSale = useMemo(() => (store.sample ? null : resumeTarget(store.resume, store.sales, store.records)), [store.sample, store.resume, store.sales, store.records]);

  // First launch on a fresh install opens the setup walk once. A restored profile settles the walk as done.
  const autoOpened = useRef(false);
  const { guide, updateGuide, sample } = store;
  const hasProfile = !!profile;
  useEffect(() => {
    if (sample) return;
    if (guide.walk === 'new' && hasProfile) updateGuide((g) => settleGuide(g, true));
    else if (!autoOpened.current && opensByItself(guide, { hasProfile, sample })) {
      autoOpened.current = true;
      router.push('/setup');
    } else if (!resumedThisLaunch() && liveSale) {
      // A cold start in the middle of a sale puts the seller back in it, once. Home stays under it for the back button.
      markResumed();
      router.push(liveSale.path as never);
    }
  }, [guide, hasProfile, sample, updateGuide, liveSale]);
  const glance = glanceFor({ profile, plants, sales, records: store.records, pro: store.pro });
  const goNext = (r: NextRoute) => {
    if (r.to === 'setup') router.push('/setup');
    else if (r.to === 'plant') router.push('/plant/new');
    else if (r.to === 'pick') setPicking(true);
    else router.push(r.screen ? `/sale/${r.saleId}/${r.screen}` : `/sale/${r.saleId}`);
  };
  const resume = showsResume(guide, profile, sample) ? (guide.done.length ? WALK_COPY.resumeContinue : WALK_COPY.resumeStart) : null;

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
      {phil ? <StatusBar style="light" /> : null}
      <Stack.Screen
        options={{
          // The Phil build's brand band sits right under the bar, so the bar joins it: same green, no title of its own.
          ...(phil ? { title: '', headerStyle: { backgroundColor: ACCENT.deep }, headerTintColor: ACCENT.cream } : {}),
          headerRight: () => (
            <Row style={{ gap: 4 }}>
              <Link href="/sales" asChild>
                <Pressable accessibilityRole="button" style={{ padding: 8 }}>
                  <Text style={{ color: phil ? ACCENT.cream : colors.moss, fontWeight: '600', fontSize: 15 }}>Sales</Text>
                </Pressable>
              </Link>
              <Link href="/settings" asChild>
                <Pressable accessibilityRole="button" accessibilityLabel="Settings" style={{ padding: 8, justifyContent: 'center' }}>
                  <GearIcon color={phil ? ACCENT.cream : colors.moss} />
                </Pressable>
              </Link>
              <Link href="/profile" asChild>
                <Pressable accessibilityRole="button" style={{ padding: 8 }}>
                  <Text style={{ color: phil ? ACCENT.cream : colors.moss, fontWeight: '600', fontSize: 15 }}>Profile</Text>
                </Pressable>
              </Link>
            </Row>
          ),
        }}
      />
      <Screen footer={footer} lush>
        {phil ? <BrandBand style={{ marginHorizontal: -16, marginTop: -16 }} /> : null}
        {/* In the Phil build the first card is pulled up over the band's bottom edge. */}
        <Wrap {...(phil ? { style: { marginTop: -12 } } : {})}>
        {liveSale && !picking ? (
          <Panel style={{ backgroundColor: colors.mossTint, borderColor: colors.mossTint }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 2, ...(T.display ? { fontFamily: T.display, fontWeight: 'normal' as const } : {}) }}>{RESUME_COPY.title}</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{resumeName(liveSale.sale)}</Text>
            <Note>{RESUME_COPY.where(screenName(liveSale.path))}</Note>
            <Button title={RESUME_COPY.title} onPress={() => router.push(liveSale.path as never)} />
          </Panel>
        ) : null}

        {!profile ? (
          <Panel style={{ backgroundColor: colors.mossTint, borderColor: colors.mossTint }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 6, ...(T.display ? { fontFamily: T.display, fontWeight: 'normal' as const } : {}) }}>Welcome</Text>
            <Note>
              Save your seller details once. Every card you make pulls them in, so you never type your shipping
              or payment terms again.
            </Note>
            <Button title="Set up my profile" onPress={() => router.push('/profile')} />
            {resume ? <Button kind="secondary" title={resume} onPress={() => router.push('/setup')} /> : null}
            {googleReady() ? <Button kind="quiet" title="Restore from my Google Drive" onPress={() => router.push('/backup')} /> : null}
            <Button kind="quiet" title="Look around a sample showcase first" onPress={store.openSample} />
          </Panel>
        ) : null}

        {phil && profile && !picking && !store.sample ? <GlanceCard glance={glance} onNext={() => goNext(glance.next!.route)} /> : null}

        {profile && resume && !picking ? (
          <Panel style={{ backgroundColor: colors.mossTint, borderColor: colors.mossTint }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 6 }}>{WALK_COPY.resumeTitle}</Text>
            <Note>{WALK_COPY.resumeNote}</Note>
            <Button title={resume} onPress={() => router.push('/setup')} />
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
                style={[
                  {
                    backgroundColor: colors.mossTint,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 8,
                  },
                  phil ? { borderRadius: 16, padding: 14, marginBottom: 12, ...PHIL_SHADOW.raised } : null,
                ]}
              >
                <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 15 }}>
                  {s.kind === 'auction' ? 'Grower Showcase auction' : 'Grower Showcase'}, {s.lots.length} lots
                  {s.opens ? `, ${formatDay(s.opens.day)}` : ''}
                </Text>
                <Text style={{ color: colors.soft, fontSize: 13 }}>{isPhil() && store.profile ? `${venueOf(store.profile, s).name}. Tap to open.` : `${getFormat(s.formatId).name} format. Tap to open.`}</Text>
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

        {picking ? (
          phil ? (
            <Panel>
              <Note>Tap plants in the order you want the lots numbered.</Note>
            </Panel>
          ) : (
            <Note>Tap plants in the order you want the lots numbered.</Note>
          )
        ) : null}

        {profile && !plants.length ? (
          phil ? (
            <Panel>
              <EmptyState line={NO_PLANTS_YET} />
            </Panel>
          ) : (
            <Note>No plants yet. Add one with a photo and a price, and the card is ready right away.</Note>
          )
        ) : null}

        <Grid min={270}>
        {ordered.map((p) => {
          const index = picked.indexOf(p.id);
          const on = index >= 0;
          if (phil) {
            return (
              <PlantRow
                key={p.id}
                plant={p}
                picking={picking}
                on={on}
                index={index}
                thumb={<Thumb uri={p.photoUri} size={104} />}
                onPress={() => (picking ? toggle(p.id) : router.push(`/plant/${p.id}`))}
              />
            );
          }
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
        </Grid>
        </Wrap>
      </Screen>
    </>
  );
}
