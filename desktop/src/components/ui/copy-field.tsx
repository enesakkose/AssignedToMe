import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { IconButton } from './button';

/** A value or command the user copies, with a working copy key. */
export function CopyField({ value, className }: { value: string; className?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <div className={cn('cut flex min-w-0 items-start gap-1 border border-rule bg-paper-2 py-0.5 pr-0.5 pl-2.5', className)}>
      <code data-selectable className="min-w-0 flex-1 py-1 font-mono text-sm break-all text-ink-2">
        {value}
      </code>
      <IconButton
        label={copied ? t('ui.copied') : t('ui.copy')}
        onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </IconButton>
    </div>
  );
}
