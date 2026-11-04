import { isSafeUrl, type Attachment } from "@mytask/core";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppTheme } from "@/hooks/use-app-theme";
import { withSecrets } from "@/features/connections/api/connections";
import { useQueries } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import WebView from "react-native-webview";
import { toast } from "sonner-native";
import { z } from "zod";
import { openInSource } from "../api/open-in-source";
import { useBoard } from "../hooks/use-board";
import { ImagePreview } from "./attachment-images";

/**
 * Untrusted HTML from the source runs in a locked-down page: the policy blocks every script, frame, form and remote
 * load, so nothing in it executes or phones home. Only our own measuring script (injected by the app, which the page
 * policy doesn't apply to) runs.
 */
const CSP =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";

// Belt and braces on top of the policy: tags that have no place in a description are dropped outright.
const DROP =
  /<(script|style|iframe|object|embed|form|meta|base|link|video|audio)\b[\s\S]*?(<\/\1>|\/?>)/gi;
const IMG_SRC = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(.*?)\2/gi;
const A_HREF = /(<a\b[^>]*?\bhref\s*=\s*)(["'])(.*?)\2/gi;

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const resolve = (url: string, base: string) => {
  try {
    return new URL(decode(url), `${base}/`).toString();
  } catch {
    return undefined;
  }
};

// Reports the content height (the page can't size itself to a native view) and image taps.
const MEASURE = `(() => {
  const post = (m) => window.ReactNativeWebView.postMessage(JSON.stringify(m));
  const h = () => post({ height: document.documentElement.scrollHeight });
  new ResizeObserver(h).observe(document.body);
  h();
  document.addEventListener('click', (e) => {
    const img = e.target.closest && e.target.closest('img[data-i]');
    if (img) post({ image: Number(img.dataset.i) });
  });
})(); true;`;

const message = z.union([
  z.object({ height: z.number().positive().max(100_000) }),
  z.object({ image: z.number().int().min(0) }),
]);

type Props = { html: string; base: string; connectionId: string; taskUrl: string };

/** The description as the source renders it (tables, panels, smart links), with images loaded through the connection. */
export function SourceHtml({ html, base, connectionId, taskUrl }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { connection, provider } = useBoard(connectionId);
  const [height, setHeight] = useState(0);
  const [preview, setPreview] = useState<Attachment | null>(null);

  // Links point at the source site, so relative ones ("/browse/X") are made absolute before the page sees them.
  const clean = html
    .replace(DROP, "")
    // No inline styles from the source (as desktop): a description can't draw over or mimic the app's own UI.
    .replace(/\sstyle\s*=\s*(["'])[\s\S]*?\1/gi, "")
    .replace(
      A_HREF,
      (_m, start: string, _q: string, href: string) =>
        `${start}"${(resolve(href, base) ?? "").replace(/"/g, "&quot;")}"`,
    );
  const urls = [...clean.matchAll(IMG_SRC)].map((m) => resolve(m[3] ?? "", base));
  // Same cache as the attachment thumbnails; credentials only ever go to the connection's own site (core checks).
  const images = useQueries({
    queries: urls.map((url) => ({
      enabled: !!url && !!connection && !!provider?.downloadAttachment,
      gcTime: 10 * 60_000,
      queryFn: async () => {
        const blob = await provider!.downloadAttachment!(
          await withSecrets(connection!),
          url!,
          fetch,
        );
        return new Promise<string>((ok, fail) => {
          const reader = new FileReader();
          reader.onload = () => ok(String(reader.result));
          reader.onerror = () => fail(reader.error);
          reader.readAsDataURL(blob);
        });
      },
      queryKey: ["attachment", connectionId, url],
      staleTime: Infinity,
    })),
  });
  if (images.some((q) => q.isPending && q.fetchStatus !== "idle"))
    return (
      <View className="gap-2">
        <Skeleton className="h-4 w-full rounded-sm" />
        <Skeleton className="h-4 w-4/5 rounded-sm" />
      </View>
    );

  let i = 0;
  // Each image gets its downloaded data, or is left without a source (a failed one simply doesn't show).
  const body = clean.replace(IMG_SRC, (_m, start: string) => {
    const n = i++;
    const data = images[n]?.data;
    return `${start}"${data ?? ""}" data-i="${n}"`;
  });

  const c = theme.tokens;
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    html,body{margin:0;padding:0;background:transparent;color:${theme.values.mutedInk};font:15px/22px -apple-system,system-ui,sans-serif;overflow-wrap:anywhere}
    a{color:${c.foreground};text-decoration:underline}
    img{max-width:100%;height:auto;border-radius:6px}
    img:not([src^="data:"]){display:none}
    table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}
    td,th{border:1px solid ${c.border};padding:6px 8px;text-align:left;vertical-align:top}
    pre,code{font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap}
    blockquote,.panel,[class*="panel"]{margin:8px 0;padding:8px 12px;border-left:3px solid ${c.border};background:${c.muted}}
    p{margin:0 0 10px} ul,ol{padding-left:20px;margin:0 0 10px} h1,h2,h3,h4{color:${c.foreground};font-size:16px;margin:12px 0 6px}
  </style></head><body>${body}</body></html>`;

  return (
    <>
      <WebView
        allowsLinkPreview={false}
        injectedJavaScript={MEASURE}
        onMessage={(e) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(e.nativeEvent.data);
          } catch {
            return;
          }
          const m = message.safeParse(parsed);
          if (!m.success) return;
          if ("height" in m.data) setHeight(Math.ceil(m.data.height));
          else {
            const url = urls[m.data.image];
            if (url) setPreview({ id: url, name: url.split("/").pop() ?? "", url });
          }
        }}
        // The page never navigates: a tapped link opens outside the app (http(s) only), anything else is dropped.
        onShouldStartLoadWithRequest={(req) => {
          // Only our own document loads; a data: URL would be a new page without the policy above.
          if (req.url === "about:blank") return true;
          const url = resolve(req.url, base);
          if (req.navigationType === "click" && url && isSafeUrl(url))
            void openInSource(connectionId, url).catch(() => toast.error(t("errors.openLink")));
          return false;
        }}
        originWhitelist={["about:blank"]}
        scrollEnabled={false}
        source={{ baseUrl: "about:blank", html: doc }}
        style={{ backgroundColor: "transparent", height: Math.max(height, 24) }}
      />
      {preview ? (
        <ImagePreview
          attachment={preview}
          connectionId={connectionId}
          onClose={() => setPreview(null)}
          taskUrl={taskUrl}
        />
      ) : null}
    </>
  );
}
