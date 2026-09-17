import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { ICommerceCartTotals } from './commerce-cart.model';
import { CurrencyCode } from './money.model';

/**
 * Orders.
 *
 * An order is the immutable commercial record: once placed, it is changed only through an
 * `order_change`, which is why every mutable-looking column on it is a cache of a ledger or of its
 * lines. The table is `order`, never `commerce_order` â€” the concept exists in ERP, CRM and accounting,
 * and the bare name carries the meaning exactly.
 */

/** Where an order is in its lifecycle. */
export enum OrderStatus {
	/** Editable in place: no stock reserved, no payment attempted. */
	DRAFT = 'DRAFT',
	/** Placed but not yet accepted; used when an approval or a manual step comes first. */
	PENDING = 'PENDING',
	/** Blocked on something external: a payment needing authentication, an approval, a missing address. */
	REQUIRES_ACTION = 'REQUIRES_ACTION',
	/** Accepted; stock is reserved and fulfilment may start. */
	CONFIRMED = 'CONFIRMED',
	/** At least one fulfilment exists and the order is not yet complete. */
	PROCESSING = 'PROCESSING',
	/** Every line fulfilled and the payment side settled. */
	COMPLETED = 'COMPLETED',
	/** Cancelled before completion. */
	CANCELED = 'CANCELED',
	/** Hidden from the working lists; retained permanently for accounting. */
	ARCHIVED = 'ARCHIVED'
}

/**
 * The money state of an order, **materialised** from its transaction ledger.
 *
 * No caller writes this: it is derived from the order's own rows and re-derived by the payment-ledger
 * audit, so a stale value is detectable rather than merely wrong.
 */
export enum OrderPaymentStatus {
	NOT_PAID = 'NOT_PAID',
	AWAITING = 'AWAITING',
	AUTHORIZED = 'AUTHORIZED',
	PARTIALLY_AUTHORIZED = 'PARTIALLY_AUTHORIZED',
	PARTIALLY_CAPTURED = 'PARTIALLY_CAPTURED',
	CAPTURED = 'CAPTURED',
	PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
	REFUNDED = 'REFUNDED',
	CANCELED = 'CANCELED',
	FAILED = 'FAILED'
}

/**
 * The fulfilment state of an order, **materialised** from its fulfilment lines and their order-line
 * quantities. No caller writes this either.
 */
export enum FulfillmentStatus {
	NOT_FULFILLED = 'NOT_FULFILLED',
	PARTIALLY_FULFILLED = 'PARTIALLY_FULFILLED',
	FULFILLED = 'FULFILLED',
	PARTIALLY_RETURNED = 'PARTIALLY_RETURNED',
	RETURNED = 'RETURNED',
	CANCELED = 'CANCELED'
}

/**
 * What kind of post-placement modification a change is.
 */
export enum OrderChangeType {
	/** Lines, quantities, addresses or shipping. */
	EDIT = 'EDIT',
	/** Drives a return. */
	RETURN = 'RETURN',
	/** Drives a claim. */
	CLAIM = 'CLAIM',
	/** Drives an exchange. */
	EXCHANGE = 'EXCHANGE',
	/** A credit granted against the order. */
	CREDIT = 'CREDIT',
	/** Cancels the order. */
	CANCEL = 'CANCEL',
	/** Converts the order, or a line of it, into a subscription. */
	SUBSCRIBE = 'SUBSCRIBE',
	/** Originates on the purchasing side and touches the order's fulfilment. */
	PURCHASE = 'PURCHASE',
	/** Reverses a change that is already `APPLIED`, by carrying the inverse of its actions. */
	UNDO = 'UNDO'
}

/**
 * Where a change is in its own lifecycle.
 *
 * `PENDING`, `REQUESTED` and `CONFIRMED` are non-terminal and occupy the order's exclusivity slot:
 * at most one change per order may be in one of them at any time.
 */
export enum OrderChangeStatus {
	PENDING = 'PENDING',
	REQUESTED = 'REQUESTED',
	CONFIRMED = 'CONFIRMED',
	DECLINED = 'DECLINED',
	CANCELED = 'CANCELED',
	APPLIED = 'APPLIED',
	UNDONE = 'UNDONE'
}

/**
 * One action inside a change.
 */
