import { randomBytes } from "node:crypto";

import { encryptTransfer, type Connection } from "@mytask/core";
import { beforeEach, describe, expect, test, vi } from "vitest";

process.env.WEB_SEALING_KEY = randomBytes(32).toString("base64url");
vi.mock("server-only", () => ({}));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
const saved: { connection: Connection; createdAt: number }[] = [];
vi.mock("@/server/boards", () => ({
  getBoard: async () => undefined,
  listBoards: async () => saved,
  saveBoard: async (b: (typeof saved)[number]) => void saved.push(b),
  BoardLimitError: class extends Error {},
  dropCookie: async (name: string) => void jar.delete(name),
}));
const { receiveBoards, sendBoards, startReceive } = await import("./actions");

const jira: Connection = {
  id: "mac-board-1",
  providerId: "jira",
  name: "Acme",
  values: { domain: "https://acme.atlassian.net", email: "me@acme.test", apiToken: "test-token" },
};
const signedIn: Connection = {
  id: "mac-board-2",
  providerId: "github-oauth",
  name: "octo",
  values: { token: "test-oauth-token" },
};

beforeEach(() => {
  jar.clear();
  saved.length = 0;
});

describe("receiving boards", () => {
  test("the shown code opens the text once; ids become web ids and sign-ins stay behind", async () => {
    const { code } = await startReceive();
    const text = await encryptTransfer([jira, signedIn], code);
    expect(await receiveBoards(text)).toEqual({ added: 2 });
    expect(saved.map((b) => b.connection.id)).toEqual([
      expect.stringMatching(/^[a-f0-9]{16}$/),
      expect.stringMatching(/^[a-f0-9]{16}$/),
    ]);
    expect(saved[0]!.connection.values.apiToken).toBe("test-token");
    expect(saved[1]!.connection.values.token).toBeUndefined();
    // One code, one transfer.
    expect(await receiveBoards(text)).toEqual({ error: "expired" });
  });

  test("text sealed for another code is refused and nothing is saved", async () => {
    await startReceive();
    const text = await encryptTransfer([jira], "7K2M9QXD");
    expect(await receiveBoards(text)).toEqual({ error: "wrong_code" });
    expect(saved).toHaveLength(0);
  });

  test("without a code shown first, nothing opens", async () => {
    expect(await receiveBoards("AT1.xxxx")).toEqual({ error: "expired" });
  });
});

describe("sending boards", () => {
  test("a bad code or crafted ids are refused before any board is read", async () => {
    expect(await sendBoards(["0123456789abcdef"], "nope")).toEqual({ error: "code" });
    expect(await sendBoards(["../x"], "7K2M9QXD")).toEqual({ error: "code" });
  });
});
