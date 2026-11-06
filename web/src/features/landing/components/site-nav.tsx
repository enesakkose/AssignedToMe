import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BrandMark } from "@/components/ui/brand-mark";
import { buttonVariants } from "@/components/ui/button-variants";
import { APP_PATH } from "@/features/tasks/lib/queue-params";
import { cn } from "@/lib/cn";
import { DOWNLOAD_URL, RELEASES_URL, REPO_URL } from "@/lib/links";

/** The landing's header: one floating pill in the middle of the top edge, with a machined hairline. */
export async function SiteNav() {
  const t = await getTranslations("landing");
  const link =
    "hidden h-9 items-center rounded-full px-3 text-md text-ink-2 transition-colors duration-[var(--dur-micro)] hover:text-ink md:inline-flex";
  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-30 flex justify-center px-4">
      <nav
        aria-label={t("nav")}
        className="metal-edge pointer-events-auto flex h-14 w-full max-w-[60rem] items-center gap-1 rounded-full pr-2 pl-5"
      >
        <Link href="/" className="flex items-center gap-2 rounded-full text-ink">
          <BrandMark className="size-[18px]" />
          <span className="font-display text-md font-semibold tracking-[-0.01em]">
            AssignedToMe
          </span>
        </Link>
        {/* The links sit in the middle of the pill, the name and the download at its two ends. */}
        <span className="mx-auto flex items-center gap-1">
          <a href={RELEASES_URL} className={link}>
            {t("navMac")}
          </a>
          <Link href={APP_PATH} className={link}>
            {t("navWeb")}
          </Link>
          <a href={REPO_URL} className={link}>
            {t("github")}
          </a>
        </span>
        <a
          href={DOWNLOAD_URL}
          className={cn(
            buttonVariants({ variant: "primary", size: "sm" }),
            "metal-fill h-10 rounded-full px-5 text-md hover:brightness-110",
          )}
        >
          {t("downloadMac")}
        </a>
      </nav>
    </header>
  );
}
