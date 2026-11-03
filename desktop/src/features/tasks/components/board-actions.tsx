import { MoreHorizontal, Pencil, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { toast } from '@/components/ui/toaster';
import type { StoredConnection } from '@/features/connections/api/connections';
import { useRemoveConnection, useRenameConnection } from '@/features/connections/hooks/use-connections';
import { ALL_BOARDS, useNav } from '@/stores/nav';

type Props = { board: StoredConnection; onRefresh: () => void };

/** The "…" menu for the selected board: rename, refresh, edit, remove. */
export function BoardActions({ board, onRefresh }: Props) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const go = useNav((s) => s.go);
  const selectBoard = useNav((s) => s.selectBoard);
  const remove = useRemoveConnection();

  return (
    <>
      <Menu>
        <MenuTrigger render={<IconButton label={t('boards.actions')} />}>
          <MoreHorizontal />
        </MenuTrigger>
        <MenuContent>
          <MenuItem icon={<Pencil />} onClick={() => setRenaming(true)}>
            {t('boards.rename')}
          </MenuItem>
          <MenuItem icon={<RefreshCw />} onClick={onRefresh}>
            {t('tasks.refresh')}
          </MenuItem>
          <MenuItem icon={<Settings2 />} onClick={() => go({ name: 'connection', id: board.id })}>
            {t('connections.edit')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 />} tone="danger" onClick={() => setRemoving(true)}>
            {t('connections.remove')}
          </MenuItem>
        </MenuContent>
      </Menu>
      <RenameBoardDialog board={board} open={renaming} onOpenChange={setRenaming} />
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={t('connections.removeTitle', { name: board.name })}
        description={t('connections.removeDescription')}
        confirmLabel={t('connections.remove')}
        onConfirm={() =>
          remove.mutate(board.id, {
            onSuccess: () => {
              selectBoard(ALL_BOARDS);
              toast.success(t('connections.removed'));
            },
            onError: () => toast.error(t('errors.generic')),
          })
        }
      />
    </>
  );
}

export function RenameBoardDialog({
  board,
  open,
  onOpenChange,
}: {
  board: StoredConnection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const rename = useRenameConnection();
  const [name, setName] = useState(board.name);
  const trimmed = name.trim();

  const save = () => {
    if (!trimmed) return;
    rename.mutate({ id: board.id, name: trimmed }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setName(board.name);
        onOpenChange(next);
      }}
      title={t('boards.rename')}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('ui.cancel')}
          </Button>
          <Button size="sm" variant="primary" disabled={!trimmed} loading={rename.isPending} onClick={save}>
            {t('ui.save')}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label={t('boards.name')} error={trimmed ? undefined : t('boards.nameRequired')}>
          <Input value={name} onValueChange={setName} maxLength={60} autoFocus />
        </Field>
      </form>
    </Dialog>
  );
}
