"use client";

import { useTranslations } from "next-intl";

export type ErrorCode = { code: string; status?: number };

/** User-facing text for a failed connect, sign-in or load, from the code the server sends (never its message). */
export function useErrorText() {
  const t = useTranslations("errors");
  return ({ code, status }: ErrorCode, app: string) => {
    switch (code) {
      case "unauthorized":
        return status === 403 ? t("forbidden", { app }) : t("unauthorized");
      case "captcha":
        return t("captcha", { app });
      case "blocked":
        return t("blocked", { app });
      case "not_found":
        return t("notFound", { app });
      case "network":
        return t("network", { app });
      case "rate_limited":
        return t("rateLimited", { app });
      case "invalid_input":
        return t("invalidInput");
      case "limit":
        return t("limit");
      case "signin":
        return t("signin");
      default:
        return t("generic");
    }
  };
}
