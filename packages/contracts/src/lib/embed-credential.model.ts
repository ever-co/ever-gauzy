import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

/**
 * A workspace credential a host's backend holds to embed the timer: it is exchanged for a short-lived token limited to
 * one member and to the timer (`POST /embed/token`). The secret is shown once, at creation; only its SHA-256 is stored.
 */
export interface IEmbedCredential extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	/** The first characters of the secret (`gze_` and 8 more), to recognize it in the list. */
	prefix: string;
	/** The client (an organization contact) the credential is limited to; null for one of the whole organization. */
	organizationContactId?: ID | null;
	lastUsedAt?: Date | null;
	revokedAt?: Date | null;
}

export interface IEmbedCredentialCreateInput {
	name: string;
	organizationId: ID;
	/** A client of the organization to limit the credential to; without one, it serves the whole organization. */
	organizationContactId?: ID;
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
}

export interface IEmbedTokenExchangeResponse {
	token: string;
	/** ISO date; the token answers 401 after it, and the host asks for a new one. */
	expiresAt: string;
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
