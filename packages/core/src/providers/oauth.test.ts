import { describe, expect, test } from 'bun:test';
import { sha256 } from '@noble/hashes/sha2.js';
import { ProviderError } from '../errors';
import { renewConnection } from '../index';
import type { Connection, Provider } from '../types';
import { b64url, codeFrom, pkce } from './oauth';

describe('sign-in basics', () => {
  test('the redirect is only believed when it carries our own state', () => {
    expect(codeFrom('http://localhost:1/callback?code=abc&state=s1', 's1')).toBe('abc');
    expect(() => codeFrom('http://localhost:1/callback?code=abc&state=other', 's1')).toThrow(ProviderError);
    expect(() => codeFrom('http://localhost:1/callback?code=abc', 's1')).toThrow(ProviderError);
    // A cancelled sign-in comes back with our state but no code.
    expect(() => codeFrom('http://localhost:1/callback?error=access_denied&state=s1', 's1')).toThrow('access_denied');
  });

  test('the PKCE challenge is the SHA-256 of the verifier, and every pair is new', () => {
    const a = pkce();
    expect(a.challenge).toBe(b64url(sha256(new TextEncoder().encode(a.verifier))));
    expect(a.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pkce().verifier).not.toBe(a.verifier);
  });
});

describe('renewConnection', () => {
  const board = (refreshToken: string): Connection => ({ id: 'c1', providerId: 'x', name: 'x', values: { refreshToken, accessToken: 'old' } });
  const provider = (refresh: Provider['refreshCredentials']) => ({ refreshCredentials: refresh }) as Provider;
  const refused = () => Promise.reject(new ProviderError('unauthorized', 'Sign-in was refused', 400));

  test('a renewal that works is returned to be saved', async () => {
    const p = provider(async (c) => ({ ...c.values, accessToken: 'new' }));
    expect(await renewConnection(p, board('r1'), fetch, async () => board('r1'))).toEqual({ values: { refreshToken: 'r1', accessToken: 'new' }, changed: true });
  });

  test('nothing to renew yet: the values stay and nothing is saved', async () => {
    const p = provider(async () => undefined);
    expect(await renewConnection(p, board('r1'), fetch, async () => board('r1'))).toEqual({ values: board('r1').values, changed: false });
  });

  test('if another window renewed first, its saved tokens are used instead of failing', async () => {
    const winner = { id: 'c1', providerId: 'x', name: 'x', values: { refreshToken: 'r2', accessToken: 'fresh' } };
    expect(await renewConnection(provider(refused), board('r1'), fetch, async () => winner)).toEqual({ values: winner.values, changed: false });
  });

  test("a winner still mid-save is waited for, not latched as a sign-out", async () => {
    // The loser loses the race, then re-reads: the old token at first, the winner's saved token a moment later.
    let reads = 0;
    const reload = async () => (reads++ < 2 ? board('r1') : { id: 'c1', providerId: 'x', name: 'x', values: { refreshToken: 'r2', accessToken: 'fresh' } });
    expect(await renewConnection(provider(refused), board('r1'), fetch, reload)).toEqual({ values: { refreshToken: 'r2', accessToken: 'fresh' }, changed: false });
  });

  test('a refusal with nothing newer saved is a real sign-out', async () => {
    await expect(renewConnection(provider(refused), board('r1'), fetch, async () => board('r1'))).rejects.toMatchObject({ code: 'unauthorized' });
  });
});
