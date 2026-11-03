import AsyncStorage from "@react-native-async-storage/async-storage";

export const asyncStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
};
