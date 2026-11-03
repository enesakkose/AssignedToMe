import type { Attachment, DescriptionPart } from '../../types';

const IMAGE_NAME = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const isImage = (a: Attachment) => !!a.mimeType?.startsWith('image/') || IMAGE_NAME.test(a.name);
const ISSUE_URL = /\/browse\/([A-Z][A-Z0-9_]*-\d+)/;
const URL = /^https?:\/\//i;

/** A link's visible text: the issue key for Jira issue links (smart links carry no text), else the URL. */
const linkText = (url: string) => url.match(ISSUE_URL)?.[1] ?? url;

/**
 * Resolves embedded images to attachments by file name. With `byOrder`, an unmatched one takes the next image not placed yet
 * (shortcut: Cloud media ids aren't attachment ids, so order is the fallback when a paste has no name; fine for the usual one image per paste).
 */
function imagePicker(attachments: Attachment[], byOrder: boolean) {
  const images = attachments.filter(isImage);
  const used = new Set<string>();
  return (name: string | undefined): DescriptionPart | undefined => {
    const lower = name?.toLowerCase();
    const hit =
      images.find((a) => !used.has(a.id) && a.name.toLowerCase() === lower) ?? (byOrder ? images.find((a) => !used.has(a.id)) : undefined);
    if (!hit) return undefined;
    used.add(hit.id);
    return { type: 'image', attachmentId: hit.id };
  };
}

/** Joins neighbouring text, squeezes blank runs and trims the ends. */
function tidy(parts: DescriptionPart[]): DescriptionPart[] {
  const out: DescriptionPart[] = [];
  for (const p of parts) {
    const last = out.at(-1);
    if (p.type === 'text' && last?.type === 'text') last.text += p.text;
    else if (p.type !== 'text' || p.text) out.push(p.type === 'text' ? { ...p } : p);
  }
  for (const p of out) if (p.type === 'text') p.text = p.text.replace(/\n{3,}/g, '\n\n');
  const first = out[0];
  const last = out.at(-1);
  if (first?.type === 'text') first.text = first.text.trimStart();
  if (last?.type === 'text') last.text = last.text.trimEnd();
  return out.filter((p) => p.type !== 'text' || p.text);
}

/** Atlassian Document Format (Cloud) to ordered parts. */
export function adfToParts(doc: unknown, attachments: Attachment[] = []): DescriptionPart[] {
  const pick = imagePicker(attachments, true);
  const parts: DescriptionPart[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; text?: string; content?: unknown[]; attrs?: Record<string, unknown>; marks?: { type?: string; attrs?: { href?: unknown } }[] };
    const attr = (key: string) => (typeof n.attrs?.[key] === 'string' ? (n.attrs[key] as string) : undefined);
    switch (n.type) {
      case 'text': {
        const href = n.marks?.find((m) => m.type === 'link')?.attrs?.href;
        if (typeof href === 'string' && URL.test(href)) parts.push({ type: 'link', url: href, text: n.text ?? href });
        else parts.push({ type: 'text', text: n.text ?? '' });
        return;
      }
      case 'hardBreak':
        parts.push({ type: 'text', text: '\n' });
        return;
      case 'inlineCard':
      case 'blockCard':
      case 'embedCard': {
        const url = attr('url');
        if (url && URL.test(url)) parts.push({ type: 'link', url, text: linkText(url) });
        if (n.type !== 'inlineCard') parts.push({ type: 'text', text: '\n' });
        return;
      }
      case 'mention':
      case 'emoji':
        parts.push({ type: 'text', text: attr('text') ?? attr('shortName') ?? '' });
        return;
      case 'media': {
        const image = pick(attr('alt'));
        if (image) parts.push(image, { type: 'text', text: '\n' });
        return;
      }
    }
    for (const child of n.content ?? []) walk(child);
    if (n.type === 'paragraph' || n.type === 'heading' || n.type === 'listItem') parts.push({ type: 'text', text: '\n' });
  };
  walk(doc);
  return tidy(parts);
}

// !file.png|thumbnail!  ·  [text|https://…]  ·  [https://…]  ·  a bare https://… URL
const WIKI_TOKEN = /!([^!\n|]+?)(?:\|[^!\n]*)?!|\[(?:([^|\]\n]*)\|)?(https?:\/\/[^\]\s]+)\]|(https?:\/\/[^\s\]|]+)/gi;

/** Jira wiki markup (Data Center/Server) to ordered parts; other markup stays as plain text. */
export function wikiToParts(text: string, attachments: Attachment[] = []): DescriptionPart[] {
  const pick = imagePicker(attachments, false);
  const parts: DescriptionPart[] = [];
  let at = 0;
  for (const m of text.matchAll(WIKI_TOKEN)) {
    parts.push({ type: 'text', text: text.slice(at, m.index) });
    at = m.index + m[0].length;
    const [, imageName, label, bracketUrl, bareUrl] = m;
    if (imageName !== undefined) {
      // Only file names that look like images; "!important!" stays text.
      const image = IMAGE_NAME.test(imageName) ? pick(imageName) : undefined;
      if (image) parts.push(image);
      else if (!IMAGE_NAME.test(imageName)) parts.push({ type: 'text', text: m[0] });
    } else {
      const url = (bracketUrl ?? bareUrl)!;
      parts.push({ type: 'link', url, text: label?.trim() || linkText(url) });
    }
  }
  parts.push({ type: 'text', text: text.slice(at) });
  return tidy(parts);
}

/** The searchable, plain version: link text kept, images dropped. */
export function partsToText(parts: DescriptionPart[]): string {
  return parts
    .map((p) => (p.type === 'image' ? '' : p.text))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
