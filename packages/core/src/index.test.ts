import { expect, test } from 'bun:test';
import { fillGuide, isCancelled, matchesQuery, parseDuration, isSafeUrl, priorityLevel, providers, sortTasks, splitSecrets } from '.';
import type { Task } from './types';

test('splitSecrets keeps secret fields out of plain values', () => {
  const jira = providers.find((p) => p.id === 'jira')!;
  const { plain, secret } = splitSecrets(jira, { domain: 'acme', email: 'a@b.c', apiToken: 'tok' });
  expect(plain).toEqual({ domain: 'acme', email: 'a@b.c' });
  expect(secret).toEqual({ apiToken: 'tok' });
});

test('sortTasks puts newest first without mutating', () => {
  const t = (id: string, updatedAt: string) => ({ id, updatedAt }) as Task;
  const input = [t('a', '2026-01-01T00:00:00.000Z'), t('b', '2026-03-01T00:00:00.000Z')];
  expect(sortTasks(input).map((x) => x.id)).toEqual(['b', 'a']);
  expect(input[0]!.id).toBe('a');
});

test('sortTasks orders by creation so an edit does not move a task', () => {
  const t = (id: string, createdAt: string, updatedAt: string) => ({ id, createdAt, updatedAt }) as Task;
  const input = [t('old-but-edited', '2026-01-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z'), t('new', '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z')];
  expect(sortTasks(input).map((x) => x.id)).toEqual(['new', 'old-but-edited']);
});

test('fillGuide fills known fields and keeps unknown placeholders', () => {
  expect(fillGuide('{email} {domain} {x}', { email: 'me', domain: ' ' })).toBe('me {domain} {x}');
  // A pasted scheme or trailing slash doesn't double up after "https://".
  expect(fillGuide('https://{domain}/x', { domain: 'https://jira.co/jira/' })).toBe('https://jira.co/jira/x');
  expect(fillGuide('https://{domain}/x', { domain: 'jira.co' })).toBe('https://jira.co/x');
});

test('isSafeUrl only allows http(s)', () => {
  expect(isSafeUrl('https://a.atlassian.net/browse/X-1')).toBe(true);
  expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  expect(isSafeUrl('not a url')).toBe(false);
});

test('priorityLevel reads common names and leaves unknown ones empty', () => {
  expect(priorityLevel('Highest')).toBe(5);
  expect(priorityLevel('High')).toBe(4);
  expect(priorityLevel('Medium')).toBe(3);
  expect(priorityLevel('Düşük')).toBe(2);
  expect(priorityLevel('Lowest')).toBe(1);
  expect(priorityLevel('P0 - fire')).toBeUndefined();
  expect(priorityLevel(undefined)).toBeUndefined();
});

test('isCancelled spots cancel-like done statuses only', () => {
  for (const s of ['Cancel', 'Cancelled', 'Rejected', "Won't Do", 'İptal Edildi', 'Reddedildi']) expect(isCancelled(s)).toBe(true);
  for (const s of ['Done', 'Closed', 'Resolved', 'Tamamlandı']) expect(isCancelled(s)).toBe(false);
});

test('parseDuration reads Jira-style and Turkish durations', () => {
  expect(parseDuration('1h 30m')).toBe(5400);
  expect(parseDuration('45m')).toBe(2700);
  expect(parseDuration('1.5h')).toBe(5400);
  expect(parseDuration('1,5sa')).toBe(5400);
  expect(parseDuration('1d')).toBe(8 * 3600);
  expect(parseDuration('2sa 15dk')).toBe(8100);
  expect(parseDuration('1w')).toBe(40 * 3600);
});

test('parseDuration rejects unitless, unknown and tiny input', () => {
  for (const s of ['', '2', 'abc', '1x', '1h abc', '30s']) expect(parseDuration(s)).toBeUndefined();
});

test('matchesQuery finds by key, title words, assignee and sub-tasks, case and Turkish insensitive', () => {
  const task = {
    id: '1',
    key: 'FEMBS3-2363',
    title: 'International Roaming Display',
    status: 'İnceleniyor',
    statusCategory: 'in_progress',
    type: 'Story',
    sprint: '26-Pi3-S4',
    assignee: { id: 'a', name: 'Enes Akköse' },
    subtasks: [{ id: 's', key: 'FEMBS3-2460', title: 'Test Preparation', status: 'To Do', statusCategory: 'todo', url: 'x' }],
    url: 'x',
    connectionId: 'c',
    updatedAt: '2026-10-30T00:00:00.000Z',
  } as Task;
  for (const q of ['', '  ', '2363', 'fembs3', 'roaming display', 'ROAMING', 'inceleniyor', 'akköse', 'pi3', '2460', 'preparation'])
    expect(matchesQuery(task, q)).toBe(true);
  for (const q of ['roaming missing', 'bug', '9999']) expect(matchesQuery(task, q)).toBe(false);
});
