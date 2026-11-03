import { azure } from './providers/azure';
import { github } from './providers/github';
import { gitlab } from './providers/gitlab';
import { jira, jiraDataCenter } from './providers/jira';
import { linear } from './providers/linear';
import type { Provider, Task } from './types';

export * from './types';
export * from './errors';
export * from './priority';
export * from './status';
export * from './duration';
export * from './search';
export * from './filters';

/** Add a provider: create providers/<id>/index.ts and list it here. */
export const providers: Provider[] = [jira, jiraDataCenter, linear, github, gitlab, azure];

export function getProvider(id: string): Provider | undefined {
  return providers.find((p) => p.id === id);
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
