import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { CurrencyCode } from './money.model';
import { IChannelDomain } from './channel-domain.model';
import { IChannelRegion } from './channel-region.model';
import { IRegion } from './region.model';

/**
 * Where a sales context stands in its life.
 *
 * One vocabulary covers the channel and the region, deliberately: the two are filtered together in
 * every administration list, and a second three-value type spelled `RegionStatus` would make one
 * filter over both impossible without a mapping. Only `ACTIVE` serves requests — a `DRAFT` channel is
 * being configured, an `INACTIVE` one is temporarily withdrawn and an `ARCHIVED` one exists only
 * because orders name it. `ARCHIVED` is terminal.
 */
export enum ChannelStatus {
	/** Configured but not yet serving. Authoring through the API is unaffected. */
	DRAFT = 'DRAFT',
	/** Serving. Publication, price, stock and promotion resolution all run for this channel. */
	ACTIVE = 'ACTIVE',
	/** Temporarily withdrawn. Existing orders continue to be processed; no new cart can be created. */
	INACTIVE = 'INACTIVE',
	/** Retired. Read-only; retained because orders point at it. Terminal. */
	ARCHIVED = 'ARCHIVED'
}

/**
 * The sales context: a storefront, a marketplace listing, a point of sale, a B2B portal.
 *
 * Prices, stock, publication and promotions are all resolved *for a channel*, so this row is the root
 * of every channel-scoped resolution: channel → regions → currency → publication → price → stock.
 * `code` is the stable key used in URLs, seeds and imports; `isDefault` marks the one channel of an
 * organization that administrative reads fall back to. `settings` is read whole and merged over the
 * organization-level defaults by the settings resolver, and it is a document rather than columns
 * because the overrides a channel carries differ per domain and a column per override would be a
 * schema change per feature.
 */
export interface IChannel extends IBasePerTenantAndOrganizationEntityModel {
	/** Admin-facing name. */
	name: string;
	/** Stable key, unique per organization. Used in URLs, seeds and imports. */
	code: string;
	/** Free-text description shown in the administration surface. */
	description?: string;
	/** Where the channel stands in its life. Only `ACTIVE` serves requests. */
	status: ChannelStatus;
	/** Whether this is the organization's default channel. At most one row per organization carries it. */
	isDefault: boolean;
	/** Currency of a cart created without an explicit currency. */
	defaultCurrency: CurrencyCode;
	/** Region applied when the request does not resolve one. When set, it is also published through `regions`. */
	defaultRegionId?: ID;
	/** The region row `defaultRegionId` names. */
	defaultRegion?: IRegion;
	/** BCP-47 locale for translated content. */
	defaultLocale?: string;
	/** Prefix handed to the `sequence` row for this channel. */
	orderNumberPrefix?: string;
	/** Zero-padding width of the numeric part of an order number. */
	orderNumberPadding: number;
	/** Channel-scoped overrides read by the checkout, tax and fulfilment strategies. */
	settings?: JsonData;
	/** Tenant extras. */
	metadata?: JsonData;
	/** The hostnames that resolve to this channel. */
	domains?: IChannelDomain[];
	/** The regions published to this channel. */
	regions?: IChannelRegion[];
}

/**
 * What a caller states when it opens a sales context.
 *
 * The lifecycle members are absent: the channel is created `DRAFT` or `ACTIVE` through the status
 * write, its default flag is claimed through the set-default write, and the default region is named by
 * the write that publishes it. `code` is required here and never editable afterwards — it is the key
 * that URLs, seeds and imports are written against, and the schema makes it immutable once an order
 * points at the channel.
 */
export interface IChannelCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Admin-facing name. */
	name: string;
	/** Stable key, unique per organization. */
	code: string;
	/** Free-text description. */
	description?: string;
	/** Currency of a cart created without an explicit currency. Defaults to the organization's currency. */
	defaultCurrency?: CurrencyCode;
	/** BCP-47 locale for translated content. */
	defaultLocale?: string;
	/** Prefix handed to the `sequence` row for this channel. */
	orderNumberPrefix?: string;
	/** Zero-padding width of the numeric part of an order number. Defaults to six. */
	orderNumberPadding?: number;
	/** Channel-scoped overrides. */
	settings?: JsonData;
	/** Tenant extras. */
	metadata?: JsonData;
}

/**
 * What a caller may change on a channel that exists.
 *
 * `code` is absent, and a body that carries it is refused rather than silently ignored: the code is
 * the channel's identity in every URL and import that names it. `status`, `isDefault` and
 * `defaultRegionId` are absent for the same reason — each has an operation of its own, and a
 * descriptive update that could also move one of them is how a lifecycle stops being one.
 */
export interface IChannelUpdateInput {
	/** Admin-facing name. */
	name?: string;
	/** Free-text description. */
	description?: string;
	/** Currency of a cart created without an explicit currency. */
	defaultCurrency?: CurrencyCode;
	/** BCP-47 locale for translated content. */
	defaultLocale?: string;
	/** Prefix handed to the `sequence` row for this channel. */
	orderNumberPrefix?: string;
	/** Zero-padding width of the numeric part of an order number. */
	orderNumberPadding?: number;
	/** Channel-scoped overrides, replaced whole. */
	settings?: JsonData;
	/** Tenant extras, replaced whole. */
	metadata?: JsonData;
}

