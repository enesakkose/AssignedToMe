"use server";

import { createHash } from "node:crypto";

import {
  decryptTransfer,
  encryptTransfer,
  getProvider,
  isTransferCode,
  mergeIncoming,
  newTransferCode,
  providers,
  signInProviders,
  transferable,
  TRANSFER_QR_LIMIT,
  TRANSFER_TTL_MS,
  TransferError,
  type TransferErrorCode,
} from "@mytask/core";
import { cookies } from "next/headers";
import { z } from "zod";

import { BoardLimitError, dropCookie, getBoard, listBoards, saveBoard } from "@/server/boards";
import { seal, unseal } from "@/server/seal";

/**
 * Boards move between devices only through core's transfer (one-time code, scrypt + XChaCha20-Poly1305, 10 minutes).
 * Encrypting and decrypting happen here, so the page only ever holds the sealed text and the code, never a board.
 */
type Failure = { error: TransferErrorCode | "limit" | "code" };

/** The code this browser shows while receiving: sealed, HttpOnly, gone after 10 minutes or one transfer. */
const RECEIVING = "__Host-atm_transfer";
const receivingSchema = z.object({ code: z.string(), at: z.number() });

/** Starts receiving: a fresh code to show. Opening the screen again replaces it, so one code makes one transfer. */
export async function startReceive(): Promise<{ code: string }> {
  const code = newTransferCode();
  (await cookies()).set(RECEIVING, seal(JSON.stringify({ code, at: Date.now() }), RECEIVING), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: TRANSFER_TTL_MS / 1000,
  });
  return { code };
}

/** The other device's ids may be anything; here a board id is 16 hex. The same board sent again maps to the same id. */
const webId = (id: string) =>
  /^[a-f0-9]{16}$/.test(id) ? id : createHash("sha256").update(id).digest("hex").slice(0, 16);

/** Opens pasted transfer text with this browser's code and saves its boards (one sent again replaces its copy). */
export async function receiveBoards(text: string): Promise<{ added: number } | Failure> {
  const jar = await cookies();
  const plain = jar.get(RECEIVING)?.value && unseal(jar.get(RECEIVING)!.value, RECEIVING);
  const started = plain ? receivingSchema.safeParse(JSON.parse(plain)) : undefined;
  if (!started?.success || Date.now() - started.data.at > TRANSFER_TTL_MS)
    return { error: "expired" };
  try {
    const incoming = await decryptTransfer(String(text).slice(0, 200_000), started.data.code, [
      ...providers,
      ...signInProviders,
    ]);
    for (const c of incoming) {
      const id = webId(c.id);
      const have = await getBoard(id);
      const name = c.name.trim().slice(0, 80) || getProvider(c.providerId)!.defaultName(c.values);
      await saveBoard({
        createdAt: have?.createdAt ?? Date.now(),
        connection: mergeIncoming(have?.connection, { ...c, id, name }),
      });
    }
    await dropCookie(RECEIVING);
    return { added: incoming.length };
  } catch (error) {
    if (error instanceof TransferError) return { error: error.code };
    if (error instanceof BoardLimitError) return { error: "limit" };
    throw error;
  }
}

const sendSchema = z.object({
  ids: z
    .array(z.string().regex(/^[a-f0-9]{16}$/))
    .min(1)
    .max(15),
  code: z.string().max(20).refine(isTransferCode),
});

/**
 * Seals the picked boards for the device that shows `code`. Boards from a sign-in go without it (that device signs in
 * itself). `qr` says whether it fits one QR; the text can always be pasted instead.
 */
export async function sendBoards(
  ids: string[],
  code: string,
): Promise<{ text: string; qr: boolean } | Failure> {
  const parsed = sendSchema.safeParse({ ids, code });
  if (!parsed.success) return { error: "code" };
  const picked = new Set(parsed.data.ids);
  const boards = (await listBoards()).filter((b) => picked.has(b.connection.id));
  if (boards.length === 0) return { error: "invalid" };
  const text = await encryptTransfer(
    boards.map((b) => transferable(b.connection)),
    parsed.data.code,
  );
  return { text, qr: text.length <= TRANSFER_QR_LIMIT };
}
