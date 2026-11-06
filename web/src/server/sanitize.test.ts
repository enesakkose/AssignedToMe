import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { sanitizeSourceHtml } = await import("./sanitize");

const opts = { base: "https://acme.atlassian.net", boardId: "0123456789abcdef" };

describe("source HTML", () => {
  test("script, handlers, styles, forms and frames are gone", () => {
    const out = sanitizeSourceHtml(
      `<p onclick="x()" style="color:red" id="a">Hi<script>alert(1)</script></p><iframe src="https://evil"></iframe><form><input></form><img src="x" onerror="alert(1)">`,
      opts,
    );
    expect(out).not.toMatch(/script|onclick|onerror|style=|iframe|form|input|id=/i);
    expect(out).toContain("<p>Hi</p>");
  });

  test("links become absolute and open outside; javascript: links lose their link", () => {
    const out = sanitizeSourceHtml(
      `<a href="/browse/AB-1">AB-1</a><a href="javascript:alert(1)">x</a>`,
      opts,
    );
    expect(out).toContain(
      '<a href="https://acme.atlassian.net/browse/AB-1" target="_blank" rel="noopener noreferrer nofollow">AB-1</a>',
    );
    expect(out).not.toContain("javascript");
  });

  test("images load only through the attachment route", () => {
    const out = sanitizeSourceHtml(
      `<img src="/rest/api/3/attachment/content/10" alt="shot"><img src="data:image/svg+xml,<svg>">`,
      opts,
    );
    expect(out).toContain(
      `src="/api/boards/0123456789abcdef/attachment?url=${encodeURIComponent("https://acme.atlassian.net/rest/api/3/attachment/content/10")}"`,
    );
    expect(out).not.toContain("data:");
  });
});
