import { isSafeUrl } from "@mytask/core";
import * as WebBrowser from "expo-web-browser";

/**
 * Opens a link inside the app, in the system's in-app browser sliding up as a sheet (Safari view on iOS, a Custom Tab on
 * Android), so the user never leaves AssignedToMe. Only http(s) links open. Resolves when the sheet is closed (iOS).
 */
export async function openLink(url: string) {
  if (!isSafeUrl(url)) throw new Error("Refusing to open a non-http(s) URL");
  await WebBrowser.openBrowserAsync(url, {
    dismissButtonStyle: "close",
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}
