import { openUrl } from '@tauri-apps/plugin-opener';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, LogIn, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { locale } from '@/lib/i18n';
import { loginInput, startLogin } from '../api';
import { solverOf } from '../solvers';
import type { SolverId } from '../types';

/** Shown when the CLI isn't installed: the one-line install command and a link to the docs. */
export function InstallGuide({ solver }: { solver: SolverId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const s = solverOf(solver);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col items-start gap-3 px-3 py-4">
      <p className="text-md text-ink-2">{t('solve.notInstalledTitle', { name: s.name })}</p>
      <p className="text-sm text-muted">{s.install[locale]}</p>
      <div className="flex w-full items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-sm bg-paper-2 px-3 py-2 font-mono text-sm text-ink" title={s.installCmd}>
          {s.installCmd}
        </code>
        <Button
          variant="ghost"
          onClick={() => void navigator.clipboard.writeText(s.installCmd).then(() => setCopied(true))}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? t('ui.copied') : t('ui.copy')}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={() => void qc.invalidateQueries({ queryKey: ['solve-cli'] })}>
          <RefreshCw />
          {t('solve.recheck')}
        </Button>
        <Button variant="ghost" onClick={() => void openUrl(s.docsUrl)}>
          <ExternalLink />
          {t('solve.openDocs')}
        </Button>
      </div>
    </div>
  );
}

/** Starts the CLI's browser sign-in from inside the app, opens the URL, and (fallback) takes a pasted code. */
export function AuthPanel({ solver, onDone }: { solver: SolverId; onDone: () => void }) {
  const { t } = useTranslation();
  const s = solverOf(solver);
  const [running, setRunning] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const runIdRef = useRef<string | null>(null);

  const login = () => {
    const runId = crypto.randomUUID();
    runIdRef.current = runId;
    setLines([]);
    setUrl(null);
    setRunning(true);
    startLogin({ runId, solver }, (e) => {
      if (e.type === 'stdout' || e.type === 'stderr') {
        setLines((prev) => [...prev, e.line]);
        const m = e.line.match(/https?:\/\/\S+/);
        if (m) {
          setUrl((prev) => prev ?? m[0]);
          void openUrl(m[0]);
        }
      } else if (e.type === 'exit') {
        setRunning(false);
        onDone(); // re-check auth status; if still signed out, this panel stays
      }
    }).catch(() => setRunning(false));
  };

  const submitCode = () => {
    const runId = runIdRef.current;
    if (runId && code.trim()) void loginInput(runId, code.trim());
    setCode('');
  };

  return (
    <div className="flex flex-col items-start gap-3 px-3 py-4">
      <p className="text-md text-ink-2">{t('solve.signInTitle', { name: s.name })}</p>
      <p className="text-sm text-muted">{t('solve.signInHint')}</p>
      {!running ? (
        <Button variant="primary" onClick={login}>
          <LogIn />
          {t('solve.signIn', { name: s.name })}
        </Button>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> {t('solve.signingIn')}
          </div>
          <div className="flex items-center gap-2">
            {url && (
              <Button variant="ghost" onClick={() => void openUrl(url)}>
                <ExternalLink />
                {t('solve.openSignInPage')}
              </Button>
            )}
            {/* Safety net: return to the chat and re-check, in case the CLI doesn't exit on its own after the browser. */}
            <Button variant="primary" onClick={onDone}>
              <Check />
              {t('solve.signedInContinue')}
            </Button>
          </div>
          {/* Fallback for flows that show a code instead of redirecting. */}
          <div className="flex w-full items-center gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('solve.pasteCode')} className="flex-1" />
            <Button variant="ghost" onClick={submitCode} disabled={!code.trim()}>
              {t('solve.submitCode')}
            </Button>
          </div>
        </>
      )}
      {lines.length > 0 && (
        <pre className="max-h-32 w-full overflow-auto rounded-sm bg-paper-2 p-2 font-mono text-xs whitespace-pre-wrap text-muted">{lines.join('\n')}</pre>
      )}
    </div>
  );
}
