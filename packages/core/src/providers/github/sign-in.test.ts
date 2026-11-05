import { expect, test } from 'bun:test';
import type { Fetch } from '../../types';
import { githubSignIn } from './sign-in';

test('device sign-in waits while the code is pending, then names the board after the account', async () => {
  let polls = 0;
  const fetch = (async (url: string) => {
    if (url.endsWith('/login/device/code'))
      return Response.json({ device_code: 'd', user_code: 'ABCD-1234', verification_uri: 'https://github.com/login/device', interval: 0, expires_in: 60 });
    if (url.endsWith('/login/oauth/access_token')) return Response.json(++polls < 2 ? { error: 'authorization_pending' } : { access_token: 'gho_x' });
    return Response.json({ login: 'octo' });
  }) as Fetch;
  const how = githubSignIn.signIn!;
  if (how.kind !== 'device') throw new Error('expected a device sign-in');
  const started = await how.begin(fetch);
  expect(started.code).toBe('ABCD-1234');
  expect(await how.finish(fetch, started.pending)).toEqual([{ name: 'octo', values: { token: 'gho_x' } }]);
  expect(polls).toBe(2);
});
