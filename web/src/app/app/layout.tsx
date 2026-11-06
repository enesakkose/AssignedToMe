import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/toaster";

/** One person's tasks: titled, never indexed. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: t("app"),
    robots: { index: false, follow: false },
    alternates: { canonical: null },
  };
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <Toaster />
    </QueryProvider>
  );
}
