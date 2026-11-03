import { getProvider, providers, type Connection, type Provider } from '@mytask/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/layout/app-header';
import { Section } from '@/components/layout/section';
import { Button, IconButton } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, SecretInput } from '@/components/ui/input';
import { ProviderLogo } from '@/components/ui/provider-logo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/state';
import { toast } from '@/components/ui/toaster';
import { errorText } from '@/lib/errors';
import { http } from '@/lib/http';
import { locale } from '@/lib/i18n';
import { ALL_BOARDS, useNav } from '@/stores/nav';
import { withSecrets, type StoredConnection } from '../api/connections';
import { ProviderGuide } from '../components/provider-guide';
import { useConnections, useRemoveConnection, useSaveConnection } from '../hooks/use-connections';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const secretKeys = (provider: Provider) => provider.fields.filter((f) => f.type === 'secret').map((f) => f.key);

/** Long tokens show their last 4 like a card number; short ones (passwords) show none, 4 characters would give too much away. */
const mask = (secret: string) => (secret ? '••••••••' + (secret.length >= 20 ? secret.slice(-4) : '') : '');

/** Add (no id) or edit (id) a board connection. */
export function ConnectionScreen({ id }: { id?: string }) {
  const { t } = useTranslation();
  const go = useNav((s) => s.go);
  const connections = useConnections();
  const existing = connections.data?.find((c) => c.id === id);
  const [providerId, setProviderId] = useState<string | undefined>(existing?.providerId);
  const provider = getProvider(providerId ?? existing?.providerId ?? '');

  // The saved secrets never come back into the form; it only gets a masked hint of each.
  const loaded = useQuery({
    queryKey: ['connection-form', id],
    queryFn: async () => {
      const full = await withSecrets(existing!);
      return Object.fromEntries(secretKeys(provider!).map((k) => [k, mask(full.values[k] ?? '')]));
    },
    enabled: !!existing,
    gcTime: 0,
    staleTime: 0,
  });

  const back = () => go(id ? { name: 'settings' } : { name: 'tasks' });

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        title={id ? t('connections.edit') : t('connections.add')}
        leading={
          <IconButton label={t('ui.back')} onClick={back}>
            <ArrowLeft />
          </IconButton>
        }
      />
      <ScrollArea className="flex-1">
        {!provider ? (
          <ProviderPicker onPick={setProviderId} />
        ) : id && !loaded.data ? (
          loaded.isError ? (
            <ErrorState title={t('errors.keychainTitle')} description={t('errors.keychain')} />
          ) : (
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
            </div>
          )
        ) : (
          <ConnectionForm key={id ?? provider.id} provider={provider} initial={existing} hints={loaded.data} onDone={back} />
        )}
      </ScrollArea>
    </div>
  );
}

