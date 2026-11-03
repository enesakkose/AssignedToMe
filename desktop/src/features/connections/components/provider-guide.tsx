import { fillGuide, type Provider } from '@mytask/core';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyField } from '@/components/ui/copy-field';
import { locale } from '@/lib/i18n';
import { openExternal } from '@/lib/open-external';

/** Step-by-step "how to get your key", generated from the provider definition. */
export function ProviderGuide({ provider, values }: { provider: Provider; values: Record<string, string> }) {
  return (
    <ol className="flex flex-col gap-3">
      {provider.guide.map((step, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="num flex size-5 shrink-0 items-center justify-center rounded-full border border-rule-2 bg-paper font-mono text-xs text-muted">
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="text-md text-ink-2">{step.text[locale]}</p>
            {step.link && (
              <Button size="sm" className="self-start" onClick={() => openExternal(step.link!)}>
                <ExternalLink />
                {new URL(step.link).hostname}
              </Button>
            )}
            {step.copy && <CopyField value={fillGuide(step.copy, values)} />}
          </div>
        </li>
      ))}
    </ol>
  );
}
