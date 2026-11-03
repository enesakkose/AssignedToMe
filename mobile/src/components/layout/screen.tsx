import { cn } from "@/lib/utils";
import { type PropsWithChildren } from "react";
import { ScrollView, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenProps = PropsWithChildren<
  ViewProps & {
    scroll?: boolean;
    contentClassName?: string;
  }
>;

export function Screen({
  children,
  className,
  contentClassName,
  scroll = true,
  ...props
}: ScreenProps) {
  const content = (
    <View
      className={cn("w-full max-w-4xl flex-1 gap-5 px-5 pb-24 pt-6", contentClassName)}
      {...props}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      className={cn("flex-1 bg-background", className)}
      edges={["top", "left", "right"]}
    >
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow items-center"
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        <View className="flex-1 items-center">{content}</View>
      )}
    </SafeAreaView>
  );
}
