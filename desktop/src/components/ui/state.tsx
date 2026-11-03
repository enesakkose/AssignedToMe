import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type StateProps = {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** What belongs here and the one action that fills it. */
export function EmptyState({ icon, title, description, action, className }: StateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-8 py-10 text-center', className)}>
      {icon && <div className="mb-1 text-muted [&_svg]:size-5">{icon}</div>}
      <h3 className="text-lg">{title}</h3>
      {description && <p className="max-w-64 text-md text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** What broke and what to do about it. */
export function ErrorState({ title, description, action, className }: Omit<StateProps, 'icon'>) {
  return (
    <div role="alert" className={cn('cut mx-3 my-3 flex gap-2 border border-error/30 bg-error-wash p-3', className)}>
      <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-error" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium text-ink">{title}</p>
        {description && <p className="text-sm text-ink-2">{description}</p>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}
