import { randomBytes } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { z } from 'zod';
import { ProviderError } from '../errors';
import type { Fetch } from '../types';

/** Shared pieces of the browser sign-ins (Atlassian, Linear, GitHub): PKCE, token requests, expiry. */

export const b64url = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const randomState = () => b64url(randomBytes(16));

/** A PKCE pair: the challenge goes in the authorize URL, the verifier in the token request. */
export function pkce() {
  const verifier = b64url(randomBytes(32));
  return { verifier, challenge: b64url(sha256(new TextEncoder().encode(verifier))) };
}

const tokenSchema = z.object({
  access_token: z.string().min(1).optional(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  error: z.string().optional(),
});
export type TokenResponse = z.infer<typeof tokenSchema>;

/** POSTs a form to a token endpoint. A 400/401 is a refused sign-in (expired or revoked), never our bug to retry. */
export async function postForm(fetch: Fetch, url: string, body: Record<string, string>, accept?: string): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(accept ? { Accept: accept } : {}) },
      body: new URLSearchParams(body).toString(),
    });
  } catch {
    throw new ProviderError('network', 'Network request failed');
  }
  if (res.status === 400 || res.status === 401) throw new ProviderError('unauthorized', 'Sign-in was refused', res.status);
  if (!res.ok) throw new ProviderError('http', `HTTP ${res.status}`, res.status);
  const parsed = tokenSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new ProviderError('invalid_response', 'Unexpected token response');
  return parsed.data;
}

/** The access token, or a refusal with the server's reason. */
export function accessToken(token: TokenResponse): string {
  if (!token.access_token) throw new ProviderError('unauthorized', token.error ?? 'No access token');
  return token.access_token;
}

export const expiresAt = (seconds = 3600) => String(Date.now() + seconds * 1000);

/** Refresh this long before the access token runs out, so a request never goes out with a dying token. */
export const REFRESH_MARGIN_MS = 10 * 60_000;

/** The `code` from the URL the browser came back to, after checking it answers our own request. */
export function codeFrom(redirectedTo: string, state: string): string {
  const params = new URL(redirectedTo).searchParams;
  if (params.get('state') !== state) throw new ProviderError('invalid_input', 'Sign-in response does not match');
  const code = params.get('code');
  if (!code) throw new ProviderError('unauthorized', params.get('error_description') ?? params.get('error') ?? 'Sign-in was cancelled');
  return code;
}
