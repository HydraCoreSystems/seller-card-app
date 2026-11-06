import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import type { MetaPage, MetaPost } from '../core/metaDemo';
import { META_COPY as C } from '../core/metaDemoCopy';
import { MetaError, fetchPosts } from '../lib/metaGraph';
import { loadSession } from '../lib/metaSession';
import { Button, H, Note, Panel, Screen, colors } from '../ui/kit';

/** Screen three: the recent posts on the connected Page's own timeline. */
export default function MetaPosts() {
  const [page, setPage] = useState<MetaPage | null>(null);
  const [posts, setPosts] = useState<MetaPost[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (p: MetaPage) => {
    setBusy(true);
    setMessage(null);
    try {
      setPosts(await fetchPosts(p));
    } catch (e) {
      setMessage(e instanceof MetaError && e.expired ? C.expired : C.failed);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadSession().then((s) => {
      if (!s?.page) {
        router.replace('/meta');
        return;
      }
      setPage(s.page);
      load(s.page);
    });
  }, [load]);

  return (
    <Screen>
      <H>{page ? page.name : C.postsTitle}</H>
      <Note>{C.postsNote}</Note>
      {message ? <Note tone="warn">{message}</Note> : null}
      <Button kind="secondary" title={busy ? C.loadingPages : C.refresh} disabled={busy || !page} onPress={() => page && load(page)} style={{ marginBottom: 12 }} />
      {posts && !posts.length ? <Note>{C.noPosts}</Note> : null}
      {posts?.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/meta/comments', params: { post: p.id, text: p.text } })}
        >
          <Panel>
            <Text style={{ color: colors.ink, fontSize: 15 }} numberOfLines={3}>{p.text}</Text>
            <Text style={{ color: colors.soft, fontSize: 12, marginTop: 4 }}>
              {p.createdSec ? new Date(p.createdSec * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : p.createdIso}
            </Text>
          </Panel>
        </Pressable>
      ))}
    </Screen>
  );
}
