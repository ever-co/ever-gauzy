import {
	IFulfillment,
	IFulfillmentLine,
	IShippingOption,
	IShippingProfile,
	IShippingProfileVariant
} from '@gauzy/contracts';

/**
 * The GraphQL type names of the fulfilment domain, bound to the contracts.
 *
 * The schema and the contracts describe the same rows, so they are one definition here rather than two
 * that can drift.
 */
export type Fulfillment = IFulfillment;
export type FulfillmentLine = IFulfillmentLine;
export type ShippingOption = IShippingOption;
export type ShippingProfile = IShippingProfile;
export type ShippingProfileVariant = IShippingProfileVariant;

/** A page of fulfilments. */
export interface IFulfillmentConnection {
	items: Fulfillment[];
	total: number;
}

/** A page of shipping options. */
export interface IShippingOptionConnection {
	items: ShippingOption[];
	total: number;
}

/** A page of shipping profiles. */
export interface IShippingProfileConnection {
	items: ShippingProfile[];
	total: number;
}

/** An option together with why it is or is not available. */
export interface IShippingOptionEligibility {
	option: ShippingOption;
	eligible: boolean;
	reason?: string;
}

/** The price of one option for one cart, or the strategy that must be asked for it. */
export interface IShippingRate {
	amount: number;
	currency?: string;
	providerKey?: string;
	eligible: boolean;
	reason?: string;
}
