import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LandingPage } from "@/features/landing/components/landing-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: { absolute: t("home") } };
}

export default function Page() {
  return <LandingPage />;
}
