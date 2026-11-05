import {
  decryptTransfer,
  formatTransferCode,
  getProvider,
  mergeIncoming,
  newTransferCode,
  providers,
  signInProviders,
  TransferError,
} from "@mytask/core";
import { AppHeader } from "@/components/layout/app-header";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ErrorState } from "@/components/ui/state";
import { Text } from "@/components/ui/text";
import { clearHalted } from "@/features/tasks/background-refresh";
import { useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";
import { toast } from "sonner-native";
import { saveConnection, useConnectionsStore } from "../api/connections";

export const transferErrorKey = (e: unknown) =>
  e instanceof TransferError
    ? (
        {
          expired: "transfer.expired",
          invalid: "transfer.invalid",
          wrong_code: "transfer.wrongCode",
        } as const
      )[e.code]
    : "errors.generic";

/**
 * Desktop → phone. This phone makes the one-time code (shown here, typed on the Mac); the Mac shows the boards as a QR
 * encrypted with it. The QR alone is useless to anyone else.
 */
export function TransferReceiveScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [code] = useState(newTransferCode);
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The scanner fires many times a second; one QR is handled at a time.
  const handling = useRef(false);

  const onScan = async (data: string) => {
    if (handling.current || error) return;
    handling.current = true;
    setBusy(true);
    try {
      const incoming = await decryptTransfer(data, code, [...providers, ...signInProviders]);
      if (!incoming.length) throw new Error("none");
      // The same board sent again replaces the saved one (same id). Secrets go to the Keychain.
      const have = useConnectionsStore.getState().connections;
      for (const c of incoming) {
        await saveConnection(
          mergeIncoming(
            have.find((h) => h.id === c.id),
            c,
          ),
        );
        clearHalted(c.id);
        void qc.invalidateQueries({ queryKey: ["tasks", c.id] });
      }
      // Boards added with a sign-in come without it: the phone signs in itself, from the board's tab.
      const signInNeeded = incoming.some(
        (c) => getProvider(c.providerId)?.signIn && !have.some((h) => h.id === c.id),
      );
      toast.success(t("transfer.imported", { count: incoming.length }), {
        description: signInNeeded ? t("transfer.signInNeeded") : undefined,
      });
      router.back();
    } catch (e) {
      setError(
        e instanceof Error && e.message === "none"
          ? t("transfer.noBoards")
          : t(transferErrorKey(e)),
      );
      handling.current = false;
    } finally {
      setBusy(false);
    }
  };

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
          title={t("transfer.receiveTitle")}
        />
      }
    >
      <View className="gap-5 p-5">
        <Text className="text-[15px] leading-[22px] text-ink-2">{t("transfer.receiveStep")}</Text>
        <Text
          accessibilityLabel={code.split("").join(" ")}
          className="cut self-center border border-rule bg-paper-2 px-6 py-3 font-mono text-3xl tracking-[6px]"
          selectable
        >
          {formatTransferCode(code)}
        </Text>

        {error ? (
          <View className="gap-3">
            <ErrorState title={error} />
            <Button className="self-start" onPress={() => setError(null)} variant="secondary">
              <Text>{t("transfer.scanAgain")}</Text>
            </Button>
          </View>
        ) : null}

        {!permission ? null : !permission.granted ? (
          <View className="items-start gap-3">
            <Text className="text-sm" variant="muted">
              {t("transfer.cameraNeeded")}
            </Text>
            <Button onPress={() => void requestPermission()}>
              <Text>{t("transfer.allowCamera")}</Text>
            </Button>
          </View>
        ) : (
          <View className="cut aspect-square w-full overflow-hidden border border-rule bg-black">
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={error ? undefined : ({ data }) => void onScan(data)}
              style={{ flex: 1 }}
            />
            {busy ? (
              <View className="absolute inset-0 items-center justify-center bg-black/50">
                <ActivityIndicator color="white" />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Screen>
  );
}
