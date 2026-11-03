# AssignedToMe Design Language

Source of truth for the visual language. Desktop defines it first; web and mobile copy these tokens and rules. Change this file before changing the look.

Built with the hallmark (Cobalt theme recoloured to the Titanium palette, app-screen scope) and emilkowalski skills.

## Character

Exact and technical, like a good changelog. Metallic and achromatic: silver-grey paper ruled with hairlines, flat graphite pill buttons, panels cut on two opposite corners, a popover window with 12px rounded corners over the native macOS popover blur. No hue; emphasis comes from contrast, weight and the graphite fill. Dense like a native macOS panel; nothing decorative.

## Tokens

All in `src/styles/globals.css` (`:root` light, `prefers-color-scheme: dark` dark). The theme setting (system, light, dark) sets the native window appearance via `lib/theme.ts`, and `prefers-color-scheme` follows it, mapped to Tailwind in `@theme inline`. No literal colors, fonts or durations in components.

| Group | Tokens | Use |
|---|---|---|
| Surfaces | `surface`, `paper`, `paper-2`, `paper-3` | translucent window over the blur (85% in light so text stays crisp over dark windows, 28% in dark), opaque floating panels and inputs, alpha hover fills and wells |
| Text | `ink`, `ink-2`, `muted` | primary, secondary, meta |
| Lines | `rule`, `rule-2` | row dividers and edges, control borders. Ink at 5% and 10% alpha so they stay quiet on the blur |
| Signal | `accent`, `accent-hover`, `accent-text`, `accent-wash`, `accent-ink` | graphite (light) / silver (dark): primary action, selection, in-progress state only |
| State | `error`, `error-wash`, `success`, `progress`, `warning` | the only hues: errors and high priority, done, in progress (teal), medium priority (amber) |
| Inverse | `graphite`, `graphite-ink` | tooltips |
| Controls | `thumb`, `track` | switch thumb (light in both modes) and off track |
| Type | `font-display` and `font-body` Instrument Sans, `font-mono` JetBrains Mono | one family for heads, labels and body (weight and tracking set them apart); mono for machine values (task keys, tokens, commands) |
| Size | `text-xs` 11 · `text-sm` 12 · `text-md` 13 · `text-lg` 15 · `text-xl` 17 | 13px body, macOS density |
| Shape | `radius-window` 12, `radius-control` pill, `radius-sm` 4, `radius-input` 8, `radius-card` 10, `cut` utility | buttons and inputs are pills; tiles, panels (bevel where supported) |
| Motion | `ease-out`, `ease-in-out`, `dur-micro` 120ms, `dur-short` 200ms | transform and opacity only |

Fonts are bundled (fontsource); the CSP forbids remote fonts.

## Rules

- Every control has its states: default, hover (one step darker fill), active (scale 0.97), focus-visible (2px focus ring), disabled, loading, invalid, selected.
- Buttons and controls are flat: one solid fill, no shadow, no border edge. Only floating layers (menus, dialogs, toasts, tooltips) cast `shadow-float`.
- Status is coloured text with one icon (`Status`), never a filled chip. Priority shows a level icon (`Priority`): red for high, amber for medium, muted for low. Issue type is a neutral `Badge`. Status looks the same everywhere (cards and sub-tasks): `StatusMenu` draws it and makes it the trigger for status changes. Done-category statuses that mean cancelled or rejected (`isCancelled` in core) are red, not green.
- A list inside a rounded container clips its rows (`overflow-hidden`) so hover fills follow the radius.
- Labels are sentence case in the display face, never tracked capitals, never mono.
- No middle-dot meta strings, no emoji icons, no gradients, no cards inside cards.
- Every region that loads data draws four states: loading (skeleton shaped like the content), empty (what belongs here + one action), error (what broke + what to do), full.
- Motion is state, never decoration. Popovers grow from their trigger, dialogs scale from 0.95, nothing animates on keyboard-driven actions. Reduced motion turns it all off.
- Links never navigate the popover; they open in the browser through `openExternal`.
- Dates are picked with `DatePicker` (a pill trigger plus `Calendar` in a popover), never the native date input.

