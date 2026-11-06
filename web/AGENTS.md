# Web Agent Guide

Next.js 16 (App Router) + React 19 + Tailwind v4 + base-ui. Read the root `AGENTS.md` first; this file adds web rules. Phase 2: the first screen runs on demo data; connecting boards comes next.

## Shape

- `src/app/`: routes only. `/` is the landing page (`features/landing`), `/app` the task screen (`features/tasks`). A page parses its URL and hands it to a feature screen.
- `src/features/<feature>/`: `components/` for UI, `lib/` for logic with tests. Today: `landing` (the first page, with a picture of the app drawn from its own parts and sample tasks in `landing/lib`), `tasks` (the list, header, detail, URL params), `boards` (the sidebar nav and the `Board` type), `settings` (theme and language menu).
- `src/components/ui/`: primitives on base-ui + cva (`button`, `menu`, `tooltip`, `sheet`, `kbd`, …). Features never use raw elements or raw colours where a primitive or token exists. `button-variants.ts` has no `"use client"` so server components can style a link as a button.
- `src/components/layout/`: the app shell (sidebar from 1024px, a sheet below it).
- Boards live in sealed cookies, one per board (`src/server/boards.ts`): AES-256-GCM under `WEB_SEALING_KEY`, the cookie's name as associated data, `__Host-`, HttpOnly, Secure, SameSite=Lax. No database. The browser gets board ids and names only.
- Every provider call runs on the server through `src/server/provider-fetch.ts` (https only, no private or loopback addresses, redirects re-checked, 20 s timeout, 20 MB cap). Never call a provider with the plain `fetch`.
- Tasks load per board from `GET /api/boards/[id]/tasks` with TanStack Query (1 hour, and on focus when stale). That route renews a sign-in near expiry and saves it; a page render can't set cookies, so token work stays in routes and actions.
- Source HTML (descriptions) is sanitized on the server (`server/sanitize.ts`) before it reaches the page; its images and attached images load only through `GET /api/boards/[id]/attachment?url=` (https, the board's own site via core, png/jpeg/gif/webp, `sandbox` CSP).
- Editing a board keeps an empty secret only when its site URL is unchanged; a new site needs the token typed again.
- Moving boards: `features/transfer/actions.ts` around core's `transfer.ts`. Sealing and opening happen on the server; the page only holds the code and the sealed text. Receiving keeps its one-time code in a sealed `__Host-atm_transfer` cookie (10 minutes, deleted after one use). Incoming ids are mapped to 16-hex web ids (same board → same id); sign-in boards arrive without their sign-in.
- Connecting: `features/connections/actions.ts` (token form, GitHub device code) and `/api/oauth/start` + `/api/oauth/callback` (Atlassian, Linear). A sign-in in progress waits in a sealed 10-minute cookie; core checks the OAuth `state`.
- Errors reach the browser as a code and status only (`src/server/errors.ts`), never a provider message.
- Sample data lives only in `features/landing/lib` and never reaches `/app`.
- `src/i18n/`: next-intl, cookie `locale`, en and tr. Every string lives in `messages/*.json`.

## Rules

- The URL is the state: `board`, `q`, `status`, `priority`, `type`, `task`, parsed by `features/tasks/lib/queue-params.ts` (anything that doesn't fit is dropped). Server components render from it; client islands (search, filter menu, settings, mobile nav) only change the URL.
- `@mytask/core` is imported only in server components, so providers never reach the browser bundle. Provider calls go through route handlers, never from the client, and keys never go to the browser (root rule).
- Tokens and components follow `DESIGN.md`. The first lines of `globals.css` are the Hallmark stamp; keep them.

## Commands

- `bun run dev` (port from `.claude/launch.json`), `bun run check` (lint, format, types, tests).
- `node ~/.claude/skills/hallmark/scripts/sloplint.mjs src/app/globals.css $(find src -name "*.tsx") --scope app --render --url http://localhost:3100/`: design lint; 0 FAIL before calling UI work done.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
