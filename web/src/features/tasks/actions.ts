"use server";

import type { Comment, Person, Task, Transition, WorkLog } from "@mytask/core";
import { z } from "zod";

import { providerFetch } from "@/server/provider-fetch";
import { onBoard, unsupported, type Result } from "@/server/on-board";
import { sanitizeSourceHtml } from "@/server/sanitize";

// Everything from the page is checked before it reaches a provider.
const boardId = z.string().regex(/^[a-f0-9]{16}$/);
const taskKey = z.string().regex(/^[A-Za-z0-9#/_.-]{1,80}$/);
const id = z.string().min(1).max(200);
const invalid = { error: { code: "invalid_input" as const } };

export async function getTransitions(board: string, key: string): Promise<Result<Transition[]>> {
  if (!boardId.safeParse(board).success || !taskKey.safeParse(key).success) return invalid;
  return onBoard(board, (p, c) => (p.getTransitions ?? unsupported)(c, key, providerFetch));
}

const inputSchema = z
  .object({
    values: z.record(z.string(), z.string().max(4000)).optional(),
    comment: z.string().max(8000).optional(),
  })
  .optional();

/**
 * Moves a task. The transition is looked up again on the server by its id, so the page can only pick one of the moves
 * the source offers right now, never send its own.
 */
export async function moveTask(
  board: string,
  key: string,
  transitionId: string,
  input?: unknown,
): Promise<Result<{ to: string }>> {
  const parsedInput = inputSchema.safeParse(input);
  if (
    !boardId.safeParse(board).success ||
    !taskKey.safeParse(key).success ||
    !id.safeParse(transitionId).success ||
    !parsedInput.success
  )
    return invalid;
  return onBoard(board, async (p, c) => {
    if (!p.getTransitions || !p.transition) unsupported();
    const transition = (await p.getTransitions(c, key, providerFetch)).find(
      (t) => t.id === transitionId,
    );
    if (!transition || transition.needsInput) throw new Error("unavailable");
    await p.transition(c, key, transition, providerFetch, parsedInput.data);
    return { to: transition.to.name };
  });
}

const entrySchema = z.object({
  seconds: z
    .number()
    .int()
    .min(60)
    .max(7 * 24 * 3600),
  started: z.iso.datetime(),
  comment: z.string().max(8000).optional(),
});

/** Logs time; returns the new work log's id so it can be undone. */
export async function logWork(board: string, key: string, entry: unknown): Promise<Result<string>> {
  const parsed = entrySchema.safeParse(entry);
  if (!boardId.safeParse(board).success || !taskKey.safeParse(key).success || !parsed.success)
    return invalid;
  const { seconds, started, comment } = parsed.data;
  return onBoard(board, (p, c) =>
    (p.logWork ?? unsupported)(
      c,
      key,
      { seconds, started: new Date(started), comment },
      providerFetch,
    ),
  );
}

export async function deleteWorkLog(
  board: string,
  key: string,
  workLogId: string,
): Promise<Result<null>> {
  if (
    !boardId.safeParse(board).success ||
    !taskKey.safeParse(key).success ||
    !id.safeParse(workLogId).success
  )
    return invalid;
  return onBoard(board, async (p, c) => {
    await (p.deleteWorkLog ?? unsupported)(c, key, workLogId, providerFetch);
    return null;
  });
}

export async function getWorkLogs(board: string, key: string): Promise<Result<WorkLog[]>> {
  if (!boardId.safeParse(board).success || !taskKey.safeParse(key).success) return invalid;
  return onBoard(board, (p, c) => (p.getWorkLogs ?? unsupported)(c, key, providerFetch));
}

export async function currentUser(board: string): Promise<Result<Person>> {
  if (!boardId.safeParse(board).success) return invalid;
  return onBoard(board, (p, c) => (p.currentUser ?? unsupported)(c, providerFetch));
}

export async function searchAssignees(
  board: string,
  key: string,
  query: string,
  startAt?: number,
): Promise<Result<{ people: Person[]; next?: number }>> {
  if (
    !boardId.safeParse(board).success ||
    !taskKey.safeParse(key).success ||
    query.length > 100 ||
    (startAt !== undefined && !Number.isInteger(startAt))
  )
    return invalid;
  return onBoard(board, (p, c) =>
    (p.searchAssignees ?? unsupported)(c, key, query, providerFetch, startAt),
  );
}

/** Assigns the task; `personId` null unassigns. */
export async function assignTask(
  board: string,
  key: string,
  personId: string | null,
): Promise<Result<null>> {
  if (
    !boardId.safeParse(board).success ||
    !taskKey.safeParse(key).success ||
    (personId !== null && !id.safeParse(personId).success)
  )
    return invalid;
  return onBoard(board, async (p, c) => {
    await (p.assign ?? unsupported)(c, key, personId, providerFetch);
    return null;
  });
}

export async function getComments(board: string, key: string): Promise<Result<Comment[]>> {
  if (!boardId.safeParse(board).success || !taskKey.safeParse(key).success) return invalid;
  return onBoard(board, (p, c) => (p.getComments ?? unsupported)(c, key, providerFetch));
}

export async function addComment(
  board: string,
  key: string,
  text: string,
  parentId?: string,
): Promise<Result<Comment>> {
  const body = text.trim();
  if (
    !boardId.safeParse(board).success ||
    !taskKey.safeParse(key).success ||
    !body ||
    body.length > 8000 ||
    (parentId !== undefined && !id.safeParse(parentId).success)
  )
    return invalid;
  return onBoard(board, (p, c) =>
    (p.addComment ?? unsupported)(c, key, body, providerFetch, parentId),
  );
}

export async function deleteComment(
  board: string,
  key: string,
  commentId: string,
): Promise<Result<null>> {
  if (
    !boardId.safeParse(board).success ||
    !taskKey.safeParse(key).success ||
    !id.safeParse(commentId).success
  )
    return invalid;
  return onBoard(board, async (p, c) => {
    await (p.deleteComment ?? unsupported)(c, key, commentId, providerFetch);
    return null;
  });
}

/**
 * The source's own rendering of the description, sanitized here so the page only ever gets safe markup. `url` is the
 * task's link; its origin resolves relative links and images (which load through the attachment route).
 */
export async function getDescription(
  board: string,
  key: string,
  url: string,
): Promise<Result<string | null>> {
  const base = z.url({ protocol: /^https$/ }).safeParse(url);
  if (!boardId.safeParse(board).success || !taskKey.safeParse(key).success || !base.success)
    return invalid;
  return onBoard(board, async (p, c) => {
    const html = await (p.getDescriptionHtml ?? unsupported)(c, key, providerFetch);
    return html
      ? sanitizeSourceHtml(html, { base: new URL(base.data).origin, boardId: board })
      : null;
  });
}

/** A single task by key (e.g. a parent or related task not in my list), so it can open in the app. */
export async function getTask(board: string, key: string): Promise<Result<Task>> {
  if (!boardId.safeParse(board).success || !taskKey.safeParse(key).success) return invalid;
  return onBoard(board, (p, c) => (p.getTask ?? unsupported)(c, key, providerFetch));
}

/** An epic's issues, or a task's sub-issues that aren't embedded in it. */
export async function getChildren(
  board: string,
  key: string,
  type?: string,
): Promise<Result<Task[]>> {
  if (!boardId.safeParse(board).success || !taskKey.safeParse(key).success) return invalid;
  return onBoard(board, (p, c) =>
    (p.getChildren ?? unsupported)(c, { key, type: type?.slice(0, 80) }, providerFetch),
  );
}

const projectKeys = z.array(z.string().regex(/^[A-Za-z0-9_]{1,40}$/)).max(50);

/** Searches the whole source, not just my tasks. Project keys from my tasks let "2750" mean PROJ-2750. */
export async function searchSource(
  board: string,
  query: string,
  keys: unknown,
): Promise<Result<Task[]>> {
  const q = z.string().trim().min(2).max(200).safeParse(query);
  const k = projectKeys.safeParse(keys);
  if (!boardId.safeParse(board).success || !q.success || !k.success) return invalid;
  return onBoard(board, (p, c) =>
    (p.searchTasks ?? unsupported)(c, q.data, providerFetch, { projectKeys: k.data }),
  );
}
