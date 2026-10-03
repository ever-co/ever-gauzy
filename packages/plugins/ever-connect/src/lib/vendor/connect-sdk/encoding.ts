// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/encoding.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/** Byte helpers shared by the signers and verifiers (Node's Buffer; no other dependency). */
import { createHash } from 'node:crypto';

/** base64url without padding. */
export const b64url = (bytes: Uint8Array | string): string => Buffer.from(bytes).toString('base64url');

/** The bytes of a base64url string, or null when it is not canonical base64url without padding. */
export function fromB64url(text: string): Uint8Array | null {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const bytes = Buffer.from(text, 'base64url');
  // A canonical encoding round-trips: trailing bits and padding variants are refused.
  return b64url(bytes) === text ? new Uint8Array(bytes) : null;
}

export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

export const sha256 = (bytes: Uint8Array | string): Uint8Array => new Uint8Array(createHash('sha256').update(bytes).digest());

export const sha256Hex = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');

/** A ULID (Crockford base32, 26 characters, upper case). */
export const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
