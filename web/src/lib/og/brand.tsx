import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** The app icon's colours (desktop/design/logo/mytask-macos-icon.svg), for images drawn on the server. */
export const BRAND = {
  tile: "#2b2d31",
  mark: "#e4e5e7",
  ground: "#141517",
  ink: "#eceef1",
  muted: "#9a9ea6",
} as const;

/** The mark: three bars, the middle one pulled out, a dot where it was. */
export function Mark({ size, color = BRAND.mark }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill={color}>
      <rect x="24" y="24" width="152" height="56" rx="28" />
      <circle cx="53" cy="128" r="29" />
      <rect x="106" y="100" width="126" height="56" rx="28" />
      <rect x="24" y="176" width="152" height="56" rx="28" />
    </svg>
  );
}

/** Instrument Sans at the weights an image needs, from the installed static font files. */
export async function brandFonts() {
  // From the web package's own node_modules; a bundled route has no real module path to resolve from.
  const dir = join(process.cwd(), "node_modules/@fontsource/instrument-sans/files");
  const load = (weight: 400 | 600) =>
    readFile(join(dir, `instrument-sans-latin-${weight}-normal.woff`));
  const [regular, semibold] = await Promise.all([load(400), load(600)]);
  return [
    { name: "Instrument Sans", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Instrument Sans", data: semibold, weight: 600 as const, style: "normal" as const },
  ];
}
