// Self-check, run with `bun test src/lib/format.test.ts`.
import { describe, expect, mock, test } from "bun:test";

mock.module("@/lib/i18n", () => ({ currentLocale: () => "en" }));
const { duration, timeAgo } = await import("./format");

describe("format", () => {
  test("duration", () => {
    expect(duration(5400)).toBe("1h 30m");
    expect(duration(0)).toBe("0m");
    expect(duration(3600)).toBe("1h");
  });
  test("timeAgo", () => {
    const now = Date.parse("2026-01-10T12:00:00Z");
    expect(timeAgo("2026-01-10T11:58:00Z", now)).toBe("2m");
    expect(timeAgo("2026-01-07T12:00:00Z", now)).toBe("3d");
    expect(timeAgo("2026-01-10T12:00:30Z", now)).toBe("0m");
  });
});
