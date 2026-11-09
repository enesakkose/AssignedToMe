import { providers, signInProviders, type Provider } from "@mytask/core";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/ui/brand-mark";
import { buttonVariants } from "@/components/ui/button-variants";
import { ProviderLogo } from "@/components/ui/provider-logo";
import type { Locale } from "@/i18n/locales";
import { APP_PATH } from "@/features/tasks/lib/queue-params";
import { cn } from "@/lib/cn";
import { DOWNLOAD_URL, REPO_URL } from "@/lib/links";

import { Features } from "./features";
import { HeroList } from "./hero-list";
import { FooterPrefs } from "./footer-prefs";
import { SiteNav } from "./site-nav";
import { StructuredData } from "./structured-data";

/** One container for the whole page: 1200px of content at most; past it the gutters grow. */
const Container = ({ className, children }: { className?: string; children: ReactNode }) => (
  <div className={cn("mx-auto w-full max-w-[78rem] px-4 sm:px-8", className)}>{children}</div>
);

const sectionHead = "font-display text-section leading-[1.08] font-medium tracking-[-0.025em]";
const big = "h-12 px-6 text-md";

/** How a board is connected: the sign-in when the provider has one, otherwise its token. */
const signInFor = (p: Provider) => signInProviders.find((s) => s.signIn?.for === p.id);

