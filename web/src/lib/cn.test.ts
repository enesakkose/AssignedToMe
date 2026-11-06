import { expect, test } from "vitest";

import { cn } from "./cn";

test("custom type sizes survive next to a text colour", () => {
  expect(cn("text-section text-ink", "max-w-[16ch]")).toBe("text-section text-ink max-w-[16ch]");
  expect(cn("text-sm text-accent-ink", "text-md")).toBe("text-accent-ink text-md");
});
