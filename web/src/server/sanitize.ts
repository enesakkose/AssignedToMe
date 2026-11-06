import "server-only";

import sanitizeHtml, { type Tag } from "sanitize-html";

const dropped: Tag = { tagName: "span", attribs: {} };

/**
 * The source's own rendering of a description (tables, panels, lists) is untrusted. Only plain markup survives: no
 * scripts, styles, forms, frames, event handlers or ids. Links become absolute http(s) links that open outside; images
 * load only through this app's attachment route, so the page never reaches another site and credentials stay put.
 */
export function sanitizeSourceHtml(
  html: string,
  { base, boardId }: { base: string; boardId: string },
): string {
  const resolve = (value?: string) => {
    if (!value) return undefined;
    try {
      const url = new URL(value, `${base}/`);
      return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  };
  return sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "hr",
      "ul",
      "ol",
      "li",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "del",
      "sub",
      "sup",
      "code",
      "pre",
      "blockquote",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
      "img",
      "span",
      "div",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "loading"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https"],
    allowedSchemesByTag: { img: [] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attribs): Tag => {
        const href = resolve(attribs.href);
        return href
          ? {
              tagName: "a",
              attribs: { href, target: "_blank", rel: "noopener noreferrer nofollow" },
            }
          : dropped;
      },
      img: (_tag, attribs): Tag => {
        const src = resolve(attribs.src);
        if (!src?.startsWith("https://")) return dropped;
        return {
          tagName: "img",
          attribs: {
            src: `/api/boards/${boardId}/attachment?url=${encodeURIComponent(src)}`,
            alt: attribs.alt ?? "",
            loading: "lazy",
          },
        };
      },
    },
  });
}
