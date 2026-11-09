import { getProvider, providers, type Connection, type Provider } from "@mytask/core";
import { AppHeader } from "@/components/layout/app-header";
import { Section } from "@/components/layout/section";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm-sheet";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SecretInput } from "@/components/ui/secret-input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { Text } from "@/components/ui/text";
import { providerErrorText } from "@/lib/errors";
import { currentLocale } from "@/lib/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { toast } from "sonner-native";
import {
  newConnectionId,
  removeConnection,
  renameConnection,
  saveConnection,
  useConnectionsStore,
  withSecrets,
  type StoredConnection,
} from "../api/connections";
import { ProviderGuide } from "../components/provider-guide";
import { ProviderLogo } from "../components/provider-logo";
import { SignInPanel, signInFor } from "../components/sign-in-panel";
import { forgetTasks } from "@/features/tasks/api/task-cache";
import { clearHalted } from "@/features/tasks/background-refresh";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const secretKeys = (provider: Provider) =>
  provider.fields.filter((f) => f.type === "secret").map((f) => f.key);

/** Long tokens show their last 4 like a card number; short ones (passwords) show none. */
const mask = (secret: string) =>
  secret ? "••••••••" + (secret.length >= 20 ? secret.slice(-4) : "") : "";

/** Add (no id) or edit (id) a board connection. */
export function ConnectionScreen({ id }: { id?: string }) {
  const { t } = useTranslation();
  const existing = useConnectionsStore((s) => s.connections.find((c) => c.id === id));
  const [providerId, setProviderId] = useState<string | undefined>(existing?.providerId);
  const provider = getProvider(providerId ?? "");

  // The saved secrets never come back into the form; it only gets a masked hint of each.
  const loaded = useQuery({
    queryKey: ["connection-form", id],
    queryFn: async () => {
      const full = await withSecrets(existing!);
      return Object.fromEntries(secretKeys(provider!).map((k) => [k, mask(full.values[k] ?? "")]));
    },
    enabled: !!existing && !!provider,
    gcTime: 0,
    staleTime: 0,
  });

  return (
    <Screen
      header={
        <AppHeader
          leading={
            <Button
              accessibilityLabel={t("ui.back")}
              onPress={() => router.back()}
              size="icon"
              variant="ghost"
            >
              <Icon as={ArrowLeft} size={20} />
            </Button>
          }
          title={id ? t("connections.edit") : t("connections.add")}
        />
      }
    >
      {!provider ? (
        <ProviderPicker onPick={setProviderId} />
      ) : existing && !loaded.data ? (
        loaded.isError ? (
          <ErrorState
            className="m-5"
            description={t("errors.keychain")}
            title={t("errors.keychainTitle")}
          />
        ) : (
          <View className="gap-3 p-5">
            <Skeleton className="h-11 w-full rounded-full" />
            <Skeleton className="h-11 w-full rounded-full" />
            <Skeleton className="h-11 w-full rounded-full" />
          </View>
        )
      ) : (
        <ConnectionForm
          hints={loaded.data}
          initial={existing}
          key={id ?? provider.id}
          provider={provider}
        />
      )}
    </Screen>
  );
}

function ProviderPicker({ onPick }: { onPick: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <Section description={t("connections.pickProviderHint")} title={t("connections.pickProvider")}>
      <View className="flex-row flex-wrap gap-2">
        {providers.map((p) => (
          <Pressable
            accessibilityRole="button"
            className="cut min-h-14 grow basis-[45%] flex-row items-center gap-2.5 border border-rule bg-background p-2.5 active:scale-[0.97] active:bg-paper-2"
            key={p.id}
            onPress={() => onPick(p.id)}
          >
            <ProviderLogo provider={p} />
            <Text className="shrink text-sm font-medium">{p.name}</Text>
          </Pressable>
        ))}
      </View>
    </Section>
  );
}

