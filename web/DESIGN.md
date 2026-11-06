# Web Design

The web app shares the desktop system: `../desktop/DESIGN.md` is the source of truth for colour, type, radius, motion and the cut corner. This file lists only where the web differs and why.

## Token differences

| Token                             | Desktop         | Web                                                       | Why                                                        |
| --------------------------------- | --------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| Type sizes                        | menubar density | 12 / 13 / 14 / 15 / 16 / 18 / 22                          | a browser window is read from further away                 |
| `--color-rule` / `--color-rule-2` |                 | ink at 8% / 14%                                           | hairlines on a larger, brighter page                       |
| `--color-edge`                    | none            | light `oklch(60% 0.008 260)`, dark `oklch(52% 0.008 255)` | a field's edge needs 3:1 against the page; hairlines don't |
| `--color-band`                    | none            | ink 3% mixed into paper                                   | sidebar and status bands: a step off the page, opaque      |
| `--color-scrim`                   | none            | black 32%                                                 | behind the phone's sidebar sheet                           |
| `--control-sm` / `--control-md`   |                 | 28 / 36px, 44 on coarse pointers                          | touch targets                                              |
| `--ease-drawer`                   | none            | `cubic-bezier(0.32, 0.72, 0, 1)`                          | the sheet's slide                                          |

## Layout

- Shell: a 240px sidebar (`bg-band`, hairline right edge) and the page beside it. Under 1024px the sidebar is a sheet from the left behind a menu button.
- Sidebar rows: 32px (44 on touch), 2px apart, icon column 16px, count right-aligned in mono figures. Section label sits 4px above its rows and 24px below the previous group.
- Page header: 56px, title + count, then search (pill, 28px, `/` keycap) and the filter menu.
- List: status bands (36px, `bg-band`), rows 44px on one line from a 768px container, otherwise two lines (title, then key, priority, assignee, age). Columns: status, priority, key, title, type, time, sub-tasks, assignee, board, age.
- Detail: a 416px panel (512 from 1280px) with its own 56px header (board, key, type, Open in, close). Full screen on phones, with Back.
- Signature: the pulled bar from the logo marks the open task in the left gutter.

## Shared with desktop, unchanged

Pill buttons, inputs and search; 18px pill badges; 4px count chips on tabs; hairlines at 6%/10%; a 12px window radius; cut corners on panels. The task card (`features/tasks/components/task-card.tsx`) is desktop's card anatomy, used by the app list and the landing page alike.

## Landing page

- Dark first (`defaultTheme="dark"`); light stays one switch away and every part works in both.
- Header: React Bits' Card Nav, in our tokens. A floating glass bar (menu, name, Download) that opens into three link cards; Esc, an outside click or a link closes it, closed cards are inert.
- Hero: a quiet surface (one tone step down from the top), the head centred and the macOS window rising beneath it as the one moment. No background effect.
- Then the providers as spotlight cards (a pointer-following light in ink, fine pointers only), a bento where each tile shows the Mac app's own UI for one job (board tabs, status menu, log time, task card), the Keychain statement with the sign-in buttons, and the download on a plain panel.
- Display tokens only the landing uses: `--text-display`, `--text-section`, `--text-lead`; 48px hero buttons; 1200px content.
- The header's centre is the Nokta mark (`components/ui/brand-mark.tsx`, flat, current colour, no tile) beside the name at 14px medium.

## Motion

Menus grow from their trigger (scale 0.95 + fade, 120ms). The sheet slides in and out the same way (200ms, drawer curve). Buttons scale to 0.97 on press. List rows, tabs and the detail panel do not animate: they are used dozens of times a day.
