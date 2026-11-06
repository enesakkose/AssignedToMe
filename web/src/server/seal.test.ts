import { randomBytes } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { seal, sealingKey, unseal } = await import("./seal");

const key = randomBytes(32);

describe("seal", () => {
  test("round-trips under the same key and context", () => {
    const sealed = seal('{"token":"abc"}', "board-1", key);
    expect(sealed).not.toContain("abc");
    expect(unseal(sealed, "board-1", key)).toBe('{"token":"abc"}');
  });

  test("refuses another cookie's context, another key, and a flipped byte", () => {
    const sealed = seal("secret", "board-1", key);
    expect(unseal(sealed, "board-2", key)).toBeUndefined();
    expect(unseal(sealed, "board-1", randomBytes(32))).toBeUndefined();
    const [v, iv, body] = sealed.split(".");
    const flipped = Buffer.from(body!, "base64url");
    flipped[0]! ^= 1;
    expect(unseal(`${v}.${iv}.${flipped.toString("base64url")}`, "board-1", key)).toBeUndefined();
    expect(unseal("garbage", "board-1", key)).toBeUndefined();
  });

  test("a missing or short key is an error, not a weak default", () => {
    expect(() => sealingKey(undefined)).toThrow();
    expect(() => sealingKey(randomBytes(16).toString("base64url"))).toThrow();
  });
});
