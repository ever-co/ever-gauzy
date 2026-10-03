// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/local.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * Local hosts: the only places where plain `http://`, extra root keys and another issuer are
 * accepted (CI positive controls, the mock platform, a development build). The list comes from
 * `CONSTANTS.root_keys_file_hosts`.
 */
import { CONSTANTS } from '../connect-contracts';

function ipv4(host: string): number | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^(0|[1-9][0-9]{0,2})$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n;
}

function inCidr(address: number, cidr: string): boolean {
  const [base, bits] = cidr.split('/') as [string, string];
  const start = ipv4(base);
  if (start === null) return false;
  const size = 2 ** (32 - Number(bits));
  return address >= start && address < start + size;
}

/** Whether `hostname` (as `URL.hostname` gives it) is a local host. */
export function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  const address = ipv4(host);
  for (const entry of CONSTANTS.root_keys_file_hosts) {
    if (entry.startsWith('*.')) {
      if (host.endsWith(entry.slice(1)) && host.length > entry.length - 1) return true;
    } else if (entry.includes('/')) {
      if (address !== null && inCidr(address, entry)) return true;
    } else if (host === entry) return true;
  }
  return false;
}

/** Whether a URL points at a local host. */
export function isLocalUrl(url: string): boolean {
  try {
    return isLocalHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

const AUTHORITY = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]*)/;

/**
 * The origin of an http(s) URL (`https://api.ever.co`), or null. The rule both SDKs share
 * (vectors in `contracts/fixtures/keys/origins.json`): the authority holds only ASCII letters,
 * digits and `. _ - : [ ]` (so userinfo, percent-escapes, backslashes, spaces and hosts that are
 * not ASCII are refused); the URL standard's origin otherwise, except that a host it would
 * rewrite (an IPv4 address not in dotted-decimal form, an IPv6 address not in its shortest form)
 * is refused.
 */
export function originOf(url: string): string | null {
  const m = AUTHORITY.exec(url);
  if (!m || !/^[A-Za-z0-9._:[\]-]*$/.test(m[1] as string)) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const authority = (m[1] as string).toLowerCase();
  const colon = authority.lastIndexOf(':');
  const host = colon >= 0 && !authority.slice(colon).includes(']') ? authority.slice(0, colon) : authority;
  return u.hostname === host ? u.origin : null;
}

let warned = false;
/** Writes one warning per process (the override rules say "ignored with one warning"). */
export function warnOnce(message: string, sink: (message: string) => void = (m) => console.warn(m)): void {
  if (warned) return;
  warned = true;
  sink(message);
}
