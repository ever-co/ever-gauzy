import { GraphqlConnection } from '@gauzy/core';
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

/**
 * A page of fulfilments, of shipping options and of shipping profiles.
 *
 * Each was its own `{ items, total }` before, which is a page a client can read once and not walk: the
 * kernel's connection carries the cursors and the boundary as well as the count.
 */
export type IFulfillmentConnection = GraphqlConnection<Fulfillment>;
export type IShippingOptionConnection = GraphqlConnection<ShippingOption>;
export type IShippingProfileConnection = GraphqlConnection<ShippingProfile>;

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
