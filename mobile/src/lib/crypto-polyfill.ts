import * as ExpoCrypto from "expo-crypto";

// Hermes has no Web Crypto; the transfer cipher (noble) needs a secure random source, so lend it the OS one.
const g = globalThis as { crypto?: { getRandomValues?: unknown } };
g.crypto ??= {};
g.crypto.getRandomValues ??= ExpoCrypto.getRandomValues;