export enum OrderChangeActionType {
	ITEM_ADD = 'ITEM_ADD',
	ITEM_UPDATE = 'ITEM_UPDATE',
	ITEM_REMOVE = 'ITEM_REMOVE',
	ITEM_RETURN = 'ITEM_RETURN',
	RECEIVE_RETURN_ITEM = 'RECEIVE_RETURN_ITEM',
	DISMISS_ITEM_RETURN = 'DISMISS_ITEM_RETURN',
	WRITE_OFF_ITEM = 'WRITE_OFF_ITEM',
	SHIPPING_ADD = 'SHIPPING_ADD',
	SHIPPING_UPDATE = 'SHIPPING_UPDATE',
	SHIPPING_REMOVE = 'SHIPPING_REMOVE',
	ADDRESS_UPDATE = 'ADDRESS_UPDATE',
	CREDIT_LINE_ADD = 'CREDIT_LINE_ADD',
	PROMOTION_ADD = 'PROMOTION_ADD',
	PROMOTION_REMOVE = 'PROMOTION_REMOVE',
	TRANSFER_CREATE = 'TRANSFER_CREATE',
	FULFILLMENT_CREATE = 'FULFILLMENT_CREATE',
	UPDATE_ORDER_PROPERTIES = 'UPDATE_ORDER_PROPERTIES',
	NOTE_ADD = 'NOTE_ADD'
}

/**
 * One movement of money against an order.
 */
export enum OrderTransactionType {
	/** Funds reserved at the provider. Not money received, so it is excluded from the paid total. */
	AUTHORIZATION = 'AUTHORIZATION',
	/** Authorised funds taken. Increases the paid total. */
	CAPTURE = 'CAPTURE',
	/** Money returned to the customer. Increases the refunded total, never decreases the paid total. */
	REFUND = 'REFUND',
	/** Non-cash value applied to the order. Increases the paid total. */
	CREDIT = 'CREDIT',
	/** The provider reversed a capture after a dispute. */
	CHARGEBACK = 'CHARGEBACK',
	/** An authorisation released without a capture. */
	VOID = 'VOID',
	/** An operator-recorded movement. */
	MANUAL = 'MANUAL'
}

/**
 * The kind of address a snapshot row is.
 *
 * The same vocabulary types the core address book's `type` column, so one filter and one navigation
 * cover both a live address and a frozen one.
 */
export enum AddressType {
	/** The address the invoice is issued to, and the tax jurisdiction when it differs from shipping. */
	BILLING = 'BILLING',
	/** The address the goods ship to. */
	SHIPPING = 'SHIPPING'
}

/**
 * The complete total set of an order.
 */
export interface IOrderTotals extends ICommerceCartTotals {
	/** The sum of the credit lines, which is not money received. */
	creditTotal: number;
	/** Settled money. */
	paidTotal: number;
	/** Money returned, as a positive magnitude. */
	refundedTotal: number;
	/** `grandTotal - creditTotal - paidTotal + refundedTotal`. */
	outstandingTotal: number;
}

/**
 * An order.
 */
export interface IOrder extends IBasePerTenantAndOrganizationEntityModel {
	number: string;
	displayId?: string;
	channelId: ID;
	regionId?: ID;
	customerId?: ID;
	userId?: ID;
	email?: string;
	phone?: string;
	currency: CurrencyCode;
	currencyDecimals: number;
	locale?: string;
	status: OrderStatus;
	paymentStatus: OrderPaymentStatus;
	fulfillmentStatus: FulfillmentStatus;
	isDraft: boolean;
	isTest: boolean;
	cartId?: ID;
	parentOrderId?: ID;
	invoiceId?: ID;
	quoteInvoiceId?: ID;
	source?: string;
	shippingAddressId?: ID;
	billingAddressId?: ID;
	/**
	 * The number of distinct sellers across the order's lines. Derived, and never absent: the column is
	 * `NOT NULL DEFAULT 0`, so an order that has not been recomputed yet reports zero rather than
	 * nothing.
	 */
	sellerCount: number;
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
	creditTotal: number;
	outstandingTotal: number;
	version: number;
	placedAt?: Date;
	completedAt?: Date;
	canceledAt?: Date;
	cancelReason?: string;
	purchaseOrderNumber?: string;
	metadata?: Record<string, unknown>;
	externalId?: string;
}

/**
 * One line of an order, with the price snapshot it was bought at.
 */
