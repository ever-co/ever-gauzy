import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { OidcError } from './errors';
import { loadJose } from './jose-loader';
import { OIDC_MODULE_OPTIONS, OidcModuleOptions } from './oidc-module.options';
import { OidcBeginOptions, OidcTransaction, OidcTransactionCookieOptions } from './oidc.types';
import { createCodeVerifier, randomBase64Url } from './pkce';

/** A transaction is valid for 10 minutes. */
export const OIDC_TRANSACTION_TTL_MS = 10 * 60 * 1000;

/** Default cookie path: only the API's auth routes ever receive the cookie. */
export const OIDC_TRANSACTION_COOKIE_PATH = '/api/auth';

/** JOSE `typ` of the transaction token, so no other token type can be replayed as a transaction. */
const TRANSACTION_TYPE = 'gauzy-oidc-txn+jwt';

/** Label of the key derivation; changing it invalidates every transaction in flight. */
const KEY_DERIVATION_LABEL = 'gauzy-oidc-transaction-v1';

/** Upper bound of remembered (consumed) states per process. */
const MAX_CONSUMED_STATES = 10_000;

/** The parts of an Express request the service reads. */
export interface OidcCookieRequest {
	headers: Record<string, string | string[] | undefined>;
	cookies?: Record<string, string>;
}

/** The parts of an Express response the service writes. */
export interface OidcCookieResponse {
	cookie(name: string, value: string, options: Record<string, unknown>): unknown;
	clearCookie(name: string, options: Record<string, unknown>): unknown;
}

/**
 * Reads one cookie from a request, with or without `cookie-parser`.
 *
 * @param request - The incoming request.
 * @param name - Cookie name.
 * @returns The decoded value, or `undefined`.
 */
export function readCookie(request: OidcCookieRequest, name: string): string | undefined {
	const parsed = request.cookies?.[name];
	if (typeof parsed === 'string' && parsed) {
		return parsed;
	}
	const header = request.headers?.cookie;
	const raw = Array.isArray(header) ? header.join(';') : header;
	if (!raw) {
		return undefined;
	}
	for (const part of raw.split(';')) {
		const separator = part.indexOf('=');
		if (separator < 0) {
			continue;
		}
		if (part.slice(0, separator).trim() === name) {
			const value = part.slice(separator + 1).trim();
			try {
				return decodeURIComponent(value);
			} catch {
				return undefined;
			}
		}
	}
	return undefined;
}

/**
 * Compares two strings in constant time.
 *
 * @param a - First value.
 * @param b - Second value.
 * @returns `true` when both are equal.
 */
