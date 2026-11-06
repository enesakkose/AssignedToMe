import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { isPublicAddress, providerFetch } = await import("./provider-fetch");

describe("provider fetch", () => {
  test("private, loopback, link-local and metadata addresses are refused", () => {
    for (const a of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ])
      expect(isPublicAddress(a), a).toBe(false);
    for (const a of ["104.192.141.1", "140.82.112.3", "2606:4700::6810:84e5"])
      expect(isPublicAddress(a), a).toBe(true);
  });

  test("http, credentials in the URL and private hosts never leave", async () => {
    await expect(providerFetch("http://example.com/x")).rejects.toMatchObject({
      code: "invalid_input",
    });
    await expect(providerFetch("https://user:pw@example.com/x")).rejects.toMatchObject({
      code: "invalid_input",
    });
    await expect(providerFetch("https://127.0.0.1/rest")).rejects.toMatchObject({
      code: "invalid_input",
    });
    await expect(providerFetch("https://[::1]/rest")).rejects.toMatchObject({
      code: "invalid_input",
    });
  });
});
