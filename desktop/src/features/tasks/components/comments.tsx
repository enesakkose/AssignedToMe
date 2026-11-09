import type { Attachment, Comment } from '@mytask/core';
import { MessageSquare, Reply, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toaster';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { errorText } from '@/lib/errors';
import { timeAgo } from '@/lib/format';
import { useAddComment, useCanComment, useComments, useDeleteComment } from '../hooks/use-comments';
import { useBoard } from '../hooks/use-board';
import { FailureNotice } from './failure-notice';
import { RichText } from './rich-text';

// The newest ten; older ones are one click away so a long thread doesn't bury the composer.
const SHOWN = 10;

type Props = {
  connectionId: string;
  taskKey: string;
  url: string;
  attachments: Attachment[] | undefined;
  onOpen: (url: string) => void;
};

/** A task's comments, oldest to newest like a chat, with a box to add one at the bottom. */
export function Comments({ connectionId, taskKey, url, attachments, onOpen }: Props) {
  const { t } = useTranslation();
  const supported = useCanComment(connectionId);
  const appName = useBoard(connectionId).provider?.appName;
  const comments = useComments(connectionId, taskKey, attachments, supported);
  const [all, setAll] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const remove = useDeleteComment(connectionId, taskKey);
  if (!supported) return null;
  const deleting = remove.mutation.isPending ? remove.mutation.variables : undefined;

  const list = comments.data ?? [];
  const hidden = all ? 0 : Math.max(0, list.length - SHOWN);

  return (
    // Its own block under a rule: the task's content above, the conversation about it below.
    <section className="mt-1 flex flex-col gap-2.5 border-t border-rule pt-3" aria-busy={comments.isPending || undefined}>
      <h4 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink-2">
        <MessageSquare className="size-3.5 text-muted" aria-hidden />
        {t('comments.title')}
        {comments.isSuccess && list.length > 0 && <span className="num font-normal text-muted">{list.length}</span>}
      </h4>

      {comments.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-4/5" />
        </div>
      ) : comments.isError ? (
        <FailureNotice error={comments.error} url={url} onOpen={onOpen} appName={appName} />
      ) : (
        <>
          {hidden > 0 && (
            <button type="button" onClick={() => setAll(true)} className="self-start text-sm font-medium text-ink hover:underline">
              {t('comments.showEarlier', { count: hidden })}
            </button>
          )}
          {list.length === 0 ? (
            <p className="text-sm text-muted">{t('comments.empty')}</p>
          ) : (
            <ul className="fade-in flex flex-col gap-3">
              {list.slice(hidden).map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  depth={0}
                  connectionId={connectionId}
                  taskKey={taskKey}
                  attachments={attachments}
                  onOpen={onOpen}
                  remove={remove}
                  deleting={deleting}
                  onDelete={setConfirming}
                />
              ))}
            </ul>
          )}
          <Composer connectionId={connectionId} taskKey={taskKey} />
        </>
      )}
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={t('comments.deleteTitle')}
        description={t('comments.deleteDescription', { app: appName })}
        confirmLabel={t('comments.delete')}
        onConfirm={() =>
          confirming &&
          remove.mutation.mutate(confirming, {
            onSuccess: () => toast.success(t('comments.deleted')),
            onError: (error) => toast.error(t('comments.deleteFailed'), { description: errorText(error, t, appName) }),
          })
        }
      />
    </section>
  );
}

/** One comment and its replies, nested and indented; depth caps the indent so deep threads stay readable. */
function CommentItem({
  comment: c,
  depth,
  connectionId,
  taskKey,
  attachments,
  onOpen,
  remove,
  deleting,
  onDelete,
}: {
  comment: Comment;
  depth: number;
  connectionId: string;
  taskKey: string;
  attachments: Attachment[] | undefined;
  onOpen: (url: string) => void;
  remove: ReturnType<typeof useDeleteComment>;
  deleting: string | undefined;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [replying, setReplying] = useState(false);
  return (
    <li className="group flex gap-2">
      <Avatar name={c.author} className="mt-px" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5 text-sm">
          <span className="truncate font-medium text-ink">{c.author ?? t('tasks.unknownAuthor')}</span>
          {c.mine && <Badge>{t('tasks.you')}</Badge>}
          <span className="num shrink-0 text-xs text-muted" title={new Date(c.created).toLocaleString()}>
            {timeAgo(c.created)}
          </span>
          {c.mine && remove.supported && (
            // Quiet until the row is hovered or focused, so the thread reads clean; a spinner while the source deletes it.
            <IconButton
              label={t('comments.delete')}
              onClick={() => onDelete(c.id)}
              disabled={remove.mutation.isPending}
              className={cn(
                '-my-1 ml-auto size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                deleting === c.id && 'opacity-100',
              )}
            >
              {deleting === c.id ? <Spinner /> : <Trash2 />}
            </IconButton>
          )}
        </span>
        <RichText
          text={c.text}
          parts={c.parts}
          attachments={attachments}
          connectionId={connectionId}
          onOpen={onOpen}
          className="text-sm"
          lines="line-clamp-4"
        />
        <button
          type="button"
          onClick={() => setReplying((r) => !r)}
          className="flex items-center gap-1 self-start text-xs font-medium text-muted hover:text-ink"
        >
          <Reply className="size-3" aria-hidden />
          {t('comments.reply')}
        </button>
        {replying && (
          <Composer connectionId={connectionId} taskKey={taskKey} parentId={c.id} autoFocus onSent={() => setReplying(false)} />
        )}
        {c.replies && c.replies.length > 0 && (
          // Cap the indent at depth 2 so deep threads don't run off a narrow card.
          <ul className={cn('mt-2 flex flex-col gap-3 border-l border-rule', depth < 2 ? 'ml-1 pl-3' : 'pl-3')}>
            {c.replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                depth={depth + 1}
                connectionId={connectionId}
                taskKey={taskKey}
                attachments={attachments}
                onOpen={onOpen}
                remove={remove}
                deleting={deleting}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function Composer({
  connectionId,
  taskKey,
  parentId,
  autoFocus,
  onSent,
}: {
  connectionId: string;
  taskKey: string;
  parentId?: string;
  autoFocus?: boolean;
  onSent?: () => void;
}) {
  const appName = useBoard(connectionId).provider?.appName;
  const { t } = useTranslation();
  const add = useAddComment(connectionId, taskKey);
  const [text, setText] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);

  // One line until you type more, then it grows (up to ~6 lines) so an empty box doesn't dominate the card.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);
  const canSend = !!text.trim() && !add.isPending;
  // Text stays in the box until the source confirms, so a failure loses nothing.
  const send = () =>
    canSend &&
    add.mutate(
      { text, parentId },
      {
        onSuccess: () => {
          setText('');
          onSent?.();
        },
      },
    );

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <Textarea
        ref={box}
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={t('comments.placeholder')}
        aria-label={t('comments.placeholder')}
        aria-invalid={add.isError || undefined}
        rows={1}
        className="min-h-0 resize-none py-1.5 text-sm"
      />
      {add.isError && <p className="text-sm text-error">{errorText(add.error, t, appName)}</p>}
      {/* Send appears once there's something to send. */}
      {(text.trim() || add.isPending) && (
        <div className="flex items-center justify-end gap-2">
          <span className="flex items-center gap-1 text-xs text-muted">
            <Kbd>⌘</Kbd>
            <Kbd>↩</Kbd>
          </span>
          <Button type="submit" size="sm" variant="primary" disabled={!canSend} loading={add.isPending}>
            {t('comments.send')}
          </Button>
        </div>
      )}
    </form>
  );
}
