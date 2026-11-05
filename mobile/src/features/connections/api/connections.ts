import { getProvider, renewConnection, splitSecrets, type Connection } from "@mytask/core";
import { secrets } from "@/lib/secrets";
import { mmkvStorage } from "@/lib/storage/mmkv-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** A connection as persisted: secret fields are not included (they live in SecureStore). */
export type StoredConnection = Connection;

// Persisted to MMKV, which loads synchronously, so the background refresh can read it without React.
export const useConnectionsStore = create<{ connections: StoredConnection[] }>()(
  persist(() => ({ connections: [] as StoredConnection[] }), {
    name: "connections",
    storage: createJSONStorage(() => mmkvStorage),
  }),
);

const write = (connections: StoredConnection[]) => useConnectionsStore.setState({ connections });
const list = () => useConnectionsStore.getState().connections;

// SecureStore keys may only hold letters, digits, ".", "-" and "_".
const account = (connectionId: string, field: string) => `${connectionId}.${field}`;

function secretFields(providerId: string) {
  return (
    getProvider(providerId)
      ?.fields.filter((f) => f.type === "secret")
      .map((f) => f.key) ?? []
  );
}

/** A local id; only needs to be unique on this device. */
export const newConnectionId = () =>
  `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

async function read(connection: StoredConnection, fresh = false): Promise<Connection> {
  const values = { ...connection.values };
  for (const key of secretFields(connection.providerId)) {
    values[key] = (await secrets.get(account(connection.id, key), fresh)) ?? "";
  }
  return { ...connection, values };
}

// One renewal at a time per board: the refresh token changes on each, so two at once would spend the same one twice.
const renewing = new Map<string, Promise<Connection>>();

/**
 * Adds secrets from SecureStore; only call right before talking to the provider. A board added by signing in renews
 * its access token here first when it is about to expire, so every caller (and the background refresh) gets a live one.
 */
export async function withSecrets(connection: StoredConnection): Promise<Connection> {
  const provider = getProvider(connection.providerId);
  if (!provider?.refreshCredentials) return read(connection);
  let pending = renewing.get(connection.id);
  if (!pending) {
    pending = (async () => {
      const stored = () => list().find((c) => c.id === connection.id) ?? connection;
      const full = await read(stored());
      // The background task may renew at the same moment; if it won, its saved tokens are used (read afresh, past the cache).
      const { values, changed } = await renewConnection(provider, full, fetch, async () => {
        await useConnectionsStore.persist.rehydrate();
        return read(stored(), true);
      });
      if (changed) await saveConnection({ ...full, values });
      return { ...full, values };
    })().finally(() => renewing.delete(connection.id));
    renewing.set(connection.id, pending);
  }
  return { ...(await pending), name: connection.name };
}

export async function saveConnection(connection: Connection) {
  const provider = getProvider(connection.providerId);
  if (!provider) throw new Error(`Unknown provider ${connection.providerId}`);
  const { plain, secret } = splitSecrets(provider, connection.values);
  // A blank secret on edit means "keep the saved one".
  for (const [key, value] of Object.entries(secret))
    if (value) await secrets.set(account(connection.id, key), value);
  const stored = { ...connection, values: plain };
  const all = list();
  write(
    all.some((c) => c.id === stored.id)
      ? all.map((c) => (c.id === stored.id ? stored : c))
      : [...all, stored],
  );
}

export function renameConnection(id: string, name: string) {
  write(list().map((c) => (c.id === id ? { ...c, name } : c)));
}

export async function removeConnection(id: string) {
  const target = list().find((c) => c.id === id);
  if (target)
    for (const key of secretFields(target.providerId)) await secrets.delete(account(id, key));
  write(list().filter((c) => c.id !== id));
}
