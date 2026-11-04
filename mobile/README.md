# AssignedToMe (mobile)

The iOS/Android app of AssignedToMe: every task assigned to you, from all your boards, in one list, with the same actions as desktop (status, assignment, time, comments). Provider logic comes from `packages/core`; keys live in the iOS Keychain / Android Keystore.

## Stack

- Expo SDK 57 + Expo Router + TypeScript, NativeWind + React Native Reusables
- `@mytask/core` (used from source through `metro.config.js`)
- TanStack Query for provider data, Zustand on MMKV for non-secret state, SecureStore for keys
- `expo-notifications` + `expo-background-task` for new-task alerts
- `@gorhom/bottom-sheet`, `sonner-native`, `react-native-webview` (sandboxed source HTML)
- Instrument Sans and JetBrains Mono, the AssignedToMe design tokens shared with desktop
- Oxlint + Oxfmt

## Commands

```sh
bun run dev
bun run ios
bun run android
bun run lint
bun run format
bun run typecheck
bun run check
```

EAS build and update commands:

```sh
bunx eas-cli build --profile development
bunx eas-cli build --profile development-simulator
bunx eas-cli build --profile preview
bunx eas-cli build --profile production
bunx eas-cli update --channel preview
bunx eas-cli update --channel production
```

If a new native package is added, rebuild the dev client:

```sh
bunx expo run:ios
bunx expo run:android
```

## Structure

- `src/app`: thin Expo Router files only.
- `src/features`: feature-owned screens and feature-local logic.
- `src/features/<feature>/screens`: all feature screens.
- `src/components/ui`: React Native Reusables primitives and native wrappers.
- `src/components/layout`: generic layout wrappers such as `Screen`, `Section`, `AppHeader`.
- `src/providers`: app-level provider composition, including splash boot orchestration.
- `src/lib`: errors, fonts, i18n, query, storage, secrets, notifications and theme utilities.
- `src/lib/app`: app version, build, bundle and device metadata.
- `src/lib/localization`: supported locales, device locale and app-locale resolution.
- `src/lib/network`: native network status helpers.
- `src/hooks`: reusable cross-feature hooks.
- `src/stores`: persisted, non-secret preferences.

## Theme

Theme scheme control is handled by NativeWind through `useAppTheme`.

- Use `src/hooks/use-app-theme.ts` for `colorScheme`, `isDark`, `tokens`, `navigationTheme`, `setColorScheme` and theme-specific values.
- Do not create a Zustand store just for theme mode.
- Design tokens live in `global.css`, `tailwind.config.js` and `src/lib/theme.ts`.
- Product language is documented in `DESIGN.md`.

## Providers

`src/providers/app-providers.tsx` is the single app provider composition point.

It wires:

- Gesture handler root
- Safe area provider
- TanStack Query
- React Navigation theme
- Bottom sheet modal provider
- Reanimated DnD drop provider
- Splash provider
- Sonner toaster

## EAS And Updates

`eas.json` includes `development`, `development-simulator`, `preview` and `production` build profiles. The app config uses `runtimeVersion.policy = appVersion`, so production OTA compatibility follows the native app version.

Run `bunx eas-cli init` for a real app before the first EAS build/update. Expo will attach the project id and update URL for that EAS project.

## UI Rules

- Import primitives from `src/components/ui` first.
- Add wrappers in `src/components/layout` or feature-local `components`.
- Bottom sheets use `src/components/ui/bottom-sheet`.
- Virtualized lists use FlashList.
- Drag and drop uses React Native Reanimated DnD.
- Use the local `Button` `haptic` prop for simple press feedback; keep custom haptic calls in `src/lib/utils/haptics.ts`.
- Keep accessible roles and disabled states on custom pressable controls.
- Do not add Virtuoso or dnd kit to native code.

See `AGENTS.md` for detailed agent rules and `DESIGN.md` for the design system.
