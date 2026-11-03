import { ProviderError } from "@mytask/core";
import type { TFunction } from "i18next";

/** User-facing text for a failed provider call (same wording as desktop). Never includes credentials. */
export function providerErrorText(error: unknown, t: TFunction, appName?: string): string {
  const app = appName ?? t("errors.source");
  if (!(error instanceof ProviderError))
    return t("errors.genericWithDetail", {
      detail: error instanceof Error ? error.message : String(error),
    });
  switch (error.code) {
    case "unauthorized":
      return error.status === 403 ? t("errors.forbidden", { app }) : t("errors.unauthorized");
    case "captcha":
      return t("errors.captcha", { app });
    case "blocked":
      // A company proxy or firewall answered instead of the API; the request never reached it.
      return t("errors.blocked", { app });
    case "not_found":
      return t("errors.notFound", { app });
    case "network":
      return t("errors.network");
    case "rate_limited":
      return t("errors.rateLimited", { app });
    case "invalid_input":
      return t("errors.invalidInput");
    default:
      return t("errors.genericWithDetail", { detail: error.message });
  }
}
