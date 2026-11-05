import { signInProviders, type Connection, type Provider, type SignedInBoard } from "@mytask/core";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/state";
import { Text } from "@/components/ui/text";
import { clearHalted } from "@/features/tasks/background-refresh";
import { providerErrorText } from "@/lib/errors";
import { currentLocale } from "@/lib/i18n";
import { openLink } from "@/lib/open-link";
import { hapticSuccess } from "@/lib/utils/haptics";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { toast } from "sonner-native";
import {
  newConnectionId,
  saveConnection,
  useConnectionsStore,
  type StoredConnection,
} from "../api/connections";
import { ProviderLogo } from "./provider-logo";

/** The sign-in version of a provider (Jira → Jira through Atlassian), when it has one. */
export const signInFor = (provider: Provider) =>
  signInProviders.find((p) => p.signIn?.for === provider.id);

// The app's own scheme (app.json): iOS hands the page the browser lands on straight back to the sign-in session.
const REDIRECT_URI = "assignedtome://oauth/callback";

/** The person closed the sign-in on their own; not an error to show. */
class Cancelled extends Error {}

/**
 * Adds boards by signing in in the browser instead of pasting a token (Atlassian, Linear, GitHub). `provider` is the
 * sign-in provider; `existing` is the board being signed in again (expired, or one that came over by QR).
 */
export function SignInPanel({
  provider,
  existing,
}: {
  provider: Provider;
  existing?: StoredConnection;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const how = provider.signIn!;
  const account = how.for === "jira" ? "Atlassian" : provider.appName;
  const [device, setDevice] = useState<{ url: string; code: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const signIn = useMutation({
    mutationFn: async (): Promise<Connection[]> => {
      let boards: SignedInBoard[];
      if (how.kind === "redirect") {
        const { url, pending } = await how.begin(fetch, REDIRECT_URI);
        const result = await WebBrowser.openAuthSessionAsync(url, REDIRECT_URI);
        if (result.type !== "success") throw new Cancelled();
        boards = await how.finish(fetch, pending, result.url);
      } else {
        // The person types the code on the provider's site; it is shown here and already copied.
        const { url, code, pending } = await how.begin(fetch);
        setDevice({ code, url });
        void Clipboard.setStringAsync(code);
        void openLink(url).catch(() => undefined);
        abort.current = new AbortController();
        try {
          boards = await how.finish(fetch, pending, abort.current.signal);
        } finally {
          void WebBrowser.dismissBrowser();
        }
      }
      const known = useConnectionsStore.getState().connections;
      const saved: Connection[] = [];
      for (const b of boards) {
        // Signing in again to the same site or account renews that board instead of adding a second one.
        const same =
          (boards.length === 1 && existing) ||
          known.find(
            (c) =>
              c.providerId === provider.id &&
              (b.values.domain ? c.values.domain === b.values.domain : c.name === b.name),
          );
        const c: Connection = {
          id: same ? same.id : newConnectionId(),
          name: same ? same.name : b.name,
          providerId: provider.id,
          values: b.values,
        };
        await saveConnection(c);
        clearHalted(c.id);
        void qc.invalidateQueries({ queryKey: ["tasks", c.id] });
        saved.push(c);
      }
      return saved;
    },
    onError: () => setDevice(null),
    onSuccess: (saved) => {
      setDevice(null);
      void hapticSuccess();
      toast.success(t("connections.saved", { name: saved.map((c) => c.name).join(", ") }));
      router.back();
    },
  });

  // Leaving the screen ends a code that is still being waited for.
  useEffect(() => () => abort.current?.abort(), []);

  const cancelled = signIn.error instanceof Cancelled || signIn.error?.name === "AbortError";

  return (
    <View className="gap-3 border-t border-rule pt-4">
      <Text className="text-sm" variant="muted">
        {existing ? t("connections.signInAgain") : t("connections.orSignIn", { account })}
      </Text>
      <Button
        className="self-start"
        loading={signIn.isPending && !device}
        onPress={() => signIn.mutate()}
        variant="secondary"
      >
        <View className="size-4">
          <ProviderLogo bare provider={provider} />
        </View>
        <Text>{how.label[currentLocale()]}</Text>
      </Button>
      {device ? (
        <View className="gap-2">
          <Text className="text-sm" variant="muted">
            {t("connections.deviceCode", { app: provider.appName })}
          </Text>
          <Pressable
            accessibilityHint={t("tasks.copyId")}
            accessibilityLabel={device.code}
            accessibilityRole="button"
            className="cut self-start border border-rule bg-paper-2 px-4 py-3"
            onPress={() => void Clipboard.setStringAsync(device.code)}
          >
            <Text className="font-mono text-xl tracking-[3px]" selectable>
              {device.code}
            </Text>
          </Pressable>
          <View className="flex-row gap-2">
            <Button
              onPress={() => void openLink(device.url).catch(() => undefined)}
              size="sm"
              variant="secondary"
            >
              <Text>{t("connections.openSite", { app: provider.appName })}</Text>
            </Button>
            <Button onPress={() => abort.current?.abort()} size="sm" variant="ghost">
              <Text>{t("ui.cancel")}</Text>
            </Button>
          </View>
        </View>
      ) : null}
      {signIn.isError && !cancelled ? (
        <ErrorState
          description={providerErrorText(signIn.error, t, provider.appName)}
          title={t("connections.testFailed")}
        />
      ) : null}
      {/* Company accounts may need an admin to approve the app first; the token form needs no approval. */}
      <Text className="text-sm" variant="muted">
        {t("connections.signInApproval", { app: provider.appName })}
      </Text>
    </View>
  );
}