function ProviderPicker({ onPick }: { onPick: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <Section title={t('connections.pickProvider')} description={t('connections.pickProviderHint')}>
      <div className="grid grid-cols-2 gap-2">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            className="cut flex items-center gap-2.5 border border-rule bg-paper p-2.5 text-left transition-[scale,background-color] duration-[var(--dur-micro)] ease-out hover:bg-paper-2 active:scale-[0.98]"
          >
            <ProviderLogo provider={p} />
            <span className="font-display font-medium">{p.name}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function ConnectionForm({
  provider,
  initial,
  hints = {},
  onDone,
}: {
  provider: Provider;
  initial?: StoredConnection;
  hints?: Record<string, string>;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const go = useNav((s) => s.go);
  const selectBoard = useNav((s) => s.selectBoard);
  const save = useSaveConnection();
  const remove = useRemoveConnection();
  const [values, setValues] = useState<Record<string, string>>(initial?.values ?? {});
  const [name, setName] = useState(initial?.name ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState(false);

  const connection = (): Connection => ({
    id: initial?.id ?? crypto.randomUUID(),
    providerId: provider.id,
    name: name.trim() || provider.defaultName(values),
    values: Object.fromEntries(provider.fields.map((f) => [f.key, (values[f.key] ?? '').trim()])),
  });

  const check = () => {
    const next: Record<string, string> = {};
    for (const f of provider.fields) {
      const v = (values[f.key] ?? '').trim();
      if (!v && !hints[f.key]) {
        if (!f.optional) next[f.key] = t('connections.required');
      } else if (f.type === 'email' && !EMAIL.test(v)) next[f.key] = t('connections.invalidEmail');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // A kept secret is read from Keychain only for this request, never put into form state.
  const withKept = async (c: Connection): Promise<Connection> => {
    if (!initial) return c;
    const saved = await withSecrets(initial);
    // Only secrets are kept when left blank; other fields are shown in the form, so a blank one was cleared on purpose.
    const secrets = new Set(secretKeys(provider));
    return {
      ...c,
      values: Object.fromEntries(Object.entries(c.values).map(([k, v]) => [k, v || (secrets.has(k) ? (saved.values[k] ?? '') : '')])),
    };
  };

  const test = useMutation({ mutationFn: async (c: Connection) => provider.validate(await withKept(c), http) });

  const onTest = () => {
    if (!check()) return;
    test.mutate(connection(), { onSuccess: () => toast.success(t('connections.testOk')) });
  };

  const onSave = () => {
    if (!check()) return;
    const c = connection();
    test.mutate(c, {
      onSuccess: () =>
        save.mutate(c, {
          onSuccess: () => {
            toast.success(t('connections.saved', { name: c.name }));
            selectBoard(c.id);
            go({ name: 'tasks' });
          },
          onError: () => toast.error(t('errors.keychain')),
        }),
    });
  };

  return (
    <>
      <form
        className="flex flex-col gap-3 border-b border-rule p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <div className="flex items-center gap-2.5">
          <ProviderLogo provider={provider} />
          <span className="font-display text-lg font-semibold">{provider.name}</span>
        </div>
        {provider.fields.map((f) => {
          const props = {
            value: values[f.key] ?? '',
            onValueChange: (v: string) => setValues((prev) => ({ ...prev, [f.key]: v })),
            placeholder: f.placeholder,
            name: f.key,
          };
          return (
            <Field
              key={f.key}
              label={f.label[locale]}
              error={errors[f.key]}
              description={hints[f.key] ? t('connections.secretKept', { hint: hints[f.key] }) : undefined}
            >
              {f.type === 'secret' ? (
                <SecretInput {...props} placeholder={hints[f.key] || f.placeholder} />
              ) : (
                <Input type={f.type === 'url' ? 'text' : f.type} {...props} />
              )}
            </Field>
          );
        })}
        <Field label={t('boards.name')} description={t('connections.nameHint')}>
          <Input value={name} onValueChange={setName} placeholder={provider.defaultName(values)} maxLength={60} />
        </Field>

        {test.isError && (
          <ErrorState className="mx-0 my-0" title={t('connections.testFailed')} description={errorText(test.error, t, provider.appName)} />
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" variant="primary" loading={test.isPending || save.isPending}>
            {initial ? t('ui.save') : t('connections.save')}
          </Button>
          <Button type="button" onClick={onTest} disabled={test.isPending}>
            {t('connections.test')}
          </Button>
          {initial && (
            <Button type="button" variant="ghost" className="ml-auto text-error" onClick={() => setRemoving(true)}>
              <Trash2 />
              {t('connections.remove')}
            </Button>
          )}
        </div>
      </form>

      <Section title={t('connections.guideTitle', { name: provider.name })}>
        <ProviderGuide provider={provider} values={values} />
      </Section>

      {initial && (
        <ConfirmDialog
          open={removing}
          onOpenChange={setRemoving}
          title={t('connections.removeTitle', { name: initial.name })}
          description={t('connections.removeDescription')}
          confirmLabel={t('connections.remove')}
          onConfirm={() =>
            remove.mutate(initial.id, {
              onSuccess: () => {
                selectBoard(ALL_BOARDS);
                toast.success(t('connections.removed'));
                onDone();
              },
              onError: () => toast.error(t('errors.generic')),
            })
          }
        />
      )}
    </>
  );
}
