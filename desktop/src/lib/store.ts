import { load, type Store } from '@tauri-apps/plugin-store';

// Non-secret app data only (connections without secrets, task cache, UI prefs). Secrets live in lib/secrets.
let store: Store | undefined;

export async function initStore() {
  store = await load('mytask.json', { autoSave: true, defaults: {} });
}

export function getStore(): Store {
  if (!store) throw new Error('Store not initialised');
  return store;
}
