import { ID } from './base-entity.model';

/**
 * Body of `POST /integrations/upwork/access-token/:organizationId`: what Upwork's OAuth callback
 * hands back to the browser.
 *
 * It carries no request-token secret: the server stored that when the handshake started and never
 * reads one from the client.
 */
export interface IAccessTokenDto {
	requestToken: string;
	verifier: string;
}

/**
 * Result of exchanging an OAuth 1.0a request token for an Upwork access token.
 *
 * The minted `accessToken` / `accessTokenSecret` pair is persisted as integration settings and is
 * deliberately NOT part of this payload: the browser has no use for it, and returning it put live
 * Upwork credentials into the Angular app's memory and into any log along the way
 * (GHSA-3rqg-gpm9-gx84). Callers that need to talk to Upwork resolve the credentials server-side
 * from `integrationId`.
 */
export interface IAccessToken {
	integrationId: ID;
}

/**
 * `POST /integrations/upwork/token-secret-pair/:organizationId` when the Upwork app still has to
 * be authorized: the URL to send the operator to.
 *
 * `requestTokenSecret` is stored server-side and is never returned: it signs the access-token
 * exchange, so it is credential material and has no client-side consumer (GHSA-3rqg-gpm9-gx84).
 */
export interface IUpworkAuthorizationHandshake {
	/** The Upwork page the operator authorizes the app on. */
	url: string;
	/** The OAuth request token Upwork will echo back to the callback. */
	requestToken: string;
	organizationId?: ID;
}

/**
 * `POST /integrations/upwork/token-secret-pair/:organizationId` when the Upwork app already
 * completed the handshake for the organization: the integration to open.
 *
 * It names the integration only. The stored access token pair never leaves the server.
 */
export interface IUpworkExistingAuthorization {
	/** The integration that already holds an access token pair for this Upwork app. */
	integrationId: ID;
	organizationId?: ID;
}

/**
 * Result of starting the Upwork OAuth 1.0a handshake: either a new handshake to complete, or the
 * integration that already completed one. Tell them apart with {@link isUpworkExistingAuthorization}.
 */
export type IAccessTokenSecretPair = IUpworkAuthorizationHandshake | IUpworkExistingAuthorization;

/**
 * Whether a handshake result names an integration that is already authorized.
 *
 * @param result - The `token-secret-pair` response.
 * @returns True when the result carries an integration id and no authorization URL.
 */
export function isUpworkExistingAuthorization(result: IAccessTokenSecretPair): result is IUpworkExistingAuthorization {
	return (
		!!result &&
		!!(result as IUpworkExistingAuthorization).integrationId &&
		!(result as IUpworkAuthorizationHandshake).url
	);
}

/**
 * Non-secret view of an Upwork integration's stored API credentials.
 *
 * `GET /integrations/upwork/config/:integrationId` used to answer with the cleartext
 * `accessToken` / `consumerKey` / `consumerSecret` / `accessSecret` quadruple, bypassing the
 * `IntegrationSetting` masking that every other read of those settings goes through. The route now
 * answers with this shape instead: presence flags only, enough for the UI to know the integration
 * is usable, and no credential-derived value — not even a masked fragment (GHSA-3rqg-gpm9-gx84).
 */
export interface IUpworkApiConfigStatus {
	/** The integration whose credentials were resolved. */
	integrationId: ID;
	/** Whether a usable Upwork access token / secret pair is stored for this integration. */
	hasAccessToken: boolean;
	/** Whether the Upwork consumer key / secret pair is stored for this integration. */
	hasConsumerKey: boolean;
}

/**
 * Query parameters for `GET /integrations/upwork/work-diary`.
 *
 * Carries the integration to read from, never the credentials to read it with: the server resolves
 * those from `integrationId` within the caller's tenant and organization.
 */
export interface IGetWorkDiaryDto {
	integrationId: ID;
	organizationId: ID;
	contractId: string;
	forDate: Date;
}

/**
 * Query parameters for `GET /integrations/upwork/freelancer-contracts`.
 *
 * Carries the integration to read from, never the credentials to read it with: the server resolves
 * those from `integrationId` within the caller's tenant and organization.
 */
export interface IGetContractsDto {
	integrationId: ID;
	organizationId: ID;
}

/**
 * Body of `POST /integrations/upwork/sync-contracts`.
 *
 * The tenant is never part of it: the server takes it from the request context. The organization
 * is authorized for the caller and the integration must belong to it.
 */
export interface IUpworkSyncContractsDto {
	integrationId: ID;
	organizationId: ID;
	contracts: IEngagement[];
}

/**
 * Body of `POST /integrations/upwork/sync-contracts-related-data`.
 *
 * This used to carry the caller's `IUpworkApiConfig`, which meant the Angular app had to hold live
 * Upwork credentials in memory and post them back to the API. The credentials are now resolved
 * server-side from `integrationId` (GHSA-3rqg-gpm9-gx84).
 */
export interface IUpworkSyncContractsRelatedDataDto {
	integrationId: ID;
	organizationId: ID;
	contracts: IEngagement[];
	entitiesToSync: any[];
	employeeId?: ID;
	providerId?: string;
	providerReferenceId?: string;
}

export interface IEngagement {
	engagement_start_date: string;
	job_ref_ciphertext: string;
	status: string;
	provider__reference: string;
	engagement_job_type: string;
	offer_id: string;
	job__title: string;
	cj_job_application_uid: string;
	provider_team__id: string;
	fixed_charge_amount_agreed: string;
	job_application_ref: string;
	dev_recno_ciphertext: string;
	reference: string; // USED AS CONTRACT ID TO GET WORKDAYS
	active_milestone: string;
	engagement_end_ts: string;
	provider__id: string;
	created_time: string;
	engagement_end_date: string;
	provider_team__reference: string;
	engagement_start_ts: string;
	buyer_team__reference: string;
	fixed_price_upfront_payment: string;
	hourly_charge_rate: string;
}

/**
 * The credential quadruple the Upwork SDK needs to sign an API call.
 *
 * 🛑 Server-internal only. It must never be accepted from, nor returned to, an API client — the
 * server resolves it from the integration id inside the caller's tenant and organization. Use
 * {@link IUpworkApiConfigStatus} for anything that crosses the wire.
 */
export interface IUpworkApiConfig extends IUpworkClientSecretPair {
	accessToken: string;
	accessSecret: string;
}

export interface IUpworkClientSecretPair {
	consumerKey: string;
	consumerSecret: string;
}

export interface IUpworkDateRange {
	start: Date;
	end: Date;
}

export enum IUpworkOfferStatusEnum {
	ACCEPTED = 'accepted',
	NEW = 'new',
	DECLINED = 'declined',
	EXPIRED = 'expired',
	WITHDRAWN = 'withdrawn',
	CANCELLED = 'cancelled',
	CHANGED = 'changed'
}

export enum IUpworkProposalStatusEnum {
	ACTIVE = 'active',
	SUBMITTED = 'submitted',
	ARCHIVED = 'archived'
}
