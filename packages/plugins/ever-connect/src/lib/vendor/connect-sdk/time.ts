// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/time.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * The one time format of the key manifest (`not_before`, `not_after`): RFC 3339 in UTC,
 * `YYYY-MM-DDTHH:MM:SS[.fraction]Z`, a day that exists, no leap second. Both SDKs parse it with this
 * rule; anything else is refused, never read as "no limit".
 */
const UTC_TIME = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(\.[0-9]{1,9})?Z$/;

const daysIn = (year: number, month: number) =>
  month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;

/** Unix seconds (the fraction dropped) of a UTC time in the manifest's format, or null. */
export function parseUtcTime(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const m = UTC_TIME.exec(text);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number) as [number, number, number, number, number, number];
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month) || hour > 23 || minute > 59 || second > 59) return null;
  return daysFromCivil(year, month, day) * 86400 + hour * 3600 + minute * 60 + second;
}

/** Days since 1970-01-01 of a proleptic Gregorian date (the algorithm the Rust crate uses too). */
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
