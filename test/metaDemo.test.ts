/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import {
  DEMO_SALE,
  GRAPH_VERSION,
  META_APP_ID,
  META_CONFIG_ID,
  META_APP_LINK,
  META_RETURN_URL,
  META_URL_SCHEME,
  arrange,
  buildLoginUrl,
  checkReturn,
  demoDone,
  graphUrl,
  isAppLink,
  isExpired,
  lotComment,
  metaDemoEnabled,
  nextPage,
  parseGraphTime,
  parseReturn,
  readComments,
  readPages,
  readPosts,
  type MetaComment,
} from '../src/core/metaDemo';
import { META_COPY } from '../src/core/metaDemoCopy';
import { DASH_PATTERN } from '../src/core/text';
import { MetaError, createComment, createPost, exchangeCode, fetchComments, fetchPages, fetchPosts, subscribePage, unsubscribePage } from '../src/lib/metaGraph';
import { runDemoSale } from '../src/lib/metaDemoSale';

const keep = process.env.EXPO_PUBLIC_APP_VARIANT;
afterEach(() => {
  if (keep === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
  else process.env.EXPO_PUBLIC_APP_VARIANT = keep;
  vi.unstubAllGlobals();
});

const c = (id: string, iso: string, from: string | null = 'Pat', message = 'mine'): MetaComment => ({
  id,
  from,
  message,
  createdIso: iso,
  createdSec: parseGraphTime(iso),
});

describe('the demonstration identifiers', () => {
  it('uses the production Meta app, the Page connection configuration, a current Graph version, and the shop page as the return', () => {
    expect(META_APP_ID).toBe('1166563362604892');
    expect(META_CONFIG_ID).toBe('29138336945817387');
    expect(GRAPH_VERSION).toBe('v26.0');
    expect(META_RETURN_URL).toBe('https://gatheringmoss.shop/pages/skrybix-connect');
    expect(META_APP_LINK).toBe('fb1166563362604892://authorize');
    expect(META_URL_SCHEME).toBe('fb1166563362604892');
  });
});

describe('Meta times', () => {
  it('reads whole seconds, with either zone style', () => {
    expect(parseGraphTime('2026-11-06T17:56:36+0000')).toBe(Date.UTC(2026, 10, 6, 17, 56, 36) / 1000);
    expect(parseGraphTime('2026-11-06T12:56:36-0500')).toBe(Date.UTC(2026, 10, 6, 17, 56, 36) / 1000);
    expect(parseGraphTime('2026-11-06T17:56:36Z')).toBe(Date.UTC(2026, 10, 6, 17, 56, 36) / 1000);
  });

  it('says nothing rather than guessing at a time it cannot read', () => {
    expect(parseGraphTime('')).toBeNull();
    expect(parseGraphTime('yesterday')).toBeNull();
  });
});

describe('reading what Facebook sends back', () => {
  it('reads the Pages with their own tokens, and skips a row that is missing one', () => {
    const pages = readPages({ data: [{ id: '1', name: 'Gathering Moss', access_token: 'tok' }, { id: '2', name: 'No token' }] });
    expect(pages).toEqual([{ id: '1', name: 'Gathering Moss', token: 'tok' }]);
    expect(readPages(null)).toEqual([]);
  });

  it('reads posts, with a stand in for a post that has no words', () => {
    const posts = readPosts({ data: [{ id: 'p1', message: 'Grower Showcase', created_time: '2026-11-06T17:00:00+0000', permalink_url: 'https://x' }, { id: 'p2', created_time: '2026-11-06T18:00:00+0000' }] });
    expect(posts.map((p) => p.text)).toEqual(['Grower Showcase', 'A post with no words']);
    expect(posts[0].link).toBe('https://x');
    expect(posts[1].link).toBeNull();
  });

  it('reads the commenter name, the words and the Meta time, in the order returned', () => {
    const rows = readComments({
      data: [
        { id: 'c2', message: 'second', from: { name: 'Sam', id: '9' }, created_time: '2026-11-06T17:56:37+0000' },
        { id: 'c1', message: 'first', from: { name: 'Pat', id: '8' }, created_time: '2026-11-06T17:56:36+0000' },
        { id: 'c3', message: 'no name', created_time: '2026-11-06T17:56:38+0000' },
      ],
    });
    expect(rows.map((r) => r.id)).toEqual(['c2', 'c1', 'c3']);
    expect(rows[0]).toMatchObject({ from: 'Sam', message: 'second' });
    expect(rows[2].from).toBeNull();
  });

  it('finds the next page of results', () => {
    expect(nextPage({ paging: { next: 'https://graph.facebook.com/next' } })).toBe('https://graph.facebook.com/next');
    expect(nextPage({ data: [] })).toBeNull();
  });
});

describe('the arrival order list', () => {
  it('puts comments in order of Meta’s time and flags nothing when every second is its own', () => {
    const rows = arrange([c('b', '2026-11-06T17:00:02+0000'), c('a', '2026-11-06T17:00:01+0000'), c('d', '2026-11-06T17:00:04+0000')]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'd']);
    expect(rows.every((r) => r.sameSecond === 1)).toBe(true);
  });

  it('flags every comment in a shared second, with how many share it, and never calls one first', () => {
    const rows = arrange([
      c('a', '2026-11-06T17:00:01+0000'),
      c('x', '2026-11-06T17:00:05+0000'),
      c('y', '2026-11-06T17:00:05+0000'),
      c('z', '2026-11-06T17:00:05+0000'),
      c('e', '2026-11-06T17:00:09+0000'),
    ]);
    expect(rows.map((r) => r.sameSecond)).toEqual([1, 3, 3, 3, 1]);
    expect(META_COPY.sameSecond(3)).toContain('Order unresolved');
    expect(META_COPY.sameSecond(2)).toBe('Same second as one other comment. Order unresolved.');
  });

  it('keeps a shared second where it was first seen, so the list does not jump between refreshes', () => {
    const first = arrange([c('x', '2026-11-06T17:00:05+0000'), c('y', '2026-11-06T17:00:05+0000')]);
    const seen = first.map((r) => r.id);
    // Facebook hands the same two back in the other order on the next refresh, with a new one after.
    const again = arrange([c('y', '2026-11-06T17:00:05+0000'), c('x', '2026-11-06T17:00:05+0000'), c('n', '2026-11-06T17:00:06+0000')], seen);
    expect(again.map((r) => r.id)).toEqual(['x', 'y', 'n']);
    expect(again[0].sameSecond).toBe(2);
    expect(again[1].sameSecond).toBe(2);
  });

  it('puts a comment that arrives late into its own second rather than at the end', () => {
    const seen = ['a', 'b'];
    const rows = arrange([c('a', '2026-11-06T17:00:01+0000'), c('b', '2026-11-06T17:00:03+0000'), c('late', '2026-11-06T17:00:02+0000')], seen);
    expect(rows.map((r) => r.id)).toEqual(['a', 'late', 'b']);
  });

  it('puts a comment whose time cannot be read last, and flags nothing for it', () => {
    const rows = arrange([c('odd', 'soon'), c('a', '2026-11-06T17:00:01+0000')]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'odd']);
    expect(rows[1].sameSecond).toBe(1);
  });
});

