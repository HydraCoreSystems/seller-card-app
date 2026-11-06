/**
 * The Facebook Graph API calls for the Page demonstration. Each call carries its token in the
 * Authorization header, so a token is never part of an address. Nothing is logged.
 */
import {
  META_APP_ID,
  META_RETURN_URL,
  MAX_PAGES,
  graphUrl,
  isExpired,
  nextPage,
  readComments,
  readPages,
  readPosts,
  type MetaComment,
  type MetaPage,
  type MetaPost,
} from '../core/metaDemo';

export class MetaError extends Error {
  constructor(
    message: string,
    readonly expired: boolean,
  ) {
    super(message);
  }
}

async function call(token: string | null, method: 'GET' | 'POST' | 'DELETE', url: string, form?: Record<string, string>): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
  } catch {
    throw new MetaError('network', false);
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // An empty or odd body is handled by the status below.
  }
  const error = (json as { error?: { code?: number; type?: string; message?: string } } | null)?.error;
  if (!res.ok || error) throw new MetaError(error?.message ?? `Facebook answered ${res.status}`, isExpired(error));
  return json;
}

/** The Pages this seller manages, each with its own Page token. Needs pages_show_list. */
export async function fetchPages(userToken: string): Promise<MetaPage[]> {
  return readPages(await call(userToken, 'GET', graphUrl('me/accounts', { fields: 'id,name,access_token', limit: 100 })));
}

/** Subscribes the Page to this app for feed activity. Needs pages_manage_metadata. */
export async function subscribePage(page: MetaPage): Promise<boolean> {
  const json = await call(page.token, 'POST', graphUrl(`${page.id}/subscribed_apps`), { subscribed_fields: 'feed' });
  return (json as { success?: boolean } | null)?.success === true;
}

/** Removes the subscription. Needs pages_manage_metadata. */
export async function unsubscribePage(page: MetaPage): Promise<boolean> {
  const json = await call(page.token, 'DELETE', graphUrl(`${page.id}/subscribed_apps`));
  return (json as { success?: boolean } | null)?.success === true;
}

/** Recent posts on the Page's own timeline. Needs pages_read_engagement. */
export async function fetchPosts(page: MetaPage): Promise<MetaPost[]> {
  return readPosts(
    await call(page.token, 'GET', graphUrl(`${page.id}/posts`, { fields: 'id,message,story,created_time,permalink_url', limit: 25 })),
  );
}

/** Every comment on one post, in the order Facebook returns them. Needs pages_read_user_content. */
export async function fetchComments(page: MetaPage, postId: string): Promise<MetaComment[]> {
  const all: MetaComment[] = [];
  let url: string | null = graphUrl(`${postId}/comments`, {
    fields: 'id,message,from,created_time',
    order: 'chronological',
    filter: 'stream',
    limit: 100,
  });
  for (let i = 0; url && i < MAX_PAGES; i += 1) {
    const json = await call(page.token, 'GET', url);
    all.push(...readComments(json));
    url = nextPage(json);
  }
  return all;
}

/** Takes this app's permissions back from the account, so the next sign in asks again. */
export async function revokePermissions(userToken: string): Promise<void> {
  await call(userToken, 'DELETE', graphUrl('me/permissions'));
}

/** Posts a message on the Page's own timeline, as the Page. Needs pages_manage_posts. Returns the post id. */
export async function createPost(page: MetaPage, message: string): Promise<string> {
  const json = await call(page.token, 'POST', graphUrl(`${page.id}/feed`), { message });
  const id = (json as { id?: string } | null)?.id;
  if (!id) throw new MetaError('Facebook did not return the new post.', false);
  return id;
}

/** Adds a comment under one of the Page's own posts, as the Page. Needs pages_manage_engagement. */
export async function createComment(page: MetaPage, postId: string, message: string): Promise<string> {
  const json = await call(page.token, 'POST', graphUrl(`${postId}/comments`), { message });
  const id = (json as { id?: string } | null)?.id;
  if (!id) throw new MetaError('Facebook did not return the new comment.', false);
  return id;
}

/**
 * Trades a returned code for a user token, with the app ID and the same return address and nothing
 * else. This carries no app secret, so Facebook decides whether it will answer. The implicit return
 * does not need it, and is the one this build asks for.
 */
export async function exchangeCode(code: string): Promise<string> {
  const json = await call(null, 'GET', graphUrl('oauth/access_token', { client_id: META_APP_ID, redirect_uri: META_RETURN_URL, code }));
  const token = (json as { access_token?: string } | null)?.access_token;
  if (!token) throw new MetaError('Facebook did not return a token for that code.', false);
  return token;
}
