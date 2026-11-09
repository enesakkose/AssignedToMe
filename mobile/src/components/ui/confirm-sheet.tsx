import {
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetModal,
  type BottomSheetModalRef,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { create } from "zustand";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

const useConfirm = create<{ options?: ConfirmOptions }>(() => ({}));

/** Opens the confirmation bottom sheet. Works from any screen because the sheet is hosted at the root. */
export const confirm = (options: ConfirmOptions) => useConfirm.setState({ options });
const close = () => useConfirm.setState({ options: undefined });

/**
 * Mounted once at the root (like TaskSheets). A BottomSheetModal mounted inside a pushed stack screen
 * renders behind it and never shows, so the confirm sheet lives here and is driven by a store instead.
 */
export function ConfirmSheetHost() {
  const ref = useRef<BottomSheetModalRef>(null);
  const options = useConfirm((s) => s.options);
  useEffect(() => {
    if (options) ref.current?.present();
  }, [options]);
  const dismiss = () => ref.current?.dismiss();

  return (
    <BottomSheetModal ref={ref} enableDynamicSizing onDismiss={close}>
      <BottomSheetContent className="gap-5">
        {options ? (
          <>
            <BottomSheetHeader title={options.title} description={options.description} />
            <View className="gap-2.5">
              <Button
                variant={options.destructive ? "destructive" : "default"}
                onPress={() => {
                  const run = options.onConfirm;
                  dismiss();
                  run();
                }}
              >
                <Text>{options.confirmLabel}</Text>
              </Button>
              <Button variant="secondary" onPress={dismiss}>
                <Text>{options.cancelLabel}</Text>
              </Button>
            </View>
          </>
        ) : null}
      </BottomSheetContent>
    </BottomSheetModal>
  );
}
