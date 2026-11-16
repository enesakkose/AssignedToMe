import { expect, test } from 'bun:test';
import { solverOf } from './solvers';

const claude = solverOf('claude');

test('a non-JSON line yields no events', () => {
  expect(claude.parse('not json')).toEqual([]);
  expect(claude.parse('')).toEqual([]);
});

test('claude: init carries the session id, assistant text and tool use, result ends it', () => {
  expect(claude.parse(JSON.stringify({ type: 'system', subtype: 'init', session_id: 'abc' }))).toEqual([{ kind: 'session', id: 'abc' }]);
  expect(
    claude.parse(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }, { type: 'tool_use', name: 'Edit', input: { file_path: 'a.ts' } }] } })),
  ).toEqual([
    { kind: 'text', text: 'hi' },
    { kind: 'tool', name: 'Edit', detail: 'a.ts' },
  ]);
  expect(claude.parse(JSON.stringify({ type: 'result', is_error: false }))).toEqual([{ kind: 'done', ok: true }]);
  expect(claude.parse(JSON.stringify({ type: 'result', is_error: true }))).toEqual([{ kind: 'done', ok: false }]);
});
