/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import {
  GRAPH_VERSION,
  META_APP_ID,
  META_CONFIG_ID,
  META_REDIRECT_URI,
  META_URL_SCHEME,
  arrange,
  graphUrl,
  isExpired,
  metaDemoEnabled,
  nextPage,
  parseGraphTime,
  readComments,
  readPages,
  readPosts,
  type MetaComment,
} from '../src/core/metaDemo';
import { META_COPY } from '../src/core/metaDemoCopy';
import { DASH_PATTERN } from '../src/core/text';
import { MetaError, fetchComments, fetchPages, fetchPosts, subscribePage, unsubscribePage } from '../src/lib/metaGraph';

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
  it('uses the production Meta app, the Page connection configuration and a current Graph version', () => {
    expect(META_APP_ID).toBe('1166563362604892');
    expect(META_CONFIG_ID).toBe('29138336945817387');
    expect(GRAPH_VERSION).toBe('v26.0');
    expect(META_REDIRECT_URI).toBe('fb1166563362604892://authorize');
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

  it('stays inside its scope: no Messenger, no groups, nothing that posts', () => {
    const files = ['src/core/metaDemo.ts', 'src/lib/metaGraph.ts', 'src/lib/metaSession.ts', 'src/core/metaConfig.json'];
    for (const f of files) {
      const text = readFileSync(join(__dirname, '..', f), 'utf8');
      expect(text, f).not.toMatch(/pages_messaging|messenger|\/groups|group_id|pages_manage_posts|pages_manage_engagement/i);
    }
    // Only reads, plus the subscription calls and the sign out.
    const graph = readFileSync(join(__dirname, '..', 'src/lib/metaGraph.ts'), 'utf8');
    expect([...graph.matchAll(/'(POST)'/g)].length).toBeGreaterThan(0);
    expect(graph).not.toMatch(/\/feed/);
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

  it('names no permission this build does not use', () => {
    const names = META_COPY.uses.map((u) => u.name);
    expect(names).toEqual(['pages_show_list', 'pages_manage_metadata', 'pages_read_engagement', 'pages_read_user_content']);
  });
});
