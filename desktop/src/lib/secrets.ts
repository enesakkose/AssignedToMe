import { invoke } from '@tauri-apps/api/core';

// macOS Keychain via src-tauri secret_* commands. Never store secrets anywhere else.
// Reads are kept in memory for the app's lifetime: each Keychain read can trigger a macOS permission
// prompt (every time for unsigned dev builds), and providers need the secret before every request.
const cache = new Map<string, string | null>();

export const secrets = {
  get: async (account: string) => {
    if (cache.has(account)) return cache.get(account) ?? null;
    const value = await invoke<string | null>('secret_get', { account });
    cache.set(account, value);
    return value;
  },
  set: async (account: string, value: string) => {
    await invoke<void>('secret_set', { account, value });
    cache.set(account, value);
  },
  delete: async (account: string) => {
    await invoke<void>('secret_delete', { account });
    cache.delete(account);
  },
};
