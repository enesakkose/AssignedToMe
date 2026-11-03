import { getProvider, splitSecrets, type Connection } from '@mytask/core';
import { secrets } from '@/lib/secrets';
import { getStore } from '@/lib/store';

const KEY = 'connections';

/** A connection as persisted: secret fields are not included. */
export type StoredConnection = Connection;

const account = (connectionId: string, field: string) => `${connectionId}:${field}`;

function secretFields(providerId: string) {
  return getProvider(providerId)?.fields.filter((f) => f.type === 'secret').map((f) => f.key) ?? [];
}

export async function listConnections(): Promise<StoredConnection[]> {
  return (await getStore().get<StoredConnection[]>(KEY)) ?? [];
}

async function write(connections: StoredConnection[]) {
  await getStore().set(KEY, connections);
}

/** Adds secrets from Keychain; only call right before talking to the provider. */
export async function withSecrets(connection: StoredConnection): Promise<Connection> {
  const values = { ...connection.values };
  for (const key of secretFields(connection.providerId)) {
    values[key] = (await secrets.get(account(connection.id, key))) ?? '';
  }
  return { ...connection, values };
}

export async function saveConnection(connection: Connection) {
  const provider = getProvider(connection.providerId);
  if (!provider) throw new Error(`Unknown provider ${connection.providerId}`);
  const { plain, secret } = splitSecrets(provider, connection.values);
  // A blank secret on edit means "keep the saved one".
  for (const [key, value] of Object.entries(secret)) if (value) await secrets.set(account(connection.id, key), value);
  const stored = { ...connection, values: plain };
  const all = await listConnections();
  await write(all.some((c) => c.id === stored.id) ? all.map((c) => (c.id === stored.id ? stored : c)) : [...all, stored]);
}

export async function renameConnection(id: string, name: string) {
  await write((await listConnections()).map((c) => (c.id === id ? { ...c, name } : c)));
}

export async function removeConnection(id: string) {
  const all = await listConnections();
  const target = all.find((c) => c.id === id);
  if (target) for (const key of secretFields(target.providerId)) await secrets.delete(account(id, key));
  await write(all.filter((c) => c.id !== id));
}
