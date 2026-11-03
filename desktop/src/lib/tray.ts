import { TrayIcon } from '@tauri-apps/api/tray';

/** Open task count next to the menubar icon; hidden when zero. Tray id is set in src-tauri/src/lib.rs. */
export async function setTrayCount(count: number) {
  const tray = await TrayIcon.getById('main');
  await tray?.setTitle(count > 0 ? String(count) : null);
}
