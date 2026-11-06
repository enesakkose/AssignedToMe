import { ImageResponse } from "next/og";

import { BRAND, Mark } from "@/lib/og/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon: the mark on the graphite tile (iOS rounds the corners itself). */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND.tile,
      }}
    >
      <Mark size={124} />
    </div>,
    size,
  );
}
