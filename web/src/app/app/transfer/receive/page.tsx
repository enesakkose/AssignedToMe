import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ConnectPage } from "@/features/connections/components/connect-page";
import { ReceiveBoards } from "@/features/transfer/components/receive-boards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("transfer"))("receiveTitle") };
}

/** Receive boards from the phone app or the Mac app. */
export default async function ReceivePage() {
  const t = await getTranslations("transfer");
  return (
    <ConnectPage title={t("receiveTitle")}>
      <ReceiveBoards />
    </ConnectPage>
  );
}
