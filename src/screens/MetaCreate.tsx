import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { DEMO_SALE, demoDone, lotComment, type DemoProgress } from '../core/metaDemo';
import { META_COPY as C } from '../core/metaDemoCopy';
import { MetaError } from '../lib/metaGraph';
import { runDemoSale } from '../lib/metaDemoSale';
import { loadSession, saveSession, type MetaSession } from '../lib/metaSession';
import { Button, H, Note, Panel, Screen, colors } from '../ui/kit';

/**
 * Screen five: create the demonstration sale on the connected Page. This is the only screen that
 * writes to Facebook, and only when its button is pressed. It then opens the comments review.
 */
export default function MetaCreate() {
  const [session, setSession] = useState<MetaSession | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSession().then((s) => (s?.page ? setSession(s) : router.replace('/meta')));
  }, []);

  const page = session?.page ?? null;
  const demo = session?.demo ?? null;
  const finished = demoDone(demo);

  const watch = (postId: string) =>
    router.replace({ pathname: '/meta/comments', params: { post: postId, text: DEMO_SALE.post.split('\n')[0] } });

  const create = async () => {
    if (!session || !page || busy) return;
    setMessage(null);
    setBusy(C.createPosting);
    try {
      const done: DemoProgress = await runDemoSale(
        page,
        demo,
        async (progress) => {
          const next = { ...session, demo: progress };
          await saveSession(next);
          setSession(next);
        },
        (step) => setBusy(step === 'post' ? C.createPosting : C.createCommenting(step.commented, DEMO_SALE.lots.length)),
      );
      setBusy(null);
      watch(done.postId);
    } catch (e) {
      setBusy(null);
      setMessage(e instanceof MetaError && e.expired ? C.expired : C.createFailed);
    }
  };

  if (!page) return <Screen><Note>{C.loadingPages}</Note></Screen>;

  return (
    <Screen>
      <H>{C.createTitle}</H>
      <Note>{C.createNote}</Note>
      {message ? <Note tone="warn">{message}</Note> : null}

      <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 6 }}>{C.createPostLabel}</Text>
      <Panel>
        <Text style={{ color: colors.ink }}>{DEMO_SALE.post}</Text>
      </Panel>

      <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 6 }}>{C.createLotsLabel}</Text>
      <Panel>
        {DEMO_SALE.lots.map((lot, i) => (
          <Text key={lot.number} style={{ color: colors.ink, marginTop: i ? 6 : 0 }}>{lotComment(lot)}</Text>
        ))}
      </Panel>

      {finished && demo ? (
        <>
          <Note>{C.createFinished}</Note>
          <Button title={C.createWatch} onPress={() => watch(demo.postId)} />
        </>
      ) : (
        <Button title={busy ?? (demo ? C.createResume : C.createButton(page.name))} disabled={!!busy} onPress={create} />
      )}
    </Screen>
  );
}
