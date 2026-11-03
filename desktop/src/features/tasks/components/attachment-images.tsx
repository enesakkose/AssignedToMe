import type { Attachment } from '@mytask/core';
import { ExternalLink, ImageOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { useAttachmentImage, useCanShowAttachments } from '../hooks/use-attachment';

const IMAGE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
export const isImage = (a: Attachment) => a.mimeType?.startsWith('image/') || IMAGE.test(a.name);

/** Image attachments as a thumbnail grid; click for a larger preview. `exclude` skips images already shown inside the description. */
export function AttachmentImages({
  connectionId,
  attachments,
  exclude,
  onOpen,
  className,
}: {
  connectionId: string;
  attachments: Attachment[] | undefined;
  exclude?: Set<string>;
  onOpen: (url: string) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const supported = useCanShowAttachments(connectionId);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const images = (attachments ?? []).filter((a) => isImage(a) && !exclude?.has(a.id));
  if (!supported || !images.length) return null;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <h4 className="font-display text-sm font-semibold text-ink-2">{t('tasks.images', { count: images.length })}</h4>
      <ul className="grid grid-cols-3 gap-1.5">
        {images.map((a) => (
          <li key={a.id}>
            <Thumb connectionId={connectionId} attachment={a} onClick={() => setPreview(a)} />
          </li>
        ))}
      </ul>
      {preview && <ImagePreview connectionId={connectionId} attachment={preview} onClose={() => setPreview(null)} onOpen={onOpen} />}
    </div>
  );
}

/** An image inside the description, at its own aspect ratio, where the author placed it; click for a larger preview. */
export function InlineImage({
  connectionId,
  attachment,
  onOpen,
}: {
  connectionId: string;
  attachment: Attachment;
  onOpen: (url: string) => void;
}) {
  const { t } = useTranslation();
  const supported = useCanShowAttachments(connectionId);
  const image = useAttachmentImage(connectionId, supported ? (attachment.thumbnailUrl ?? attachment.url) : undefined);
  const [preview, setPreview] = useState(false);
  if (!supported) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setPreview(true)}
        aria-label={t('tasks.previewImage', { name: attachment.name })}
        title={attachment.name}
        className="my-1 block w-fit max-w-full overflow-hidden rounded-sm border border-rule bg-paper-3 transition-[scale] duration-[var(--dur-micro)] active:scale-[0.98]"
      >
        {image.data ? (
          <img src={image.data} alt={attachment.name} className="block max-h-40 max-w-full object-contain" draggable={false} />
        ) : image.isError ? (
          <span className="flex h-16 w-28 items-center justify-center text-muted">
            <ImageOff className="size-4" aria-hidden />
          </span>
        ) : (
          <Skeleton className="h-24 w-40 rounded-none" />
        )}
      </button>
      {preview && <ImagePreview connectionId={connectionId} attachment={attachment} onClose={() => setPreview(false)} onOpen={onOpen} />}
    </>
  );
}

export function ImagePreview({
  connectionId,
  attachment,
  onClose,
  onOpen,
}: {
  connectionId: string;
  attachment: Attachment;
  onClose: () => void;
  onOpen: (url: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={<span className="block truncate">{attachment.name}</span>}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t('ui.close')}
          </Button>
          <Button size="sm" onClick={() => onOpen(attachment.url)}>
            <ExternalLink />
            {t('tasks.openOriginal')}
          </Button>
        </>
      }
    >
      <FullImage connectionId={connectionId} attachment={attachment} />
    </Dialog>
  );
}

function Thumb({ connectionId, attachment, onClick }: { connectionId: string; attachment: Attachment; onClick: () => void }) {
  const { t } = useTranslation();
  const image = useAttachmentImage(connectionId, attachment.thumbnailUrl ?? attachment.url);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('tasks.previewImage', { name: attachment.name })}
      title={attachment.name}
      className="relative z-10 block aspect-[4/3] w-full overflow-hidden rounded-sm border border-rule bg-paper-3 transition-[scale] duration-[var(--dur-micro)] active:scale-[0.97]"
    >
      {image.data ? (
        <img src={image.data} alt="" className="size-full object-cover" draggable={false} />
      ) : image.isError ? (
        <span className="flex size-full items-center justify-center text-muted">
          <ImageOff className="size-4" aria-hidden />
        </span>
      ) : (
        <Skeleton className="size-full rounded-none" />
      )}
    </button>
  );
}

function FullImage({ connectionId, attachment }: { connectionId: string; attachment: Attachment }) {
  const { t } = useTranslation();
  const image = useAttachmentImage(connectionId, attachment.url);
  // If the full file is refused (e.g. a network filter), the thumbnail that already loaded is better than nothing.
  const thumb = useAttachmentImage(connectionId, image.isError ? attachment.thumbnailUrl : undefined);
  if (image.data) return <img src={image.data} alt={attachment.name} className="max-h-[60vh] w-full rounded-sm object-contain" />;
  if (image.isError) {
    return (
      <div className="flex flex-col gap-2">
        {thumb.data && <img src={thumb.data} alt={attachment.name} className="max-h-[50vh] w-full rounded-sm object-contain" />}
        <p className="text-sm text-muted">{thumb.data ? t('tasks.thumbnailOnly') : t('tasks.imageFailed')}</p>
      </div>
    );
  }
  return <Skeleton className="aspect-[4/3] w-full" />;
}
