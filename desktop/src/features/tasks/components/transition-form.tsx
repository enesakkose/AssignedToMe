import type { Transition, TransitionInput } from '@mytask/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  taskKey: string;
  transition: Transition;
  pending: boolean;
  /** Server error text; the form stays open so nothing typed is lost. */
  error?: string;
  onSubmit: (input: TransitionInput) => void;
  onCancel: () => void;
};

/** The transition's screen (e.g. "Estimated Budget Effort"), built from the fields the source reports. */
export function TransitionForm({ taskKey, transition, pending, error, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const problems: Record<string, string> = {};
  for (const f of transition.fields) {
    const v = values[f.key]?.trim() ?? '';
    if (f.required && !v) problems[f.key] = t('connections.required');
    else if (v && f.kind === 'number' && !Number.isFinite(Number(v.replace(',', '.')))) problems[f.key] = t('tasks.mustBeNumber');
  }
  const shown = (key: string) => (touched ? problems[key] : undefined);

  const submit = () => {
    setTouched(true);
    if (Object.keys(problems).length) return;
    onSubmit({ values, comment: comment.trim() || undefined });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !pending && onCancel()}
      title={transition.name}
      description={t('tasks.formMovesTo', { key: taskKey, status: transition.to.name })}
      footer={
        <>
          <Button size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
            {t('ui.cancel')}
          </Button>
          <Button size="sm" variant="primary" loading={pending} onClick={submit}>
            {transition.name}
          </Button>
        </>
      }
    >
      <form
        className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {transition.fields.map((f) => {
          const label = f.required ? f.name : t('tasks.optionalField', { name: f.name });
          return (
            <Field key={f.key} label={label} error={shown(f.key)}>
              {f.kind === 'select' ? (
                <Select
                  value={values[f.key] ?? null}
                  onValueChange={(v) => set(f.key, v ?? '')}
                  options={(f.options ?? []).map((o) => ({ value: o.id, label: o.name }))}
                  placeholder={t('tasks.choose')}
                  invalid={!!shown(f.key)}
                />
              ) : f.kind === 'textarea' ? (
                <Textarea value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} aria-invalid={!!shown(f.key)} />
              ) : (
                <Input
                  value={values[f.key] ?? ''}
                  onValueChange={(v) => set(f.key, v)}
                  inputMode={f.kind === 'number' ? 'decimal' : undefined}
                  placeholder={f.kind === 'number' ? '0' : undefined}
                />
              )}
            </Field>
          );
        })}
        {transition.allowsComment && (
          <Field label={t('tasks.optionalField', { name: t('tasks.workComment') })}>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
        )}
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
