import type { Provider } from '@mytask/core';
import { cn } from '@/lib/cn';

const sizes = { sm: 'size-4 p-0', md: 'size-7 p-1.5', lg: 'size-10 p-2' };

export function ProviderLogo({ provider, size = 'md', className }: { provider: Provider; size?: keyof typeof sizes; className?: string }) {
  const wrap = cn('inline-flex shrink-0 items-center justify-center', size !== 'sm' && 'rounded-input border border-rule bg-paper', sizes[size], className);
  // A monochrome mark (currentColor) is rendered inline so it follows the theme's ink color — reliably, unlike a
  // media query inside an <img> SVG. The logo is a trusted built-in constant, not provider-fetched data.
  if (provider.logo.includes('currentColor'))
    return <span role="img" aria-label={provider.name} className={cn(wrap, 'text-ink [&>svg]:size-full')} dangerouslySetInnerHTML={{ __html: provider.logo }} />;
  // Colored logos stay in an <img>: isolation keeps their gradient ids and styles from leaking into the page.
  return (
    <span className={wrap}>
      <img src={`data:image/svg+xml;utf8,${encodeURIComponent(provider.logo)}`} alt={provider.name} className="size-full" draggable={false} />
    </span>
  );
}
