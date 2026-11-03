# AssignedToMe Agent Guide

AssignedToMe collects every task assigned to the user from the boards they connect (Jira, ClickUp, Linear, …) into one board. Each task links straight to its source. Boards show as renameable tabs, data refreshes every hour, and API keys are added on a Settings screen.

This file holds the **shared rules** for the whole repo. Each app has its own `AGENTS.md` with platform rules. When working inside an app folder, read both: this file first, then the app's file. If they conflict, the app's file wins for that app, except on security.

## Layout

```
mytask/
  AGENTS.md          # shared rules (this file)
  packages/core/     # pure TS shared by all apps: provider adapters, types, zod schemas
  desktop/           # Tauri v2 + Vite + React + Tailwind + base-ui — macOS menubar app (phase 1), see desktop/AGENTS.md
  web/               # Next.js, based on ../arac-degerleme/aracdegerleme-web (phase 2)
  mobile/            # Expo / React Native, rn-base (phase 3) — see mobile/AGENTS.md
```

- Package manager: **Bun** everywhere, bun workspaces at the root.
- Lint/format: **oxlint** + **oxfmt**. TypeScript strict. Every app exposes `bun run check` (lint + format check + typecheck); run it before calling work done.

## Shared Domain Rules

- All provider logic lives in `packages/core/providers/<provider>.ts`. Apps never call a provider API directly.
- Every provider implements the same `Provider` interface: its logo, form fields, a step-by-step key guide (links + copyable values/commands, tr and en), `validate` and `fetchMyTasks`, plus optional `getTransitions`/`transition` for status changes and `logWork`/`deleteWorkLog`/`getWorkLogs` for time tracking `currentUser`/`searchAssignees`/`assign` for assignment `getComments`/`addComment`/`deleteComment` for comments, `getTask`/`getChildren` for related tasks, `getDescriptionHtml` for the source's own rendering (untrusted HTML: apps sanitize it before showing), `searchTasks` for searching the whole source and `downloadAttachment` for images (credentials only to the connection's own site) (UIs hide those actions when a provider omits them). UIs render forms and guides from this data; nothing provider-specific is hardcoded in apps. Add a provider by adding one folder and registering it; do not touch other providers. Jira Cloud and Jira Data Center/Server share one implementation (`createJira(flavor)` in `providers/jira`); only the flavor (API version, auth, paging, comment format, assignee id) differs.
- Provider responses are parsed with zod at the boundary and normalized to the shared `Task` type (`id, title, status, priority?, url, boardId, updatedAt, description?`). `url` must open the exact task in its source app.
- `core` never imports platform code. The HTTP function is injected by each app (Tauri `plugin-http`, Next route-handler proxy, React Native `fetch` on mobile).
- Server state uses TanStack Query in every app. Refresh: `refetchInterval` of 1 hour, plus refetch on open/focus when data is older than 1 hour.
- Board/tab names default to the provider/workspace name and are user-renameable. Keep a stable `boardId` separate from the display name.

## Security (non-negotiable)

- API keys and tokens are secrets. Store them only in the platform's secure store: macOS Keychain (desktop), SecureStore (mobile), encrypted server-side storage (web). Never in plain `localStorage`, AsyncStorage, `plugin-store`, logs, error messages, query keys, URLs or analytics.
- Web must never send provider keys to the browser bundle; provider calls go through Next route handlers.
- Never work around a company's network or security controls (e.g. imitating a browser to get past a firewall/SOC block page). Detect the block, say so, and offer "open in the source app"; the fix is the security team allowing the API.
- Validate all external data with zod before use. Treat provider payloads (titles, descriptions) as untrusted: no `dangerouslySetInnerHTML` without sanitizing.
- Only open `http(s)` task URLs; reject other schemes.
- Run the **security-audit** skill on any change that touches keys, storage, networking, auth, Tauri capabilities/permissions or the web proxy, and before every release.

## How to Write Code

Use the **ponytail** and **andrej-karpathy-skills** (karpathy-guidelines) skills on every coding task. In short:

- Smallest complete change. Reuse what exists (house components, `core`, installed deps) before writing new code. No speculative options, wrappers or "for later" code.
- Think before coding: state assumptions, ask when the request is ambiguous, define how the change will be verified.
- Surgical edits: touch only what the task needs, keep the existing structure and conventions, and match the surrounding style.
- Fix root causes in shared code (`core`) once instead of patching each app.
- New non-trivial logic (parsers, provider normalizers, refresh logic, secret handling) gets a small test.
- Known limits are marked with `// shortcut: <limit>, <when to upgrade>`.

## Design

The goal is a **unique visual language** shared across desktop, web and mobile, not the default shadcn/RNR look.

- Blend the design skills, do not apply just one: **hallmark** (nutlope/hallmark) for the overall identity and taste, **emilkowalski/skills** (installed in `.agents/skills`: `emil-design-eng`, `apple-design`, `break-ui`, `pick-ui-library`, `prototype`, the `animate*`/`*-animations` family, `mobile-native`, `write-swift`, …) for craft, motion and interaction detail.
- Each app keeps its own `DESIGN.md` as the source of truth for its tokens and components. Keep color, type and radius tokens aligned across apps so the product feels like one thing.
- Functional first: dense, scannable task lists; no marketing sections, fake metrics or decorative noise.
- Accessibility is required: keyboard navigation (desktop/web), proper roles/labels, visible focus, contrast, 44 px touch targets on mobile, respect reduced motion.

## Library Docs

Use Context7 for up-to-date docs of any library, framework or provider API (Tauri, Next.js, Expo, TanStack Query, Jira/ClickUp/Linear APIs, …) instead of relying on memory.

## Setup

Claude Code plugins (run inside an interactive `claude` session):

```sh
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
/plugin install andrej-karpathy-skills@karpathy-skills
```

Ponytail as project skills too (for non-Claude agents and machines without the plugin):

```sh
npx skills add DietrichGebert/ponytail
```

Karpathy guidelines file (appended to `CLAUDE.md` so it does not overwrite the `@AGENTS.md` import):

```sh
curl -s https://raw.githubusercontent.com/forrestchang/andrej-karpathy-skills/main/CLAUDE.md >> CLAUDE.md
```

Design skills:

```sh
npx skills add nutlope/hallmark -g
npx skills@latest add emilkowalski/skills
```

Security:

```sh
npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit
```

App-specific skills are listed in each app's `AGENTS.md`.
