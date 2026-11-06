import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
// No board is ever opened for bad input: a call reaching the cookie store fails this test.
vi.mock("next/headers", () => ({
  cookies: () => {
    throw new Error("touched the cookie store");
  },
}));
const actions = await import("./actions");

const board = "0123456789abcdef";
const invalid = { error: { code: "invalid_input" } };

describe("task actions refuse crafted input before using a board", () => {
  test("bad board ids and task keys", async () => {
    expect(await actions.getTransitions("../../x", "ABC-1")).toEqual(invalid);
    expect(await actions.getTransitions(board, "ABC-1; rm -rf")).toEqual(invalid);
    expect(await actions.getComments(board, "x".repeat(81))).toEqual(invalid);
  });

  test("a move with an input that isn't the form's shape", async () => {
    expect(await actions.moveTask(board, "ABC-1", "11", { values: { a: 1 } })).toEqual(invalid);
  });

  test("time outside a minute to a week, and a date that isn't one", async () => {
    expect(
      await actions.logWork(board, "ABC-1", { seconds: 10, started: new Date().toISOString() }),
    ).toEqual(invalid);
    expect(await actions.logWork(board, "ABC-1", { seconds: 3600, started: "yesterday" })).toEqual(
      invalid,
    );
  });

  test("empty or oversized comments", async () => {
    expect(await actions.addComment(board, "ABC-1", "   ")).toEqual(invalid);
    expect(await actions.addComment(board, "ABC-1", "x".repeat(8001))).toEqual(invalid);
  });

  test("description, children and source search", async () => {
    expect(await actions.getDescription(board, "ABC-1", "javascript:alert(1)")).toEqual(invalid);
    expect(await actions.getDescription(board, "ABC-1", "http://acme.test/browse/ABC-1")).toEqual(
      invalid,
    );
    expect(await actions.getChildren("nope", "ABC-1")).toEqual(invalid);
    expect(await actions.searchSource(board, "a", [])).toEqual(invalid);
    expect(await actions.searchSource(board, "login", ["AB C"])).toEqual(invalid);
  });
});
