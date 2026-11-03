import { Toaster as Sonner } from 'sonner';

export { toast } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      gap={6}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'cut flex w-[calc(400px-32px)] items-start gap-2 border border-rule bg-paper p-3 text-md text-ink shadow-float',
          title: 'font-medium',
          description: 'text-sm text-muted',
          icon: 'mt-0.5 [&_svg]:size-3.5',
          error: '[&_[data-icon]]:text-error',
          success: '[&_[data-icon]]:text-success',
          actionButton: 'ml-auto font-display text-sm font-medium text-accent-text hover:underline',
        },
      }}
    />
  );
}