/** The fields a caller may narrow a list of channels by. */
export interface IChannelFindInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Restrict to one lifecycle status. */
	status?: ChannelStatus;
	/** Restrict to the organization's default channel, or to the others. */
	isDefault?: boolean;
	/** Restrict to the channel under one code. */
	code?: string;
	/**
	 * Include the channels that have been soft-deleted.
	 *
	 * Stated as part of the narrowing rather than beside it because it is one: the same read answers both,
	 * and a caller that could ask for a retired channel over GraphQL but not over REST would have two
	 * answers to one question.
	 */
	withDeleted?: boolean;
}

/**
 * The qualifiers a channel-or-region refusal carries beside its platform error code.
 *
 * The platform's error-code catalogue is the single owner of the codes a response carries, and it also
 * owns the HTTP status of each one; the schema chapter names the conditions below — `CHANNEL_INACTIVE`,
 * `CHANNEL_DEFAULT_IMMUTABLE`, `CHANNEL_DOMAIN_ALREADY_EXISTS`, `REGION_NOT_SUPPORTED_FOR_CHANNEL`,
 * `REGION_COUNTRY_NOT_ALLOWED` and the three service checks I-25, I-26 and I-27 — as the codes those
 * conditions are reported with. They are carried here, as a qualifier inside the message, until their
 * catalogue rows exist, so that a client, a log line and a test can branch on the same token the
 * specification names. The catalogue code stays the leading token of every message, which is what a
 * caller branches on today; when the catalogue gains the rows, the qualifier is what the code becomes.
 */
export const ChannelRegionRefusalReason = {
	/** No channel matches what the caller named. */
	CHANNEL_NOT_FOUND: 'CHANNEL_NOT_FOUND',
	/** The channel is not `ACTIVE`, so it serves no request. */
	CHANNEL_INACTIVE: 'CHANNEL_INACTIVE',
	/** A move the channel's own lifecycle does not allow. */
	CHANNEL_STATUS_INVALID: 'CHANNEL_STATUS_INVALID',
	/** The organization's default channel is never deleted, unset or archived. */
	CHANNEL_DEFAULT_IMMUTABLE: 'CHANNEL_DEFAULT_IMMUTABLE',
	/** The channel cannot serve: it carries no hostname, so no request can resolve to it (I-25). */
	CHANNEL_SETUP_INCOMPLETE: 'CHANNEL_SETUP_INCOMPLETE',
	/** The channel's stable key is written once. */
	CHANNEL_CODE_IMMUTABLE: 'CHANNEL_CODE_IMMUTABLE',
	/** No hostname row matches what the caller named. */
	CHANNEL_DOMAIN_NOT_FOUND: 'CHANNEL_DOMAIN_NOT_FOUND',
	/** The hostname is not a hostname. */
	CHANNEL_DOMAIN_HOSTNAME_INVALID: 'CHANNEL_DOMAIN_HOSTNAME_INVALID',
	/** The hostname already resolves to a channel. */
	CHANNEL_DOMAIN_ALREADY_EXISTS: 'CHANNEL_DOMAIN_ALREADY_EXISTS',
	/** The channel already has a primary hostname. */
	CHANNEL_DOMAIN_PRIMARY_EXISTS: 'CHANNEL_DOMAIN_PRIMARY_EXISTS',
	/** No region matches what the caller named. */
	REGION_NOT_FOUND: 'REGION_NOT_FOUND',
	/** A move the region's own lifecycle does not allow. */
	REGION_STATUS_INVALID: 'REGION_STATUS_INVALID',
	/** The region's currency is not one the platform knows (I-26). */
	REGION_CURRENCY_UNKNOWN: 'REGION_CURRENCY_UNKNOWN',
	/** The region serves no row for the country that was named. */
	REGION_COUNTRY_NOT_FOUND: 'REGION_COUNTRY_NOT_FOUND',
	/** The region already carries a row for the country. */
	REGION_COUNTRY_EXISTS: 'REGION_COUNTRY_EXISTS',
	/** A province scope that is neither absent nor a non-empty list. */
	REGION_COUNTRY_PROVINCES_INVALID: 'REGION_COUNTRY_PROVINCES_INVALID',
	/** The country is not served by the region. */
	REGION_COUNTRY_NOT_ALLOWED: 'REGION_COUNTRY_NOT_ALLOWED',
	/** The region is not published to the channel. */
	REGION_NOT_SUPPORTED_FOR_CHANNEL: 'REGION_NOT_SUPPORTED_FOR_CHANNEL',
	/** The region is already published to the channel. */
	CHANNEL_REGION_EXISTS: 'CHANNEL_REGION_EXISTS',
	/** The region is the channel's default region, so it is not withdrawn while it is named (I-27). */
	CHANNEL_DEFAULT_REGION_PUBLISHED: 'CHANNEL_DEFAULT_REGION_PUBLISHED'
} as const;

/** The union of the qualifiers above, so a consumer can exhaustively switch on it. */
export type ChannelRegionRefusalReason =
	(typeof ChannelRegionRefusalReason)[keyof typeof ChannelRegionRefusalReason];
