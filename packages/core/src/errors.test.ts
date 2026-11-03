import { expect, test } from 'bun:test';
import { ProviderError, request } from './errors';

const res = (body: string, type: string, status = 200) =>
  (async (_u: string | URL | Request) => new Response(body, { status, headers: { "content-type": type } })) as typeof globalThis.fetch;

test('an HTML page where JSON was due is a blocked error, not a parse error', async () => {
  const err = await request(res('<html><body>Erişim Engellendi</body></html>', 'text/html; charset=utf-8'), 'https://x/api', {}).catch((e) => e);
  expect(err).toBeInstanceOf(ProviderError);
  expect((err as ProviderError).code).toBe('blocked');
});

test('non-HTML non-JSON is still an invalid_response', async () => {
  const err = await request(res('not json', 'text/plain'), 'https://x/api', {}).catch((e) => e);
  expect((err as ProviderError).code).toBe('invalid_response');
});

test('a rate limit is its own error, not "credentials rejected"', async () => {
  const limited = (async () => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } })) as unknown as typeof globalThis.fetch;
  expect(await request(limited, 'https://x/api', {}).catch((e) => e)).toMatchObject({ code: 'rate_limited' });
  expect(await request(res('{}', 'application/json', 429), 'https://x/api', {}).catch((e) => e)).toMatchObject({ code: 'rate_limited' });
  // A plain 403 is still a refused sign-in.
  expect(await request(res('{}', 'application/json', 403), 'https://x/api', {}).catch((e) => e)).toMatchObject({ code: 'unauthorized' });
});

test('error details are read from GraphQL and REST message shapes too', async () => {
  const detail = async (body: unknown) => ((await request(res(JSON.stringify(body), 'application/json', 400), 'https://x/api', {}).catch((e) => e)) as Error).message;
  expect(await detail({ errors: [{ message: 'Authentication required' }] })).toContain('Authentication required');
  expect(await detail({ message: 'Bad credentials' })).toContain('Bad credentials');
  expect(await detail({ error: 'insufficient_scope' })).toContain('insufficient_scope');
  expect(await detail({ errorMessages: ['Field x'], errors: { y: 'is wrong' } })).toBe('HTTP 400: Field x is wrong');
});
