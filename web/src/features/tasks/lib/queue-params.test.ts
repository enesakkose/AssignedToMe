import { describe, expect, it } from "vitest";

import { emptyFilters } from "@mytask/core";

import { ALL_BOARDS, parseQueueParams, queueHref, toggleFilter } from "./queue-params";

describe("queue params", () => {
  it("reads board, search, filters and task from the URL", () => {
    const p = parseQueueParams({
      board: "acme",
      q: " export ",
      status: "todo,in_progress",
      type: "Bug",
      task: "PAY-482",
    });
    expect(p).toMatchObject({ board: "acme", q: "export", task: "PAY-482" });
    expect(p.filters.status).toEqual(["todo", "in_progress"]);
    expect(p.filters.type).toEqual(["Bug"]);
  });

  it("drops what doesn't fit rather than half-applying it", () => {
    const p = parseQueueParams({ status: "todo,nonsense", task: "<script>alert(1)</script>" });
    expect(p.filters).toEqual(emptyFilters());
    expect(p.task).toBe("");
    expect(parseQueueParams({}).board).toBe(ALL_BOARDS);
  });

  it("writes short links and round-trips", () => {
    const base = parseQueueParams({});
    expect(queueHref(base)).toBe("/app");
    const next = toggleFilter(toggleFilter(base, "status", "todo"), "type", "Bug");
    const href = queueHref(next, { board: "studio", q: "csv" });
    expect(href).toBe("/app?board=studio&q=csv&status=todo&type=Bug");
    const back = parseQueueParams(Object.fromEntries(new URL(href, "http://x").searchParams));
    expect(back.filters.status).toEqual(["todo"]);
    expect(toggleFilter(back, "status", "todo").filters.status).toEqual([]);
  });
});
