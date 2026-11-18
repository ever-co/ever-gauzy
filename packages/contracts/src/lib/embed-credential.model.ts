import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

/**
 * A workspace credential a host's backend holds to embed the timer: it is exchanged for a short-lived token limited to
 * one member and to the timer (`POST /embed/token`). The secret is shown once, at creation; only its SHA-256 is stored.
 */
export interface IEmbedCredential extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	/** The first characters of the secret (`gze_` and 8 more), to recognize it in the list. */
	prefix: string;
	/**
	 * The client (an organization contact) whose spent time the credential reads (`POST /embed/client-report`); null
	 * for a credential that reads no client report. It does not narrow the exchange yet: a token exchanged with the
	 * credential acts for any member of the organization, as with any other credential.
	 */
	organizationContactId?: ID | null;
	/**
	 * Whether an exchange may add the person it names as an employee of the organization when the address has no active
	 * member there (`POST /embed/token`). False for every credential created without it.
	 */
	canAddMembers?: boolean;
	lastUsedAt?: Date | null;
	revokedAt?: Date | null;
}

export interface IEmbedCredentialCreateInput {
	name: string;
	organizationId: ID;
	/**
	 * A client of the organization whose spent time the credential is to read (`POST /embed/client-report`). It does not
	 * narrow the exchange yet: the credential still exchanges tokens for any member of the organization.
	 */
	organizationContactId?: ID;
	/** Lets the credential's exchanges add the people they name as employees of the organization. Off by default. */
	canAddMembers?: boolean;
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
	/**
	 * The first name of the person `email` names, for an account a credential that may add members creates (at most 100
	 * characters, a longer one is cut). Without it, the account is named after the part of the address before the @.
	 * An existing account keeps its name.
	 */
	firstName?: string;
	/** The last name of that person, for an account a credential that may add members creates (at most 100 characters). */
	lastName?: string;
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

/** A client's spent time, asked by its portal's server with a credential limited to that client. */
export interface IEmbedClientReportInput {
	credential: string;
}

/** A project of the client, and the seconds spent on it this week. */
export interface IEmbedClientReportProject {
	id: ID;
	name: string;
	seconds: number;
}

/**
 * The time spent on the projects of one client: today, this week, and this week by project. Days are `YYYY-MM-DD` in
 * `timeZone`, and a running timer counts up to the time of the request. No member, task or description is named.
 */
export interface IEmbedClientReport {
	client: { id: ID; name: string };
	/** The organization's time zone, or UTC when it has none. */
	timeZone: string;
	today: { date: string; seconds: number };
	/** From the organization's first day of the week (Monday unless it says otherwise), seven days. */
	week: { start: string; end: string; seconds: number };
	/** The projects with time this week, the most first. */
	projects: IEmbedClientReportProject[];
}

/** What an embed token may do, besides reading the signed-in user. */
export enum EmbedScopeEnum {
	TIMER = 'timer'
}
