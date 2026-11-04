import {
  decryptTransfer,
  encryptTransfer,
  formatTransferCode,
  getProvider,
  isTransferCode,
  newTransferCode,
  providers,
  TRANSFER_QR_LIMIT,
  TransferError,
} from '@mytask/core';
import { useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ProviderLogo } from '@/components/ui/provider-logo';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { saveConnection, withSecrets, type StoredConnection } from '../api/connections';
import { connectionsKey } from '../hooks/use-connections';

const transferErrorKey = (e: unknown) =>
  e instanceof TransferError ? (({ wrong_code: 'transfer.wrongCode', expired: 'transfer.expired', invalid: 'transfer.invalid' }) as const)[e.code] : 'errors.generic';

/** The QR as SVG squares drawn from its matrix (no markup strings, no canvas). */
function Qr({ text }: { text: string }) {
  const path = useMemo(() => {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: 'L' });
    let d = '';
    for (let y = 0; y < modules.size; y++)
      for (let x = 0; x < modules.size; x++) if (modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return { d, size: modules.size };
  }, [text]);
  // A quiet zone of 4 modules and black on white whatever the theme: phone cameras read it best that way.
  return (
    <svg
      viewBox={`-4 -4 ${path.size + 8} ${path.size + 8}`}
      className="aspect-square w-full max-w-72 self-center rounded-input bg-white"
      shapeRendering="crispEdges"
      role="img"
    >
      <path d={path.d} fill="#000" />
    </svg>
  );
}

/** Desktop → phone: enter the code the phone shows, pick boards, show them as an encrypted QR. */
export function SendToPhoneDialog({ boards, open, onOpenChange }: { boards: StoredConnection[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [picked, setPicked] = useState(() => new Set(boards.map((b) => b.id)));
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = (next: boolean) => {
    if (next) return onOpenChange(true);
    // Nothing of the transfer outlives the dialog.
    setQr(null);
    setCode('');
    setError(null);
    onOpenChange(false);
  };

  const show = async () => {
    if (!isTransferCode(code)) return setError(t('transfer.codeInvalid'));
    setBusy(true);
    setError(null);
    try {
      // Secrets are read from Keychain only for this, and leave the app only inside the encrypted text.
      const full = await Promise.all(boards.filter((b) => picked.has(b.id)).map(withSecrets));
      const sealed = await encryptTransfer(full, code);
      if (sealed.length > TRANSFER_QR_LIMIT) setError(t('transfer.tooMany'));
      else setQr(sealed);
    } catch (e) {
      setError(t(transferErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={t('transfer.sendTitle')}
      description={qr ? t('transfer.scan') : t('transfer.sendStep')}
      footer={
        qr ? (
          <Button size="sm" onClick={() => close(false)}>
            {t('ui.close')}
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={() => close(false)}>
              {t('ui.cancel')}
            </Button>
            <Button size="sm" variant="primary" loading={busy} disabled={!picked.size} onClick={() => void show()}>
              {t('transfer.showQr')}
            </Button>
          </>
        )
      }
    >
      {qr ? (
        <Qr text={qr} />
      ) : (
        <div className="flex flex-col gap-3">
          <Field label={t('transfer.code')} error={error ?? undefined}>
            <Input
              value={code}
              onValueChange={setCode}
              placeholder="XXXX-XXXX"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase tracking-widest"
              maxLength={9}
              onKeyDown={(e) => e.key === 'Enter' && void show()}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-sm font-medium text-ink-2">{t('transfer.boards')}</span>
            {boards.map((b) => {
              const provider = getProvider(b.providerId);
              return (
                <label key={b.id} className="flex items-center gap-2.5 text-md">
                  {provider && <ProviderLogo provider={provider} size="sm" />}
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  <Switch
                    checked={picked.has(b.id)}
                    onCheckedChange={(on) =>
                      setPicked((s) => {
                        const next = new Set(s);
                        if (on) next.add(b.id);
                        else next.delete(b.id);
                        return next;
                      })
                    }
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Phone → desktop: show a code for the phone to encrypt with, then paste what the phone copied. */
export function ReceiveFromPhoneDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [code, setCode] = useState(newTransferCode);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = (next: boolean) => {
    if (next) return onOpenChange(true);
    // A new code every time the dialog opens: one code, one transfer.
    setCode(newTransferCode());
    setText('');
    setError(null);
    onOpenChange(false);
  };

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const incoming = await decryptTransfer(text, code, providers);
      if (!incoming.length) return setError(t('transfer.noBoards'));
      // The same board sent again replaces the saved one (same id); new ones are added. Secrets go to Keychain.
      for (const c of incoming) await saveConnection(c);
      await qc.invalidateQueries({ queryKey: connectionsKey });
      for (const c of incoming) void qc.invalidateQueries({ queryKey: ['tasks', c.id] });
      toast.success(t('transfer.imported', { count: incoming.length }));
      close(false);
    } catch (e) {
      setError(t(transferErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={t('transfer.receiveTitle')}
      description={t('transfer.receiveStep')}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={() => close(false)}>
            {t('ui.cancel')}
          </Button>
          <Button size="sm" variant="primary" loading={busy} disabled={!text.trim()} onClick={() => void add()}>
            {t('transfer.import')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p data-selectable className="cut self-center border border-rule bg-paper-2 px-5 py-3 font-mono text-2xl tracking-[0.2em] text-ink">
          {formatTransferCode(code)}
        </p>
        <Field label={t('transfer.paste')} error={error ?? undefined}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} spellCheck={false} className="font-mono text-xs" />
        </Field>
      </div>
    </Dialog>
  );
}