function ConnectionForm({
  provider,
  initial,
  hints = {},
}: {
  provider: Provider;
  initial?: StoredConnection;
  hints?: Record<string, string>;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(initial?.values ?? {});
  const [name, setName] = useState(initial?.name ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const connection = (): Connection => ({
    id: initial?.id ?? newConnectionId(),
    providerId: provider.id,
    name: name.trim() || provider.defaultName(values),
    values: Object.fromEntries(provider.fields.map((f) => [f.key, (values[f.key] ?? "").trim()])),
  });

  const check = () => {
    const next: Record<string, string> = {};
    for (const f of provider.fields) {
      const v = (values[f.key] ?? "").trim();
      if (!v && !hints[f.key]) {
        if (!f.optional) next[f.key] = t("connections.required");
      } else if (f.type === "email" && !EMAIL.test(v)) next[f.key] = t("connections.invalidEmail");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // A kept secret is read from SecureStore only for this request, never put into form state.
  const withKept = async (c: Connection): Promise<Connection> => {
    if (!initial) return c;
    const saved = await withSecrets(initial);
    const secrets = new Set(secretKeys(provider));
    return {
      ...c,
      values: Object.fromEntries(
        Object.entries(c.values).map(([k, v]) => [
          k,
          v || (secrets.has(k) ? (saved.values[k] ?? "") : ""),
        ]),
      ),
    };
  };

  const test = useMutation({
    mutationFn: async (c: Connection) => provider.validate(await withKept(c), fetch),
  });
  const save = useMutation({
    mutationFn: saveConnection,
    onSuccess: (_data, c) => {
      clearHalted(c.id);
      return qc.invalidateQueries({ queryKey: ["tasks", c.id] });
    },
  });
  const remove = useMutation({
    mutationFn: removeConnection,
    onSuccess: (_data, id) => {
      forgetTasks(id);
      qc.removeQueries({ queryKey: ["tasks", id] });
    },
  });

  // A board added by signing in has no form: its sign-in is renewed, not typed, so there is nothing to check.
  const onTest = () => {
    if (!provider.signIn && !check()) return;
    test.mutate(connection(), { onSuccess: () => toast.success(t("connections.testOk")) });
  };

  const onSave = () => {
    if (provider.signIn && initial) {
      renameConnection(initial.id, name.trim() || initial.name);
      toast.success(t("connections.saved", { name: name.trim() || initial.name }));
      return router.back();
    }
    if (!check()) return;
    const c = connection();
    test.mutate(c, {
      onSuccess: () =>
        save.mutate(c, {
          onSuccess: () => {
            toast.success(t("connections.saved", { name: c.name }));
            router.back();
          },
          onError: () => toast.error(t("errors.keychain")),
        }),
    });
  };

  const busy = test.isPending || save.isPending;

  return (
    <>
      <View className="gap-4 border-b border-rule p-5">
        <View className="flex-row items-center gap-3">
          <ProviderLogo provider={provider} />
          <Text className="text-[17px] font-semibold">{provider.name}</Text>
        </View>
        {(provider.signIn ? [] : provider.fields).map((f) => (
          <View className="gap-2" key={f.key}>
            <Label className="text-sm" nativeID={`field-${f.key}`}>
              {f.label[locale]}
            </Label>
            {f.type === "secret" ? (
              <SecretInput
                accessibilityLabelledBy={`field-${f.key}`}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                onChangeText={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                placeholder={hints[f.key] || f.placeholder}
                textContentType="password"
                value={values[f.key] ?? ""}
              />
            ) : (
              <Input
                accessibilityLabelledBy={`field-${f.key}`}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                keyboardType={
                  f.type === "email" ? "email-address" : f.type === "url" ? "url" : "default"
                }
                onChangeText={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
              />
            )}
            {errors[f.key] ? (
              <Text className="text-sm text-error">{errors[f.key]}</Text>
            ) : hints[f.key] ? (
              <Text className="text-sm" variant="muted">
                {t("connections.secretKept", { hint: hints[f.key] })}
              </Text>
            ) : null}
          </View>
        ))}
        <View className="gap-2">
          <Label className="text-sm" nativeID="field-name">
            {t("boards.name")}
          </Label>
          <Input
            accessibilityLabelledBy="field-name"
            maxLength={60}
            onChangeText={setName}
            placeholder={provider.defaultName(values)}
            value={name}
          />
          <Text className="text-sm" variant="muted">
            {t("connections.nameHint")}
          </Text>
        </View>

        {test.isError ? (
          <ErrorState
            description={providerErrorText(test.error, t, provider.appName)}
            title={t("connections.testFailed")}
          />
        ) : null}

        <View className="flex-row gap-2 pt-1">
          <Button className="flex-1" loading={busy} onPress={onSave}>
            <Text>{initial ? t("ui.save") : t("connections.save")}</Text>
          </Button>
          <Button className="flex-1" disabled={busy} onPress={onTest} variant="secondary">
            <Text>{t("connections.test")}</Text>
          </Button>
        </View>
        {/* Add: sign in instead of pasting a token. Edit of a signed-in board: sign in again when it has ended. */}
        {!initial && signInFor(provider) ? <SignInPanel provider={signInFor(provider)!} /> : null}
        {initial && provider.signIn ? <SignInPanel existing={initial} provider={provider} /> : null}
        {initial ? (
          <Button
            className="self-center"
            variant="ghost"
            onPress={() =>
              confirm({
                title: t("connections.removeTitle", { name: initial.name }),
                description: t("connections.removeDescription"),
                confirmLabel: t("connections.remove"),
                cancelLabel: t("ui.cancel"),
                destructive: true,
                onConfirm: () =>
                  remove.mutate(initial.id, {
                    onSuccess: () => {
                      toast.success(t("connections.removed"));
                      router.back();
                    },
                    onError: () => toast.error(t("errors.generic")),
                  }),
              })
            }
          >
            <Icon as={Trash2} className="text-error" size={16} />
            <Text className="text-error">{t("connections.remove")}</Text>
          </Button>
        ) : null}
      </View>

      {provider.signIn ? null : (
        <Section title={t("connections.guideTitle", { name: provider.name })}>
          <ProviderGuide provider={provider} values={values} />
        </Section>
      )}
    </>
  );
}
