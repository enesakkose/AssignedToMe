import { ProviderError } from '@mytask/core';
import { Ban, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { errorText } from '@/lib/errors';

const isBlocked = (error: unknown) => error instanceof ProviderError && error.code === 'blocked';

/**
 * One calm place for a failed section (comments, logs, …). A network/firewall block is expected on some boards, so it
 * reads as a quiet note with "open in source", not an alarm; other failures show as an error.
 */
export function FailureNotice({
  error,
  url,
  onOpen,
  appName,
  className,
}: {
  error: unknown;
  /** Shows an "open in source" button when given. */
  url?: string;
  onOpen?: (url: string) => void;
  /** The board's name, so the message names the right tool. */
  appName?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const blocked = isBlocked(error);
  return (
    <div className={cn('flex flex-col items-start gap-1.5', className)}>
      <p className={cn('flex items-start gap-1.5 text-sm', blocked ? 'text-muted' : 'text-error')}>
        {blocked && <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
        {errorText(error, t, appName)}
      </p>
      {url && onOpen && (
        <Button size="sm" variant="ghost" className="-ml-2" onClick={() => onOpen(url)}>
          <ExternalLink />
          {t('tasks.openInSource')}
        </Button>
      )}
    </div>
  );
}
