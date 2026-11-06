import { providers } from "@mytask/core";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ProviderLogo } from "@/components/ui/provider-logo";
import { ConnectPage } from "@/features/connections/components/connect-page";

/** Where a board comes from: one tile per provider. */
export default async function ConnectIndex() {
  const t = await getTranslations("connect");
  return (
    <ConnectPage title={t("title")} lead={t("pick")}>
      <ul className="grid border-t border-l border-rule sm:grid-cols-2 lg:grid-cols-3">
        {providers.map((p) => (
          <li key={p.id} className="border-r border-b border-rule">
            <Link
              href={`/app/connect/${p.id}`}
              className="flex h-full items-center gap-4 p-6 transition-colors duration-[var(--dur-micro)] hover:bg-paper-2 focus-visible:outline-offset-[-2px]"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-paper shadow-window">
                <ProviderLogo provider={p} className="size-5" />
              </span>
              <span className="font-display text-xl font-medium">{p.name}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/app/transfer/receive"
        className="self-start text-md text-ink-2 underline-offset-4 hover:text-ink hover:underline"
      >
        {t("fromDevice")}
      </Link>
    </ConnectPage>
  );
}
