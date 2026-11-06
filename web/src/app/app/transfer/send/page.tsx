import { getProvider } from "@mytask/core";
import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { providerView } from "@/components/ui/provider-logo";
import { EmptyState } from "@/components/ui/state";
import { ConnectPage } from "@/features/connections/components/connect-page";
import { SendBoards } from "@/features/transfer/components/send-boards";
import { listBoards } from "@/server/boards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("transfer"))("sendTitle") };
}

/** Send boards to the phone app or the Mac app. Only names and logos reach the page; boards are sealed on the server. */
export default async function SendPage() {
  const t = await getTranslations("transfer");
  const boards = (await listBoards()).flatMap(({ connection: c }) => {
    const provider = getProvider(c.providerId);
    return provider
      ? [{ id: c.id, name: c.name, provider: providerView(provider), signedIn: !!provider.signIn }]
      : [];
  });
  return (
    <ConnectPage title={t("sendTitle")}>
      {boards.length ? (
        <SendBoards boards={boards} />
      ) : (
        <EmptyState
          icon={<Inbox />}
          title={t("nothingToSend")}
          description={t("nothingToSendHint")}
        />
      )}
    </ConnectPage>
  );
}
