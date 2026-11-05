import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { randomBytes } from '@noble/ciphers/utils.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { z } from 'zod';
import type { Connection, Provider } from './types';

/**
 * Moving boards (with their secrets) between devices without a server: the receiving device shows a one-time code,
 * the sending device encrypts with it, and the result travels as a QR (desktop → phone) or pasted text (phone →
 * desktop). The QR or text alone is useless: the code never leaves the receiver's screen.
 *
 * Format: "AT1." + base64(salt[16] | nonce[24] | xchacha20poly1305 ciphertext+tag), key = scrypt(code, salt).
 */

const PREFIX = 'AT1.';
const AAD = new TextEncoder().encode('AT1');
// Crockford base32: no I, L, O, U, so a code read aloud or typed can't be mistaken. 8 characters = 40 bits.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 8;
// ~50 ms on a Mac, a few hundred on a phone; makes guessing the 40-bit code offline slow.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, dkLen: 32 } as const;
/** A transfer older than this is refused, so a QR photographed now is worthless later. */
export const TRANSFER_TTL_MS = 10 * 60_000;
/** A single QR holds about this many characters reliably; the sender is told to pick fewer boards beyond it. */
export const TRANSFER_QR_LIMIT = 2_300;

export type TransferErrorCode = 'invalid' | 'wrong_code' | 'expired';

/** Never carries any part of the payload or the code. */
export class TransferError extends Error {
  constructor(readonly code: TransferErrorCode) {
    super(`Transfer ${code}`);
    this.name = 'TransferError';
  }
}

/** A fresh one-time code, e.g. "7K2M9QXD". */
export function newTransferCode(): string {
  return [...randomBytes(CODE_LENGTH)].map((b) => ALPHABET[b & 31]).join('');
}

/** "7K2M9QXD" → "7K2M-9QXD", for reading. */
export const formatTransferCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** What the user typed, made comparable: case, spaces and dashes don't matter; O reads as 0, I and L as 1. */
export function normalizeTransferCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export const isTransferCode = (input: string) =>
  new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`).test(normalizeTransferCode(input));

const text = z.string().max(4096);
const payloadSchema = z.object({
  v: z.literal(1),
  at: z.number(),
  connections: z
    .array(
      z.object({
        // Becomes part of a Keychain/SecureStore account name on the receiving side.
        id: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),
        providerId: text.min(1),
        name: text,
        values: z.record(z.string(), text),
      }),
    )
    .min(1)
    .max(50),
});

const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const deriveKey = (code: string, salt: Uint8Array) => scryptAsync(normalizeTransferCode(code), salt, SCRYPT);

/** Encrypts boards (secrets included) for the device that showed `code`. */
export async function encryptTransfer(connections: Connection[], code: string, now = Date.now()): Promise<string> {
  if (!isTransferCode(code)) throw new TransferError('wrong_code');
  const salt = randomBytes(16);
  const nonce = randomBytes(24);
  const key = await deriveKey(code, salt);
  const plain = new TextEncoder().encode(JSON.stringify({ v: 1, at: now, connections }));
  const sealed = xchacha20poly1305(key, nonce, AAD).encrypt(plain);
  const out = new Uint8Array(salt.length + nonce.length + sealed.length);
  out.set(salt);
  out.set(nonce, salt.length);
  out.set(sealed, salt.length + nonce.length);
  return PREFIX + toBase64(out);
}

/**
 * Opens a transfer with this device's code. Throws TransferError: `invalid` (not a transfer, or tampered),
 * `wrong_code`, or `expired`. Only boards of providers this app knows come back, with only those providers' fields.
 */
export async function decryptTransfer(
  input: string,
  code: string,
  known: (Pick<Provider, 'id' | 'fields'> & Partial<Pick<Provider, 'signIn'>>)[],
  now = Date.now(),
): Promise<Connection[]> {
  const trimmed = input.trim();
  if (!trimmed.startsWith(PREFIX)) throw new TransferError('invalid');
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(trimmed.slice(PREFIX.length));
  } catch {
    throw new TransferError('invalid');
  }
  if (bytes.length < 16 + 24 + 16 + 1) throw new TransferError('invalid');
  const key = await deriveKey(code, bytes.subarray(0, 16));
  let plain: Uint8Array;
  try {
    plain = xchacha20poly1305(key, bytes.subarray(16, 40), AAD).decrypt(bytes.subarray(40));
  } catch {
    // The tag only checks out with the right code: a wrong code and a tampered transfer look the same.
    throw new TransferError('wrong_code');
  }
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new TransferError('invalid');
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) throw new TransferError('invalid');
  const age = now - parsed.data.at;
  if (age > TRANSFER_TTL_MS || age < -60_000) throw new TransferError('expired');
  return parsed.data.connections.flatMap((c) => {
    const provider = known.find((p) => p.id === c.providerId);
    if (!provider) return [];
    // A signed-in board arrives without a sign-in even if the sender included one: this device signs in itself.
    const own = provider.fields.filter((f) => !provider.signIn || (f.type !== 'secret' && !f.session));
    const values = Object.fromEntries(own.flatMap((f) => (f.key in c.values ? [[f.key, c.values[f.key]!]] : [])));
    return [{ ...c, values }];
  });
}
