import "server-only";

import { ProviderError, type ProviderErrorCode } from "@mytask/core";

/** What the browser learns about a failure: the code and HTTP status only, never the message (it may quote a URL). */
export type ErrorBody = {
  error: { code: ProviderErrorCode | "limit" | "unknown"; status?: number };
};

export function errorBody(error: unknown): ErrorBody {
  if (error instanceof ProviderError) return { error: { code: error.code, status: error.status } };
  return { error: { code: "unknown" } };
}
