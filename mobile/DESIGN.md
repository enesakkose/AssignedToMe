# Mica Halo Design System

Mica Halo is the default product language for this React Native base. React Native Reusables provides the primitive mechanics; Mica Halo provides the visual contract: soft radius, floating chrome, capsule wells, quiet hierarchy and tactile native interaction.

## Design Read

- Audience: product engineers building native iOS and Android apps from this base.
- Use: inspect the system quickly, then replace brand colors without rebuilding primitives.
- Tone: soft, utilitarian, calm, slightly distinctive.
- Hallmark macrostructure: Component Playground.
- Dials: variance 6, motion 4, density 5.
- Signature: halo dock navigation, rounded tool wells, offset capsule rhythm and neutral-first contrast.

## Color

The default palette is nearly colorless. Brand color is intentionally absent because each app built from this base will bring its own. Identity comes from shape, depth and interaction before color.

| Role | OKLCH Intent | Native Token |
| --- | --- | --- |
| Paper | `oklch(0.965 0.012 260)` | `--background` |
| Ink | `oklch(0.18 0.012 260)` | `--foreground` |
| Raised surface | `oklch(0.99 0.008 260)` | `--card`, `--surface-raised` |
| Field surface | `oklch(0.93 0.01 260)` | `--surface`, `--muted` |
| Active surface | `oklch(0.90 0.01 260)` | `--accent` |
| Destructive | `oklch(0.52 0.17 27)` | `--destructive` |

NativeWind/RNR consume HSL custom properties through `hsl(var(--token))`, so `global.css` stores HSL-compatible values while this document records the perceptual OKLCH intent.

## Typography

- Default app font is Plus Jakarta Sans.
- The font variable name is `--font-plus-jakarta-sans`; native runtime maps it through `src/lib/fonts.ts`.
- Display text is left aligned, compact and medium-heavy, not black-weight by default.
- Body text uses 16 px minimum and comfortable line height.
- Numbers that move or compare should use tabular treatment where the platform supports it.
- No italic display words. Emphasis comes from weight, placement and contrast.

## Shape And Surface

- Base radius is `20px`.
- Large panels use `28-36px` radius.
- Buttons, inputs, badges, tabs and segmented controls should feel pill-soft, not square.
- Bottom navigation is a floating halo dock: rounded, theme-aware, slightly detached from the screen edge.
- Bottom sheets are native gesture surfaces. Use them for contextual tasks, compact choices and short forms that should not become full routes.
- Repeated controls sit inside soft wells. A well is filled, rounded and quiet; it should not look like a web card pasted into native.
- Cards are quiet raised surfaces. Avoid nested card stacks unless the inner element is a real repeated record or framed control.
- Prefer soft filled fields over hard outline-only surfaces.

## Interaction

- Minimum touch target is 44 px.
- Press feedback uses `scale(0.96)` where the primitive supports it.
- UI motion stays below 300 ms and should communicate feedback, state or spatial continuity.
- Drag surfaces must visually follow the finger: no foreign white containers, no hard stops, no delayed state feedback.
- Animate transform and opacity only. Drag behavior belongs to React Native Reanimated DnD.
- Silent success is preferred. Use toasts for failures or actions whose result is not visible.

## Component Rules

- Import from `src/components/ui` first.
- Extend primitives through layout wrappers or feature-local components, not by creating a second primitive library.
- Every primitive example belongs in the playground.
- Use primary as contrast, not as a brand color.
- Use lucide icons consistently through `Icon` when possible.

## Playground Acceptance

`src/features/playground/playground-screen.tsx` must feel like a working system bench:

- Every RNR primitive family is visible.
- External native packages are demonstrated: NumberFlow, OTP, FlashList, React Native Reanimated DnD and Sonner.
- The opening screen shows the system through real surfaces, not giant color swatches.
- Component inventory is grouped by purpose.
- Copy stays functional. No fake metrics, fake testimonials or decorative version strings.
