import type { Provider } from "@mytask/core";

import { cn } from "@/lib/cn";

/** All a mark needs: plain data, so a server component can hand it to a client one. */
export type ProviderMark = Pick<Provider, "name" | "logo">;

/** A provider as a card needs it: its mark and the app its tasks open in. */
export type ProviderView = Pick<Provider, "name" | "logo" | "appName">;

export const providerView = (p: Provider): ProviderView => ({
  name: p.name,
  logo: p.logo,
  appName: p.appName,
});

/**
 * The provider's own mark. A monochrome one (currentColor) is inlined so it follows the theme's ink; a coloured one
 * stays in an <img> so its gradient ids and styles can't leak into the page. The SVG is a built-in constant in
 * @mytask/core, never fetched data.
 */
export function ProviderLogo({
  provider,
  className,
}: {
  provider: ProviderMark;
  className?: string;
}) {
  if (provider.logo.includes("currentColor"))
    return (
      <span
        role="img"
        aria-label={provider.name}
        className={cn("inline-flex size-4 shrink-0 text-ink [&>svg]:size-full", className)}
        dangerouslySetInnerHTML={{ __html: provider.logo }}
      />
    );
  return (
    // oxlint-disable-next-line nextjs/no-img-element -- a data: URL of a built-in SVG; nothing for next/image to optimise
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(provider.logo)}`}
      alt={provider.name}
      className={cn("size-4 shrink-0", className)}
      draggable={false}
    />
  );
}
