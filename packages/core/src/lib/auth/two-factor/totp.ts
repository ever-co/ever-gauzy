// cspell:ignore hotp otpauth
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time passwords (RFC 6238 over the HOTP of RFC 4226), with the defaults every authenticator app reads
 * from an `otpauth://totp` address: HMAC-SHA-1, six digits, 30-second steps.
 */

/** Length of a step, in seconds. */
export const TOTP_PERIOD_SECONDS = 30;

/** Digits of a code. */
export const TOTP_DIGITS = 6;

/** Steps accepted on each side of the current one, so that a phone clock up to 30 s off still works. */
export const TOTP_ACCEPTED_DRIFT_STEPS = 1;

/** 160 bits, the secret length RFC 4226 recommends for HMAC-SHA-1. */
export const TOTP_SECRET_BYTES = 20;

/** The RFC 4648 base32 alphabet, in which authenticator apps take secrets. */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes bytes in base32, without padding (authenticator apps accept it, and people type it).
 *
 * @param bytes The bytes to encode.
 * @returns The base32 text.
 */
export function encodeBase32(bytes: Buffer): string {
	let bits = 0;
	let value = 0;
	let output = '';
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) {
		output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
	}
	return output;
}

/**
 * Decodes base32 text, ignoring case, spaces and padding.
 *
 * @param text The base32 text.
 * @returns The bytes.
 * @throws Error when a character is not in the base32 alphabet.
 */
export function decodeBase32(text: string): Buffer {
	const cleaned = text.toUpperCase().replace(/[\s=]/g, '');
	let bits = 0;
	let value = 0;
	const bytes: number[] = [];
	for (const character of cleaned) {
		const index = BASE32_ALPHABET.indexOf(character);
		if (index === -1) {
			throw new Error('Invalid base32 character');
		}
		value = (value << 5) | index;
		bits += 5;
		if (bits >= 8) {
			bytes.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return Buffer.from(bytes);
}

/** A new random secret, in base32. */
export function generateTotpSecret(): string {
	return encodeBase32(randomBytes(TOTP_SECRET_BYTES));
}

/**
 * The HOTP value of a counter (RFC 4226, section 5.3).
 *
 * @param secret The shared secret.
 * @param counter The moving factor.
 * @returns The code, left-padded with zeros to six digits.
 */
export function hotp(secret: Buffer, counter: number): string {
	const message = Buffer.alloc(8);
	message.writeBigUInt64BE(BigInt(counter));
	const digest = createHmac('sha1', secret).update(message).digest();
	const offset = digest[digest.length - 1] & 0x0f;
	const binary =
		((digest[offset] & 0x7f) << 24) |
		((digest[offset + 1] & 0xff) << 16) |
		((digest[offset + 2] & 0xff) << 8) |
		(digest[offset + 3] & 0xff);
	const code = binary % 10 ** TOTP_DIGITS;
	return String(code).padStart(TOTP_DIGITS, '0');
}

/**
 * The step a moment falls in, counted from the Unix epoch.
 *
 * @param epochMs The moment, in milliseconds.
 */
export function timeStepAt(epochMs: number): number {
	return Math.floor(epochMs / 1000 / TOTP_PERIOD_SECONDS);
}

/**
 * The code an authenticator app shows at a moment.
 *
 * @param secretBase32 The secret, in base32.
 * @param epochMs The moment, in milliseconds.
 */
export function totpAt(secretBase32: string, epochMs: number): string {
	return hotp(decodeBase32(secretBase32), timeStepAt(epochMs));
}

/**
 * The six digits of a typed code, without the spaces or dash some apps show in the middle; empty when it is not
 * six digits.
 *
 * @param code What the person typed.
 */
export function normalizeTotpCode(code: string | null | undefined): string {
	const digits = String(code ?? '').replace(/[\s-]/g, '');
	const isSixDigits = new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(digits);
	if (!isSixDigits) {
		return '';
	}
	return digits;
}

/**
 * The step whose code was typed, among the current step and the accepted drift around it, or null when none matches.
 *
 * Every candidate is compared, in constant time, whether or not an earlier one matched, so the answer time says
 * nothing about which step matched. The caller refuses a step it already accepted once (replay).
 *
 * @param secretBase32 The secret, in base32.
 * @param code What the person typed.
 * @param epochMs The moment of the check, in milliseconds.
 */
export function matchingTimeStep(secretBase32: string, code: string, epochMs: number): number | null {
	const typed = normalizeTotpCode(code);
	if (!typed) {
		return null;
	}
	const secret = decodeBase32(secretBase32);
	const current = timeStepAt(epochMs);
	let matched: number | null = null;
	for (let drift = -TOTP_ACCEPTED_DRIFT_STEPS; drift <= TOTP_ACCEPTED_DRIFT_STEPS; drift++) {
		const step = current + drift;
		const expected = hotp(secret, step);
		const isMatch = timingSafeEqual(Buffer.from(expected), Buffer.from(typed));
		if (isMatch) {
			matched = step;
		}
	}
	return matched;
}

/**
 * The `otpauth://totp/...` address an authenticator app reads from a QR code
 * (https://github.com/google/google-authenticator/wiki/Key-Uri-Format).
 *
 * A colon separates the issuer from the account in the label, so none is kept inside either.
 *
 * @param input The base32 secret, the account name (the email) and the issuer shown in the app.
 */
export function buildOtpauthUrl(input: { secret: string; accountName: string; issuer: string }): string {
	const issuer = input.issuer.replace(/:/g, '').trim();
	const accountName = input.accountName.replace(/:/g, '').trim();
	const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
	const parameters = [
		`secret=${input.secret}`,
		`issuer=${encodeURIComponent(issuer)}`,
		'algorithm=SHA1',
		`digits=${TOTP_DIGITS}`,
		`period=${TOTP_PERIOD_SECONDS}`
	];
	return `otpauth://totp/${label}?${parameters.join('&')}`;
}
