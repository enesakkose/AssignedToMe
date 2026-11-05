import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConnectionScreen } from '@/features/connections/screens/connection-screen';
import { SettingsScreen } from '@/features/connections/screens/settings-screen';
import { OnboardingScreen } from '@/features/onboarding/onboarding-screen';
import { BackgroundSync } from '@/features/tasks/components/background-sync';
import { BoardSidebar, SidebarToggle } from '@/features/tasks/components/board-sidebar';
import { PlaygroundScreen } from '@/features/playground/screens/playground-screen';
import { TaskDetailScreen } from '@/features/tasks/screens/task-detail-screen';
import { TasksScreen } from '@/features/tasks/screens/tasks-screen';
import { queryClient } from '@/lib/query';
import { cn } from '@/lib/cn';
import type { Task } from '@mytask/core';
import { invoke } from '@tauri-apps/api/core';
import { onNotificationClick } from '@/lib/notifications';
import { broadcast, isAppWindow, onBroadcast } from '@/lib/windows';
import { useNav } from '@/stores/nav';

function CurrentScreen() {
  const screen = useNav((s) => s.screen);
  switch (screen.name) {
    case 'settings':
      return <SettingsScreen />;
    case 'connection':
      return <ConnectionScreen key={screen.id ?? 'new'} id={screen.id} />;
    case 'playground':
      return <PlaygroundScreen />;
    default:
      return <TasksScreen />;
  }
}

/**
 * A click outside an open popover or menu only closes it. The popup closes on pointer-down, so without this the same
 * click would land on whatever was underneath (e.g. open the task card behind an assignee picker).
 */
function useOutsideClickOnlyCloses() {
  useEffect(() => {
    let swallow = false;
    const down = (e: PointerEvent) => {
      const target = e.target as Element | null;
      // A closed Select keeps its popup in the DOM (marked data-closed); only an open one counts.
      swallow = !!document.querySelector('[data-floating]:not([data-closed])') && !target?.closest('[data-floating]');
    };
    const click = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('click', click, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('click', click, true);
    };
  }, []);
}

/** A task's detail page sits over the screen, so the list keeps its search, filters and scroll position. */
function Screens() {
  const detail = useNav((s) => s.detail);
  return (
    <div className="relative h-full">
      {/* Hidden, not unmounted: the detail page shares the window's translucent background, so the list mustn't show through. */}
      <div className={cn('h-full', detail && 'invisible')} inert={!!detail}>
        <CurrentScreen />
      </div>
      {detail && <TaskDetailScreen key={detail.id} snapshot={detail} />}
    </div>
  );
}

/** ⌘R refreshes, ⌘, opens settings, Esc closes a task's page or goes back to tasks. */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { screen, go, detail, closeTask } = useNav.getState();
      if (e.metaKey && e.key === 'r') {
        e.preventDefault();
        void queryClient.refetchQueries({ queryKey: ['tasks'] });
      } else if (e.metaKey && e.key === ',') {
        e.preventDefault();
        go({ name: 'settings' });
      } else if (e.key === 'Escape' && (detail || screen.name !== 'tasks') && !document.querySelector('[role="dialog"],[role="menu"]')) {
        if (detail) closeTask();
        else go({ name: 'tasks' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Shows a task from a notification: its board, then its detail page. */
function showTask(connectionId: string, taskKey: string) {
  const { openTask, selectBoard, go } = useNav.getState();
  go({ name: 'tasks' });
  if (connectionId && taskKey) {
    selectBoard(connectionId);
    // A pointer by key; the detail page finds the real task in the board (or loads it on its own).
    openTask({ id: `${connectionId}:${taskKey}`, key: taskKey, title: '', status: '', statusCategory: 'todo', url: '', connectionId, updatedAt: '' } as Task);
  }
}

/** Clicking a task notification opens that task: in the app window when it's open, otherwise in the popover. */
function useNotificationClicks() {
  useEffect(() => {
    if (isAppWindow) {
      // Notifications belong to the popover, which hands the task over here.
      const off = onBroadcast('open-task', ({ connectionId, taskKey }) => showTask(connectionId, taskKey));
      return () => void off.then((unlisten) => unlisten()).catch(() => undefined);
    }
    void onNotificationClick(async (connectionId, taskKey) => {
      if (await invoke<boolean>('focus_app_window').catch(() => false)) broadcast('open-task', { connectionId, taskKey });
      else {
        void invoke('show_popover').catch(() => undefined);
        showTask(connectionId, taskKey);
      }
    });
  }, []);
}

export default function App() {
  useShortcuts();
  useOutsideClickOnlyCloses();
  useNotificationClicks();
  const onboarded = useNav((s) => s.onboarded);
  const sidebarOpen = useNav((s) => s.sidebarOpen);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delay={400}>
        {/* The popover is always running, so it alone polls, counts and notifies; twice would mean double notifications. */}
        {!isAppWindow && <BackgroundSync />}
        {isAppWindow ? (
          // The window has room for the boards as a sidebar; the popover keeps them as tabs.
          <div className="flex h-full">
            {sidebarOpen && <BoardSidebar />}
            <div className="min-w-0 flex-1">
              <Screens />
            </div>
            <SidebarToggle />
          </div>
        ) : (
          <Screens />
        )}
        {/* First launch: the intro covers everything until finished or skipped. */}
        {!onboarded && <OnboardingScreen />}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
