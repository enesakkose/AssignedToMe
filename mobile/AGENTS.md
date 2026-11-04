# AssignedToMe Mobile Agent Guide

The AssignedToMe iOS/Android app (Expo + TypeScript): the tasks assigned to you across your boards, the same features as desktop. Read the root `AGENTS.md` first. Use Bun for all package commands.

## Core Stack

- Expo SDK 57, Expo Router, TypeScript, NativeWind, React Native Reusables.
- React Native Reusables components live in `src/components/ui`; import primitives from there before writing anything custom.
- Generic layout wrappers live in `src/components/layout`.
- State/data/forms use Zustand, TanStack Query, React Hook Form and Zod.
- Storage is split by sensitivity: provider keys only in SecureStore (`src/lib/secrets.ts`, this-device-only, readable after first unlock for the background refresh); non-secret app state (connections without secrets, preferences, seen task ids) in Zustand persisted to MMKV.
- Virtualization uses FlashList. Drag-and-drop uses React Native Reanimated DnD.
- Bottom sheets use `@gorhom/bottom-sheet`; import the local wrapper from `src/components/ui/bottom-sheet`.
- OTA readiness uses `expo-updates` with EAS channels and `runtimeVersion.policy = appVersion`.
- Native app metadata comes from `expo-application` and `expo-device`; network checks use `expo-network`; i18n boot uses `expo-localization`.
- Do not add Virtuoso or dnd kit to native code; this project is not targeting web UI libraries.

## Architecture Rules

- Keep `src/app` thin. Route files should only wire layouts and feature screens.
- Build product code under `src/features/<feature-name>`.
- Feature screens live in `src/features/<feature-name>/screens`; route files import from that folder.
- A feature can use `api`, `components`, `hooks` and `screens` (see `src/features/tasks`).
- Keep cross-feature logic in `src/lib`, `src/providers` or `src/stores` (`persist-store.ts` holds the non-secret preferences).
- Reusable hooks live in `src/hooks`; keep feature-specific hooks inside their own feature folder.
- Locale/device language selection lives in `src/lib/localization`; UI code should use `src/hooks/use-app-locale.ts`.
- Wrap app-level providers only in `src/providers/app-providers.tsx`; do not duplicate QueryClient, Toaster, SafeArea, Gesture or theme wrappers inside screens.
- App boot/splash provider orchestration lives in `src/providers/splash-provider.tsx`; splash UI can stay in `src/features/splash`.
- Use the storage adapters, `src/lib/secrets.ts` and `queryClient` instead of creating feature-local copies.
- Every network call goes through a `@mytask/core` provider, which takes a fetch-shaped function; the app passes React Native's `fetch` (no CORS). Task actions (status, assign, log time, comments) open one shared sheet (`openTaskSheet` in `features/tasks/components/task-sheets.tsx`), never a sheet per row.
- Source HTML (task descriptions) is untrusted: it renders only in `features/tasks/components/source-html.tsx`, a WebView whose page policy blocks scripts, frames, forms and remote loads; links open outside, images load through the connection.
- Provider logic comes from `@mytask/core` (`../packages/core`, used from source through `metro.config.js` and `tsconfig.json` paths); never call a provider API from the app.
- Read app/version/device data from `src/lib/app`; read network status from `src/lib/network`.
- Prefer extension/wrapper components over new primitives. If a primitive is missing, add it to `src/components/ui` through React Native Reusables when available.

## UI Direction

- Follow installed skills in `.agents/skills` for UI quality, theme taste, interaction layers and React Native guidance.
- Treat `DESIGN.md` as the source of truth for this base's product language. Update it first when the design direction changes.
- Theme tokens are defined in `global.css`, `tailwind.config.js` and `src/lib/theme/theme.ts`; keep them synchronized with each other and with `desktop/src/styles/globals.css`.
- Theme scheme control uses NativeWind through `src/hooks/use-app-theme.ts`; do not add a Zustand store just for theme mode.
- Typography is Instrument Sans with JetBrains Mono for machine values, via `src/lib/theme/fonts.ts`; the font variable is `--font-instrument-sans`.
- `lib/theme.ts` is a small React Native Reusables doctor mirror; keep it aligned with `src/lib/theme.ts`.
- React Native Reusables is the primitive layer, not the visual identity. Do not ship the default RNR/shadcn look unchanged.
- The visual language is AssignedToMe's, shared with desktop (`desktop/DESIGN.md` is the source of truth; `DESIGN.md` here maps it to RNR): silver-grey paper, hairline rules, flat graphite pill buttons, no hue except state.
- Keep color usage minimal. Do not add purple glows, beige craft palettes, decorative dots, fake metrics or bright default brand colors.
- Buttons and pressable controls should preserve 44 px touch targets and subtle `scale(0.96)` press feedback where the primitive supports it.
- Button haptics are centralized through `src/lib/utils/haptics.ts`; use the local `Button` `haptic` prop instead of calling haptics inline for simple press feedback.
- Pressable controls must set an accessible role/state when they behave like buttons, switches, tabs or menu items.
- Use lucide-react-native icons for tool/action affordances.
- Keep screens functional first; do not build marketing pages inside the app shell.

## Commands

- `bun run dev`: start Expo dev client.
- `bun run ios`: start iOS dev client.
- `bun run android`: start Android dev client.
- `bun run lint`: run Oxlint.
- `bun run format`: format with Oxfmt.
- `bun run typecheck`: TypeScript check.
- `bun run check`: lint, format check and typecheck.
- `bun run test`: unit tests (`bun test`).
- `bunx eas-cli build --profile development`: create a device dev build.
- `bunx eas-cli build --profile development-simulator`: create an iOS simulator dev build.
- `bunx eas-cli build --profile preview`: create an internal preview build.
- `bunx eas-cli build --profile production`: create a production build.
- `bunx eas-cli update --channel preview`: publish an OTA update to preview.
- `bunx eas-cli update --channel production`: publish an OTA update to production.

## Skill Setup

The requested skills were installed into `.agents/skills`. If this repo is recreated, run:

```sh
npx skills add Leonxlnx/taste-skill
npx skills add jamiemill/layers-skills
npx skills add jakubkrehel/skills
npx skills@latest add emilkowalski/skills
npx skills add nutlope/hallmark
npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-native-skills
```
