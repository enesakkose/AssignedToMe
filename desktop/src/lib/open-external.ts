import { isSafeUrl } from '@mytask/core';
import { openUrl } from '@tauri-apps/plugin-opener';

/** Opens http(s) links in the default browser. Never navigate the popover itself. */
export async function openExternal(url: string) {
  if (!isSafeUrl(url)) throw new Error('Refusing to open a non-http(s) URL');
  await openUrl(url);
}