describe('addresses and errors', () => {
  it('builds an address with the parameters encoded and no token in it', () => {
    const url = graphUrl('/123/comments', { fields: 'id,message,from,created_time', limit: 100, skip: undefined });
    expect(url).toBe('https://graph.facebook.com/v26.0/123/comments?fields=id%2Cmessage%2Cfrom%2Ccreated_time&limit=100');
    expect(url).not.toMatch(/access_token/);
  });

  it('knows when a sign in has run out', () => {
    expect(isExpired({ code: 190 })).toBe(true);
    expect(isExpired({ type: 'OAuthException' })).toBe(true);
    expect(isExpired({ code: 4 })).toBe(false);
    expect(isExpired(null)).toBe(false);
  });
});

describe('the sign in return road', () => {
  const now = 1_000_000;
  const pending = { state: 'S1', at: now - 1000 };

  it('sends Facebook to the shop page, with the configuration, the state and no scope or secret', () => {
    const url = buildLoginUrl('S1');
    expect(url.startsWith('https://www.facebook.com/v26.0/dialog/oauth?')).toBe(true);
    expect(url).toContain('client_id=1166563362604892');
    expect(url).toContain(`redirect_uri=${encodeURIComponent('https://gatheringmoss.shop/pages/skrybix-connect')}`);
    expect(url).toContain('response_type=token');
    expect(url).toContain('config_id=29138336945817387');
    expect(url).toContain('state=S1');
    expect(url).not.toMatch(/scope=|secret|fb1166563362604892/i);
  });

  it('knows the link the shop page hands back with', () => {
    expect(isAppLink('fb1166563362604892://authorize?code=abc&state=S1')).toBe(true);
    expect(isAppLink('FB1166563362604892://authorize#access_token=t')).toBe(true);
    expect(isAppLink('sellercardphil://authorize')).toBe(false);
    expect(isAppLink('https://gatheringmoss.shop/pages/skrybix-connect?code=abc')).toBe(false);
    expect(isAppLink(null)).toBe(false);
  });

  it('reads what came back from the query string, the fragment, or both', () => {
    expect(parseReturn('fb1166563362604892://authorize?code=abc%2Bdef&state=S1')).toEqual({ state: 'S1', accessToken: null, code: 'abc+def', error: null });
    expect(parseReturn('fb1166563362604892://authorize#access_token=EAAB&state=S1&expires_in=5000')).toMatchObject({ state: 'S1', accessToken: 'EAAB' });
    expect(parseReturn('fb1166563362604892://authorize?state=S1#access_token=EAAB')).toMatchObject({ state: 'S1', accessToken: 'EAAB' });
    expect(parseReturn('fb1166563362604892://authorize?code=abc&state=S1#_=_')).toMatchObject({ code: 'abc', state: 'S1' });
    expect(parseReturn('fb1166563362604892://authorize?error=access_denied&state=S1')).toMatchObject({ error: 'access_denied' });
    expect(parseReturn('fb1166563362604892://authorize')).toEqual({ state: null, accessToken: null, code: null, error: null });
  });

  it('finishes from a token or a code only when the state is the one this app started', () => {
    const ret = (url: string) => checkReturn(parseReturn(url), pending, now);
    expect(ret('fb1166563362604892://authorize#access_token=EAAB&state=S1')).toEqual({ kind: 'token', token: 'EAAB' });
    expect(ret('fb1166563362604892://authorize?code=abc&state=S1')).toEqual({ kind: 'code', code: 'abc' });
    expect(ret('fb1166563362604892://authorize?code=abc&state=OTHER')).toEqual({ kind: 'mismatch' });
    expect(ret('fb1166563362604892://authorize?code=abc')).toEqual({ kind: 'mismatch' });
    expect(ret('fb1166563362604892://authorize?error=access_denied&state=S1')).toEqual({ kind: 'denied' });
    expect(ret('fb1166563362604892://authorize?state=S1')).toEqual({ kind: 'empty' });
  });

  it('ignores an old link, with no sign in waiting for it or one that ran out', () => {
    const link = parseReturn('fb1166563362604892://authorize#access_token=EAAB&state=S1');
    expect(checkReturn(link, null, now)).toEqual({ kind: 'stale' });
    expect(checkReturn(link, { state: 'S1', at: now - 16 * 60 * 1000 }, now)).toEqual({ kind: 'stale' });
  });

  it('can trade a code for a token with no secret, and says so plainly when Facebook will not', async () => {
    const reply = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body }) as unknown as Response;
    const fetchMock = vi.fn(async () => reply({ access_token: 'EAAB' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await exchangeCode('abc')).toBe('EAAB');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/v26.0/oauth/access_token?');
    expect(url).toContain('client_id=1166563362604892');
    expect(url).toContain(`redirect_uri=${encodeURIComponent(META_RETURN_URL)}`);
    expect(url).not.toMatch(/secret/i);
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    vi.stubGlobal('fetch', vi.fn(async () => reply({ error: { code: 1, message: 'needs secret' } }, false)));
    await expect(exchangeCode('abc')).rejects.toBeInstanceOf(MetaError);
  });

  it('carries no app secret anywhere in the demonstration', () => {
    for (const f of ['src/core/metaDemo.ts', 'src/core/metaConfig.json', 'src/lib/metaGraph.ts', 'src/lib/metaSession.ts', 'src/screens/MetaConnect.tsx', 'src/app/authorize.tsx']) {
      expect(readFileSync(join(__dirname, '..', f), 'utf8'), f).not.toMatch(/client_secret|app_secret|appsecret/i);
    }
  });

  it('has a route for the incoming link, for the Phil build only', () => {
    const route = readFileSync(join(__dirname, '..', 'src/app/authorize.tsx'), 'utf8');
    expect(route).toMatch(/metaDemoEnabled\(\) \? <Finish \/> : <Redirect/);
    expect(route).toMatch(/completeSignIn/);
  });
});

