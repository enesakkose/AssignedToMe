import { azure } from './providers/azure';
import { github } from './providers/github';
import { gitlab } from './providers/gitlab';
import { jira, jiraDataCenter } from './providers/jira';
import { jiraAtlassian } from './providers/jira-atlassian';
import { githubSignIn } from './providers/github/sign-in';
import { linearSignIn } from './providers/linear/sign-in';
import { linear } from './providers/linear';
import type { Connection, Provider, Task } from './types';

export * from './types';
export * from './errors';
export * from './priority';
export * from './status';
export * from './duration';
export * from './search';
export * from './filters';
export * from './transfer';

/** Add a provider: create providers/<id>/index.ts and list it here. */
export const providers: Provider[] = [jira, jiraDataCenter, linear, github, gitlab, azure];

/** Offered inside another provider's screen (`signIn.for`), not in the list above. */
export const signInProviders: Provider[] = [jiraAtlassian, linearSignIn, githubSignIn];

export function getProvider(id: string): Provider | undefined {
  return providers.find((p) => p.id === id) ?? signInProviders.find((p) => p.id === id);
}

/** Fills `{field}` placeholders in a guide `copy` value. */
export function fillGuide(template: string, values: Record<string, string>): string {
  return template.replace(/(:\/\/)?\{(\w+)\}/g, (match, scheme: string | undefined, key: string) => {
    let value = values[key]?.trim();
    if (!value) return match;
    // In "https://{domain}" the user may have pasted the address with its own scheme or a trailing slash.
    if (scheme) value = value.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    return (scheme ?? '') + value;
  });
}

/**
 * What may leave this device for another. A board added by signing in goes without its sign-in (tokens and this
 * device's session state): tokens that renew can't be shared between two devices, so the other one signs in itself.
 */
export function transferable(connection: Connection): Connection {
  const provider = getProvider(connection.providerId);
  if (!provider?.signIn) return connection;
  const drop = new Set(provider.fields.filter((f) => f.type === 'secret' || f.session).map((f) => f.key));
  return { ...connection, values: Object.fromEntries(Object.entries(connection.values).filter(([key]) => !drop.has(key))) };
}

/**
 * Renews a signed-in board's credentials when they are about to end. The refresh token works once, so when two
 * places renew at the same moment (the popover and the app window, the background task and the app) the loser is
 * refused; `reload` then re-reads what the winner saved, and that is used instead of failing. `changed` says the
 * returned values are new and still need saving.
 */
export async function renewConnection(
  provider: Provider,
  connection: Connection,
  fetch: typeof globalThis.fetch,
  reload: () => Promise<Connection>,
): Promise<{ values: Record<string, string>; changed: boolean }> {
  try {
    const values = await provider.refreshCredentials?.(connection, fetch);
    return values ? { values, changed: true } : { values: connection.values, changed: false };
  } catch (error) {
    const again = await reload();
    if (again.values.refreshToken && again.values.refreshToken !== connection.values.refreshToken)
      return { values: again.values, changed: false };
    throw error;
  }
}

/** A board that comes over again (same id) keeps this device's own sign-in state: the sender's copy has none. */
export function mergeIncoming(have: Connection | undefined, incoming: Connection): Connection {
  return have && getProvider(incoming.providerId)?.signIn ? { ...incoming, values: { ...have.values, ...incoming.values } } : incoming;
}

/** Splits form values into what may be stored plainly and what must go to the platform's secret store. */
export function splitSecrets(provider: Provider, values: Record<string, string>) {
  const secretKeys = new Set(provider.fields.filter((f) => f.type === 'secret').map((f) => f.key));
  const plain: Record<string, string> = {};
  const secret: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) (secretKeys.has(key) ? secret : plain)[key] = value;
  return { plain, secret };
}

/** Newest first across boards. */
export function sortTasks(tasks: Task[]): Task[] {
  // Newest task first by creation, so a change to a task doesn't jump it to the top; updatedAt only when a source has no creation date.
  const at = (t: Task) => t.createdAt ?? t.updatedAt;
  return [...tasks].sort((a, b) => at(b).localeCompare(at(a)));
}

/** Only http(s) task links may be opened. */
export function isSafeUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}
