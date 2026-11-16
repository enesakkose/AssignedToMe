import type { Task } from '@mytask/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { withSecrets } from '@/features/connections/api/connections';
import { useBoard } from '@/features/tasks/hooks/use-board';
import { http } from '@/lib/http';
import { getRepoPath, startSolve, stopSolve } from '../api';
import { solverOf } from '../solvers';
import type { ChatEvent, ChatItem, Mode, SolverId } from '../types';

const plain = (s: string | undefined) => (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * The full task as context for the agent's first turn — everything inline as text, no links (it runs headless and
 * can't open them). Includes the parent story and epic with their own descriptions, plus related issues and sub-tasks.
 */
function buildPrompt(task: Task, parent: Task | undefined, epic: Task | undefined, note: string): string {
  const lines = [`# ${task.key}: ${task.title}`, ''];
  const meta = [
    task.status && `Status: ${task.status}`,
    task.type && `Type: ${task.type}`,
    task.priority && `Priority: ${task.priority}`,
    task.project && `Project: ${task.project}`,
    task.sprint && `Sprint: ${task.sprint}`,
  ].filter(Boolean) as string[];
  if (meta.length) lines.push(...meta, '');

  lines.push('## Description', plain(task.description) || '(no description provided)', '');

  if (epic) lines.push(`## Epic — ${epic.key}: ${epic.title}`, plain(epic.description) || '(no description)', '');
  if (parent) lines.push(`## Parent — ${parent.key}: ${parent.title}`, plain(parent.description) || '(no description)', '');

  const related = (task.links ?? []).map((l) => `- ${l.relation}: ${l.key} — ${l.title}`);
  if (related.length) lines.push('## Related issues', ...related, '');

  const subs = (task.subtasks ?? []).map((s) => {
    const d = plain(s.description);
    return `- ${s.key} — ${s.title} (${s.status})${d ? `\n  ${d}` : ''}`;
  });
  if (subs.length) lines.push('## Sub-tasks', ...subs, '');

  lines.push('## What to do', note.trim() || 'Implement what this task describes, in the current repository.');
  return lines.join('\n');
}

function appendAssistant(items: ChatItem[], text: string): ChatItem[] {
  const last = items.at(-1);
  if (last?.role === 'assistant') return [...items.slice(0, -1), { role: 'assistant', text: last.text ? `${last.text}\n${text}` : text }];
  return [...items, { role: 'assistant', text }];
}

/** Drives one chat session against a local coding-agent CLI for a task. */
export function useSolve(task: Task) {
  const [solver, setSolver] = useState<SolverId>('claude');
  const [mode, setMode] = useState<Mode>('edits');
  const [model, setModel] = useState('');
  const [effort, setEffort] = useState('');
  const [items, setItems] = useState<ChatItem[]>([]);
  const [running, setRunning] = useState(false);
  const [sessionCost, setSessionCost] = useState(0);
  const sessionRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const runIdRef = useRef<string | null>(null);
  // Cumulative cost reported so far (total_cost_usd is cumulative across a resumed session); the diff is the turn's cost.
  const costRef = useRef(0);

  // Pull the full task, then its parent and that parent's parent (the epic), so the first prompt carries the whole
  // hierarchy inline as text — complete descriptions, no links.
  const { connection, provider } = useBoard(task.connectionId);
  const canFetch = !!connection && !!provider?.getTask;
  const getTask = async (key: string) => provider!.getTask!(await withSecrets(connection!), key, http);
  const full = useQuery({ queryKey: ['solve-task', task.connectionId, task.key], queryFn: () => getTask(task.key), enabled: canFetch, staleTime: 60_000 });
  const richTask = full.data ?? task;
  const parentKey = richTask.parent?.key;
  const parentQ = useQuery({ queryKey: ['solve-task', task.connectionId, parentKey], queryFn: () => getTask(parentKey!), enabled: canFetch && !!parentKey, staleTime: 60_000 });
  const epicKey = parentQ.data?.parent?.key;
  const epicQ = useQuery({ queryKey: ['solve-task', task.connectionId, epicKey], queryFn: () => getTask(epicKey!), enabled: canFetch && !!epicKey, staleTime: 60_000 });

  // Cached so reopening the screen doesn't flash the "choose repo" step while the stored path loads.
  const qc = useQueryClient();
  const repoQuery = useQuery({ queryKey: ['solve-repo', task.connectionId], queryFn: () => getRepoPath(task.connectionId), staleTime: Infinity });
  const repo = repoQuery.data; // undefined = still loading, null = none set, string = chosen
  const setRepo = useCallback((path: string) => qc.setQueryData(['solve-repo', task.connectionId], path), [qc, task.connectionId]);

  useEffect(() => () => void (runIdRef.current && stopSolve(runIdRef.current)), []);

  const chooseSolver = useCallback((next: SolverId) => {
    if (running) return;
    setSolver(next);
    setModel('');
    setEffort('');
    sessionRef.current = null;
    startedRef.current = false;
    costRef.current = 0;
    setSessionCost(0);
    setItems([]);
  }, [running]);

  const send = useCallback(
    (note: string) => {
      if (running || !repo) return;
      const first = !startedRef.current;
      const prompt = first ? buildPrompt(richTask, parentQ.data, epicQ.data, note) : note.trim();
      if (!prompt) return;
      if (first && solver === 'claude') sessionRef.current = crypto.randomUUID();
      const runId = crypto.randomUUID();
      runIdRef.current = runId;
      setItems((prev) => [...prev, { role: 'user', text: first ? note.trim() || `${task.key}: ${task.title}` : note.trim() }]);
      setRunning(true);

      let hadText = false;
      const apply = (ev: ChatEvent) => {
        if (ev.kind === 'session') {
          if (ev.id) sessionRef.current = ev.id;
        } else if (ev.kind === 'text') {
          hadText = true;
          setItems((prev) => appendAssistant(prev, ev.text));
        } else if (ev.kind === 'tool') {
          setItems((prev) => [...prev, { role: 'tool', name: ev.name, detail: ev.detail }]);
        } else if (ev.kind === 'usage') {
          const turnCost = Math.max(0, ev.costUsd - costRef.current);
          costRef.current = ev.costUsd;
          setSessionCost(ev.costUsd);
          setItems((prev) => [...prev, { role: 'usage', inputTokens: ev.inputTokens, outputTokens: ev.outputTokens, costUsd: turnCost }]);
        }
      };

      const errors: string[] = [];
      const parse = solverOf(solver).parse;
      startSolve({ runId, solver, prompt, repo, sessionId: sessionRef.current, resume: !first, mode, model: model || null, effort: effort || null }, (e) => {
        if (e.type === 'stdout') for (const ev of parse(e.line)) apply(ev);
        else if (e.type === 'stderr') errors.push(e.line);
        else if (e.type === 'exit') {
          setRunning(false);
          startedRef.current = true;
          if (!hadText && e.code && e.code !== 0) {
            setItems((prev) => [...prev, { role: 'error', text: errors.join('\n').trim() || `CLI exited with code ${e.code}` }]);
          }
        }
      }).catch((err: unknown) => {
        setRunning(false);
        setItems((prev) => [...prev, { role: 'error', text: err instanceof Error ? err.message : String(err) }]);
      });
    },
    [running, repo, solver, mode, model, effort, task, richTask, parentQ.data, epicQ.data],
  );

  const stop = useCallback(() => {
    if (runIdRef.current) void stopSolve(runIdRef.current);
  }, []);

  const clearErrors = useCallback(() => setItems((prev) => prev.filter((i) => i.role !== 'error')), []);

  return { solver, chooseSolver, mode, setMode, model, setModel, effort, setEffort, repo, setRepo, items, running, send, stop, sessionCost, clearErrors };
}
