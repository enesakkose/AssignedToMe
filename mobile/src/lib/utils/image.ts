import { Image } from "expo-image";

export function preloadImages(urls: string[]): ReturnType<typeof Image.prefetch> {
  return Image.prefetch(urls);
}

export function clearImageMemoryCache(): Promise<boolean> {
  return Image.clearMemoryCache();
}

export function clearImageDiskCache(): Promise<boolean> {
  return Image.clearDiskCache();
}

export function clearImageCache(): Promise<[boolean, boolean]> {
  return Promise.all([clearImageMemoryCache(), clearImageDiskCache()]);
}
