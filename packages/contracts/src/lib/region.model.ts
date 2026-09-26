import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { ChannelStatus } from './channel.model';
import { CurrencyCode } from './money.model';
import { IChannelRegion } from './channel-region.model';
import { IRegionCountry } from './region-country.model';

/**
 * The commercial geography: a currency, a tax-inclusivity default, a country set and the provider keys
 * enabled for it.
 *
 * The region is where tax-inclusivity, currency and provider selection are decided, so a cart that
 * resolved a region reads all three from one row instead of asking each domain. Its country set is the
 * union of its `region_country` rows and is never stored denormalised here: a denormalised copy would
 * be a second answer to "is this address inside the region", and the two would drift in exactly the
 * checkout that must not disagree with itself. `currency` names a row of the platform's currency
 * master, checked when the region is written, because a region whose currency no rounding rule covers
 * would price its carts by guesswork. `status` shares the channel's lifecycle vocabulary so one filter
 * and one navigation cover both.
 */
export interface IRegion extends IBasePerTenantAndOrganizationEntityModel {
	/** Admin-facing name. */
	name: string;
	/** Stable key, unique per organization. */
	code: string;
	/** The region's currency. A cart created in the region defaults to it. */
	currency: CurrencyCode;
	/** Whether this is the organization's default region. At most one row per organization carries it. */
	isDefault: boolean;
	/** Whether displayed prices include tax in this region. */
	isTaxInclusive: boolean;
	/** Registered tax-provider strategy key. Null means the built-in tax engine. */
	taxProviderKey?: string;
	/** Allowed payment-provider codes in this region. Null means every enabled provider. */
	paymentProviderKeys?: string[];
	/** Allowed shipping and carrier provider keys in this region. Null means every enabled provider. */
	fulfillmentProviderKeys?: string[];
	/** Where the region stands in its life. Only `ACTIVE` regions are offered by their channels. */
	status: ChannelStatus;
	/** Tenant extras. */
	metadata?: JsonData;
	/** The countries the region serves, one row per country. */
	countries?: IRegionCountry[];
	/** The channels this region is published to. */
	channels?: IChannelRegion[];
}

/**
 * What a caller states when it opens a commercial geography.
 *
 * `currency` is required and is checked against the platform's currency master before the row is
 * written. The country set is not part of this input: membership is a pivot the region's own operation
 * writes, so a region is created empty and countries are added to it.
 */
export interface IRegionCreateInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Admin-facing name. */
	name: string;
	/** Stable key, unique per organization. */
	code: string;
	/** The region's currency. Checked against the currency master. */
	currency: CurrencyCode;
	/** Whether displayed prices include tax. Defaults to false. */
	isTaxInclusive?: boolean;
	/** Registered tax-provider strategy key. */
	taxProviderKey?: string;
	/** Allowed payment-provider codes; an empty list means none, null means every enabled provider. */
	paymentProviderKeys?: string[];
	/** Allowed shipping and carrier provider keys; null means every enabled provider. */
	fulfillmentProviderKeys?: string[];
	/** Tenant extras. */
	metadata?: JsonData;
}

/**
 * What a caller may change on a region that exists.
 *
 * A currency change is re-checked against the currency master like the creation is, because the rule is
 * about the stored value and not about the moment it first arrived. `isDefault` and `status` are absent:
 * each has an operation of its own.
 */
export interface IRegionUpdateInput {
	/** Admin-facing name. */
	name?: string;
	/** Stable key, unique per organization. */
	code?: string;
	/** The region's currency, re-checked against the currency master. */
	currency?: CurrencyCode;
	/** Whether displayed prices include tax. */
	isTaxInclusive?: boolean;
	/** Registered tax-provider strategy key; an explicit null returns the region to the built-in engine. */
	taxProviderKey?: string | null;
	/** Allowed payment-provider codes, replaced whole. */
	paymentProviderKeys?: string[];
	/** Allowed shipping and carrier provider keys, replaced whole. */
	fulfillmentProviderKeys?: string[];
	/** Tenant extras, replaced whole. */
	metadata?: JsonData;
}

/** The fields a caller may narrow a list of regions by. */
export interface IRegionFindInput extends IBasePerTenantAndOrganizationEntityModel {
	/** Restrict to one lifecycle status. */
	status?: ChannelStatus;
	/** Restrict to the region under one code. */
	code?: string;
	/** Restrict to the regions that price in one currency. */
	currency?: CurrencyCode;
	/** Restrict to the organization's default region, or to the others. */
	isDefault?: boolean;
	/** Restrict to the regions published to one channel. */
	channelId?: ID;
}