## Components (`src/components/ui`)

`Button` (primary, secondary, ghost, danger; sm, md, icon; loading) · `IconButton` (with tooltip) · `Kbd` · `Input` · `SecretInput` · `Textarea` · `Select` · `Field` · `Switch` · `SearchField` · `SegmentedControl` · `Tabs`/`TabsList`/`Tab` (count, icon) · `Menu`/`MenuContent`/`MenuItem`/`MenuSeparator` · `Popover`/`PopoverContent` · `Calendar` · `DatePicker` · `Tooltip` · `Dialog` · `ConfirmDialog` · `Toaster`/`toast` · `ScrollArea` · `Separator` · `Skeleton` · `Spinner` · `Status` · `Priority` · `AppLogo` · `Badge` · `Avatar` · `ProviderLogo` · `CopyField` · `EmptyState` · `ErrorState`

Layout (`src/components/layout`): `AppHeader`, `Section`.

The playground (`src/features/playground`) shows each of these in every state, with a worst-case data toggle. Check new components there first.

## Brand

Name AssignedToMe. The mark ("Nokta"): three rounded bars, the middle one pulled out to the right with a dot where it was — your task pulled from the stack, and you. The masters and usage rules live in `design/logo` (`GUIDELINES.md`).
- Menubar: template image from the small-size cut (`src-tauri/icons/tray.png`, 44 px, black on transparent).
- App icon: silver mark on a graphite tile (`design/logo/mytask-macos-icon.svg` → `tauri icon`).
- Header: `AppLogo` (small-size cut, `brand-tile`/`brand-mark`, identical in light and dark).

## Search

Under the board tabs a `SearchField` filters the selected tab (or all boards) as you type, using `matchesQuery` from core: every word must appear in the key, title, status, type, sprint, assignee or a sub-task's key/title, ignoring case (Turkish-aware). On a single board tab (not "All", which searches only my tasks), from two characters on, the board's source is searched too (`searchTasks`: a full key, a bare number in my projects, or full text); those results appear under "More results in Jira" with a spinner while loading, and support every action a card has. ⌘F focuses it; Esc clears it first. Only when both are empty does the no-results state show.

## Signature

The queue: one ruled list of my tasks across boards. A row has the provider logo in its own column; then the key in mono, the sprint (PI) right next to it and the issue type badge, with the age on the right (the project/team name is not shown), the title at 14px semibold, a line for status, priority and assignee, and a line for story points, logged time against the estimate (with a small meter) and sub-tasks done. Expanding shows the description and the sub-tasks, each with a status dot, its key, title, assignee (initials avatar) and time. Clicking the card toggles its details (description and sub-tasks); only the ↗ button at the bottom right opens the task at its source. Sub-task rows have the same ↗ button, and expand the same way to show their own description and images when they have them. Image attachments appear in the details as a 3-column thumbnail grid (downloaded with the connection's credentials, shown as data: URLs); clicking one opens a larger preview with "Open in Jira". Wiki image embeds (`!x.png!`) are removed from the description text. A status (on the card and on sub-tasks) is a menu of the statuses the task can move to right now; the change shows at once, can be undone from the toast, and transitions that need extra fields open a form built from the transition's screen (`TransitionForm`: selects, numbers, text, comment; e.g. "Estimated Budget Effort"), marked with a form icon in the menu. Only required fields the app can't render (dates, users…) still point to the source app. The time (logged / estimate) opens a `Popover` to log work: a duration like `1h 30m` with quick picks, a date from our `DatePicker` (no future dates) and an optional comment; the panel stays open with a loading button until the source confirms, then the card updates and the toast can undo it. Below the form it lists the task's logged work (newest first, author, day, comment, duration); your own logs can be deleted, also with undo. Tasks with nothing tracked show "Log time" there. The assignee (initials avatar and name, on cards and sub-tasks) opens a `Popover` with people search, "Assign to me" and "Unassign"; the change shows at once with undo, and reassigning one of my tasks says it will leave my list.
