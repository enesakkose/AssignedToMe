import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/cn";

/** The frame of the connect screens: back to the list, a title, then the content. */
export async function ConnectPage({
  title,
  lead,
  children,
}: {
  title: ReactNode;
  lead?: string;
  children: ReactNode;
}) {
  const t = await getTranslations("connect");
  return (
    <main className="mx-auto flex w-full max-w-[64rem] flex-col gap-10 px-4 py-10 text-lg sm:px-8 sm:py-16">
      <Link
        href="/app"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-3 self-start text-md")}
      >
        <ArrowLeft aria-hidden />
        {t("back")}
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-3 font-display text-section leading-tight font-medium tracking-[-0.02em]">
          {title}
        </h1>
        {lead && <p className="text-lead text-muted">{lead}</p>}
      </header>
      {children}
    </main>
  );
}
