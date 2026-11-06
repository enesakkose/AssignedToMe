import { providers, signInProviders, type Locale } from "@mytask/core";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { ProviderLogo, providerView } from "@/components/ui/provider-logo";
import { ErrorState } from "@/components/ui/state";
import { ConnectForm } from "@/features/connections/components/connect-form";
import { ConnectPage } from "@/features/connections/components/connect-page";
import { DeviceSignIn } from "@/features/connections/components/device-sign-in";
import { PopupSignIn } from "@/features/connections/components/popup-sign-in";
import { getBoard } from "@/server/boards";

/** One provider's screen: its sign-in when it has one, its token form, and the guide to get the token. */
export default async function ConnectProvider({
  params,
  searchParams,
}: {
  params: Promise<{ providerId: string }>;
  searchParams: Promise<{ error?: string; board?: string }>;
}) {
  const [{ providerId }, { error, board: boardId }, t, te, locale] = await Promise.all([
    params,
    searchParams,
    getTranslations("connect"),
    getTranslations("errors"),
    getLocale() as Promise<Locale>,
  ]);
  const provider = providers.find((p) => p.id === providerId);
  if (!provider) notFound();
  // Editing a board fills in what it has, except its secrets: those stay on the server and are kept when left empty.
  const board = boardId ? await getBoard(boardId) : undefined;
  const editing =
    board?.connection.providerId === provider.id
      ? {
          id: board.connection.id,
          name: board.connection.name,
          values: Object.fromEntries(
            provider.fields
              .filter((f) => f.type !== "secret" && !f.session)
              .map((f) => [f.key, board.connection.values[f.key] ?? ""]),
          ),
        }
      : undefined;
  const signIn = editing ? undefined : signInProviders.find((p) => p.signIn?.for === provider.id);
  const account = provider.id === "jira" ? "Atlassian" : provider.appName;
  return (
    <ConnectPage
      title={
        <>
          <ProviderLogo provider={provider} className="size-7" />
          {editing ? t("editTitle", { board: editing.name }) : provider.name}
        </>
      }
    >
      {error && (
        <ErrorState
          title={t("failed")}
          description={error === "limit" ? te("limit") : te("signin")}
        />
      )}
      {signIn?.signIn && (
        <section className="flex flex-col gap-4 border-b border-rule pb-10">
          <p className="text-md text-ink-2">{t("orSignIn", { account })}</p>
          {signIn.signIn.kind === "redirect" ? (
            <PopupSignIn providerId={signIn.id} app={provider.appName}>
              <ProviderLogo provider={providerView(signIn)} />
              {signIn.signIn.label[locale]}
            </PopupSignIn>
          ) : (
            <DeviceSignIn
              providerId={signIn.id}
              label={signIn.signIn.label[locale]}
              app={provider.appName}
            />
          )}
          <p className="text-sm text-muted">{t("approval", { app: provider.appName })}</p>
        </section>
      )}
      <ConnectForm
        providerId={provider.id}
        providerName={provider.name}
        appName={provider.appName}
        editing={editing}
        fields={provider.fields
          .filter((f) => !f.session)
          .map((f) => ({
            key: f.key,
            label: f.label[locale],
            type: f.type,
            optional: f.optional,
            placeholder: f.placeholder,
          }))}
        guide={provider.guide.map((g) => ({ text: g.text[locale], link: g.link, copy: g.copy }))}
      />
    </ConnectPage>
  );
}
