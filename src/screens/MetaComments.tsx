import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { POLL_MS, arrange, showMetaTime, type CommentRow, type MetaPage } from '../core/metaDemo';
import { META_COPY as C } from '../core/metaDemoCopy';
import { MetaError, fetchComments } from '../lib/metaGraph';
import { loadSession } from '../lib/metaSession';
import { Button, H, Note, Panel, Screen, colors } from '../ui/kit';

/**
 * Screen four: one post's comments as a live review list. The list asks Facebook again every few
 * seconds while the screen is open. Same second comments are flagged, with the order unresolved.
 */
export default function MetaComments() {
  const { post, text } = useLocalSearchParams<{ post: string; text?: string }>();
  const [page, setPage] = useState<MetaPage | null>(null);
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // The order of ids from earlier refreshes, so a list does not jump about between refreshes.
  const seen = useRef<string[]>([]);

  useEffect(() => {
    loadSession().then((s) => (s?.page ? setPage(s.page) : router.replace('/meta')));
  }, []);

  useEffect(() => {
    if (!page || !post) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const next = await fetchComments(page, post);
        if (!live) return;
        const arranged = arrange(next, seen.current);
        seen.current = arranged.map((r) => r.id);
        setRows(arranged);
        setLoaded(true);
        setMessage(null);
      } catch (e) {
        if (!live) return;
        setMessage(e instanceof MetaError && e.expired ? C.expired : C.failed);
        // An ended sign in will not mend itself, so stop asking.
        if (e instanceof MetaError && e.expired) return;
      }
      if (live) timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [page, post]);

  const anySame = rows.some((r) => r.sameSecond > 1);

  return (
    <Screen>
      <H>{C.commentsTitle}</H>
      {text ? <Note>{text}</Note> : null}
      <Note>{C.commentsNote}</Note>
      {message ? (
        <>
          <Note tone="warn">{message}</Note>
          {message === C.expired ? <Button title="Connect again" onPress={() => router.replace('/meta')} /> : null}
        </>
      ) : loaded ? (
        <Text style={{ color: colors.moss, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>{C.live}</Text>
      ) : null}
      {loaded && !rows.length ? <Note>{C.noComments}</Note> : null}
      {rows.map((r) => (
        <Panel key={r.id} style={r.sameSecond > 1 ? { borderColor: colors.warn, borderWidth: 1.5 } : undefined}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ fontWeight: '700', color: colors.ink, flexShrink: 1 }}>{r.from ?? C.unknownCommenter}</Text>
            <Text style={{ color: colors.soft }}>{showMetaTime(r.createdSec, r.createdIso)}</Text>
          </View>
          <Text style={{ color: colors.ink, marginTop: 4 }}>{r.message}</Text>
          {r.sameSecond > 1 ? <Text style={{ color: colors.warn, fontWeight: '600', marginTop: 6 }}>{C.sameSecond(r.sameSecond)}</Text> : null}
        </Panel>
      ))}
      {anySame ? <Note>{C.sameSecondNote}</Note> : null}
    </Screen>
  );
}
