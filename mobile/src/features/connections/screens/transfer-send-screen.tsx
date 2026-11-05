import { encryptTransfer, getProvider, isTransferCode, transferable } from "@mytask/core";
import { AppHeader } from "@/components/layout/app-header";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/state";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { ArrowLeft, Copy } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { toast } from "sonner-native";
import { useConnectionsStore, withSecrets } from "../api/connections";
import { ProviderLogo } from "../components/provider-logo";
import { transferErrorKey } from "./transfer-receive-screen";

/**
 * Phone → desktop. The Mac makes the one-time code; this phone encrypts the boards with it and copies the result,
 * which reaches the Mac through the shared clipboard. Without the code the copied text is useless.
 */
export function TransferSendScreen() {
  const { t } = useTranslation();
  const boards = useConnectionsStore((s) => s.connections);
  const [code, setCode] = useState("");
  const [picked, setPicked] = useState(() => new Set(boards.map((b) => b.id)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Boards added with a sign-in go without it (see `transferable`): the Mac signs in by itself, once.
  const signedIn = boards.filter((b) => getProvider(b.providerId)?.signIn).length;

  const copy = async () => {
    if (!isTransferCode(code)) return setError(t("transfer.codeInvalid"));
    setBusy(true);
    setError(null);
    try {
      // Secrets are read from the Keychain only for this, and leave the app only inside the encrypted text.
      const full = await Promise.all(
        boards.filter((b) => picked.has(b.id)).map(async (b) => transferable(await withSecrets(b))),
      );
      await Clipboard.setStringAsync(await encryptTransfer(full, code));
      toast.success(t("transfer.copied"));
      router.back();
    } catch (e) {
      setError(t(transferErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string, on: boolean) =>
    setPicked((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
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
          title={t("transfer.sendTitle")}
        />
      }
    >
      <View className="gap-5 p-5">
        <Text className="text-[15px] leading-[22px] text-ink-2">{t("transfer.sendStep")}</Text>
        <View className="gap-2">
          <Text className="text-sm font-medium">{t("transfer.code")}</Text>
          <Input
            accessibilityLabel={t("transfer.code")}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect={false}
            className="font-mono text-lg tracking-[4px]"
            maxLength={9}
            onChangeText={setCode}
            onSubmitEditing={() => void copy()}
            placeholder="XXXX-XXXX"
            returnKeyType="done"
            value={code}
          />
        </View>
        <View className="gap-1">
          <Text className="text-sm font-medium">{t("transfer.boards")}</Text>
          {signedIn > 0 ? (
            <Text className="text-sm" variant="muted">
              {t("transfer.signInNote", { count: signedIn })}
            </Text>
          ) : null}
          {boards.map((b) => {
            const provider = getProvider(b.providerId);
            return (
              // The whole row toggles, not only the small switch.
              <Pressable
                accessibilityLabel={b.name}
                accessibilityRole="switch"
                accessibilityState={{ checked: picked.has(b.id) }}
                className="min-h-12 flex-row items-center gap-3"
                key={b.id}
                onPress={() => toggle(b.id, !picked.has(b.id))}
              >
                {provider ? <ProviderLogo provider={provider} /> : null}
                <Text className="min-w-0 flex-1" numberOfLines={1}>
                  {b.name}
                </Text>
                <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  <Switch checked={picked.has(b.id)} onCheckedChange={(on) => toggle(b.id, on)} />
                </View>
              </Pressable>
            );
          })}
        </View>
        {error ? <ErrorState title={error} /> : null}
        <Button disabled={!picked.size} loading={busy} onPress={() => void copy()}>
          <Icon as={Copy} className="text-primary-foreground" size={16} />
          <Text>{t("transfer.copy")}</Text>
        </Button>
      </View>
    </Screen>
  );
}
