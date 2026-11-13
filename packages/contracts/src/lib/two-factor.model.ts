/**
 * Contract for two-factor authentication with an authenticator app (TOTP, RFC 6238): a user turns it on from a
 * signed-in session, and every sign-in that ends with a session then asks for a six-digit code (or a single-use
 * recovery code) before the session is issued. Off for every user until they turn it on.
 */

import { IBasePerTenantEntityModel, ID } from './base-entity.model';

/**
 * The `code` of the 403 a sign-in answers instead of a session when the account has two-factor authentication on.
 * The answer also carries the challenge to send back with the code (`POST /api/auth/two-factor/verify`).
 */
export const TWO_FACTOR_REQUIRED_CODE = 'TWO_FACTOR_REQUIRED';

/** A user's two-factor authentication record. Its secret and recovery codes never leave the server. */
export interface IUserTwoFactor extends IBasePerTenantEntityModel {
	/** The user it protects. */
	userId: ID;

	/** When the user confirmed their first code; null while an enrolment waits for it, or after it was turned off. */
	enabledAt?: Date | null;

	/** When an administrator last reset it for the user; null when nobody did. */
	resetAt?: Date | null;

	/** The administrator who last reset it. */
	resetByUserId?: ID | null;
}

/** `GET /api/auth/two-factor`: the signed-in user's own state. */
export interface ITwoFactorStatus {
	/** Whether this server can keep authenticator secrets (it needs `ENCRYPTION_KEY`). */
	available: boolean;

	/** Whether sign-ins ask for a code. */
	enabled: boolean;

	/** When it was turned on. */
	enabledAt: Date | null;

	/** Whether an enrolment was started and still waits for its first code. */
	pendingEnrollment: boolean;

	/** How many recovery codes are still unused. */
	recoveryCodesLeft: number;

	/** Whether the organization of this session asks its members to turn it on. */
	requiredByOrganization: boolean;
}

/** `POST /api/auth/two-factor/enroll` */
export interface ITwoFactorEnrollInput {
	/** The name the authenticator app shows for the account, e.g. the client app's name. Defaults to the API's. */
	issuer?: string;
}

/** What starting an enrolment answers: the secret, as text and as an `otpauth://` address for a QR code. */
export interface ITwoFactorEnrollment {
	/** The base32 secret, for people who type it in. */
	secret: string;

	/** The `otpauth://totp/...` address to show as a QR code. */
	otpauthUrl: string;
}

/** A proof of the second factor: a current six-digit code, or one of the recovery codes. */
export interface ITwoFactorCodeInput {
	/** A six-digit code from the authenticator app. */
	code?: string;

	/** A recovery code (`XXXXX-XXXXX`), usable once. */
	recoveryCode?: string;
}

/** The recovery codes answered when two-factor authentication is turned on, or when they are replaced. Shown once. */
export interface ITwoFactorRecoveryCodes {
	recoveryCodes: string[];
}

/** `POST /api/auth/two-factor/confirm`: the enrolment is confirmed, and its recovery codes are answered once. */
export interface ITwoFactorConfirmation extends ITwoFactorRecoveryCodes {
	enabledAt: Date;
}

/** `POST /api/auth/two-factor/verify`: the challenge a sign-in answered, with the code that completes it. */
export interface ITwoFactorVerifyInput extends ITwoFactorCodeInput {
	challenge: string;
}

/** The body of the 403 a sign-in answers when the account asks for a code. */
export interface ITwoFactorChallenge {
	statusCode: 403;
	error: string;
	code: typeof TWO_FACTOR_REQUIRED_CODE;
	/** Says why, for apps that cannot ask for the code yet: they show it as they show any refused sign-in. */
	message: string;
	/** Sent back with the code to `POST /api/auth/two-factor/verify`. */
	challenge: string;
	/** When the challenge stops being accepted (ISO 8601). */
	expiresAt: string;
}
