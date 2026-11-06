import "server-only";

import { getProvider, type SignedInBoard } from "@mytask/core";
import { cookies } from "next/headers";
import { z } from "zod";

import { dropCookie, listBoards, newBoardId, saveBoard } from "./boards";
import { seal, unseal } from "./seal";

/** A sign-in in progress (PKCE verifier, state, device code): sealed, this browser only, gone after 10 minutes. */
const PENDING = "__Host-atm_signin";
const pendingSchema = z.object({
  providerId: z.string().max(64),
  pending: z.record(z.string(), z.string()),
  /** The sign-in runs in a popup: the callback reports to the page that opened it and closes. */
  popup: z.boolean().optional(),
});

export async function setPending(
  providerId: string,
  pending: Record<string, string>,
  popup = false,
) {
  (await cookies()).set(PENDING, seal(JSON.stringify({ providerId, pending, popup }), PENDING), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

export async function takePending(): Promise<z.infer<typeof pendingSchema> | undefined> {
  const value = (await cookies()).get(PENDING)?.value;
  const plain = value && unseal(value, PENDING);
  const parsed = plain ? pendingSchema.safeParse(JSON.parse(plain)) : undefined;
  return parsed?.success ? parsed.data : undefined;
}

export async function clearPending() {
  await dropCookie(PENDING);
}

/** Saves what a sign-in produced. Signing in again to the same site or account renews that board instead of adding one. */
export async function saveSignedIn(providerId: string, boards: SignedInBoard[]): Promise<number> {
  if (!getProvider(providerId)) throw new Error("Unknown provider");
  const known = await listBoards();
  for (const b of boards) {
    const same = known.find(
      (k) =>
        k.connection.providerId === providerId &&
        (b.values.domain
          ? k.connection.values.domain === b.values.domain
          : k.connection.name === b.name),
    );
    await saveBoard({
      createdAt: same?.createdAt ?? Date.now(),
      connection: {
        id: same?.connection.id ?? newBoardId(),
        providerId,
        name: same?.connection.name ?? b.name,
        values: b.values,
      },
    });
  }
  return boards.length;
}
