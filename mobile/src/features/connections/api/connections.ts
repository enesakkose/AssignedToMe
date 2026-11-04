import { getProvider, splitSecrets, type Connection } from "@mytask/core";
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

/** Adds secrets from SecureStore; only call right before talking to the provider. */
export async function withSecrets(connection: StoredConnection): Promise<Connection> {
  const values = { ...connection.values };
  for (const key of secretFields(connection.providerId)) {
    values[key] = (await secrets.get(account(connection.id, key))) ?? "";
  }
  return { ...connection, values };
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