describe('the Graph calls', () => {
  const reply = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as unknown as Response;
  const page = { id: 'PAGE1', name: 'Gathering Moss', token: 'PAGETOKEN' };

  it('lists Pages with the user token in the header, not the address', async () => {
    const fetchMock = vi.fn(async () => reply({ data: [{ id: 'PAGE1', name: 'Gathering Moss', access_token: 'PAGETOKEN' }] }));
    vi.stubGlobal('fetch', fetchMock);
    const pages = await fetchPages('USERTOKEN');
    expect(pages[0].name).toBe('Gathering Moss');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/v26.0/me/accounts');
    expect(url).not.toContain('USERTOKEN');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer USERTOKEN');
  });

  it('subscribes a Page to the feed field only, and unsubscribes it', async () => {
    const fetchMock = vi.fn(async () => reply({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await subscribePage(page)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v26.0/PAGE1/subscribed_apps');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('subscribed_fields=feed');
    expect(await unsubscribePage(page)).toBe(true);
    expect((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].method).toBe('DELETE');
  });

  it('reads a Page’s own posts from its own timeline', async () => {
    const fetchMock = vi.fn(async () => reply({ data: [{ id: 'PAGE1_9', message: 'Showcase', created_time: '2026-11-06T17:00:00+0000' }] }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchPosts(page))[0].id).toBe('PAGE1_9');
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toContain('/PAGE1/posts?');
  });

  it('reads every page of comments, in the order returned, with the Page token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ data: [{ id: 'c1', message: 'one', from: { name: 'Pat' }, created_time: '2026-11-06T17:00:01+0000' }], paging: { next: 'https://graph.facebook.com/v26.0/next' } }))
      .mockResolvedValueOnce(reply({ data: [{ id: 'c2', message: 'two', from: { name: 'Sam' }, created_time: '2026-11-06T17:00:02+0000' }] }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await fetchComments(page, 'PAGE1_9');
    expect(out.map((x) => x.id)).toEqual(['c1', 'c2']);
    const [first, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(first).toContain('/PAGE1_9/comments?');
    expect(first).toContain('fields=id%2Cmessage%2Cfrom%2Ccreated_time');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer PAGETOKEN');
    expect((fetchMock.mock.calls[1] as unknown as [string])[0]).toBe('https://graph.facebook.com/v26.0/next');
  });

  it('says plainly when the sign in has run out, and when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply({ error: { code: 190, type: 'OAuthException', message: 'expired' } }, false, 400)));
    await expect(fetchPosts(page)).rejects.toMatchObject({ expired: true });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const err = await fetchPosts(page).catch((e) => e);
    expect(err).toBeInstanceOf(MetaError);
    expect(err.expired).toBe(false);
  });
});

describe('where the demonstration lives', () => {
  const as = (v: 'phil' | undefined) => {
    if (v) process.env.EXPO_PUBLIC_APP_VARIANT = v;
    else delete process.env.EXPO_PUBLIC_APP_VARIANT;
  };

  it('is in the Phil build only', () => {
    as(undefined);
    expect(metaDemoEnabled()).toBe(false);
    as('phil');
    expect(metaDemoEnabled()).toBe(true);
  });

  it('registers Facebook’s return address in the Phil build only, and leaves production as it was', () => {
    const appConfig = createRequire(join(__dirname, 'metaDemo.test.ts'))('../app.config.js') as (a: { config: Record<string, unknown> }) => Record<string, unknown>;
    const config = { name: 'Skrybix', slug: 'seller-card-app', scheme: 'sellercard' };
    as(undefined);
    expect(appConfig({ config }).scheme).toBe('sellercard');
    as('phil');
    expect(appConfig({ config }).scheme).toEqual(['sellercardphil', META_URL_SCHEME]);
  });

  it('stays inside its scope: no Messenger and no groups', () => {
    const files = ['src/core/metaDemo.ts', 'src/lib/metaGraph.ts', 'src/lib/metaSession.ts', 'src/lib/metaDemoSale.ts', 'src/core/metaConfig.json'];
    for (const f of files) {
      const text = readFileSync(join(__dirname, '..', f), 'utf8');
      expect(text, f).not.toMatch(/pages_messaging|messenger|\/groups|group_id/i);
    }
  });

  it('writes to Facebook only from the create screen, and the read screens never write', () => {
    const read = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8');
    const callers = ['src/screens/MetaConnect.tsx', 'src/screens/MetaPosts.tsx', 'src/screens/MetaComments.tsx', 'src/screens/MetaCreate.tsx', 'src/lib/metaSession.ts', 'src/lib/metaDemoSale.ts'];
    const writers = callers.filter((f) => /createPost|createComment|runDemoSale/.test(read(f)));
    // The create screen asks, the run helper does the two writes. Nothing else may.
    expect(writers.sort()).toEqual(['src/lib/metaDemoSale.ts', 'src/screens/MetaCreate.tsx']);
    // The one place the run starts is a button press.
    const create = read('src/screens/MetaCreate.tsx');
    expect(create.match(/runDemoSale\(/g)?.length).toBe(1);
    expect(create).toMatch(/onPress=\{create\}/);
    expect(create).not.toMatch(/useEffect\([^)]*runDemoSale/);
  });

  it('keeps the demonstration out of the paste flow, the claim reader and the close flow', () => {
    for (const f of ['src/app/sale/[id]/claims.tsx', 'src/core/claims.ts', 'src/core/claimReport.ts', 'src/core/rundown.ts', 'src/core/entitlement.ts', 'src/core/pro.ts']) {
      expect(readFileSync(join(__dirname, '..', f), 'utf8'), f).not.toMatch(/metaDemo|metaGraph|metaSession/);
    }
  });
});

describe('the words on screen', () => {
  it('keeps dashes and hyphens out, as the house rules say', () => {
    const words: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === 'string') words.push(v);
      else if (typeof v === 'function') words.push(String((v as (n: number) => unknown)(2)), String((v as (n: number) => unknown)(5)));
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(META_COPY);
    expect(words.length).toBeGreaterThan(20);
    for (const w of words) expect(w, w).not.toMatch(DASH_PATTERN);
  });

  it('names exactly the permissions this build uses', () => {
    const names = META_COPY.uses.map((u) => u.name);
    expect(names).toEqual(['pages_show_list', 'pages_manage_metadata', 'pages_read_engagement', 'pages_read_user_content', 'pages_manage_posts', 'pages_manage_engagement']);
  });
});

describe('the demonstration sale', () => {
  const reply = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
  const page = { id: 'PAGE1', name: 'Gathering Moss', token: 'PAGETOKEN' };

  it('says it is a demonstration, lists three lots, and never carries a form link', () => {
    expect(DEMO_SALE.lots).toHaveLength(3);
    expect(DEMO_SALE.post).toMatch(/demonstration/i);
    expect(DEMO_SALE.post).not.toMatch(/https?:|docs\.google|form/i);
    for (const lot of DEMO_SALE.lots) {
      const text = lotComment(lot);
      expect(text).toContain(`Lot ${lot.number}:`);
      expect(text).toMatch(/Demonstration only\./);
      expect(text).not.toMatch(DASH_PATTERN);
    }
    expect(DEMO_SALE.post).not.toMatch(DASH_PATTERN);
  });

  it('posts to the Page’s own timeline and comments under the new post, as the Page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ id: 'PAGE1_77' }))
      .mockResolvedValueOnce(reply({ id: 'PAGE1_77_1' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await createPost(page, 'Hello')).toBe('PAGE1_77');
    expect(await createComment(page, 'PAGE1_77', 'Lot 1')).toBe('PAGE1_77_1');
    const [postUrl, postInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(postUrl).toBe('https://graph.facebook.com/v26.0/PAGE1/feed');
    expect(postInit.method).toBe('POST');
    expect(postInit.body).toBe('message=Hello');
    expect((postInit.headers as Record<string, string>).Authorization).toBe('Bearer PAGETOKEN');
    expect((fetchMock.mock.calls[1] as unknown as [string])[0]).toBe('https://graph.facebook.com/v26.0/PAGE1_77/comments');
  });

  it('runs the whole sale in order: the post, then one comment per lot, saving after each step', async () => {
    const fetchMock = vi.fn(async (url: string) => reply({ id: url.endsWith('/feed') ? 'PAGE1_77' : `c${fetchMock.mock.calls.length}` }));
    vi.stubGlobal('fetch', fetchMock);
    const saved: unknown[] = [];
    const done = await runDemoSale(page, null, (p) => void saved.push(p));
    expect(done).toEqual({ postId: 'PAGE1_77', commented: 3 });
    expect(saved).toEqual([
      { postId: 'PAGE1_77', commented: 0 },
      { postId: 'PAGE1_77', commented: 1 },
      { postId: 'PAGE1_77', commented: 2 },
      { postId: 'PAGE1_77', commented: 3 },
    ]);
    const urls = fetchMock.mock.calls.map((c) => (c as unknown as [string])[0]);
    expect(urls).toEqual([
      'https://graph.facebook.com/v26.0/PAGE1/feed',
      'https://graph.facebook.com/v26.0/PAGE1_77/comments',
      'https://graph.facebook.com/v26.0/PAGE1_77/comments',
      'https://graph.facebook.com/v26.0/PAGE1_77/comments',
    ]);
    const bodies = fetchMock.mock.calls.map((c) => (c as unknown as [string, RequestInit])[1].body);
    expect(decodeURIComponent(String(bodies[1])).replace(/\+/g, ' ')).toBe(`message=${lotComment(DEMO_SALE.lots[0])}`);
    expect(demoDone(done)).toBe(true);
  });

  it('carries on after a failure without posting the sale a second time', async () => {
    const fail = { ok: false, status: 500, json: async () => ({ error: { code: 2, message: 'try later' } }) } as unknown as Response;
    const fetchMock = vi.fn().mockResolvedValueOnce(reply({ id: 'PAGE1_77' })).mockResolvedValueOnce(reply({ id: 'c1' })).mockResolvedValueOnce(fail);
    vi.stubGlobal('fetch', fetchMock);
    let kept = null as { postId: string; commented: number } | null;
    await expect(runDemoSale(page, null, (p) => void (kept = p))).rejects.toBeInstanceOf(MetaError);
    expect(kept).toEqual({ postId: 'PAGE1_77', commented: 1 });
    expect(demoDone(kept)).toBe(false);

    const again = vi.fn(async () => reply({ id: 'cx' }));
    vi.stubGlobal('fetch', again);
    const done = await runDemoSale(page, kept, (p) => void (kept = p));
    expect(done).toEqual({ postId: 'PAGE1_77', commented: 3 });
    const urls = again.mock.calls.map((c) => (c as unknown as [string])[0]);
    expect(urls).toHaveLength(2);
    expect(urls.every((u) => u.endsWith('/PAGE1_77/comments'))).toBe(true);
  });

  it('writes nothing when the sale is already complete', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const done = await runDemoSale(page, { postId: 'PAGE1_77', commented: 3 }, () => undefined);
    expect(done.commented).toBe(3);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to call it done when Facebook returns no id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply({})));
    await expect(createPost(page, 'x')).rejects.toBeInstanceOf(MetaError);
  });
});
