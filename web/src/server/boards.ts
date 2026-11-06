import "server-only";

import { randomBytes } from "node:crypto";

import { getProvider, type Connection } from "@mytask/core";
import { cookies } from "next/headers";
import { z } from "zod";

import { seal, unseal } from "./seal";

/**
 * Where the web keeps boards: one cookie per board, sealed with the server's key (seal.ts), HttpOnly so no script on
 * the page can read it. The browser holds the token; only this server can open it. No database.
 */
const PREFIX = "__Host-atm_b_";
const ID = /^[a-f0-9]{16}$/;
/** A browser sends at most a few dozen kilobytes of cookies; this keeps well inside that. */
export const MAX_BOARDS = 15;
/** One cookie holds at most about 4 KB, name included. */
const MAX_COOKIE = 4000;

const storedSchema = z.object({
  createdAt: z.number(),
  connection: z.object({
    id: z.string().regex(ID),
    providerId: z.string().max(64),
    name: z.string().min(1).max(80),
    values: z.record(z.string(), z.string().max(8000)),
  }),
});

export type StoredBoard = { connection: Connection; createdAt: number };

export const newBoardId = () => randomBytes(8).toString("hex");

const cookieName = (id: string) => `${PREFIX}${id}`;

function read(name: string, value: string): StoredBoard | undefined {
  const plain = unseal(value, name);
  if (!plain) return undefined;
  const parsed = storedSchema.safeParse(JSON.parse(plain));
  if (
    !parsed.success ||
    cookieName(parsed.data.connection.id) !== name ||
    !getProvider(parsed.data.connection.providerId)
  )
    return undefined;
  return parsed.data;
}

/** Every board this browser has, oldest first. A cookie that doesn't open (tampered, old key) is skipped. */
export async function listBoards(): Promise<StoredBoard[]> {
  const jar = await cookies();
  return jar
    .getAll()
    .filter((c) => c.name.startsWith(PREFIX))
    .flatMap((c) => read(c.name, c.value) ?? [])
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function getBoard(id: string): Promise<StoredBoard | undefined> {
  if (!ID.test(id)) return undefined;
  const name = cookieName(id);
  const value = (await cookies()).get(name)?.value;
  return value ? read(name, value) : undefined;
}

export class BoardLimitError extends Error {}

/** Saves a board (new or changed). Only from a Server Action or Route Handler, where cookies can be set. */
export async function saveBoard(board: StoredBoard): Promise<void> {
  const jar = await cookies();
  const name = cookieName(board.connection.id);
  const isNew = !jar.has(name);
  if (isNew && (await listBoards()).length >= MAX_BOARDS)
    throw new BoardLimitError(`At most ${MAX_BOARDS} boards`);
  const value = seal(JSON.stringify(board), name);
  if (name.length + value.length > MAX_COOKIE)
    throw new BoardLimitError("This board's sign-in is too large to keep in the browser");
  jar.set(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}

export async function removeBoard(id: string): Promise<void> {
  if (ID.test(id)) await dropCookie(cookieName(id));
}

/**
 * Deletes one of our `__Host-` cookies. `cookies().delete()` sends the expiry without `Secure`, and a browser ignores a
 * `__Host-` cookie set without it, so the cookie (a removed board, say) would stay.
 */
export async function dropCookie(name: string): Promise<void> {
  (await cookies()).set(name, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
