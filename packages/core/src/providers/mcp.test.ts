import { expect, test } from 'bun:test';
import type { Fetch } from '../types';
import { beginMcpSignIn } from './mcp';

test('the registration names the app with its logo and site, for the provider\'s consent page', async () => {
  let sent: Record<string, unknown> = {};
  const fetch = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return Response.json({ client_id: 'cid' }, { status: 201 });
  }) as Fetch;
  const { url } = await beginMcpSignIn(fetch, { register: 'https://a/register', authorize: 'https://a/authorize', token: 'https://a/token' }, 'http://localhost:1/callback');
  expect(sent).toMatchObject({ client_name: 'AssignedToMe', redirect_uris: ['http://localhost:1/callback'], token_endpoint_auth_method: 'none' });
  expect(String(sent.logo_uri)).toStartWith('https://raw.githubusercontent.com/');
  expect(String(sent.logo_uri)).toEndWith('/mytask-oauth-logo.png');
  expect(String(sent.client_uri)).toStartWith('https://github.com/');
  expect(new URL(url).searchParams.get('client_id')).toBe('cid');
});
