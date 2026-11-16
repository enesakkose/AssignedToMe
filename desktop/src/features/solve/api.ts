import { Channel, invoke } from '@tauri-apps/api/core';
import { secrets } from '@/lib/secrets';
import { getStore } from '@/lib/store';
import type { Mode, RawEvent, SolverId } from './types';

// Per-board local repo folder. Not a secret — a path — so it lives in the plain store, not the Keychain.
const REPO_MAP = 'solveRepoMap';

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
