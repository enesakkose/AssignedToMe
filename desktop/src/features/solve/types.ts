export type SolverId = 'claude';

/** Permission level, mirroring the CLIs' own modes. */
export type Mode = 'plan' | 'edits' | 'full';

/** A solver's NDJSON line, normalized to the few things the chat UI shows. */
export type ChatEvent =
  | { kind: 'session'; id: string }
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; detail?: string }
  | { kind: 'usage'; inputTokens: number; outputTokens: number; costUsd: number }
  | { kind: 'done'; ok: boolean };

/** Raw event from the Rust side: one CLI line, or the process exit. Matches `SolveEvent` in solve.rs. */
export type RawEvent =
  | { type: 'stdout'; line: string }
  | { type: 'stderr'; line: string }
  | { type: 'exit'; code: number | null };

export type ChatItem =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'tool'; name: string; detail?: string }
  | { role: 'usage'; inputTokens: number; outputTokens: number; costUsd: number }
  | { role: 'error'; text: string };
