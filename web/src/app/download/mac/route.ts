import { NextResponse } from "next/server";

import { REPO_URL } from "@/lib/links";

/**
 * Sends the browser straight to the latest macOS .dmg instead of the GitHub releases page. The asset name carries the
 * version, so we resolve it from the GitHub API at request time (cached an hour) and redirect to it; any problem falls
 * back to the releases page so the button always does something.
 */
const repoPath = new URL(REPO_URL).pathname.replace(/\/+$/, "");
const LATEST_API = `https://api.github.com/repos${repoPath}/releases/latest`;
const RELEASES_PAGE = `${REPO_URL}/releases/latest`;
// Only ever redirect to GitHub's own download hosts.
const ALLOWED = /^https:\/\/([a-z0-9-]+\.)*(github\.com|githubusercontent\.com)\//i;

export const revalidate = 3600;

export async function GET() {
  try {
    const res = await fetch(LATEST_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "AssignedToMe-web" },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data: unknown = await res.json();
      const assets =
        data && typeof data === "object" && Array.isArray((data as { assets?: unknown }).assets)
          ? ((data as { assets: unknown[] }).assets as Array<{
              name?: unknown;
              browser_download_url?: unknown;
            }>)
          : [];
      const dmg = assets.find(
        (a) =>
          typeof a.browser_download_url === "string" &&
          typeof a.name === "string" &&
          a.name.toLowerCase().endsWith(".dmg"),
      );
      const url = dmg?.browser_download_url;
      if (typeof url === "string" && ALLOWED.test(url)) return NextResponse.redirect(url, 302);
    }
  } catch {
    // fall through to the releases page
  }
  return NextResponse.redirect(RELEASES_PAGE, 302);
}
