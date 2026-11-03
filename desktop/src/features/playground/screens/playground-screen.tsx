import { emptyFilters, filterOptions, matchesFilters, providers } from '@mytask/core';
import { Inbox, MoreHorizontal, Pencil, Plus, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/layout/app-header';
import { Section } from '@/components/layout/section';
import { Button, IconButton } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, SecretInput } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { ProviderLogo } from '@/components/ui/provider-logo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchField } from '@/components/ui/search-field';
import { EmptyState, ErrorState } from '@/components/ui/state';
import { Switch } from '@/components/ui/switch';
import { Tab, Tabs, TabsList } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toaster';
import { ProviderGuide } from '@/features/connections/components/provider-guide';
import { ActiveFilters, FilterMenu } from '@/features/tasks/components/filter-menu';
import { TaskRow, TaskRowSkeleton } from '@/features/tasks/components/task-row';
import { locale } from '@/lib/i18n';
import { openExternal } from '@/lib/open-external';
import { useNav } from '@/stores/nav';
import { TransitionForm } from '@/features/tasks/components/transition-form';
import { demoTasks, demoTransition, worstTasks } from '../fixtures';

type ListState = 'full' | 'loading' | 'empty' | 'error';

/** Every primitive in every state. Review the design language here before building features. */
export function PlaygroundScreen() {
  const { t } = useTranslation();
  const go = useNav((s) => s.go);
  const [worst, setWorst] = useState(false);
  const [listState, setListState] = useState<ListState>('full');
  const [filters, setFilters] = useState(emptyFilters);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [date, setDate] = useState(() => new Date());
  const [search, setSearch] = useState('roaming');
  const jira = providers[0]!;
  const tasks = worst ? worstTasks : demoTasks;
  const values = { domain: 'sirket.atlassian.net', email: 'ad@sirket.com' };
  const open = (url: string) => toast(t('playground.opened', { key: url.split('/').pop() }));

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        title={t('playground.title')}
        actions={
          <>
            <IconButton label={t('tasks.refresh')} onClick={() => toast.success(t('playground.refreshed'))}>
              <RefreshCw />
            </IconButton>
            <IconButton label={t('settings.title')} onClick={() => go({ name: 'settings' })}>
              <Settings />
            </IconButton>
          </>
        }
      />

      <ScrollArea className="flex-1">
        <Section title={t('playground.worstCase')} description={t('playground.worstCaseHint')}>
          <label className="flex items-center justify-between gap-3 text-md">
            {t('playground.worstCase')}
            <Switch checked={worst} onCheckedChange={setWorst} />
          </label>
        </Section>

        <Section title={t('playground.queue')} flush>
          <Tabs defaultValue="all">
            <TabsList>
              <Tab value="all" count={tasks.length}>
                {t('tasks.all')}
              </Tab>
              <Tab value="jira" count={2} icon={<ProviderLogo provider={jira} size="sm" />}>
                {worst ? 'customer-experience-platform-eu' : 'sirket'}
              </Tab>
              <Tab value="other" count={0}>
                {t('playground.secondBoard')}
              </Tab>
              <Tab value="disabled" disabled>
                {t('playground.disabled')}
              </Tab>
            </TabsList>
          </Tabs>
          <div className="flex gap-1 px-3 pt-2">
            {(['full', 'loading', 'empty', 'error'] as const).map((s) => (
              <Button key={s} size="sm" variant={s === listState ? 'primary' : 'ghost'} onClick={() => setListState(s)}>
                {t(`playground.state.${s}`)}
              </Button>
            ))}
          </div>
          <div className="px-3 pt-2">
            <div className="flex justify-end">
              <FilterMenu filters={filters} onChange={setFilters} options={filterOptions(tasks)} />
            </div>
            <ActiveFilters filters={filters} onChange={setFilters} options={filterOptions(tasks)} />
          </div>
          {listState === 'full' && (
            <ul className="mt-2 border-t border-rule">
              {tasks.filter((task) => matchesFilters(task, filters)).map((task) => (
                <TaskRow key={task.id} task={task} provider={jira} onOpen={open} />
              ))}
            </ul>
          )}
          {listState === 'loading' && (
            <ul className="mt-2 border-t border-rule" aria-busy>
              <TaskRowSkeleton />
              <TaskRowSkeleton />
              <TaskRowSkeleton />
            </ul>
          )}
          {listState === 'empty' && (
            <EmptyState
              icon={<Inbox />}
              title={t('tasks.emptyTitle')}
              description={t('tasks.emptyDescription')}
              action={
                <Button size="sm">
                  <Plus />
                  {t('connections.add')}
                </Button>
              }
            />
          )}
          {listState === 'error' && (
            <ErrorState
              title={t('tasks.errorTitle', { name: 'sirket' })}
              description={t('tasks.errorUnauthorized')}
              action={
                <Button size="sm">
                  <Settings />
                  {t('connections.edit')}
                </Button>
              }
            />
          )}
        </Section>

        <Section title={t('playground.buttons')}>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">{t('connections.save')}</Button>
            <Button>{t('connections.test')}</Button>
            <Button variant="ghost">{t('ui.cancel')}</Button>
            <Button variant="danger">
              <Trash2 />
              {t('connections.remove')}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" loading>
              {t('connections.testing')}
            </Button>
            <Button size="sm" disabled>
              {t('playground.disabled')}
            </Button>
            <IconButton label={t('tasks.refresh')}>
              <RefreshCw />
            </IconButton>
            <span className="flex items-center gap-1 text-sm text-muted">
              <Kbd>⌘</Kbd>
              <Kbd>R</Kbd>
            </span>
          </div>
        </Section>

        <Section title={t('playground.form')}>
          <SearchField value={search} onValueChange={setSearch} label={t('tasks.searchAll')} />
          <Field label={jira.fields[0]!.label[locale]} description={t('playground.domainHint')}>
            <Input placeholder={jira.fields[0]!.placeholder} />
          </Field>
          <Field label={jira.fields[1]!.label[locale]} error={t('playground.emailError')}>
            <Input defaultValue="ad@" />
          </Field>
          <Field label={jira.fields[2]!.label[locale]}>
            <SecretInput defaultValue="ATATT3xFfGF0-example-token" />
          </Field>
          <Field label={t('playground.disabled')}>
            <Input disabled defaultValue="sirket.atlassian.net" />
          </Field>
          <Field label={t('tasks.workDate')}>
            <DatePicker value={date} onChange={setDate} max={new Date()} />
          </Field>
          <label className="flex items-center justify-between gap-3 text-md">
            {t('settings.launchAtLogin')}
            <Switch defaultChecked />
          </label>
        </Section>

        <Section title={t('playground.guide')} description={t('playground.guideHint')}>
          <div className="flex items-center gap-2">
            <ProviderLogo provider={jira} size="lg" />
            <div className="flex flex-col">
              <span className="font-display text-lg font-semibold">{jira.name}</span>
              <button
                type="button"
                onClick={() => openExternal(jira.docsUrl)}
                className="self-start text-sm text-accent-text underline-offset-2 hover:underline"
              >
                {t('connections.docs')}
              </button>
            </div>
          </div>
          <ProviderGuide provider={jira} values={values} />
        </Section>

        <Section title={t('playground.overlays')}>
          <div className="flex flex-wrap items-center gap-2">
            <Menu>
              <MenuTrigger render={<Button size="sm" />}>
                <MoreHorizontal />
                {t('playground.menu')}
              </MenuTrigger>
              <MenuContent align="start">
                <MenuItem icon={<Pencil />} shortcut={<Kbd>R</Kbd>}>
                  {t('boards.rename')}
                </MenuItem>
                <MenuItem icon={<RefreshCw />}>{t('tasks.refresh')}</MenuItem>
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} tone="danger" onClick={() => setConfirmOpen(true)}>
                  {t('connections.remove')}
                </MenuItem>
              </MenuContent>
            </Menu>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              {t('boards.rename')}
            </Button>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              {demoTransition.name}
            </Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmOpen(true)}>
              {t('connections.remove')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toast.error(t('tasks.errorTitle', { name: 'sirket' }), { description: t('tasks.errorUnauthorized') })}>
              {t('playground.toastError')}
            </Button>
          </div>
        </Section>

        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={t('boards.rename')}
          footer={
            <>
              <Button size="sm" variant="ghost" onClick={() => setDialogOpen(false)}>
                {t('ui.cancel')}
              </Button>
              <Button size="sm" variant="primary" onClick={() => setDialogOpen(false)}>
                {t('ui.save')}
              </Button>
            </>
          }
        >
          <Field label={t('boards.name')}>
            <Input defaultValue="sirket" autoFocus />
          </Field>
        </Dialog>
        {formOpen && (
          <TransitionForm
            taskKey="BOOM-7187"
            transition={demoTransition}
            pending={false}
            onCancel={() => setFormOpen(false)}
            onSubmit={(input) => {
              toast(JSON.stringify(input.values));
              setFormOpen(false);
            }}
          />
        )}
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t('connections.removeTitle', { name: 'sirket' })}
          description={t('connections.removeDescription')}
          confirmLabel={t('connections.remove')}
          onConfirm={() => toast.success(t('connections.removed'))}
        />
      </ScrollArea>
    </div>
  );
}
