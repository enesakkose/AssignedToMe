import { describe, expect, test } from 'bun:test';
import type { Connection } from './types';
import {
  decryptTransfer,
  encryptTransfer,
  formatTransferCode,
  isTransferCode,
  newTransferCode,
  normalizeTransferCode,
  TransferError,
  TRANSFER_TTL_MS,
} from './transfer';

const board: Connection = {
  id: 'c1',
  providerId: 'github',
  name: 'GitHub',
  values: { token: 'ghp_secret_value' },
};
const known = [
  { id: 'github', fields: [{ key: 'token', label: { en: 'Token', tr: 'Token' }, type: 'secret' as const }] },
  { id: 'jira', fields: [] },
];

describe('transfer', () => {
  test('codes are 8 Crockford characters and read forgivingly', () => {
    const code = newTransferCode();
    expect(isTransferCode(code)).toBe(true);
    expect(formatTransferCode('7K2M9QXD')).toBe('7K2M-9QXD');
    expect(normalizeTransferCode('7k2m-9qxd')).toBe('7K2M9QXD');
    expect(normalizeTransferCode('O1IL')).toBe('0111');
    expect(isTransferCode('short')).toBe(false);
  });

  test('round-trips boards with the right code, and hides the secret', async () => {
    const code = newTransferCode();
    const sealed = await encryptTransfer([board], code);
    expect(sealed.startsWith('AT1.')).toBe(true);
    expect(sealed).not.toContain('ghp_secret_value');
    expect(await decryptTransfer(sealed, formatTransferCode(code).toLowerCase(), known)).toEqual([board]);
  });

  const failsWith = async (p: Promise<unknown>, code: string) => {
    const error = await p.then(() => undefined, (e: unknown) => e);
    expect(error).toBeInstanceOf(TransferError);
    expect((error as TransferError).code).toBe(code as TransferError['code']);
  };

  test('refuses a wrong code, a tampered or foreign text, and an old transfer', async () => {
    const code = newTransferCode();
    const sealed = await encryptTransfer([board], code, 1_000_000);
    await failsWith(decryptTransfer(sealed, newTransferCode(), known, 1_000_000), 'wrong_code');
    const flipped = sealed.slice(0, -4) + (sealed.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    await failsWith(decryptTransfer(flipped, code, known, 1_000_000), 'wrong_code');
    await failsWith(decryptTransfer('hello', code, known), 'invalid');
    await failsWith(decryptTransfer(sealed, code, known, 1_000_000 + TRANSFER_TTL_MS + 1), 'expired');
  });

  test('keeps only known providers and their own fields', async () => {
    const code = newTransferCode();
    const extra = { ...board, values: { ...board.values, junk: 'x' } };
    const sealed = await encryptTransfer([extra, { ...board, id: 'c2', providerId: 'nope' }], code);
    expect(await decryptTransfer(sealed, code, known)).toEqual([board]);
  });

  test('refuses ids that could not be a safe account name', async () => {
    const code = newTransferCode();
    const sealed = await encryptTransfer([{ ...board, id: '../evil:id' }], code);
    const error = await decryptTransfer(sealed, code, known).catch((e: unknown) => e);
    expect((error as TransferError).code).toBe('invalid');
  });
});
