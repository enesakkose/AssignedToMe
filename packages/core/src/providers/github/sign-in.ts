import { z } from 'zod';
import { ProviderError, request } from '../../errors';
import type { Provider } from '../../types';
import { github, headers } from '.';

// shortcut: the client id of the AssignedToMe OAuth app on GitHub (public, "Enable Device Flow" on, no secret
// needed); empty hides the sign-in.
const CLIENT_ID = 'Ov23liRJmKtprKBmgIYi';
const DEVICE_URL = 'https://github.com/login/device';
/** The same scopes the token guide asks for: issues in private repos, project Status, organizations. */
const SCOPES = 'repo project read:org';

const deviceSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  interval: z.number().default(5),
  expires_in: z.number().default(900),
});
const pollSchema = z.object({ access_token: z.string().optional(), error: z.string().optional(), interval: z.number().optional() });

async function postJson(fetch: typeof globalThis.fetch, url: string, body: Record<string, string>) {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(body).toString() });
  } catch {
    throw new ProviderError('network', 'Network request failed');
  }
  if (!res.ok) throw new ProviderError('http', `HTTP ${res.status}`, res.status);
  return res.json().catch(() => null);
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(new ProviderError('unauthorized', 'Sign-in was cancelled'))), { once: true });
  });

/** GitHub through "Sign in with GitHub" (device flow): the same provider, with an OAuth token instead of a personal one. */
export const githubSignIn: Provider = {
  ...github,
  id: 'github-oauth',
  fields: [{ key: 'token', type: 'secret', label: { tr: 'Erişim token’ı', en: 'Access token' } }],
  guide: [],
  signIn: CLIENT_ID
    ? {
        for: 'github',
        label: { tr: 'GitHub ile giriş yap', en: 'Sign in with GitHub' },
        kind: 'device',
        begin: async (fetch) => {
          const parsed = deviceSchema.safeParse(await postJson(fetch, 'https://github.com/login/device/code', { client_id: CLIENT_ID, scope: SCOPES }));
          if (!parsed.success) throw new ProviderError('invalid_response', 'Unexpected GitHub response');
          const d = parsed.data;
          return {
            // Always GitHub's own page: the one the response names is not trusted to send someone to a typed code.
            url: DEVICE_URL,
            code: d.user_code,
            pending: { deviceCode: d.device_code, interval: String(d.interval), until: String(Date.now() + d.expires_in * 1000) },
          };
        },
        finish: async (fetch, pending, signal) => {
          let interval = Number(pending.interval) * 1000;
          // GitHub answers "authorization_pending" until the code is entered; "slow_down" adds 5 seconds.
          while (Date.now() < Number(pending.until)) {
            await sleep(interval, signal);
            const poll = pollSchema.safeParse(
              await postJson(fetch, 'https://github.com/login/oauth/access_token', {
                client_id: CLIENT_ID,
                device_code: pending.deviceCode!,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
              }),
            );
            if (!poll.success) throw new ProviderError('invalid_response', 'Unexpected GitHub response');
            const { access_token, error } = poll.data;
            if (access_token) {
              const values = { token: access_token };
              const me = z.object({ login: z.string() }).safeParse(
                await request(fetch, 'https://api.github.com/user', { headers: headers({ id: '', providerId: 'github-oauth', name: '', values }) }),
              );
              if (!me.success) throw new ProviderError('invalid_response', 'Unexpected GitHub response');
              return [{ name: me.data.login, values }];
            }
            if (error === 'slow_down') interval = (poll.data.interval ?? interval / 1000 + 5) * 1000;
            else if (error !== 'authorization_pending') throw new ProviderError('unauthorized', error ?? 'Sign-in was refused');
          }
          throw new ProviderError('unauthorized', 'The code expired');
        },
      }
    : undefined,
};
