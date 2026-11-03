import { Text } from "@/components/ui/text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "@/lib/utils";
import {
  BottomSheetBackdrop,
  BottomSheetModal as GorhomBottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";
import * as React from "react";
import { View, type ViewProps } from "react-native";
import type { BottomSheetModalMethods } from "@gorhom/bottom-sheet/lib/typescript/types";

export type BottomSheetModalRef = BottomSheetModalMethods;

const BottomSheetModal = React.forwardRef<BottomSheetModalRef, BottomSheetModalProps>(
  (
    {
      backdropComponent,
      backgroundStyle,
      handleIndicatorStyle,
      handleStyle,
      snapPoints = ["42%"],
      ...props
    },
    ref,
  ) => {
    const theme = useAppTheme();

    const renderBackdrop = React.useCallback(
      (backdropProps: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={theme.values.bottomSheetBackdropOpacity}
          pressBehavior="close"
          {...backdropProps}
        />
      ),
      [theme.values.bottomSheetBackdropOpacity],
    );

    return (
      <GorhomBottomSheetModal
        backdropComponent={backdropComponent ?? renderBackdrop}
        backgroundStyle={[
          {
            backgroundColor: theme.tokens.card,
          },
          backgroundStyle,
        ]}
        handleIndicatorStyle={[
          {
            backgroundColor: theme.values.handleIndicator,
            width: 42,
          },
          handleIndicatorStyle,
        ]}
        handleStyle={[{ paddingBottom: 10, paddingTop: 10 }, handleStyle]}
        ref={ref}
        snapPoints={snapPoints}
        {...props}
      />
    );
  },
);

BottomSheetModal.displayName = "BottomSheetModal";

function BottomSheetContent({ children, className, ...props }: ViewProps) {
  return (
    <BottomSheetView>
      <View className={cn("gap-4 px-5 pb-8 pt-1", className)} {...props}>
        {children}
      </View>
    </BottomSheetView>
  );
}

function BottomSheetHeader({ description, title }: { description?: string; title: string }) {
  return (
    <View className="gap-1">
      <Text className="text-xl font-semibold leading-tight">{title}</Text>
      {description ? <Text variant="muted">{description}</Text> : null}
    </View>
  );
}

export { BottomSheetContent, BottomSheetHeader, BottomSheetModal };
