import type { Fetch } from '@mytask/core';
import { invoke } from '@tauri-apps/api/core';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

const granted = new Set<string>();

/**
 * The `Fetch` handed to providers. Goes through Rust, so no CORS.
 * Jira Cloud hosts are allowed in src-tauri/capabilities/default.json; any other https origin a provider
 * builds from the user's connection address (e.g. a self-hosted Jira) is allowed once at runtime.
 */
export const http: Fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const { origin } = new URL(input instanceof Request ? input.url : String(input));
  if (!granted.has(origin) && !origin.endsWith('.atlassian.net')) {
    await invoke('allow_http_origin', { origin });
    granted.add(origin);
  }
  // The plugin stamps `Origin: tauri://localhost` on every request, which tells the server a web page on another
  // site sent it (Jira's XSRF/CORS checks and firewalls treat it that way). A native client has no origin, as on
  // mobile; an empty value makes the plugin drop it (needs the `unsafe-headers` feature).
  const headers = new Headers(init?.headers);
  headers.set('Origin', '');
  return tauriFetch(input, { ...init, headers });
}) as Fetch;