export interface IOrderLine extends IBasePerTenantAndOrganizationEntityModel {
	orderId: ID;
	productId?: ID;
	variantId?: ID;
	sellerId?: ID;
	invoiceItemId?: ID;
	title: string;
	sku?: string;
	barcode?: string;
	thumbnail?: string;
	quantity: number;
	unitPrice: number;
	originalUnitPrice: number;
	isTaxInclusive: boolean;
	isDiscountable: boolean;
	requiresShipping: boolean;
	taxCategoryId?: ID;
	weight?: number;
	position: number;
	note?: string;
	warehouseId?: ID;
	subscriptionId?: ID;
	fulfilledQuantity: number;
	shippedQuantity: number;
	deliveredQuantity: number;
	returnRequestedQuantity: number;
	returnReceivedQuantity: number;
	returnDismissedQuantity: number;
	writtenOffQuantity: number;
	metadata?: Record<string, unknown>;
}

/**
 * A frozen address of an order.
 */
export interface IOrderAddress extends IBasePerTenantAndOrganizationEntityModel {
	orderId: ID;
	type: AddressType;
	sourceAddressId?: ID;
	contactName?: string;
	company?: string;
	firstName?: string;
	lastName?: string;
	phone?: string;
	email?: string;
	line1: string;
	line2?: string;
	city: string;
	province?: string;
	provinceCode?: string;
	postalCode?: string;
	countryCode: string;
	countryId?: ID;
	latitude?: number;
	longitude?: number;
}

/**
 * A delivery choice frozen on an order.
 */
export interface IOrderShippingMethod extends IBasePerTenantAndOrganizationEntityModel {
	orderId: ID;
	shippingOptionId?: ID;
	name: string;
	amount: number;
	isTaxInclusive: boolean;
	taxCategoryId?: ID;
	data?: Record<string, unknown>;
	position: number;
	metadata?: Record<string, unknown>;
}

/**
 * The totals of one order version.
 */
export interface IOrderSummary extends IBasePerTenantAndOrganizationEntityModel {
	orderId: ID;
	version: number;
	totals: Record<string, unknown>;
	currency: CurrencyCode;
	createdByUserId?: ID;
	reason?: string;
}

/**
 * One movement of money against an order. Append-only.
 */
export interface IOrderTransaction extends IBasePerTenantAndOrganizationEntityModel {
	orderId: ID;
	amount: number;
	currency: CurrencyCode;
	type: OrderTransactionType;
	referenceType?: string;
	referenceId?: ID;
	description?: string;
	/**
	 * When the movement happened. Optional because the column is nullable: a row written without an
	 * instant is a row whose time is unknown, which is not the same fact as one written now.
	 */
	occurredAt?: Date;
	createdByUserId?: ID;
	metadata?: Record<string, unknown>;
}

/**
 * A post-placement modification of an order.
 */
export interface IOrderChange extends IBasePerTenantAndOrganizationEntityModel {
	orderId: ID;
	version: number;
	changeType: OrderChangeType;
	status: OrderChangeStatus;
	returnId?: ID;
	claimId?: ID;
	exchangeId?: ID;
	subscriptionId?: ID;
	requestedByUserId?: ID;
	confirmedByUserId?: ID;
	requestedAt?: Date;
	confirmedAt?: Date;
	declinedAt?: Date;
	canceledAt?: Date;
	note?: string;
	priceChange?: number;
	isSettled: boolean;
	metadata?: Record<string, unknown>;
}

/**
 * One action inside a change.
 */
export interface IOrderChangeAction extends IBasePerTenantAndOrganizationEntityModel {
	changeId: ID;
	action: OrderChangeActionType;
	details?: Record<string, unknown>;
	amount?: number;
	referenceType?: string;
	referenceId?: ID;
	ordering: number;
	applied: boolean;
	appliedAt?: Date;
}

/**
 * Money owed back to the buyer, which is neither a payment nor a discount.
 */
export interface IOrderCreditLine extends IBasePerTenantAndOrganizationEntityModel {
	orderId: ID;
	version: number;
	referenceType?: string;
	referenceId?: ID;
	amount: number;
	currency: CurrencyCode;
	description?: string;
}

/**
 * One entry of an order's own timeline. Append-only.
 */
export interface IOrderHistory extends IBasePerTenantAndOrganizationEntityModel {
	orderId: ID;
	action: string;
	title?: string;
	description?: string;
	userId?: ID;
	metadata?: Record<string, unknown>;
}
