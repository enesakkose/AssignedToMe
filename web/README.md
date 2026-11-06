# AssignedToMe web

Every task assigned to you, from all your boards, in one list. Phase 2 of AssignedToMe; this first version runs on demo data.

```sh
bun install
bun run dev      # http://localhost:3000 (3100 via .claude/launch.json)
bun run check    # lint, format, types, tests
```

## Environment

- `WEB_SEALING_KEY` (required): 32 random bytes, base64url. It seals the board cookies; changing it signs every browser out. Make one with `node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))'` and keep it in the host's secret settings, never in the repo. Development reads it from `.env.local` (gitignored).
- `WEB_ORIGIN` (production): the site's own https origin, e.g. `https://assignedto.me`, used as the OAuth return address.

See `AGENTS.md` for how the code is laid out and `DESIGN.md` for the design system.
