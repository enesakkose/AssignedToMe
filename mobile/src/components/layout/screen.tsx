import { cn } from "@/lib/utils";
import { type PropsWithChildren, type ReactNode } from "react";
import { ScrollView, View, type ScrollViewProps, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ScreenProps = PropsWithChildren<
  ViewProps & {
    scroll?: boolean;
    contentClassName?: string;
    /** Stays put above the scrolling content (an `AppHeader`). */
    header?: ReactNode;
    refreshControl?: ScrollViewProps["refreshControl"];
  }
>;

export function Screen({
  children,
  className,
  contentClassName,
  header,
  refreshControl,
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
          // Keeps a focused field (a form, the comment box) above the keyboard.
          automaticallyAdjustKeyboardInsets
          className="flex-1"
          contentContainerClassName="grow items-center"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {content}
        </ScrollView>
      ) : (
        <View className="flex-1 items-center">{content}</View>
      )}
    </SafeAreaView>
  );
}