/** What a first-time visitor sees: what it is, in the sources' own marks; one statement; what it does; keys; download. */
export async function LandingPage() {
  const [t, locale] = await Promise.all([getTranslations("landing"), getLocale()]);
  const faq = t.raw("faq") as { q: string; a: string }[];
  return (
    <div className="text-lg">
      <StructuredData />
      <SiteNav />

      <main>
        <section
          aria-labelledby="hero"
          className="relative isolate flex min-h-dvh items-center overflow-hidden py-32"
        >
          {/* Held still and faint: light from the top, and the product's own list behind the head. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="ti-light absolute inset-0 opacity-25" />
            <HeroList />
          </div>
          <Container className="flex flex-col items-center text-center">
            <h1
              id="hero"
              className="metal-text max-w-[14ch] pb-[0.06em] font-display text-display leading-[1.04] font-semibold tracking-[-0.035em] text-balance"
            >
              {t("heroTitle")}
            </h1>
            <p className="mt-7 max-w-[30rem] text-lead leading-relaxed text-muted">
              {t("heroLine")}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {/* The browser is where the visitor already is: the web app leads, the Mac app sits beside it. */}
              <Link
                href={APP_PATH}
                className={cn(
                  buttonVariants({ variant: "primary", size: "md" }),
                  big,
                  "metal-fill group hover:brightness-110",
                )}
              >
                {t("openApp")}
                <ArrowRight
                  aria-hidden
                  className="transition-transform duration-[var(--dur-micro)] group-hover:translate-x-0.5"
                />
              </Link>
              <a
                href={DOWNLOAD_URL}
                className={cn(buttonVariants({ variant: "secondary", size: "md" }), big)}
              >
                <Download aria-hidden />
                {t("downloadMac")}
              </a>
            </div>
            <p className="mt-4 text-sm text-muted">{t("heroWebNote")}</p>
          </Container>
        </section>

        <section aria-label={t("statementLabel")} className="metal-rule py-28 lg:py-36">
          <Container>
            <p className="max-w-[30ch] font-display text-section leading-[1.15] font-medium tracking-[-0.02em] text-muted">
              <span className="text-ink">{t("statementLead")}</span> {t("statementRest")}
            </p>
          </Container>
        </section>

        <section aria-labelledby="sources" className="pb-28 lg:pb-36">
          <Container className="flex flex-col gap-10">
            <h2 id="sources" className={cn(sectionHead, "max-w-[18ch]")}>
              {t("sourcesTitle")}
            </h2>
            <ul className="grid border-t border-l border-rule sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-6 border-r border-b border-rule p-8 transition-colors duration-[var(--dur-micro)] hover:bg-paper-2"
                >
                  <span className="grid size-11 place-items-center rounded-[12px] bg-paper shadow-window">
                    <ProviderLogo provider={p} className="size-5" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-display text-xl font-medium tracking-[-0.01em] text-ink">
                      {p.name}
                    </span>
                    <span className="text-md text-muted">
                      {signInFor(p)
                        ? t("signInOr", { account: p.id === "jira" ? "Atlassian" : p.appName })
                        : t("tokenOnly")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section aria-labelledby="features" className="pb-28 lg:pb-36">
          <Container className="flex flex-col gap-10">
            <h2 id="features" className={cn(sectionHead, "max-w-[18ch]")}>
              {t("featuresTitle")}
            </h2>
            <Features />
          </Container>
        </section>

        <section aria-labelledby="keys" className="metal-rule py-28 lg:py-36">
          <Container className="grid items-end gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
            <div className="flex flex-col gap-6">
              <h2 id="keys" className={cn(sectionHead, "max-w-[16ch]")}>
                {t("keysTitle")}
              </h2>
              <p className="max-w-[32rem] text-lead leading-relaxed text-muted">{t("keysLine")}</p>
            </div>
            <div aria-hidden className="flex flex-col gap-2">
              {signInProviders.map((p) => (
                <span
                  key={p.id}
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "md" }),
                    "h-11 justify-start gap-3 px-5 text-md",
                  )}
                >
                  <ProviderLogo provider={p} />
                  {p.signIn!.label[locale as Locale]}
                </span>
              ))}
            </div>
          </Container>
        </section>

        <section aria-labelledby="faq" className="pb-28 lg:pb-36">
          <Container className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <h2 id="faq" className={cn(sectionHead, "max-w-[12ch]")}>
              {t("faqTitle")}
            </h2>
            <dl className="flex flex-col divide-y divide-rule border-t border-rule">
              {faq.map((f) => (
                <div key={f.q} className="flex flex-col gap-2 py-6">
                  <dt className="font-display text-xl font-medium tracking-[-0.01em] text-ink">
                    {f.q}
                  </dt>
                  <dd className="max-w-[46ch] text-md leading-relaxed text-muted">{f.a}</dd>
                </div>
              ))}
            </dl>
          </Container>
        </section>

        <section aria-labelledby="close" className="metal-rule py-28 lg:py-36">
          <Container className="flex flex-col items-start gap-8">
            <h2 id="close" className={cn(sectionHead, "max-w-[18ch]")}>
              {t("closeTitle")}
            </h2>
            <p className="text-lead text-muted">{t("closeLine")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={APP_PATH}
                className={cn(
                  buttonVariants({ variant: "primary", size: "md" }),
                  big,
                  "metal-fill group hover:brightness-110",
                )}
              >
                {t("openApp")}
                <ArrowRight
                  aria-hidden
                  className="transition-transform duration-[var(--dur-micro)] group-hover:translate-x-0.5"
                />
              </Link>
              <a
                href={DOWNLOAD_URL}
                className={cn(buttonVariants({ variant: "secondary", size: "md" }), big)}
              >
                <Download aria-hidden />
                {t("downloadMac")}
              </a>
            </div>
          </Container>
        </section>
      </main>

      <footer className="metal-rule">
        <Container className="flex flex-col gap-6 py-8 sm:flex-row sm:items-center">
          <span className="flex items-center gap-2 text-md font-semibold sm:mr-auto">
            <BrandMark className="size-4" />
            AssignedToMe
          </span>
          <nav
            aria-label={t("footerNav")}
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-md text-muted"
          >
            <a href={DOWNLOAD_URL} className="rounded-sm hover:text-ink">
              {t("downloadMac")}
            </a>
            <Link href={APP_PATH} className="rounded-sm hover:text-ink">
              {t("openApp")}
            </Link>
            <a href={REPO_URL} className="rounded-sm hover:text-ink">
              {t("github")}
            </a>
          </nav>
          <FooterPrefs />
        </Container>
      </footer>
    </div>
  );
}
