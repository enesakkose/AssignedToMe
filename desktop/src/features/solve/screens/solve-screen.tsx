import type { Task } from '@mytask/core';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bot, File, FileDiff, Folder, FolderGit2, LogIn, Send, Square } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { AppHeader } from '@/components/layout/app-header';
import { Button, IconButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/state';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { useNav } from '@/stores/nav';
import { authStatus, cliAvailable, gitDiff, hasAiKey, repoFiles, setRepoPath } from '../api';
import { AuthPanel, InstallGuide } from '../components/auth-panel';
import { Markdown } from '../components/markdown';
import { SolverPicker } from '../components/solver-picker';
import { TextMenu } from '../components/text-menu';
import { useSolve } from '../hooks/use-solve';
import { filterPaths, mentionAt, withFolders } from '../mention';
import { SOLVERS, solverOf } from '../solvers';
import type { Mode } from '../types';

export function SolveScreen({ task }: { task: Task }) {
  const { t } = useTranslation();
  const closeSolve = useNav((s) => s.closeSolve);
  const { solver, chooseSolver, mode, setMode, model, setModel, effort, setEffort, repo, setRepo, items, running, send, stop, clearErrors } = useSolve(task);
  const current = solverOf(solver);
  const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
  const [note, setNote] = useState('');
  const [diff, setDiff] = useState<string | null>(null);
  // Force the sign-in panel when a run fails for auth reasons, since the CLIs don't always report sign-in state reliably.
  const [forceAuth, setForceAuth] = useState(false);
  const isAuthError = (text: string) => /authenticat|\blogin\b|CURSOR_API_KEY|OAuth|unauthor|not signed|sign[ -]?in/i.test(text);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const activeMentionRef = useRef<HTMLButtonElement>(null);

  // @-mention: pick a file or folder from the repo to reference, instead of typing the path.
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [mIndex, setMIndex] = useState(0);
  const filesQuery = useQuery({ queryKey: ['solve-files', repo], queryFn: () => repoFiles(repo!), enabled: !!repo, staleTime: 5 * 60_000 });
  const entries = useMemo(() => withFolders(filesQuery.data ?? []), [filesQuery.data]);
  const suggestions = useMemo(() => (mention ? filterPaths(entries, mention.query) : []), [mention, entries]);
  const onNoteChange = (el: HTMLTextAreaElement) => {
    setNote(el.value);
    setMention(mentionAt(el.value, el.selectionStart ?? el.value.length));
    setMIndex(0);
  };
  const insertMention = (path: string) => {
    const el = taRef.current;
    if (!el || !mention) return;
    const caret = el.selectionStart ?? note.length;
    // Folders keep their trailing slash and no space, so you can keep typing to drill in; files end the token.
    const inserted = `@${path}${path.endsWith('/') ? '' : ' '}`;
    const next = note.slice(0, mention.start) + inserted + note.slice(caret);
    setNote(next);
    setMention(null);
    const pos = mention.start + inserted.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  // Grow the input with its content (up to a cap), like a chat box — no manual resize handle.
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [note]);
  // Keep the transcript pinned to the newest message as it streams.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [items, running]);
  // Keep the highlighted @-suggestion visible when navigating with the keyboard.
  useEffect(() => {
    activeMentionRef.current?.scrollIntoView({ block: 'nearest' });
  }, [mIndex, mention]);

  const available = useQuery({
    queryKey: ['solve-cli'],
    queryFn: async () => Object.fromEntries(await Promise.all(SOLVERS.map(async (s) => [s.id, await cliAvailable(s.id).catch(() => false)] as const))),
    staleTime: 60_000,
  });
  const ready = available.data?.[solver] ?? false;
  const models = current.models;
  // Signed in if the CLI reports it, or a stored API key covers it.
  const authed = useQuery({
    queryKey: ['solve-auth', solver],
    queryFn: () => Promise.all([authStatus(solver), hasAiKey(solver)]).then(([a, k]) => a || k),
    enabled: ready,
    staleTime: 30_000,
  });
  const canSend = !running && !!repo && ready && authed.data === true && (items.some((i) => i.role === 'user') ? note.trim().length > 0 : true);

  const submit = () => {
    if (!canSend) return;
    send(note);
    setNote('');
  };

  const pickRepo = async () => {
    const dir = await open({ directory: true, multiple: false, title: t('solve.repoLabel') });
    if (typeof dir === 'string') {
      await setRepoPath(task.connectionId, dir);
      setRepo(dir);
    }
  };

  const showDiff = async () => {
    try {
      setDiff((await gitDiff(repo!)) || t('solve.noChanges'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };


  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-paper">
      <AppHeader
        title={
          <span className="flex min-w-0 items-center gap-2">
            <Bot className="size-4 shrink-0 text-muted" aria-hidden />
            <span className="truncate font-mono text-md">{task.key}</span>
          </span>
        }
        leading={
          <IconButton label={t('ui.back')} onClick={closeSolve}>
            <ArrowLeft />
          </IconButton>
        }
        actions={
          repo ? (
            <button
              type="button"
              onClick={() => void pickRepo()}
              title={repo}
              className="flex min-w-0 items-center gap-1.5 rounded-sm px-2 py-1 text-sm text-muted transition-colors hover:bg-paper-3 hover:text-ink"
            >
              <FolderGit2 className="size-3.5 shrink-0" aria-hidden />
              <span className="max-w-40 truncate">{repo.split('/').filter(Boolean).pop()}</span>
            </button>
          ) : undefined
        }
      />

      {/* Middle: the setup step that applies (repo → install → sign in), otherwise the chat transcript.
          A loader covers the moments where repo/CLI/auth aren't known yet, so no setup step flashes by. */}
      {repo === undefined || (repo !== null && (!available.isSuccess || (ready && authed.isPending && !forceAuth))) ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : repo === null ? (
        <div className="flex flex-1 flex-col items-start gap-2 px-3 py-4">
          <Button variant="primary" onClick={() => void pickRepo()}>
            <FolderGit2 />
            {t('solve.chooseRepo')}
          </Button>
          <p className="text-sm text-muted">{t('solve.repoHint')}</p>
        </div>
      ) : !ready ? (
        <div className="flex-1 overflow-auto">
          <InstallGuide solver={solver} />
        </div>
      ) : authed.data === false || forceAuth ? (
        <div className="flex-1 overflow-auto">
          <AuthPanel
            solver={solver}
            onDone={() => {
              setForceAuth(false);
              clearErrors();
              toast.success(t('solve.signedIn', { name: current.name }));
              void authed.refetch();
            }}
          />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-3 px-3 py-3">
            {items.length === 0 && <p className="px-1 text-sm text-muted">{t('solve.intro', { key: task.key })}</p>}
            {items.map((item, i) => {
              if (item.role === 'tool') {
                return (
                  <div key={i} className="flex items-center gap-2 self-start rounded-sm bg-paper-2 px-2 py-1 text-sm text-muted">
                    <span className="font-mono">{item.name}</span>
                    {item.detail && <span className="max-w-64 truncate">{item.detail}</span>}
                  </div>
                );
              }
              if (item.role === 'usage') {
                return (
                  <div key={i} className="self-start text-xs text-muted" title={t('solve.usageDetail', { input: item.inputTokens, output: item.outputTokens })}>
                    ↑{fmtTokens(item.inputTokens)} ↓{fmtTokens(item.outputTokens)}
                  </div>
                );
              }
              if (item.role === 'error') {
                return (
                  <ErrorState
                    key={i}
                    title={t('solve.failed')}
                    description={item.text}
                    action={
                      isAuthError(item.text) ? (
                        <Button variant="primary" size="sm" onClick={() => setForceAuth(true)}>
                          <LogIn />
                          {t('solve.signIn', { name: current.name })}
                        </Button>
                      ) : undefined
                    }
                  />
                );
              }
              if (item.role === 'user') {
                return (
                  <div key={i} className="max-w-[85%] self-end rounded-card bg-accent-wash px-3 py-2 text-md whitespace-pre-wrap text-ink">
                    {item.text}
                  </div>
                );
              }
              return <Markdown key={i} text={item.text} className="max-w-[90%] self-start" />;
            })}
            {running && (
              <div className="flex items-center gap-2 self-start text-sm text-muted">
                <Spinner /> {t('solve.working')}
              </div>
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>
      )}

      {/* Composer (Claude-desktop style): the input, with the controls on a row beneath it, all in one box. */}
      <div className="relative border-t border-rule p-3">
        {/* @-mention picker: the repo's files/folders, floating above the input, like Claude Code's. */}
        {mention && suggestions.length > 0 && (
          <div className="absolute inset-x-3 bottom-full z-10 mb-2 max-h-64 overflow-auto rounded-card border border-rule bg-paper py-1 shadow-float">
            {suggestions.map((p, i) => (
              <button
                key={p}
                type="button"
                ref={i === mIndex ? activeMentionRef : undefined}
                // Keep the textarea focused: a plain click would blur it first, so act on mousedown and stop the blur.
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(p);
                }}
                onMouseEnter={() => setMIndex(i)}
                className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm', i === mIndex ? 'bg-paper-3 text-ink' : 'text-ink-2')}
              >
                {p.endsWith('/') ? <Folder className="size-3.5 shrink-0 text-muted" aria-hidden /> : <File className="size-3.5 shrink-0 text-muted" aria-hidden />}
                <span className="truncate font-mono">{p}</span>
              </button>
            ))}
          </div>
        )}
        {/* The input pill: just the text and send, like Claude Code's input. */}
        <div className="flex items-end gap-2 rounded-card border border-rule bg-paper-2 px-3 py-2 transition-colors focus-within:border-muted/50">
          <textarea
            ref={taRef}
            rows={1}
            value={note}
            onChange={(e) => onNoteChange(e.target)}
            onClick={(e) => setMention(mentionAt(e.currentTarget.value, e.currentTarget.selectionStart ?? 0))}
            onBlur={() => setMention(null)}
            onKeyDown={(e) => {
              if (mention && suggestions.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setMIndex((i) => (i + 1) % suggestions.length);
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setMIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
                  return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  insertMention(suggestions[mIndex]!);
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setMention(null);
                  return;
                }
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            spellCheck={false}
            placeholder={items.some((i) => i.role === 'user') ? t('solve.replyPlaceholder') : t('solve.firstPlaceholder')}
            disabled={!repo || !ready || !authed.data}
            className="max-h-40 flex-1 resize-none bg-transparent py-1 text-md text-ink placeholder:text-muted/70 focus:outline-none disabled:opacity-60"
          />
          {running ? (
            <IconButton label={t('solve.stop')} onClick={stop}>
              <Square />
            </IconButton>
          ) : (
            <IconButton label={t('solve.send')} onClick={submit} disabled={!canSend}>
              <Send />
            </IconButton>
          )}
        </div>
        {/* A separate row beneath the pill: the controls on the left, review actions on the right. */}
        <div className="mt-1 flex items-center gap-3 px-1.5">
          {SOLVERS.length > 1 && <SolverPicker value={solver} onChange={chooseSolver} available={available.data} disabled={running} />}
          <div className="ml-auto flex items-center gap-3">
            {repo && (items.length > 0 || running) && (
              <button type="button" onClick={() => void showDiff()} className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-ink">
                <FileDiff className="size-3.5" aria-hidden />
                {t('solve.showDiff')}
              </button>
            )}
            {models.length > 1 && <TextMenu value={model} onChange={setModel} disabled={running} options={models.map((m) => ({ value: m.id, label: m.label }))} />}
            {current.supportsEffort && (
              <TextMenu
                value={effort}
                onChange={setEffort}
                disabled={running}
                options={[
                  { value: '', label: t('solve.effortDefault') },
                  { value: 'low', label: t('solve.effortLow') },
                  { value: 'medium', label: t('solve.effortMedium') },
                  { value: 'high', label: t('solve.effortHigh') },
                  { value: 'xhigh', label: t('solve.effortXhigh') },
                  { value: 'max', label: t('solve.effortMax') },
                ]}
              />
            )}
            <TextMenu<Mode>
              value={mode}
              onChange={setMode}
              disabled={running}
              options={[
                { value: 'plan', label: t('solve.modePlan') },
                { value: 'edits', label: t('solve.modeEdits') },
                { value: 'full', label: t('solve.modeFull') },
              ]}
            />
          </div>
        </div>
        {mode === 'full' && <p className="mt-1.5 px-1.5 text-xs text-warning">{t('solve.fullModeWarning')}</p>}
      </div>

      <Dialog open={diff !== null} onOpenChange={(o) => !o && setDiff(null)} title={t('solve.diffTitle')}>
        <DiffView text={diff ?? ''} />
      </Dialog>
    </div>
  );
}

/** Colors a unified git diff: additions green, removals red, hunk/file headers muted. */
function DiffView({ text }: { text: string }) {
  const lineClass = (line: string) => {
    if (/^(diff --git|index |@@|\+\+\+ |--- )/.test(line)) return 'text-muted';
    if (line.startsWith('+')) return 'text-success';
    if (line.startsWith('-')) return 'text-error';
    return 'text-ink-2';
  };
  return (
    <pre className="max-h-[50vh] overflow-auto rounded-sm bg-paper-2 p-3 font-mono text-xs leading-relaxed">
      {text.split('\n').map((line, i) => (
        <div key={i} className={lineClass(line)}>
          {line || ' '}
        </div>
      ))}
    </pre>
  );
}
