import { expect, test } from 'bun:test';
import type { Attachment } from '../../types';
import { adfToParts, partsToText, wikiToParts } from './description';

const img = (id: string, name: string): Attachment => ({ id, name, mimeType: 'image/png', url: `https://x/${id}` });

test('ADF keeps images where they were and turns smart links into issue keys', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Result:' }] },
      { type: 'mediaSingle', content: [{ type: 'media', attrs: { id: 'uuid', type: 'file', alt: 'shot.png' } }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Expected: ' },
          { type: 'inlineCard', attrs: { url: 'https://acme.atlassian.net/browse/FEMBS3-574' } },
          { type: 'text', text: ' docs', marks: [{ type: 'link', attrs: { href: 'https://docs.example.com' } }] },
          { type: 'text', text: ' bad', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
        ],
      },
    ],
  };
  const parts = adfToParts(doc, [img('9', 'other.png'), img('7', 'shot.png')]);
  expect(parts).toEqual([
    { type: 'text', text: 'Result:\n' },
    { type: 'image', attachmentId: '7' },
    { type: 'text', text: '\nExpected: ' },
    { type: 'link', url: 'https://acme.atlassian.net/browse/FEMBS3-574', text: 'FEMBS3-574' },
    { type: 'link', url: 'https://docs.example.com', text: ' docs' },
    { type: 'text', text: ' bad' },
  ]);
  expect(partsToText(parts)).toBe('Result:\n\nExpected: FEMBS3-574 docs bad');
});

test('an unnamed pasted image takes the next unplaced image attachment', () => {
  const doc = { type: 'doc', content: [{ type: 'mediaSingle', content: [{ type: 'media', attrs: { id: 'u' } }] }] };
  expect(adfToParts(doc, [img('1', 'a.png')])).toEqual([{ type: 'image', attachmentId: '1' }]);
});

test('wiki markup: images by name only, bracket and bare links, other ! text untouched', () => {
  const parts = wikiToParts('See !a.png|thumbnail! and [the spec|https://x.io/s] or https://y.io !important! !gone.png!', [img('1', 'A.PNG')]);
  expect(parts).toEqual([
    { type: 'text', text: 'See ' },
    { type: 'image', attachmentId: '1' },
    { type: 'text', text: ' and ' },
    { type: 'link', url: 'https://x.io/s', text: 'the spec' },
    { type: 'text', text: ' or ' },
    { type: 'link', url: 'https://y.io', text: 'https://y.io' },
    { type: 'text', text: ' !important!' },
  ]);
});

test('MCP markdown: inline images are dropped (or matched by name), links kept — no raw ![](url) leaks', () => {
  const parts = wikiToParts('Note ![](blob:https://media.atl-paas.net/?id=1) then ![shot.png](https://m/2) and [the spec](https://x.io/s).', [img('5', 'shot.png')]);
  expect(parts).toEqual([
    { type: 'text', text: 'Note  then ' },
    { type: 'image', attachmentId: '5' },
    { type: 'text', text: ' and ' },
    { type: 'link', url: 'https://x.io/s', text: 'the spec' },
    { type: 'text', text: '.' },
  ]);
});

test('MCP markdown: a blob image whose url is split by whitespace/newline is still dropped whole', () => {
  // The MCP emits the media url with a space or newline after `blob:`, so the parens span whitespace.
  expect(wikiToParts('A ![](blob: https://media/?id=1&w=2) B')).toEqual([{ type: 'text', text: 'A  B' }]);
  expect(wikiToParts('A ![](blob:\nhttps://media/?id=1&w=2) B')).toEqual([{ type: 'text', text: 'A  B' }]);
});
