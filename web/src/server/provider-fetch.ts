import "server-only";

import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

import { ProviderError, type Fetch } from "@mytask/core";

/** Addresses a provider call may never reach: this machine, private networks, link-local and cloud metadata. */
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 127],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(net, prefix, "ipv6");

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (!family) return false;
  // An IPv4-mapped IPv6 address is judged as the IPv4 address it carries.
  const mapped = family === 6 && /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return !blocked.check(mapped, "ipv4");
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

/** Throws unless every address the host resolves to is public. */
async function assertPublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true, verbatim: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0)
    throw new ProviderError("not_found", "The site's address could not be found");
  if (!addresses.every(isPublicAddress))
    throw new ProviderError("invalid_input", "That address is not on the public internet");
}

const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;
const MAX_BYTES = 20 * 1024 * 1024;

/** A body that stops with an error past MAX_BYTES, so a site can't stream without end into the server's memory. */
function capped(res: Response): Response {
  if (!res.body) return res;
  let seen = 0;
  const body = res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > MAX_BYTES)
          controller.error(new ProviderError("invalid_response", "The response was too large"));
        else controller.enqueue(chunk);
      },
    }),
  );
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

/**
 * The fetch handed to @mytask/core on the server. Sites come from users (a self-hosted Jira, GitLab), so every request
 * is checked before it leaves: https only, no credentials in the URL, the host must resolve only to public addresses,
 * redirects are followed by hand so each hop is checked too, and a response stops at 20 MB.
 * shortcut: DNS is checked before connecting, not pinned for the connection; pin it with an undici Agent `lookup` once
 * hosting is chosen.
 */
export const providerFetch: Fetch = async (input, init) => {
  let url = new URL(input instanceof Request ? input.url : String(input));
  for (let hop = 0; ; hop++) {
    if (url.protocol !== "https:")
      throw new ProviderError("invalid_input", "Only https sites can be reached");
    if (url.username || url.password)
      throw new ProviderError("invalid_input", "Addresses with credentials are not allowed");
    await assertPublicHost(url.hostname);
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });
    const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!next) return capped(res);
    if (hop >= MAX_REDIRECTS) throw new ProviderError("network", "Too many redirects");
    url = new URL(next, url);
    // A redirected request goes on as a plain GET, the way browsers treat 301–303.
    if (res.status !== 307 && res.status !== 308)
      init = { ...init, method: "GET", body: undefined };
  }
};
