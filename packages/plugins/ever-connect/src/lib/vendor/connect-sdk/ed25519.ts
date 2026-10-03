// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/ed25519.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * Edwards25519 point checks the signature verifier needs beyond `node:crypto`: whether a 32-byte
 * encoding is a point of the curve, and whether that point has small order (`[8]P` is the identity).
 * A small-order public key verifies forged signatures, and a small-order `R` is a malleability
 * vector; the Rust crate refuses both (`verify_strict`, `is_weak`), and so does this module, with
 * the same decoding rule (the y coordinate is read modulo p, as `curve25519-dalek` reads it).
 */

const P = 2n ** 255n - 19n;
const mod = (a: bigint) => {
  const r = a % P;
  return r >= 0n ? r : r + P;
};
function pow(base: bigint, exp: bigint): bigint {
  let result = 1n;
  let b = mod(base);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = mod(result * b);
    b = mod(b * b);
    e >>= 1n;
  }
  return result;
}
const inv = (a: bigint) => pow(a, P - 2n);
const D = mod(-121665n * inv(121666n));
const SQRT_M1 = pow(2n, (P - 1n) / 4n);

interface Point {
  x: bigint;
  y: bigint;
  z: bigint;
  t: bigint;
}

/** The point of a 32-byte encoding, or null when it is not on the curve. */
function decompress(bytes: Uint8Array): Point | null {
  if (bytes.length !== 32) return null;
  let y = 0n;
  for (let i = 31; i >= 0; i -= 1) y = (y << 8n) | BigInt(i === 31 ? (bytes[i] as number) & 0x7f : (bytes[i] as number));
  const sign = ((bytes[31] as number) >> 7) & 1;
  y = mod(y);
  const y2 = mod(y * y);
  const u = mod(y2 - 1n);
  const v = mod(D * y2 + 1n);
  // x = u v^3 (u v^7)^((p-5)/8)
  const v3 = mod(v * v * v);
  let x = mod(u * v3 * pow(u * v3 * v3 * v, (P - 5n) / 8n));
  const vx2 = mod(v * x * x);
  if (vx2 !== u) {
    if (vx2 === mod(-u)) x = mod(x * SQRT_M1);
    else return null;
  }
  if (Number(x & 1n) !== sign) x = mod(-x);
  return { x, y, z: 1n, t: mod(x * y) };
}

function double(p: Point): Point {
  const a = mod(p.x * p.x);
  const b = mod(p.y * p.y);
  const c = mod(2n * p.z * p.z);
  const d = mod(-a);
  const e = mod((p.x + p.y) * (p.x + p.y) - a - b);
  const g = mod(d + b);
  const f = mod(g - c);
  const h = mod(d - b);
  return { x: mod(e * f), y: mod(g * h), t: mod(e * h), z: mod(f * g) };
}

/** Whether `bytes` encodes a point of the curve. */
export const isCurvePoint = (bytes: Uint8Array): boolean => decompress(bytes) !== null;

/** Whether `bytes` encodes a point of small order (false when it is not a point at all). */
export function isSmallOrder(bytes: Uint8Array): boolean {
  const p = decompress(bytes);
  if (!p) return false;
  const q = double(double(double(p)));
  return q.x === 0n && q.y === q.z;
}
