"use client";

import { useMemo } from "react";

import { qrShape } from "../lib/qr-shape";

/**
 * The transfer QR as on desktop: graphite soft modules on a paper card. Always dark-on-light, whatever the theme,
 * because phone cameras read that most reliably; the paper tone keeps it from glaring in dark mode.
 */
export function Qr({ text, label }: { text: string; label: string }) {
  const shape = useMemo(() => qrShape(text), [text]);
  return (
    <div className="cut w-full max-w-80 border border-rule bg-[#F5F6F8] p-4">
      <svg
        viewBox={`-3 -3 ${shape.size + 6} ${shape.size + 6}`}
        className="block aspect-square w-full"
        role="img"
        aria-label={label}
      >
        <path d={shape.dots} fill="#2B2D31" />
        <path d={shape.eyes} fill="#2B2D31" fillRule="evenodd" />
      </svg>
    </div>
  );
}
