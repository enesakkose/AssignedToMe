import { getProvider } from '@mytask/core';
import { Check, Eye, EyeOff, LayoutList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { ProviderLogo } from '@/components/ui/provider-logo';
import type { StoredConnection } from '@/features/connections/api/connections';
import { ALL_BOARDS, useNav } from '@/stores/nav';

type Props = {
  boards: StoredConnection[];
  /** Task count per board id, when loaded. */
  counts: Record<string, number | undefined>;
  total?: number;
  active: string;
};

/**
 * Lists the boards to switch between, and turns the tab bar on or off. With tabs off no board name stays on
 * screen (handy while screen sharing); the names show only while this menu is open.
 */
export function BoardSwitcher({ boards, counts, total, active }: Props) {
  const { t } = useTranslation();
  const selectBoard = useNav((s) => s.selectBoard);
  const showTabs = useNav((s) => s.showTabs);
  const setShowTabs = useNav((s) => s.setShowTabs);
  const count = (n: number | undefined) => n !== undefined && <span className="num text-xs text-muted">{n}</span>;
  const tick = (on: boolean) => (on ? <Check className="size-3.5 shrink-0 text-ink-2" aria-hidden /> : <span className="size-3.5 shrink-0" />);

  return (
    <Menu>
      <MenuTrigger render={<IconButton label={t('boards.switch')} />}>
        <LayoutList />
      </MenuTrigger>
      <MenuContent className="w-64">
        <MenuItem icon={tick(active === ALL_BOARDS)} shortcut={count(total)} onClick={() => selectBoard(ALL_BOARDS)}>
          {t('tasks.all')}
        </MenuItem>
        {boards.map((b) => {
          const provider = getProvider(b.providerId);
          return (
            <MenuItem key={b.id} icon={tick(active === b.id)} shortcut={count(counts[b.id])} onClick={() => selectBoard(b.id)}>
              <span className="flex min-w-0 items-center gap-1.5">
                {provider && <ProviderLogo provider={provider} size="sm" />}
                <span className="truncate">{b.name}</span>
              </span>
            </MenuItem>
          );
        })}
        <MenuSeparator />
        <MenuItem icon={showTabs ? <EyeOff /> : <Eye />} onClick={() => setShowTabs(!showTabs)}>
          {showTabs ? t('boards.hideTabs') : t('boards.showTabs')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
