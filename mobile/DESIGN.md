# AssignedToMe Design Language (mobile)

Mobile uses the same visual language as desktop. **`desktop/DESIGN.md` is the source of truth** for character, tokens, rules, components and brand; change it there first, then mirror it here. This file only records what differs on a phone and how the tokens map onto React Native Reusables (RNR).

## Character

Exact and technical, metallic and achromatic: silver-grey paper, hairline rules, flat graphite pill buttons. No hue except state (error, done, in progress, priority). Emphasis comes from contrast, weight and the graphite fill. Nothing decorative.

## Tokens

Defined in `global.css` (light `:root`, dark `.dark:root`), mapped to classes in `tailwind.config.js`, mirrored for JS in `src/lib/theme/theme.ts`. Keep the three in sync with `desktop/src/styles/globals.css`.

- Values are desktop's OKLCH converted to HSL (NativeWind and RNR read `hsl(var(--token))`). Desktop's translucent tokens (`paper-2`, `paper-3`, `rule`, `rule-2`) are composited over that theme's paper, since a phone screen is opaque.
- Desktop names exist as classes: `bg-paper`, `bg-paper-2/3`, `text-ink`, `text-ink-2`, `border-rule`, `border-rule-2`, `text-accent-text`, `bg-accent-wash`, `text-error`, `bg-error-wash`, `text-success`, `text-progress`, `text-warning`, `bg-graphite`, `bg-track`, `bg-thumb`, `bg-brand-tile`, `text-brand-mark`.
- RNR roles map onto them:

| RNR role | Desktop token |
|---|---|
| `background`, `card` | `paper` |
| `foreground` | `ink` |
| `primary` / `primary-foreground` | `accent` (graphite, silver in dark) / `accent-ink` |
| `secondary`, `accent` (RNR's hover/selected fill) | `paper-3` |
| `muted` (fill) | `paper-2` |
| `muted-foreground` | `muted` (desktop's `text-muted` is `text-muted-foreground` here) |
| `border`, `input` | `rule-2` |
| `ring` | `focus` |
| `destructive` | `error` |
| `popover` | `paper` (light), `paper-2` (dark, so sheets lift off the near-black page) |

## Type

- Instrument Sans for everything, JetBrains Mono for machine values (task keys, tokens, commands): `src/lib/theme/fonts.ts`, loaded in `src/providers/splash-provider.tsx`. The font variable is `--font-instrument-sans`.
- React Native picks weight by font file, so `Text` maps `font-medium`/`font-semibold`/`font-bold` to the matching file, and `font-mono` to JetBrains Mono.
- Sizes are larger than desktop's 13px macOS density: body is 16px minimum on a phone. Weights and the type rules (sentence case, no tracked capitals, no italic display) are desktop's.

## Shape

Same as desktop: buttons, inputs and select triggers are pills (`rounded-full`); menus, popovers, textareas `rounded-md` (8px); chips `rounded-sm` (4px). Buttons are flat: one fill, no shadow, no border (`default` = graphite, `secondary` = paper-3, `ghost`). Bordered tiles and notices use desktop's `cut` corners (two opposite corners 10px, the others 3px).

## Layout

No cards. A screen is a slim `AppHeader` (title, leading/trailing actions, hairline under it) fixed above ruled `Section`s: a heading and its content, divided from the next by a `border-rule` hairline. Lists run edge to edge inside a `flush` section, one rule between rows. A setting row has its label (and hint) on the left and the control on the right; one-of-few choices are a `SegmentedControl` (paper-3 track, the chosen pill on paper). Failures show `ErrorState`. Dates are picked with `DatePicker` (a pill plus the system calendar), never a bare native field. Links open in the in-app browser sheet (`src/lib/open-link.ts`), never by leaving the app.

## Phone-specific rules

- Touch targets are at least 44px.
- Press feedback is `scale(0.96)`; haptics through the `Button` `haptic` prop.
- Motion is transform and opacity only, under 300ms, and respects reduced motion.
- Every data region has the four states from desktop: loading (skeleton), empty, error, full.

## Brand

The mark ("Nokta") and its colours come from `desktop/design/logo`. The app icon is the graphite tile (`#2B2D31`) with the silver mark (`#E4E5E7`), the same as macOS; the splash screen shows that icon on the theme's paper.

## Playground

`src/features/playground/screens/playground-screen.tsx` shows every primitive in its states. Check new components there first, in light and dark.
