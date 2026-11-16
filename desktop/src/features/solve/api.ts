import { Channel, invoke } from '@tauri-apps/api/core';
import { secrets } from '@/lib/secrets';
import { getStore } from '@/lib/store';
import type { ChatItem, Mode, RawEvent, SolverId } from './types';

// Per-board local repo folder. Not a secret — a path — so it lives in the plain store, not the Keychain.
const REPO_MAP = 'solveRepoMap';

/** The repo's tracked files (for the @-mention picker). Honors .gitignore; no secrets, just paths. */
export const repoFiles = (repo: string) => invoke<string[]>('solve_repo_files', { repo });

// Last-used run settings, remembered globally so they don't reset to the defaults each time the screen opens.
const PREFS = 'solvePrefs';
type SolvePrefs = { mode?: Mode; effort?: string; model?: string };

export async function loadSolvePrefs(): Promise<SolvePrefs> {
  try {
    return (await getStore().get<SolvePrefs>(PREFS)) ?? {};
  } catch {
    return {}; // no store outside Tauri
  }
}

export async function saveSolvePrefs(prefs: SolvePrefs): Promise<void> {
  try {
    await getStore().set(PREFS, prefs);
  } catch {
    // no store outside Tauri
  }
}

// A task's chat, so it survives leaving and reopening the screen. Plain store (no secrets in the transcript).
const CHAT_MAP = 'solveChatCache';
const CHAT_TTL_MS = 24 * 60 * 60 * 1000; // a day; stale chats are dropped on the next load/save
type ChatCache = { items: ChatItem[]; sessionId: string | null; cost: number; at: number };

export async function loadSolveChat(key: string): Promise<ChatCache | undefined> {
  try {
    const entry = ((await getStore().get<Record<string, ChatCache>>(CHAT_MAP)) ?? {})[key];
    return entry && Date.now() - entry.at < CHAT_TTL_MS ? entry : undefined;
  } catch {
    return undefined; // no store outside Tauri
  }
}

export async function saveSolveChat(key: string, data: Omit<ChatCache, 'at'>): Promise<void> {
  try {
    const map = (await getStore().get<Record<string, ChatCache>>(CHAT_MAP)) ?? {};
    const now = Date.now();
    const next: Record<string, ChatCache> = { [key]: { ...data, at: now } };
    for (const [k, v] of Object.entries(map)) if (k !== key && now - v.at < CHAT_TTL_MS) next[k] = v; // prune stale
    await getStore().set(CHAT_MAP, next);
  } catch {
    // no store outside Tauri
  }
}

export async function getRepoPath(connectionId: string): Promise<string | null> {
  try {
    const map = (await getStore().get<Record<string, string>>(REPO_MAP)) ?? {};
    return map[connectionId] ?? null;
  } catch {
    return null; // no store outside Tauri
  }
}

export async function setRepoPath(connectionId: string, path: string): Promise<void> {
  try {
    const map = (await getStore().get<Record<string, string>>(REPO_MAP)) ?? {};
    map[connectionId] = path;
    await getStore().set(REPO_MAP, map);
  } catch {
    // no store outside Tauri
  }
}

// AI provider API keys: optional (the CLI can use its own login). Keychain only, via the shared secret commands.
const keyAccount = (solver: SolverId) => `ai:${solver}:apiKey`;
export const setAiKey = (solver: SolverId, key: string) => secrets.set(keyAccount(solver), key);
export const hasAiKey = async (solver: SolverId) => !!(await secrets.get(keyAccount(solver)));

export const cliAvailable = (solver: SolverId) => invoke<boolean>('solve_cli_available', { solver });
export const authStatus = (solver: SolverId) => invoke<boolean>('solve_auth_status', { solver });
export const loginInput = (runId: string, text: string) => invoke<void>('solve_login_input', { runId, text });

export function startLogin(args: { runId: string; solver: SolverId }, onEvent: (e: RawEvent) => void): Promise<void> {
  const channel = new Channel<RawEvent>();
  channel.onmessage = onEvent;
  return invoke<void>('solve_login', { ...args, onEvent: channel });
}
export const gitDiff = (repo: string) => invoke<string>('solve_git_diff', { repo });
export const stopSolve = (runId: string) => invoke<void>('solve_stop', { runId });

export function startSolve(
  args: { runId: string; solver: SolverId; prompt: string; repo: string; sessionId: string | null; resume: boolean; mode: Mode; model: string | null; effort: string | null },
  onEvent: (e: RawEvent) => void,
): Promise<void> {
  const channel = new Channel<RawEvent>();
  channel.onmessage = onEvent;
  return invoke<void>('solve_start', { ...args, onEvent: channel });
}
