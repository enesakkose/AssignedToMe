import { filterOptions, matchesFilters, matchesQuery, sortTasks, type Task } from "@mytask/core";

import type { Board } from "@/features/boards/lib/board";

import { ALL_BOARDS, type QueueParams } from "./queue-params";

export type Queue = {
  /** The board being looked at, when it's one of ours (an unknown id falls back to all boards). */
  board: Board | undefined;
  tasks: Task[];
  /** How many boards are connected at all. */
  connected: number;
  /** Open tasks per board, before search and filters, for the tab counts. */
  counts: Record<string, number>;
  total: number;
  types: string[];
  /** Boards in view that could not be loaded. */
  failed: Board[];
  /** Search or filters are narrowing the list. */
  narrowed: boolean;
  selected: Task | undefined;
};

/** The screen's data: the open tasks of the boards in view, searched, filtered and newest first. */
export function buildQueue(params: QueueParams, boards: Board[], all: Task[]): Queue {
  const board = boards.find((b) => b.id === params.board);
  const inView = board ? [board] : boards;
  const ids = new Set(inView.filter((b) => !b.signedOut).map((b) => b.id));
  const ofBoards = all.filter((t) => ids.has(t.connectionId));
  const counts = Object.fromEntries(
    boards.map((b) => [b.id, all.filter((t) => t.connectionId === b.id).length]),
  );
  const visible = ofBoards.filter(
    (t) => matchesFilters(t, params.filters) && matchesQuery(t, params.q),
  );
  const tasks = sortTasks(visible);
  return {
    board,
    tasks,
    connected: boards.length,
    counts,
    total: ofBoards.length,
    types: filterOptions(ofBoards).type,
    failed: inView.filter((b) => b.signedOut),
    narrowed: visible.length < ofBoards.length || params.board !== ALL_BOARDS,
    selected: all.find((t) => t.key === params.task),
  };
}
