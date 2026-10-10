import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { IChannel } from './channel.model';

/**
 * One hostname that resolves to one channel.
 *
 * The row exists for a single purpose: to answer "which channel is this `Host` header" in one indexed
 * read, before any other guard runs. `hostname` is therefore unique across the **whole deployment**
 * and not per tenant — the header is global, and two tenants claiming the same host would make the
 * resolution ambiguous in exactly the request that cannot ask a question first. Exactly one row per
 * channel is primary, and the primary is what the others redirect to when `redirectToPrimary` is set.
 */
export interface IChannelDomain extends IBasePerTenantAndOrganizationEntityModel {
	/** The channel this hostname resolves to. */
	channelId: ID;
	/** The channel row `channelId` names. */
	channel?: IChannel;
	/** Lower-cased hostname, without scheme and without a trailing slash. Unique across the deployment. */
	hostname: string;
	/** Whether this is the channel's canonical host. At most one row per channel carries it. */
	isPrimary: boolean;
	/** When false the host is served over plain HTTP — development and internal deployments. */
	isSslEnabled: boolean;
	/** Whether a request to this host is redirected to the channel's primary host. */
	redirectToPrimary: boolean;
	/** Tenant extras: the certificate reference, a content-delivery identifier. */
	metadata?: JsonData;
}

/**
 * What a caller states when it binds a hostname to a channel.
 *
 * `channelId` and `hostname` are both required: one names the channel the host belongs to and the
 * other is the host. The three flags carry their column defaults when they are absent, so a plain
 * binding is a primary, TLS-served, non-redirecting host.
 */
export interface IChannelDomainCreateInput {
	/** The channel the hostname resolves to. */
	channelId: ID;
	/** The hostname, as the caller states it. It is lower-cased and stripped of any scheme or path. */
	hostname: string;
	/** Whether this is the channel's canonical host. The channel's first hostname is made primary. */
	isPrimary?: boolean;
	/** Whether the host is served over TLS. Defaults to true. */
	isSslEnabled?: boolean;
	/** Whether requests to this host are redirected to the primary. Defaults to false. */
	redirectToPrimary?: boolean;
	/** Tenant extras. */
	metadata?: JsonData;
}

/**
 * What a caller may change on a hostname that exists.
 *
 * The hostname itself and the channel it belongs to are absent: a binding that could be re-pointed is
 * a binding whose resolution changes under the requests that already resolved it. Rebinding is an
 * unbind followed by a bind, which is visible in both rows' history.
 */
export interface IChannelDomainUpdateInput {
	/** Whether this is the channel's canonical host. Setting it moves the flag from the current primary. */
	isPrimary?: boolean;
	/** Whether the host is served over TLS. */
	isSslEnabled?: boolean;
	/** Whether requests to this host are redirected to the primary. */
	redirectToPrimary?: boolean;
	/** Tenant extras, replaced whole. */
	metadata?: JsonData;
}

/** The fields a caller may narrow a list of hostnames by. */
export interface IChannelDomainFindInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Restrict to the hostnames of one channel. */
	channelId?: ID;
	/** Restrict to one hostname. */
	hostname?: string;
	/** Restrict to the primary hostname, or to the others. */
	isPrimary?: boolean;
}
