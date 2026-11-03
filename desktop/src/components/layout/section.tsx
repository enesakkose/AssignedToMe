import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type SectionProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Content runs edge to edge (lists, tab strips); the heading keeps its inset. */
  flush?: boolean;
  children: ReactNode;
  className?: string;
};

export function Section({ title, description, flush, children, className }: SectionProps) {
  return (
    <section className={cn('flex flex-col gap-3 border-b border-rule py-4', !flush && 'px-4', flush && 'pb-0', className)}>
      <div className={cn('flex flex-col gap-0.5', flush && 'px-4')}>
        <h2 className="text-md font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}
