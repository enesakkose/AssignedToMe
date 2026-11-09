/**
 * `captcha`: the server wants a browser sign-in before it accepts the credentials again (Jira's lockout).
 * `blocked`: a network/security proxy answered instead of the API (an HTML block page), so the request never reached it.
 */
export type ProviderErrorCode =
  | 'unauthorized'
  | 'captcha'
  | 'blocked'
  | 'not_found'
  | 'network'
  | 'invalid_input'
  | 'invalid_response'
  | 'rate_limited'
  | 'http';

/** Never put credentials in the message. */
export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * What the server says it refused; never includes our credentials. Jira/Bitbucket: { errorMessages, errors: [{message}] or {field: msg} };
 * GraphQL (Linear, GitHub): { errors: [{ message }] }; GitHub/GitLab REST: { message } or { error }.
 */
async function serverDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { errorMessages?: unknown[]; errors?: unknown; message?: unknown; error?: unknown };
    const errors = Array.isArray(body.errors)
      ? body.errors.map((e) => (e as { message?: unknown } | null)?.message)
      : body.errors && typeof body.errors === 'object'
        ? Object.values(body.errors)
        : [];
    return [...(body.errorMessages ?? []), ...errors, body.message, body.error].filter((m) => typeof m === 'string').join(' ').slice(0, 200);
  } catch {
    return '';
  }
}

export async function request(fetch: typeof globalThis.fetch, url: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ProviderError('network', 'Network request failed');
  }
  // Too many requests: 429, or GitHub's 403 with no requests left. Not a sign-in problem, so it must not read as one.
  if (res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0'))
    throw new ProviderError('rate_limited', 'Rate limit reached', res.status);
  if (res.status === 401 || res.status === 403) {
    const denied = res.headers.get('X-Authentication-Denied-Reason') ?? '';
    if (/captcha/i.test(denied)) throw new ProviderError('captcha', 'Sign-in needs a CAPTCHA', res.status);
    const detail = await serverDetail(res);
    throw new ProviderError('unauthorized', `Credentials rejected${detail ? `: ${detail}` : ''}`, res.status);
  }
  if (res.status === 404) throw new ProviderError('not_found', 'Not found', res.status);
  if (!res.ok) {
    const detail = await serverDetail(res);
    throw new ProviderError('http', `HTTP ${res.status}${detail ? `: ${detail}` : ''}`, res.status);
  }
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    // Usually an HTML login or proxy page; a short, tag-free snippet makes that visible.
    const type = res.headers.get('content-type')?.split(';')[0] ?? 'unknown type';
    const snippet = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    // An HTML page where JSON was due means a proxy/firewall answered, not the API.
    if (/html/.test(type)) throw new ProviderError('blocked', `Blocked by a proxy (HTTP ${res.status}): ${snippet}`, res.status);
    throw new ProviderError('invalid_response', `Response is not JSON (HTTP ${res.status}, ${type}): ${snippet}`);
  }
}
