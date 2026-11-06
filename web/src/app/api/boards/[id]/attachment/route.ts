import { onBoard, unsupported } from "@/server/on-board";
import { providerFetch } from "@/server/provider-fetch";

/** Raster images only: an SVG or HTML file served from this origin could run script here. */
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * An attachment image, fetched with the board's credentials (which core only ever sends to the board's own site) and
 * passed on as an image the browser can't treat as anything else.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!url.startsWith("https://") || url.length > 2000) return new Response(null, { status: 400 });
  const result = await onBoard(id, (p, c) =>
    (p.downloadAttachment ?? unsupported)(c, url, providerFetch),
  );
  if ("error" in result)
    return new Response(null, { status: result.error.code === "not_found" ? 404 : 502 });
  const blob = result.ok;
  const type = blob.type.split(";")[0]!.trim().toLowerCase();
  if (!IMAGE_TYPES.has(type) || blob.size > MAX_BYTES) return new Response(null, { status: 415 });
  return new Response(blob, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
