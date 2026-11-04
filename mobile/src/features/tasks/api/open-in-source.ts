import { openLink } from "@/lib/open-link";
import { queryClient } from "@/lib/query";
import * as Clipboard from "expo-clipboard";
import { AppState, Platform } from "react-native";
import { toast } from "sonner-native";

/** Opens a task (or a link in it) in the in-app browser, and refetches its board afterwards so a change made there shows up here. */
export async function openInSource(connectionId: string, url: string) {
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["tasks", connectionId] });
  await openLink(url);
  // iOS resolves when the sheet closes; an Android Custom Tab resolves at once and backgrounds the app instead.
  if (Platform.OS === "ios") return refresh();
  const sub = AppState.addEventListener("change", (state) => {
    if (state !== "active") return;
    sub.remove();
    refresh();
  });
}

/** Copies a task's link or id, with a toast to confirm. */
export const copyText = (text: string, done: string) =>
  void Clipboard.setStringAsync(text).then(() => toast.success(done));
