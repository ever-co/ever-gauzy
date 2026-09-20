import { Algorithm, JwtPayload, sign, SignOptions, verify } from 'jsonwebtoken';
import { environment } from '@gauzy/config';
import { ACCESS_TOKEN_TYPE } from '../access-token/type.token';

/**
 * The only signature algorithm our own JWTs are ever issued with. Every verify of a token we
 * signed pins it, so a token can never be accepted under a different (or no) algorithm.
 */
export const JWT_ALGORITHMS: Algorithm[] = ['HS256'];

/**
 * The claim that names what a JWT_SECRET-signed token is FOR. Password-reset tokens introduced it;
 * every other purpose-specific token now carries it too.
 */
export const TOKEN_PURPOSE_CLAIM = 'purpose';

/**
 * Every purpose-specific token is signed with the one shared JWT_SECRET, so the signature alone
 * says nothing about what a token may be used for. Without a purpose check a token minted for
 * one flow (an appointment link, an invite, an estimate) was accepted by another, and missing
 * claims were silently dropped from the ORM `where` (GHSA-28wv-vrxj-rp4q, GHSA-58x4-7mw9-gmqg).
 */
export enum TokenPurposeEnum {
	ACCESS = 'access',
	WORKSPACE_SIGNIN = 'workspace-signin',
	PASSWORD_RESET = 'password-reset',
	INVOICE_SHARE = 'invoice-share',
	ESTIMATE = 'estimate',
	APPOINTMENT = 'appointment',
	INVITE = 'invite',
	TEAM_JOIN = 'team-join'
}

export type PurposeTokenFailure = 'invalid' | 'expired' | 'purpose' | 'claims';

/**
 * Thrown by {@link verifyPurposeToken}. Callers map it to their own HTTP status; the message is
 * deliberately generic and never echoes library or payload details.
 */
export class PurposeTokenError extends Error {
	constructor(public readonly reason: PurposeTokenFailure) {
		super(reason === 'expired' ? 'Token has expired' : 'Invalid token');
		this.name = 'PurposeTokenError';
	}
}

export interface SignPurposeTokenOptions {
	/** Token lifetime, as accepted by jsonwebtoken (`'10m'`, `3600`, ...). Omit for no expiry. */
	expiresIn?: SignOptions['expiresIn'];
	/** Signing secret. Defaults to `environment.JWT_SECRET`. */
	secret?: string;
}

export interface VerifyPurposeTokenOptions {
	/** Claims that must be present as non-empty strings. */
	requiredClaims?: string[];
	/**
	 * Accept a token that carries no purpose claim at all (issued before purposes existed).
	 *
	 * Only for tokens that are ALSO matched against a stored row (invoice.token,
	 * estimate_email.token, invite.token), so a foreign token cannot match anything. Never for a
	 * token that is itself the proof of identity (workspace sign-in).
	 */
	allowLegacyUntyped?: boolean;
	/** Verification secret. Defaults to `environment.JWT_SECRET`. */
	secret?: string;
}

/**
 * True for a non-empty (after trimming) string.
 */
export function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Signs a purpose-typed token with HS256. The purpose claim always wins over a `purpose` key that
 * may be present in `claims`.
 */
export function signPurposeToken(
	purpose: TokenPurposeEnum,
	claims: Record<string, unknown>,
	options: SignPurposeTokenOptions = {}
): string {
	const signOptions: SignOptions = { algorithm: JWT_ALGORITHMS[0] };
	if (options.expiresIn !== undefined && options.expiresIn !== null) {
		signOptions.expiresIn = options.expiresIn;
	}
	return sign({ ...claims, [TOKEN_PURPOSE_CLAIM]: purpose }, options.secret ?? environment.JWT_SECRET, signOptions);
}

/**
 * Verifies a purpose-typed token: signature (HS256 only), expiry, purpose, and required claims.
 *
 * @throws {PurposeTokenError} on any failure.
 */
export function verifyPurposeToken<T extends object = Record<string, unknown>>(
	token: unknown,
	purpose: TokenPurposeEnum,
	options: VerifyPurposeTokenOptions = {}
): T & JwtPayload {
	if (!isNonEmptyString(token)) {
		throw new PurposeTokenError('invalid');
	}

	let payload: string | JwtPayload;
	try {
		payload = verify(token, options.secret ?? environment.JWT_SECRET, { algorithms: JWT_ALGORITHMS });
	} catch (error) {
		throw new PurposeTokenError(error?.name === 'TokenExpiredError' ? 'expired' : 'invalid');
	}

	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new PurposeTokenError('invalid');
	}

	const actual = payload[TOKEN_PURPOSE_CLAIM];
	if (actual === undefined || actual === null) {
		// A legacy token has no purpose, but access and refresh tokens carry `tokenType` instead:
		// they are never a legacy purpose token.
		if (!options.allowLegacyUntyped || payload['tokenType'] !== undefined) {
			throw new PurposeTokenError('purpose');
		}
	} else if (actual !== purpose) {
		throw new PurposeTokenError('purpose');
	}

	for (const claim of options.requiredClaims ?? []) {
		if (!isNonEmptyString(payload[claim])) {
			throw new PurposeTokenError('claims');
		}
	}

	return payload as T & JwtPayload;
}

/**
 * Whether a verified JWT_SECRET-signed payload may be treated as an ACCESS token.
 *
 * Access tokens carry `tokenType: ACCESS_TOKEN_TYPE` (TokenModule). A payload whose `purpose` is
 * anything but `access`, or whose `tokenType` is anything but the access type, was minted for
 * another flow (password reset, workspace sign-in, invoice share, ...) and must never
 * authenticate a request. Payloads with neither claim are accepted for backward compatibility;
 * callers still require an identity claim (`id`) and resolve it against the database.
 */
export function isAccessTokenPayload(payload: unknown): boolean {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return false;
	}
	const record = payload as Record<string, unknown>;
	const purpose = record[TOKEN_PURPOSE_CLAIM];
	if (purpose !== undefined && purpose !== null && purpose !== TokenPurposeEnum.ACCESS) {
		return false;
	}
	const tokenType = record['tokenType'];
	if (tokenType !== undefined && tokenType !== null && tokenType !== ACCESS_TOKEN_TYPE) {
		return false;
	}
	return true;
}
