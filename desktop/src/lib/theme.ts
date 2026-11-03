import { getCurrentWindow } from '@tauri-apps/api/window';
import { getStore } from './store';
import { broadcast } from './windows';

export type ThemePreference = 'system' | 'light' | 'dark';
const KEY = 'theme';

// Sets the native window appearance; the webview's prefers-color-scheme and the blur material follow it.
export async function applyTheme(theme: ThemePreference) {
  await getCurrentWindow().setTheme(theme === 'system' ? null : theme);
}

export async function getTheme(): Promise<ThemePreference> {
  return (await getStore().get<ThemePreference>(KEY)) ?? 'system';
}

export async function setTheme(theme: ThemePreference) {
  await applyTheme(theme);
  await getStore().set(KEY, theme);
  // setTheme only changes this window; the other one re-applies it.
  broadcast('prefs-changed', null);
}
