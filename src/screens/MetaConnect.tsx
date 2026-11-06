import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { isAppLink, type MetaPage } from '../core/metaDemo';
import { META_COPY as C } from '../core/metaDemoCopy';
import { MetaError, fetchPages, subscribePage } from '../lib/metaGraph';
import { SignInRefused, completeSignIn, disconnect, loadSession, saveSession, signIn, type MetaSession } from '../lib/metaSession';
import { Button, H, Note, Panel, Screen, colors } from '../ui/kit';

/** Screen one and two of the Page demonstration: sign in, choose a Page, subscribe it, show it by name. */
export default function MetaConnect() {
  const [session, setSession] = useState<MetaSession | null>(null);
  const [ready, setReady] = useState(false);
  const [pages, setPages] = useState<MetaPage[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warn, setWarn] = useState(false);

  // A sign in is picked up once, however many roads the link arrives by.
  const taken = useRef<string | null>(null);

  const fail = (e: unknown) => {
    setWarn(true);
    setMessage(e instanceof SignInRefused ? C.refused : e instanceof MetaError && e.expired ? C.expired : C.failed);
  };

  const lookUpPages = async (s: MetaSession) => {
    setBusy(C.loadingPages);
    try {
      setPages(await fetchPages(s.userToken));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const takeSignIn = (s: MetaSession) => {
    if (taken.current === s.userToken) return;
    taken.current = s.userToken;
    setSession(s);
    setMessage(null);
    setWarn(false);
    lookUpPages(s);
  };

  // The shop page hands the result back with the app's own link. This catches it whether the app was
  // already open or was started by it, and finishes the sign in from what it carries.
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!isAppLink(url)) return;
      completeSignIn(url).then((s) => s && takeSignIn(s), fail);
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A sign in left half done, with no Page chosen yet, goes straight to the list of Pages.
  useEffect(() => {
    loadSession().then((s) => {
      setReady(true);
      if (s && !s.page) takeSignIn(s);
      else {
        if (s) taken.current = s.userToken;
        setSession(s);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setMessage(null);
    setWarn(false);
    setBusy(C.signingIn);
    try {
      const s = await signIn();
      setBusy(null);
      if (s) takeSignIn(s);
      else {
        setWarn(true);
        setMessage(C.backedOut);
      }
    } catch (e) {
      setBusy(null);
      fail(e);
    }
  };

  const choose = async (page: MetaPage) => {
    if (!session) return;
    setMessage(null);
    setWarn(false);
    setBusy(C.connecting);
    try {
      const subscribed = await subscribePage(page);
      const next: MetaSession = { ...session, page, subscribed };
      await saveSession(next);
      setSession(next);
      setPages(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    setBusy(C.disconnecting);
    const confirmed = await disconnect(session);
    setSession(null);
    setPages(null);
    setBusy(null);
    setWarn(!confirmed);
    setMessage(confirmed ? C.disconnected : C.disconnectedPartly);
  };

  if (!ready) return <Screen><Note>{C.loadingPages}</Note></Screen>;

  const connected = session?.page ?? null;

  return (
    <Screen>
      {message ? <Note tone={warn ? 'warn' : undefined}>{message}</Note> : null}

      {connected ? (
        <>
          <H>{C.connectedTitle}</H>
          <Panel>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.ink }}>{C.connectedPage(connected.name)}</Text>
            {session?.subscribed ? <Text style={{ color: colors.moss, fontWeight: '600', marginTop: 4 }}>{C.noticesOn}</Text> : null}
            <Note>{C.noticesNote}</Note>
            <Button title={C.createSale} onPress={() => router.push('/meta/create')} />
            <Button kind="secondary" title={C.seePosts} onPress={() => router.push('/meta/posts')} style={{ marginTop: 8 }} />
          </Panel>
          <Button kind="secondary" title={busy ?? C.disconnect} disabled={!!busy} onPress={signOut} />
        </>
      ) : session && pages ? (
        <>
          <H>{C.pickTitle}</H>
          <Note>{C.pickNote}</Note>
          {pages.length ? (
            pages.map((p) => (
              <Panel key={p.id}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 6 }}>{p.name}</Text>
                <Button title={busy ?? C.connectPage} disabled={!!busy} onPress={() => choose(p)} />
              </Panel>
            ))
          ) : (
            <Note tone="warn">{C.noPages}</Note>
          )}
          <Button kind="quiet" title={C.disconnect} disabled={!!busy} onPress={signOut} />
        </>
      ) : (
        <>
          <H>{C.connectTitle}</H>
          <Note>{C.intro}</Note>
          <Button title={busy ?? C.signIn} disabled={!!busy} onPress={connect} />
          <H>{C.usesTitle}</H>
          <Panel>
            {C.uses.map((u, i) => (
              <View key={u.name} style={{ marginTop: i ? 10 : 0 }}>
                <Text style={{ fontWeight: '700', color: colors.ink }}>{u.name}</Text>
                <Text style={{ color: colors.soft }}>{u.text}</Text>
              </View>
            ))}
          </Panel>
        </>
      )}
    </Screen>
  );
}
