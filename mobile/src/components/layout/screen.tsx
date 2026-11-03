import { cn } from "@/lib/utils";
import { type PropsWithChildren, type ReactNode } from "react";
import { ScrollView, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenProps = PropsWithChildren<
  ViewProps & {
    scroll?: boolean;
    contentClassName?: string;
    /** Stays put above the scrolling content (an `AppHeader`). */
    header?: ReactNode;
  }
>;

export function Screen({
  children,
  className,
  contentClassName,
  header,
  scroll = true,
  ...props
}: ScreenProps) {
  // Sections bring their own inset and rules, so the content itself has none; the bottom pad clears the tab dock.
  const content = (
    <View className={cn("w-full max-w-4xl flex-1 pb-32", contentClassName)} {...props}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      className={cn("flex-1 bg-background", className)}
      edges={["top", "left", "right"]}
    >
      {header}
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow items-center"
          keyboardDismissMode="on-drag"
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
