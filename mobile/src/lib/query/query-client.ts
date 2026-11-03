import { ProviderError } from "@mytask/core";
import { QueryClient, focusManager } from "@tanstack/react-query";
import { AppState } from "react-native";

/**
 * Errors retrying can't fix: a refused sign-in (repeated attempts lock the account, e.g. Jira's CAPTCHA), a company
 * network block, or an input we built wrong.
 */
export const isHaltError = (error: unknown) =>
  error instanceof ProviderError &&
  (error.code === "unauthorized" ||
    error.code === "captcha" ||
    error.code === "blocked" ||
    error.code === "invalid_input");

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failures, error) => !isHaltError(error) && failures < 1,
      staleTime: 1000 * 30,
    },
  },
});

// React Native has no window focus; coming back to the app counts as focus, so stale data refetches on open.
AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));
