import { getProvider } from "@mytask/core";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const saved: unknown[] = [];
const existing = {
  createdAt: 1,
  connection: {
    id: "0123456789abcdef",
    providerId: "jira",
    name: "Acme",
    values: { domain: "https://acme.atlassian.net", email: "me@acme.test", apiToken: "test-token" },
  },
};
vi.mock("@/server/boards", () => ({
  getBoard: async (id: string) => (id === existing.connection.id ? existing : undefined),
  saveBoard: async (b: unknown) => void saved.push(b),
  newBoardId: () => "fedcba9876543210",
  removeBoard: async () => {},
  BoardLimitError: class extends Error {},
}));
const { connectWithToken } = await import("./actions");

const jira = getProvider("jira")!;
const tried: Record<string, string>[] = [];
beforeEach(() => {
  saved.length = 0;
  tried.length = 0;
  vi.spyOn(jira, "validate").mockImplementation(async (c) => void tried.push(c.values));
});

describe("editing a board", () => {
  test("an empty secret keeps the stored one when the site is the same", async () => {
    const r = await connectWithToken("jira", {
      name: "",
      values: { domain: "https://acme.atlassian.net", email: "me@acme.test", apiToken: "" },
      boardId: existing.connection.id,
    });
    expect(r).toEqual({ ok: true });
    expect(tried[0]?.apiToken).toBe("test-token");
    expect(saved[0]).toMatchObject({
      createdAt: 1,
      connection: { id: existing.connection.id, name: "Acme" },
    });
  });

  test("a new site never gets the stored secret", async () => {
    const r = await connectWithToken("jira", {
      name: "",
      values: { domain: "https://elsewhere.example", email: "me@acme.test", apiToken: "" },
      boardId: existing.connection.id,
    });
    expect(r).toEqual({ error: { code: "invalid_input" } });
    expect(tried).toHaveLength(0);
  });

  test("a board of another provider can't be edited through this one", async () => {
    const r = await connectWithToken("linear", {
      name: "",
      values: {},
      boardId: existing.connection.id,
    });
    expect(r).toEqual({ error: { code: "invalid_input" } });
  });
});
