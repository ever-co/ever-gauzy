import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { CurrencyCode } from './money.model';

/**
 * Fulfilment.
 *
 * A fulfilment is one shipment against an order, and it has its own lifecycle: an order may be
 * partially fulfilled, fulfilled from several locations, or fulfilled again after a return. The
 * shipping configuration around it — the profiles that group variants which ship the same way, and the
 * options a buyer may choose between — belongs to the same domain, which is why the five tables live in
 * one package.
 */

/**
 * How a shipping option is priced.
 */
export enum ShippingPriceType {
	/** A stated amount, in the option's currency. */
	FLAT = 'FLAT',
	/** Priced by a registered calculation strategy at checkout time. */
	CALCULATED = 'CALCULATED',
	/** No charge; the amount is not stored. */
	FREE = 'FREE'
}

/**
 * Which way a fulfilment moves goods.
 */
export enum FulfillmentDirection {
	/** From a warehouse to the customer. Consumes reservations and writes sale movements. */
	OUTBOUND = 'OUTBOUND',
	/** From the customer back to a warehouse. */
	RETURN = 'RETURN'
}

/**
 * Where one fulfilment is in its own lifecycle.
 *
 * A delivered fulfilment is never cancelled — a return is created instead — which is why `CANCELED` is
 * only reachable from the earlier states.
 */
export enum FulfillmentStatusDetail {
	/** Created; the goods are committed but nothing has left. */
	PENDING = 'PENDING',
	/** Handed to the carrier. */
	SHIPPED = 'SHIPPED',
	/** The carrier reported movement. */
	IN_TRANSIT = 'IN_TRANSIT',
	/** The carrier reported delivery. Terminal. */
	DELIVERED = 'DELIVERED',
	/** Cancelled before dispatch; the consumed reservations are re-created. */
	CANCELED = 'CANCELED'
}

/**
 * A set of variants that ship the same way.
 */
export interface IShippingProfile extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	code: string;
	isDefault: boolean;
	description?: string;
	metadata?: Record<string, unknown>;
}

/**
 * The pivot that attaches a variant to a shipping profile.
 */
export interface IShippingProfileVariant extends IBasePerTenantAndOrganizationEntityModel {
	profileId: ID;
	variantId: ID;
}

/**
 * A configured, sellable delivery choice.
 */
export interface IShippingOption extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	code: string;
	priceType: ShippingPriceType;
	amount?: number;
	currency?: CurrencyCode;
	isTaxInclusive: boolean;
	taxCategoryId?: ID;
	providerKey?: string;
	profileId?: ID;
	channelId?: ID;
	regionId?: ID;
	priority: number;
	estimatedMinDays?: number;
	estimatedMaxDays?: number;
	requiresShippingAddress: boolean;
	allowPickup: boolean;
	maxWeight?: number;
	maxItemCount?: number;
	version: number;
	metadata?: Record<string, unknown>;
}

/**
 * One shipment against an order.
 */
export interface IFulfillment extends IBasePerTenantAndOrganizationEntityModel {
	orderId: ID;
	direction: FulfillmentDirection;
	warehouseId?: ID;
	providerId?: string;
	status: FulfillmentStatusDetail;
	trackingNumber?: string;
	trackingUrl?: string;
	carrier?: string;
	service?: string;
	labelUrl?: string;
	labelData?: Record<string, unknown>;
	shippedAt?: Date;
	deliveredAt?: Date;
	canceledAt?: Date;
	requiresShipping: boolean;
	noNotification: boolean;
	note?: string;
	version: number;
	metadata?: Record<string, unknown>;
}

/**
 * What is in one shipment.
 */
export interface IFulfillmentLine extends IBasePerTenantAndOrganizationEntityModel {
	fulfillmentId: ID;
	orderLineId: ID;
	quantity: number;
	warehouseId?: ID;
	metadata?: Record<string, unknown>;
}
