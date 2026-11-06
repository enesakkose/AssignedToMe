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

/**
 * A yes/no confirmation as a bottom sheet (the native pattern for a destructive choice) instead of a centre popup.
 * Controlled by `open`; closing it, by the backdrop or Cancel, calls `onOpenChange(false)`.
 */
export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  const ref = useRef<BottomSheetModalRef>(null);
  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);
  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      onDismiss={() => onOpenChange(false)}
    >
      <BottomSheetContent className="gap-5">
        <BottomSheetHeader title={title} description={description} />
        <View className="gap-2.5">
          <Button
            variant={destructive ? "destructive" : "default"}
            loading={pending}
            onPress={onConfirm}
          >
            <Text>{confirmLabel}</Text>
          </Button>
          <Button variant="secondary" onPress={() => onOpenChange(false)}>
            <Text>{cancelLabel}</Text>
          </Button>
        </View>
      </BottomSheetContent>
    </BottomSheetModal>
  );
}
