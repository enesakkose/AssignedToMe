import { ProviderError } from '@mytask/core';
import type { TFunction } from 'i18next';

/** User-facing text for a failed provider call. Details come from our own messages or the server's error text, never credentials. */
export function errorText(error: unknown, t: TFunction, appName?: string): string {
  // The board's own name ("GitHub", "Jira") so messages name the right tool; a generic word when no board is known.
  const app = appName ?? t('errors.source');
  // Unexpected failures carry a short technical detail (status, the server's message or the field that didn't match).
  if (!(error instanceof ProviderError)) return t('errors.genericWithDetail', { detail: error instanceof Error ? error.message : String(error) });
  switch (error.code) {
    case 'unauthorized':
      return error.status === 403 ? t('errors.forbidden', { app }) : t('errors.unauthorized');
    case 'captcha':
      return t('errors.captcha', { app });
    case 'blocked':
      // A company proxy or firewall answered instead of the API; the request never reached it.
      return t('errors.blocked', { app });
    case 'not_found':
      return t('errors.notFound', { app });
    case 'network':
      return t('errors.network');
    case 'rate_limited':
      return t('errors.rateLimited', { app });
    case 'invalid_input':
      return t('errors.invalidInput');
    case 'invalid_response':
      return t('errors.genericWithDetail', { detail: error.message });
    default:
      return t('errors.genericWithDetail', { detail: error.message });
  }
}
