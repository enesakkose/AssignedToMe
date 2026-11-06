import type { ErrorCode } from "@/features/connections/error-text";

/** What a task action failed with: the server's code and status, ready for `useErrorText`. */
export class ActionError extends Error {
  constructor(readonly detail: ErrorCode) {
    super(detail.code);
  }
}

/** Server actions answer `{ ok }` or `{ error }`; TanStack Query wants a value or a throw. */
export async function unwrap<T>(result: Promise<{ ok: T } | { error: ErrorCode }>): Promise<T> {
  const r = await result;
  if ("error" in r) throw new ActionError(r.error);
  return r.ok;
}

export const detailOf = (error: unknown): ErrorCode =>
  error instanceof ActionError ? error.detail : { code: "unknown" };