export function constantTimeEquals(a: string, b: string): boolean {
	const left = Buffer.from(String(a), 'utf8');
	const right = Buffer.from(String(b), 'utf8');
	return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Keeps `state`, `nonce` and the PKCE verifier of an authorization request in a signed cookie.
 *
 * A cookie (rather than process memory or a shared session) works across API replicas without
 * shared state and keeps two concurrent sign-ins in two tabs apart. The cookie is `HttpOnly`,
 * `SameSite=Lax`, scoped to `/api/auth` and valid for 10 minutes; its value is a compact JWS signed
 * with a key derived from the platform secret. `complete()` accepts a transaction once: it clears
 * the cookie and remembers the consumed `state` for the rest of its lifetime.
 */
@Injectable()
export class OidcTransactionService {
	private readonly key: Uint8Array;
	private readonly consumed = new Map<string, number>();

	constructor(@Inject(OIDC_MODULE_OPTIONS) options: OidcModuleOptions) {
		if (!options?.transactionSecret) {
			throw new Error('The OIDC library needs a transaction secret.');
		}
		this.key = new Uint8Array(
			createHmac('sha256', options.transactionSecret).update(KEY_DERIVATION_LABEL).digest()
		);
	}

	/**
	 * Creates a transaction and writes it into the cookie.
	 *
	 * @param response - The response that redirects to the issuer.
	 * @param cookie - Cookie name and flags.
	 * @param options - Issuer, mode and payload of the request.
	 * @returns The transaction (its `state`, `nonce` and verifier go into the authorize URL).
	 */
	async begin(
		response: OidcCookieResponse,
		cookie: OidcTransactionCookieOptions,
		options: OidcBeginOptions
	): Promise<OidcTransaction> {
		const transaction: OidcTransaction = {
			issuer: options.issuer,
			state: randomBase64Url(32),
			nonce: randomBase64Url(32),
			codeVerifier: createCodeVerifier(),
			mode: options.mode,
			payload: options.payload,
			createdAt: this.now()
		};

		const jose = await loadJose();
		const token = await new jose.SignJWT({
			iss: transaction.issuer,
			st: transaction.state,
			nn: transaction.nonce,
			cv: transaction.codeVerifier,
			md: transaction.mode,
			...(transaction.payload ? { pl: transaction.payload } : {})
		})
			.setProtectedHeader({ alg: 'HS256', typ: TRANSACTION_TYPE })
			.setIssuedAt(Math.floor(transaction.createdAt / 1000))
			.setExpirationTime(Math.floor((transaction.createdAt + OIDC_TRANSACTION_TTL_MS) / 1000))
			.sign(this.key);

		response.cookie(cookie.name, token, {
			...this.cookieFlags(cookie),
			maxAge: OIDC_TRANSACTION_TTL_MS
		});

		return transaction;
	}

	/**
	 * Reads, verifies and consumes the transaction of a callback.
	 *
	 * @param request - The callback request (carries the cookie).
	 * @param response - The callback response (the cookie is cleared on it).
	 * @param cookie - Cookie name and flags.
	 * @param state - The `state` query parameter of the callback.
	 * @returns The transaction.
	 * @throws OidcError `state_mismatch` for a missing, tampered, expired, foreign or replayed transaction.
	 */
	async complete(
		request: OidcCookieRequest,
		response: OidcCookieResponse,
		cookie: OidcTransactionCookieOptions,
		state: string
	): Promise<OidcTransaction> {
		const token = readCookie(request, cookie.name);
		response.clearCookie(cookie.name, this.cookieFlags(cookie));

		if (!token || typeof state !== 'string' || !state) {
			throw new OidcError('state_mismatch', 'No transaction for this callback');
		}

		let claims: Record<string, unknown>;
		try {
			const jose = await loadJose();
			const verified = await jose.jwtVerify(token, this.key, {
				algorithms: ['HS256'],
				typ: TRANSACTION_TYPE,
				currentDate: new Date(this.now())
			});
			claims = verified.payload as Record<string, unknown>;
		} catch {
			throw new OidcError('state_mismatch', 'Transaction cookie is invalid or expired');
		}

		const createdAt = Number(claims['iat']) * 1000;
		if (!Number.isFinite(createdAt) || this.now() - createdAt > OIDC_TRANSACTION_TTL_MS) {
			throw new OidcError('state_mismatch', 'Transaction expired');
		}

		const expected = String(claims['st'] ?? '');
		if (!constantTimeEquals(expected, state)) {
			throw new OidcError('state_mismatch', 'State does not match');
		}

		if (!this.consume(expected)) {
			throw new OidcError('state_mismatch', 'Transaction was already used');
		}

		const payload = claims['pl'];
		return {
			issuer: String(claims['iss'] ?? ''),
			state: expected,
			nonce: String(claims['nn'] ?? ''),
			codeVerifier: String(claims['cv'] ?? ''),
			mode: String(claims['md'] ?? ''),
			payload: payload && typeof payload === 'object' ? (payload as Record<string, string>) : undefined,
			createdAt
		};
	}

	/** Current time in milliseconds; a method so tests can move the clock. */
	protected now(): number {
		return Date.now();
	}

	private cookieFlags(cookie: OidcTransactionCookieOptions): Record<string, unknown> {
		return {
			httpOnly: true,
			secure: !!cookie.secure,
			sameSite: 'lax',
			path: cookie.path ?? OIDC_TRANSACTION_COOKIE_PATH
		};
	}

	/**
	 * Records a state as used. Returns `false` when it was used before.
	 *
	 * Only a digest is kept, for the transaction lifetime, with a fixed upper bound per process.
	 */
	private consume(state: string): boolean {
		const now = this.now();
		for (const [digest, expiresAt] of this.consumed) {
			if (expiresAt > now && this.consumed.size < MAX_CONSUMED_STATES) {
				break;
			}
			this.consumed.delete(digest);
		}
		const digest = createHash('sha256').update(state).digest('base64url');
		if (this.consumed.has(digest)) {
			return false;
		}
		this.consumed.set(digest, now + OIDC_TRANSACTION_TTL_MS);
		return true;
	}
}
