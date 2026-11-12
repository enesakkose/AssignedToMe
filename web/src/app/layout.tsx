import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { siteOrigin } from "@/lib/site";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("metadata"), getLocale()]);
  return {
    metadataBase: new URL(siteOrigin()),
    title: { default: t("title"), template: `%s | ${t("title")}` },
    description: t("description"),
    applicationName: "AssignedToMe",
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: "AssignedToMe",
      title: t("home"),
      description: t("description"),
      url: "/",
      locale: locale === "tr" ? "tr_TR" : "en_US",
    },
    twitter: { card: "summary_large_image", title: t("home"), description: t("description") },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#141517" },
  ],
  colorScheme: "dark light",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      {/* Browser extensions add attributes to <body> before React loads; those differences are not ours. */}
      <body suppressHydrationWarning>
        <NextIntlClientProvider>
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
