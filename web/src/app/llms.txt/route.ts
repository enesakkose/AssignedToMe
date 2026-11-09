import { REPO_URL } from "@/lib/links";
import { siteOrigin } from "@/lib/site";

/** llms.txt: a plain-text brief for AI answer engines (ChatGPT, Perplexity, Google AI) — the facts, in one place. */
export function GET() {
  const origin = siteOrigin();
  const body = `# AssignedToMe

> One list for every task assigned to you across Jira, Linear, GitHub, GitLab, Azure DevOps and Bitbucket. Each board becomes a tab, each task opens in its source, and the list refreshes every hour. Available as a macOS menu-bar app and in the browser; a mobile app is on the way. Free and open source.

## Sources it connects to
- Jira (Cloud and Data Center)
- Linear
- GitHub
- GitLab
- Azure DevOps
- Bitbucket Data Center

## What you can do
- See every task assigned to you from all your tools in one place.
- Open each task in its own source app.
- Depending on the source: change status, approve pull requests, assign, log time, and comment — directly from the list.

## Privacy
- API keys and tokens are secrets: the macOS app keeps them on-device in the Keychain; the web keeps them in encrypted server storage. Keys are never sent to the browser bundle, logs, URLs, or analytics.

## Links
- Web app: ${origin}/app
- Download for macOS: ${origin}/download/mac
- Source code: ${REPO_URL}
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
