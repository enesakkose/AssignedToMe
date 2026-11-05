import { z } from 'zod';
import { ProviderError } from '../errors';
import type { Fetch } from '../types';
import { accessToken, codeFrom, expiresAt, pkce, postForm, randomState, REFRESH_MARGIN_MS, type TokenResponse } from './oauth';

/**
 * A minimal client for remote MCP servers (streamable HTTP, JSON-RPC) and their sign-in: OAuth 2.1 with dynamic
 * client registration and PKCE, so the app needs no registration or secret of its own (Atlassian, Linear).
 */

const PROTOCOL = '2025-06-18';

// shortcut: the logo and site shown on the provider's consent page ("AssignedToMe is requesting access"), served from
// this repo's main branch; move them to our own domain if the repo is renamed or goes private.
const REPO = 'enesakkose/AssignedToMe';
const LOGO_URI = `https://raw.githubusercontent.com/${REPO}/main/desktop/design/logo/export/mytask-oauth-logo.png`;
const CLIENT_URI = `https://github.com/${REPO}`;

const rpcSchema = z.object({
  id: z.number().optional(),
  result: z
    .object({ content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(), isError: z.boolean().optional() })
    .optional(),
  error: z.object({ message: z.string() }).optional(),
});

/** One MCP session per server and access token; a new token (after a refresh) starts a new one. */
const sessions = new Map<string, Promise<string | null>>();

async function post(fetch: Fetch, url: string, token: string, session: string | null, body: unknown): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Mcp-Protocol-Version': PROTOCOL,
        ...(session ? { 'Mcp-Session-Id': session } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ProviderError('network', 'Network request failed');
  }
  if (res.status === 401 || res.status === 403) throw new ProviderError('unauthorized', 'Sign-in expired', res.status);
  if (res.status === 429) throw new ProviderError('rate_limited', 'Rate limit reached', res.status);
  if (!res.ok) throw new ProviderError('http', `HTTP ${res.status}`, res.status);
  return res;
}

/** The JSON-RPC message with this id, from a JSON body or a server-sent event stream. */
async function reply(res: Response, id: number) {
  const text = await res.text();
  const bodies = (res.headers.get('content-type') ?? '').includes('text/event-stream')
    ? text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim())
    : [text];
  for (const body of bodies) {
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      continue;
    }
    const parsed = rpcSchema.safeParse(json);
    if (parsed.success && parsed.data.id === id) return parsed.data;
  }
  throw new ProviderError('invalid_response', 'No answer from the MCP server');
}

let nextId = 0;

function session(fetch: Fetch, url: string, token: string): Promise<string | null> {
  const key = `${url} ${token}`;
  let s = sessions.get(key);
  if (!s) {
    s = (async () => {
      const id = ++nextId;
      const res = await post(fetch, url, token, null, {
        jsonrpc: '2.0',
        id,
        method: 'initialize',
        params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: 'AssignedToMe', version: '1' } },
      });
      const sessionId = res.headers.get('Mcp-Session-Id');
      await reply(res, id);
      await post(fetch, url, token, sessionId, { jsonrpc: '2.0', method: 'notifications/initialized' });
      return sessionId;
    })();
    s.catch(() => sessions.delete(key));
    sessions.set(key, s);
  }
  return s;
}

/** A tool's answer as JSON; anything else is an unexpected answer (and the text, which isn't ours, stays out of the error). */
export function parseTool(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError('invalid_response', 'Unexpected answer from the server');
  }
}

/** Calls a tool on the MCP server at `url` and returns its text. */
export async function callTool(fetch: Fetch, url: string, token: string, name: string, args: Record<string, unknown>): Promise<string> {
  const id = ++nextId;
  const res = await post(fetch, url, token, await session(fetch, url, token), { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
  const msg = await reply(res, id);
  const text = msg.result?.content?.map((c) => c.text ?? '').join('') ?? '';
  if (msg.error || msg.result?.isError) {
    const detail = (msg.error?.message ?? text).slice(0, 200);
    if (/not found|does not exist/i.test(detail)) throw new ProviderError('not_found', detail, 404);
    throw new ProviderError('http', detail);
  }
  return text;
}


/** A server's OAuth endpoints, from its /.well-known/oauth-authorization-server. */
export type McpAuth = { register: string; authorize: string; token: string };

const registrationSchema = z.object({ client_id: z.string().min(1) });

/** Registers this app with the server for one sign-in and returns the page to open plus what `exchange` needs back. */
export async function beginMcpSignIn(fetch: Fetch, auth: McpAuth, redirectUri: string) {
  let res: Response;
  try {
    res = await fetch(auth.register, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'AssignedToMe',
        logo_uri: LOGO_URI,
        client_uri: CLIENT_URI,
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      }),
    });
  } catch {
    throw new ProviderError('network', 'Network request failed');
  }
  const reg = registrationSchema.safeParse(await res.json().catch(() => null));
  if (!res.ok || !reg.success) throw new ProviderError('http', `Registration failed (HTTP ${res.status})`, res.status);
  const { verifier, challenge } = pkce();
  const pending = { clientId: reg.data.client_id, redirectUri, state: randomState(), verifier };
  const url = new URL(auth.authorize);
  url.search = new URLSearchParams({
    client_id: pending.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state: pending.state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return { url: url.toString(), pending };
}

/** Trades the redirect for tokens; returns them as the values a board stores. */
export async function finishMcpSignIn(fetch: Fetch, auth: McpAuth, pending: Record<string, string>, redirectedTo: string) {
  const token = await postForm(fetch, auth.token, {
    grant_type: 'authorization_code',
    client_id: pending.clientId!,
    code: codeFrom(redirectedTo, pending.state!),
    redirect_uri: pending.redirectUri!,
    code_verifier: pending.verifier!,
  });
  return tokenValues(token, pending.clientId!);
}

function tokenValues(token: TokenResponse, clientId: string, previousRefresh = '') {
  return {
    clientId,
    accessToken: accessToken(token),
    // Refresh tokens rotate; keep the old one only if the server didn't send a new one.
    refreshToken: token.refresh_token ?? previousRefresh,
    expiresAt: expiresAt(token.expires_in),
  };
}

/** New tokens when the access token is about to expire, else undefined (see Provider.refreshCredentials). */
export async function refreshMcpToken(fetch: Fetch, auth: McpAuth, values: Record<string, string>) {
  const { refreshToken, clientId, expiresAt: at } = values;
  if (Number(at) - Date.now() > REFRESH_MARGIN_MS || !refreshToken || !clientId) return undefined;
  const token = await postForm(fetch, auth.token, { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId });
  return { ...values, ...tokenValues(token, clientId, refreshToken) };
}

/** What a signed-in MCP board stores: secrets go to the platform's secret store like any token. */
export const MCP_FIELDS = [
  { key: 'clientId', type: 'text', session: true, label: { tr: 'İstemci kimliği', en: 'Client id' } },
  { key: 'expiresAt', type: 'text', session: true, label: { tr: 'Oturum bitişi', en: 'Session expiry' } },
  { key: 'accessToken', type: 'secret', label: { tr: 'Erişim token’ı', en: 'Access token' } },
  { key: 'refreshToken', type: 'secret', label: { tr: 'Yenileme token’ı', en: 'Refresh token' } },
] as const;
