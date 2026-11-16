import { expect, test } from 'bun:test';
import { filterPaths, mentionAt, withFolders } from './mention';

test('mentionAt finds the @-token only at a word boundary at the caret', () => {
  expect(mentionAt('@sol', 4)).toEqual({ query: 'sol', start: 0 });
  expect(mentionAt('fix @src/app', 12)).toEqual({ query: 'src/app', start: 4 });
  expect(mentionAt('@a @b', 5)).toEqual({ query: 'b', start: 3 });
  // Caret before the end: only the part up to the caret counts.
  expect(mentionAt('@src/app.ts', 4)).toEqual({ query: 'src', start: 0 });
  // An @ glued to a word (email-like) isn't a mention; nor is a finished token followed by a space.
  expect(mentionAt('a@b', 3)).toBeNull();
  expect(mentionAt('@src ', 5)).toBeNull();
  expect(mentionAt('no mention', 10)).toBeNull();
});

test('withFolders adds every parent directory, with a trailing slash, before the files', () => {
  expect(withFolders(['web/app.ts', 'readme.md'])).toEqual(['web/', 'web/app.ts', 'readme.md']);
});

test('filterPaths ranks basename-prefix matches first, then shorter paths', () => {
  const entries = ['web/', 'src/web-utils.ts', 'web/app.ts'];
  expect(filterPaths(entries, 'web')).toEqual(['web/', 'web/app.ts', 'src/web-utils.ts']);
  expect(filterPaths(['a.ts', 'b.ts'], '')).toEqual(['a.ts', 'b.ts']);
});
