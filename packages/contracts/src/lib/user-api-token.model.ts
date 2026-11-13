/**
 * Contract for personal API tokens: a long-lived credential a signed-in user creates in Settings and hands to an
 * agent or a script. It is exchanged for an ordinary short-lived access token (`POST /api/auth/api-token/exchange`),
 * so it carries exactly the role and permissions of the user who created it.
 */

import { IBasePerTenantEntityModel, ID } from './base-entity.model';

/** How long a new API token stays valid. */
export enum UserApiTokenExpiryEnum {
	DAYS_90 = '90d',
	YEAR_1 = '1y',
	NEVER = 'never'
}

/** An API token as every read returns it: the secret and its hash never leave the server. */
export interface IUserApiToken extends IBasePerTenantEntityModel {
	/** The user whose permissions the token carries. */
	userId: ID;

	/** What the user called it ("Task agent on my PC"). */
	name: string;

	/** The first characters of the token, not secret, shown so a token can be told apart from another. */
	prefix: string;

	/** When it stops working; null when it never expires. */
	expiresAt: Date | null;

	/** When it was last exchanged (accurate to about a minute); null while it was never used. */
	lastUsedAt: Date | null;

	/** When it was revoked; null while it is not. Revoked tokens are not listed. */
	revokedAt: Date | null;
}

/** `POST /api/user-api-tokens` */
export interface IUserApiTokenCreateInput {
	name: string;
	expiry: UserApiTokenExpiryEnum;
}

/** What creating a token answers: the row plus the plain token, returned this one time and never again. */
export interface IUserApiTokenWithSecret extends IUserApiToken {
	token: string;
}

/** `GET /api/user-api-tokens/config` */
export interface IUserApiTokenConfig {
	/** Whether this server has API tokens on (`GAUZY_USER_API_TOKENS_ENABLED`). */
	enabled: boolean;
}

/** `POST /api/auth/api-token/exchange` */
export interface IUserApiTokenExchangeInput {
	/** The API token. */
	token: string;

	/** The organization to work in, for a user with several; it must be one the user is an active member of. */
	organizationId?: ID;
}

/** What an exchange answers: an ordinary access token, shaped like the sign-in routes' `token`. */
export interface IUserApiTokenExchangeResponse {
	token: string;
}
