import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

/**
 * A workspace credential a host's backend holds to embed the timer: it is exchanged for a short-lived token limited to
 * one member and to the timer (`POST /embed/token`). The secret is shown once, at creation; only its SHA-256 is stored.
 */
export interface IEmbedCredential extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	/** The first characters of the secret (`gze_` and 8 more), to recognize it in the list. */
	prefix: string;
	lastUsedAt?: Date | null;
	revokedAt?: Date | null;
}

export interface IEmbedCredentialCreateInput {
	name: string;
	organizationId: ID;
}

/** The answer to a creation: the only time the secret is readable. */
export interface IEmbedCredentialWithSecret extends IEmbedCredential {
	secret: string;
}

/** The exchange of a credential for a token, for one member of the credential's organization. */
export interface IEmbedTokenExchangeInput {
	credential: string;
	employeeId?: ID;
	email?: string;
	/**
	 * The origin of the page the widget runs in (`https://app.example.com`): one of the organization's allowed origins.
	 * The token is bound to it. Required: an exchange without it is refused (403 `EMBED_ORIGIN_NOT_ALLOWED`).
	 */
	origin?: string;
}

export interface IEmbedTokenExchangeResponse {
	token: string;
	/** ISO date; the token answers 401 after it, and the host asks for a new one. */
	expiresAt: string;
}

/** A site allowed to embed the organization's timer: scheme, host and port, normalized (`https://app.example.com`). */
export interface IEmbedAllowedOrigin extends IBasePerTenantAndOrganizationEntityModel {
	origin: string;
}

export interface IEmbedAllowedOriginCreateInput {
	origin: string;
	organizationId: ID;
}

/** What an embed token may do, besides reading the signed-in user. */
export enum EmbedScopeEnum {
	TIMER = 'timer'
}
