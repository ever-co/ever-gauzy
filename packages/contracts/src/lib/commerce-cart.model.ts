import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

/**
 * The cart family.
 *
 * A cart is the pricing and validation workspace a buyer assembles before it becomes an order. It is
 * the one concept in the platform whose bare name is ambiguous — next to a purchase-requisition
 * basket and a point-of-sale basket — and which has no meaning outside an online purchase, so its
 * tables and the enumerations below keep the `commerce_` prefix while every other table of the
 * programme is named for its concept. The API paths and the error codes drop it, because a caller
 * asks for a cart.
 */

/**
 * Where a cart is in its own lifecycle.
 */
export enum CommerceCartStatus {
	/** Open and mutable. */
	ACTIVE = 'ACTIVE',
	/** Converted into an order; `orderId` is set and the cart is immutable. */
	COMPLETED = 'COMPLETED',
	/** Inactive past the abandonment threshold; the buyer may still return and resume it. */
	ABANDONED = 'ABANDONED',
	/** Its lines were moved into another cart; it keeps no lines and is immutable. */
	MERGED = 'MERGED',
	/** Past `expiresAt`; its reservations were released and it can no longer be completed. */
	EXPIRED = 'EXPIRED'
}

/**
 * How much of a validation report a caller wants.
 *
 * The mode changes only *how many* failures are reported, never which ones exist: both values run the
 * same steps in the same order. It is an enumeration rather than a boolean because a third mode (a dry
 * run that reports without reserving) is a plausible additive value.
 */
export enum CommerceCartValidationMode {
	/** Every step runs and the walk stops at the first failure. The default. */
	STRICT = 'STRICT',
	/** Validation runs to the end and collects every failure into one report. */
	LENIENT = 'LENIENT'
}

/**
 * Where an in-progress checkout session is.
 */
export enum CommerceCheckoutSessionStatus {
	/** Created, no step completed. */
	STARTED = 'STARTED',
	/** At least one step completed and the session has not reached payment. */
	IN_PROGRESS = 'IN_PROGRESS',
	/** The checkout operation succeeded and produced an order. Terminal. */
	COMPLETED = 'COMPLETED',
	/** The customer left; the session may be resumed from `completedSteps`. */
	ABANDONED = 'ABANDONED',
	/** Past `expiresAt`. Terminal; a new session is required. */
	EXPIRED = 'EXPIRED'
}

/**
 * The computed totals of a cart.
 *
 * Every one of these is stored on the cart as a cache and recomputed from the lines, the core
 * `adjustment` ledger and the core `tax_line` ledger. The object is what a totals writer writes and
 * what a caller reads; no caller computes any of it.
 */
export interface ICommerceCartTotals {
	itemSubtotal: number;
	itemDiscountTotal: number;
	itemTaxTotal: number;
	shippingSubtotal: number;
	shippingDiscountTotal: number;
	shippingTaxTotal: number;
	discountTotal: number;
	taxTotal: number;
	grandTotal: number;
	currency: string;
	currencyDecimals: number;
}

/**
 * A cart.
 */
export interface ICommerceCart extends IBasePerTenantAndOrganizationEntityModel {
	channelId: ID;
	regionId?: ID;
	customerId?: ID;
	userId?: ID;
	email?: string;
	currency: string;
	currencyDecimals: number;
	locale?: string;
	status: CommerceCartStatus;
	completedAt?: Date;
	abandonedAt?: Date;
	expiresAt?: Date;
	lastActivityAt?: Date;
	orderId?: ID;
	shippingAddressId?: ID;
	billingAddressId?: ID;
	shippingAddressSnapshot?: Record<string, unknown>;
	billingAddressSnapshot?: Record<string, unknown>;
	note?: string;
	isTaxExempt: boolean;
	version: number;
	itemSubtotal: number;
	itemDiscountTotal: number;
	itemTaxTotal: number;
	shippingSubtotal: number;
	shippingDiscountTotal: number;
	shippingTaxTotal: number;
	discountTotal: number;
	taxTotal: number;
	grandTotal: number;
	paidTotal: number;
	refundedTotal: number;
	metadata?: Record<string, unknown>;
	externalId?: string;
}

/**
 * One line of a cart.
 */
export interface ICommerceCartLine extends IBasePerTenantAndOrganizationEntityModel {
	cartId: ID;
	productId?: ID;
	variantId?: ID;
	sellerId?: ID;
	title: string;
	sku?: string;
	thumbnail?: string;
	quantity: number;
	unitPrice: number;
	originalUnitPrice: number;
	isTaxInclusive: boolean;
	taxCategoryId?: ID;
	isDiscountable: boolean;
	requiresShipping: boolean;
	weight?: number;
	position: number;
	note?: string;
	warehouseId?: ID;
	subscriptionPlanId?: ID;
	metadata?: Record<string, unknown>;
}

/**
 * A delivery choice held against a cart.
 */
export interface ICommerceCartShippingMethod extends IBasePerTenantAndOrganizationEntityModel {
	cartId: ID;
	shippingOptionId?: ID;
	name: string;
	amount: number;
	isTaxInclusive: boolean;
	data?: Record<string, unknown>;
	isManual: boolean;
	taxCategoryId?: ID;
	position: number;
	metadata?: Record<string, unknown>;
}

/**
 * A promotion as it was applied to a cart.
 */
export interface ICommerceCartPromotion extends IBasePerTenantAndOrganizationEntityModel {
	cartId: ID;
	promotionId?: ID;
	couponId?: ID;
	code?: string;
	amount: number;
	isAutomatic: boolean;
	appliedAt?: Date;
}

/**
 * The state of an in-progress checkout.
 */
export interface ICommerceCheckoutSession extends IBasePerTenantAndOrganizationEntityModel {
	cartId: ID;
	status: CommerceCheckoutSessionStatus;
	step?: string;
	completedSteps?: string[];
	data?: Record<string, unknown>;
	expiresAt?: Date;
	operationId?: ID;
}
