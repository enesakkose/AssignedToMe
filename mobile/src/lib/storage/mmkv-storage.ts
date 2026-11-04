import { createMMKV } from "react-native-mmkv";

const storage = createMMKV({ id: "assignedtome" });

export const mmkvStorage = {
  getItem: (key: string): string | null => {
    const value = storage.getString(key);
    return value ?? null;
  },
  removeItem: (key: string): void => {
    storage.remove(key);
  },
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },
};
