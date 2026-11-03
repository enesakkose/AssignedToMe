import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/lib/i18n';
import '@/styles/globals.css';
import { loadTaskCache } from '@/features/tasks/api/task-cache';
import { loadFilters } from '@/features/tasks/hooks/use-filters';
import { bindWindowFocus, queryClient } from '@/lib/query';
import { applyLanguage, getLanguage } from '@/lib/i18n';
import { initStore } from '@/lib/store';
import { loadNavPrefs } from '@/stores/nav';
import { applyTheme, getTheme } from '@/lib/theme';
import { isAppWindow, onBroadcast } from '@/lib/windows';
import App from './App';

/** Keeps this webview in step with the other one (popover ↔ app window). */
function bindOtherWindow() {
  const listening = [
    onBroadcast('tasks-fetched', ({ connectionId, tasks }) => queryClient.setQueryData(['tasks', connectionId], tasks)),
    onBroadcast('data-changed', () => void queryClient.invalidateQueries()),
    onBroadcast('prefs-changed', async () => {
      await loadNavPrefs();
      await applyTheme(await getTheme());
      await applyLanguage(await getLanguage());
    }),
  ];
  // Outside Tauri (browser preview) there is no event bus.
  for (const l of listening) l.catch(() => undefined);
}

async function boot() {
  // Popover-only styling (transparent, rounded) keys off this.
  document.documentElement.dataset.surface = isAppWindow ? 'window' : 'popover';
  bindOtherWindow();
  try {
    await initStore();
    await applyTheme(await getTheme());
    await applyLanguage(await getLanguage());
    await loadTaskCache();
    await loadFilters();
    await loadNavPrefs();
    await bindWindowFocus();
  } catch (error) {
    // Outside Tauri (plain browser preview) the store is unavailable; screens show their error states.
    console.error('Boot failed', error);
  }
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  // Once the app has painted its first frame, fade the splash out (index.html).
  requestAnimationFrame(() => requestAnimationFrame(hideSplash));
}

// Long enough that the logo reads as a deliberate splash rather than a flicker, short enough not to hold the user up.
const SPLASH_MIN_MS = 600;
const splashSince = performance.now();

function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  // The popover never shows it (it boots hidden), so it just goes.
  if (!isAppWindow) return splash.remove();
  setTimeout(
    () => {
      splash.classList.add('done');
      setTimeout(() => splash.remove(), 250);
    },
    Math.max(0, SPLASH_MIN_MS - (performance.now() - splashSince)),
  );
}

void boot();
