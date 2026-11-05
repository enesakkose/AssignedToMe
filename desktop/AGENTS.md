# Desktop Agent Guide

macOS menubar app. Tauri v2 + Vite + React + TypeScript. Read the root `AGENTS.md` first; this file adds desktop rules.

## Shape

- `src-tauri/src/lib.rs`: tray icon, popover window (hidden on blur, positioned under the tray icon), Dock hidden (`ActivationPolicy::Accessory`), Keychain commands `secret_get/secret_set/secret_delete`. Keep Rust minimal; product logic lives in TypeScript.
- `src/lib/http.ts`: the `Fetch` passed to `@mytask/core` providers (Tauri `plugin-http`, no CORS).
- `src/lib/secrets.ts`: the only way to read/write secrets. Provider fields with `type: 'secret'` go to Keychain; everything else (connection id, name, non-secret fields) goes to `plugin-store`.
- Feature code goes under `src/features/<feature>`; UI primitives under `src/components/ui` (base-ui + Tailwind + cva). Features never use raw elements or raw colors where a primitive or token exists.

## Data flow

- Connections: `features/connections/api/connections.ts` (store key `connections`, secrets in Keychain as `<connectionId>:<field>`). Use the hooks in `use-connections.ts`, never the store directly from screens.
- Tasks: one TanStack query per board, `['tasks', connectionId]` (`use-board-tasks.ts`). `staleTime` and `refetchInterval` are 1 hour; window focus (Tauri `onFocusChanged` → `focusManager`) refetches only stale boards. Last results are cached in the store (`taskCache`) and used as `initialData` at boot.
- `BackgroundSync` (mounted once in `App.tsx`) observes every board query so the hourly refresh runs on any screen, and sets the menubar count.
- Navigation is a small zustand store (`stores/nav.ts`): tasks, settings, connection (add/edit), playground (dev only).

## Adding a provider

1. `packages/core/src/providers/<id>/index.ts` implementing `Provider` (logo, fields, guide, validate, fetchMyTasks) plus a test.
2. Register it in `packages/core/src/index.ts`.
3. Fixed API hosts go in `src-tauri/capabilities/default.json` (`http:default` → `allow`); user-specific hosts are granted at runtime by `lib/http.ts`. Nothing else in desktop should need to change.

## Security

- Keep the CSP in `tauri.conf.json` strict; bundle fonts locally, no remote scripts or styles.
- Grant plugin permissions per need; do not add `*` scopes. Hosts that vary per user (self-hosted Jira) are granted one https origin at a time at runtime via the `allow_http_origin` command, called from `lib/http.ts`; it rejects non-https, credentials and paths.
- Sign-in failures (`unauthorized`, `captcha`) are never retried automatically and stop hourly/focus refetches and remote search for that board, so a wrong password cannot lock the account.
- Open task links only through `isSafeUrl` + `plugin-opener`.

## Commands

- `bun run tauri dev`: run the app (needs Rust: `source ~/.cargo/env`).
- `bun run tauri build`: build `.app` and `.dmg`.
- `scripts/build-local.sh`: a release `.app` to try on this Mac, signed with the Developer ID so the Keychain doesn't ask for the password on every read (an unsigned build does). `tauri dev` keeps secrets in a dev file instead.
- `bunx tsc --noEmit`: typecheck. `cd src-tauri && cargo build`: Rust check.
