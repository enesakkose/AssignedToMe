import { ImageResponse } from "next/og";

import { BRAND, brandFonts, Mark } from "@/lib/og/brand";

export const alt = "AssignedToMe: everything assigned to you, in one list";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview: the mark and name, the headline, and the line under it, on the app's graphite. */
export default async function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: BRAND.ground,
        fontFamily: "Instrument Sans",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: BRAND.tile,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Mark size={44} />
        </div>
        <span style={{ fontSize: 34, fontWeight: 600, color: BRAND.ink, letterSpacing: "-0.01em" }}>
          AssignedToMe
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <span
          style={{
            fontSize: 84,
            fontWeight: 600,
            lineHeight: 1.04,
            letterSpacing: "-0.035em",
            color: BRAND.ink,
            maxWidth: 920,
          }}
        >
          Everything assigned to you, in one list
        </span>
        <span style={{ fontSize: 32, color: BRAND.muted }}>
          Every board you work on, gathered and refreshed every hour.
        </span>
      </div>
    </div>,
    { ...size, fonts: await brandFonts() },
  );
}
