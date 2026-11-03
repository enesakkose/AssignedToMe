import * as SecureStore from "expo-secure-store";

// iOS Keychain / Android Keystore. Never store secrets anywhere else.
// AFTER_FIRST_UNLOCK so the background refresh can read them while the phone is locked; THIS_DEVICE_ONLY keeps them
// out of backups and off other devices.
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
const cache = new Map<string, string | null>();

export const secrets = {
  get: async (account: string) => {
    if (cache.has(account)) return cache.get(account) ?? null;
    const value = await SecureStore.getItemAsync(account, options);
    cache.set(account, value);
    return value;
  },
  set: async (account: string, value: string) => {
    await SecureStore.setItemAsync(account, value, options);
    cache.set(account, value);
  },
  delete: async (account: string) => {
    await SecureStore.deleteItemAsync(account, options);
    cache.delete(account);
  },
};
