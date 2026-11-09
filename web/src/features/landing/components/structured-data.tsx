import { getLocale, getTranslations } from "next-intl/server";

import { siteOrigin } from "@/lib/site";
import { REPO_URL } from "@/lib/links";

/** JSON-LD for the landing page: lets search engines and AI answer engines state what this is, who makes it,
 * and answer the common questions directly. Facts only — no ratings or claims we can't back. */
export async function StructuredData() {
  const [t, locale] = await Promise.all([getTranslations("landing"), getLocale()]);
  const origin = siteOrigin();
  const faq = t.raw("faq") as { q: string; a: string }[];

  const graph = [
    {
      "@type": "Organization",
      "@id": `${origin}/#org`,
      name: "AssignedToMe",
      url: origin,
      logo: `${origin}/icon.svg`,
      sameAs: [REPO_URL],
    },
    {
      "@type": "WebSite",
      "@id": `${origin}/#site`,
      name: "AssignedToMe",
      url: origin,
      inLanguage: locale === "tr" ? "tr-TR" : "en-US",
      publisher: { "@id": `${origin}/#org` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${origin}/#app`,
      name: "AssignedToMe",
      url: origin,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "macOS, Web",
      description: t("heroLine"),
      featureList: t("statementRest"),
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": `${origin}/#org` },
    },
    {
      "@type": "FAQPage",
      "@id": `${origin}/#faq`,
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- our own data, serialized to JSON
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}
