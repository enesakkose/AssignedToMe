import { SearchX } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button-variants";
import { EmptyState } from "@/components/ui/state";

export default async function NotFound() {
  const t = await getTranslations("error");
  return (
    <EmptyState
      className="pt-24"
      icon={<SearchX />}
      title={t("notFoundTitle")}
      description=""
      action={
        <Link href="/app" className={buttonVariants({ size: "sm" })}>
          {t("notFoundHome")}
        </Link>
      }
    />
  );
}
