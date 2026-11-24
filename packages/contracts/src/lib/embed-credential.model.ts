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
	 * for a credential that reads no client report. A token exchanged with the credential starts the timer only on that
	 * client's projects (403 `EMBED_CLIENT_PROJECT` otherwise); it still acts for any member of the organization.
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
	 * A client of the organization whose spent time the credential is to read (`POST /embed/client-report`). The tokens
	 * the credential exchanges start the timer only on that client's projects, for any member of the organization.
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
	/**
	 * Whether the organization's people can sign in from this site themselves: they allow it once from the web app,
	 * and the site gets their timer token without a server of its own (`POST /embed/authorize`). False for every site
	 * added without it.
	 */
	allowPersonSignIn?: boolean;
}

export interface IEmbedAllowedOriginCreateInput {
	origin: string;
	organizationId: ID;
	/** Lets the organization's people sign in from this site themselves. Off by default. */
	allowPersonSignIn?: boolean;
}

/** What an administrator changes on an allowed site. */
export interface IEmbedAllowedOriginUpdateInput {
	allowPersonSignIn: boolean;
}

/**
 * A person allows a site to start and stop their timer, with their own session (`POST /embed/authorize`). The site must
 * be one of the organization's allowed origins with sign-in on, and the person an active member who may track time.
 */
export interface IEmbedAuthorizeInput {
	organizationId: ID;
	/** The site's origin (`https://app.example.com`), as its page's `Origin` header names it. */
	origin: string;
}

/** A renewal token, as the site's page holds it (`POST /embed/renew`, `POST /embed/revoke`). */
export interface IEmbedRenewalInput {
	renewalToken: string;
}

/**
 * What a site gets when a person allows it, and at each renewal: a timer token like the exchange's, and a renewal token
 * that gets the next pair from the same site only. A renewal token works once: the renewal answers a new one.
 */
export interface IEmbedSiteTokens extends IEmbedTokenExchangeResponse {
	/** Shown in this answer only; the server keeps its SHA-256. */
	renewalToken: string;
	/** ISO date; the renewal token is refused after it, and the person allows the site again. */
	renewalExpiresAt: string;
}

/**
 * A site a person allowed to start and stop their timer, as the person and the organization's administrators list it.
 * The same through its renewals; revoking it ends the site's renewals.
 */
export interface IEmbedSiteGrant {
	id: ID;
	origin: string;
	organizationId: ID;
	userId: ID;
	employeeId: ID;
	/** When the site last got a renewal token: when the person allowed it, or its last renewal since. */
	renewedAt: Date;
	/** When it ends, unless the site renews it before. */
	expiresAt: Date;
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

/**
 * A project an embed token may track time on (`GET /embed/projects`): one of its client's for a token of a credential
 * limited to a client, else one of its member's. Its id and its name, nothing else.
 */
export interface IEmbedProject {
	id: ID;
	name: string;
}

/** What an embed token may do, besides reading the signed-in user. */
export enum EmbedScopeEnum {
	TIMER = 'timer'
}
