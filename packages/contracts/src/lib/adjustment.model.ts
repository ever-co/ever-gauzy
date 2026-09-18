import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { CurrencyCode, DecimalString } from './money.model';

/**
 * What an adjustment is attached to.
 *
 * The owner is polymorphic: `ownerId` points at a row in one of the tables below and carries no
 * foreign key, because a cart line, a return line and a subscription billing cycle do not live in
 * one table.
 */
export enum AdjustmentOwnerType {
	/** One cart line's contribution to the cart. */
	CART_LINE = 'CART_LINE',
	/** One cart shipping method. */
	CART_SHIPPING = 'CART_SHIPPING',
	/** The cart as a whole: an order-level discount, a fee, a rounding correction. */
	CART = 'CART',
	/** The order-level counterpart of `CART_LINE`; immutable once the order is placed. */
	ORDER_LINE = 'ORDER_LINE',
	/** The order-level counterpart of `CART_SHIPPING`. */
	ORDER_SHIPPING = 'ORDER_SHIPPING',
	/** The order-level counterpart of `CART`. */
	ORDER = 'ORDER',
	/** A restocking fee or a partial credit on one return line. */
	RETURN_LINE = 'RETURN_LINE',
	/** A goodwill credit attached to one claim line. */
	CLAIM_LINE = 'CLAIM_LINE',
	/** A discount or fee on one recurring billing cycle. */
	SUBSCRIPTION_BILLING = 'SUBSCRIPTION_BILLING'
}

/**
 * What produced an adjustment.
 *
 * The type fixes the sign of the amount, except for `MANUAL`, `GIFT_CARD` and `ROUNDING`, which may
 * be either: a manual goodwill credit and a manual fee are the same mechanism with opposite signs.
 */
export enum AdjustmentType {
	/** Produced by the promotion engine. */
	PROMOTION = 'PROMOTION',
	/** Entered by an operator; carries an author, a description and a governed reason. */
	MANUAL = 'MANUAL',
	/** Paid from the customer's loyalty balance. */
	LOYALTY = 'LOYALTY',
	/** Funded from a gift card. */
	GIFT_CARD = 'GIFT_CARD',
	/** Store credit or goodwill that is neither loyalty points nor a gift card. */
	CREDIT = 'CREDIT',
	/** The single rounding correction applied at a defined boundary. */
	ROUNDING = 'ROUNDING',
	/** A discount on shipping that no promotion produced. */
	SHIPPING_DISCOUNT = 'SHIPPING_DISCOUNT',
	/** A positive charge added at the adjustment layer: handling, small-order, cash on delivery. */
	FEE = 'FEE'
}

/**
 * Who bears the cost of an adjustment.
 *
 * A discount is funded by exactly one party **per row**, and the row is where the fact is recorded
 * rather than the promotion that produced it: a promotion may be funded by the platform, by one seller,
 * or split between them, and the split case is expressed as two rows — one per funder — so that each
 * amount is rounded once on its own and the audit question "who paid for this discount" is answered by
 * summing rows rather than by interpreting a ratio. The seller's own ledger reads this column to decide
 * which of its two discount amounts a row becomes.
 */
export enum AdjustmentFunding {
	/** The platform bears it: the seller is made whole and its commission basis does not move. */
	PLATFORM = 'PLATFORM',
	/** One seller bears it: it reduces that seller's net and, on a discounted basis, its commission. */
	SELLER = 'SELLER'
}

/**
 * One signed monetary modification of one document.
 *
 * Every reduction or addition to an amount payable is a row here, whatever produced it. Nothing else
 * changes an amount payable: a second mechanism writing a total directly is how two components come
 * to disagree about what a customer owes.
 */
export interface IAdjustment extends IBasePerTenantAndOrganizationEntityModel {
	/** What the adjustment is attached to. */
	ownerType: AdjustmentOwnerType;

	/** Id of the owning row. Polymorphic, so it carries no foreign key. */
	ownerId: ID;

	/** Signed exact amount: negative reduces what the customer pays, positive adds. */
	amount: DecimalString;

	/** Currency of the amount. Always present so an adjustment is self-describing. */
	currency: CurrencyCode;

	/** Whether `amount` is expressed in the owner's gross basis rather than its net basis. */
	isTaxInclusive: boolean;

	/** What produced the adjustment. */
	type: AdjustmentType;

	/** Coupon or promotion code that produced the adjustment, when one exists. */
	code?: string;

	/** Domain of the referenced row, for example `promotion` or `gift_card`. */
	referenceType?: string;

	/** Id of the referenced row; no foreign key, because the target depends on `referenceType`. */
	referenceId?: ID;

	/** Human-readable reason shown on the document. */
	description?: string;

	/** Provider or strategy row that produced the adjustment. */
	providerId?: ID;

	/**
	 * Governed reason code from `adjustment_reason`.
	 *
	 * Stored as text rather than as a foreign key so that a historical adjustment survives the
	 * retirement of the reason it cites; the service validates the code on write.
	 */
	reasonCode?: string;

	/** The producer's own trace: which rule matched, which allocation was used, the derived tax. */
	metadata?: Record<string, unknown>;

	/**
	 * Who bears the cost of this row.
	 *
	 * `PLATFORM` by default, which is what every row written before the marketplace existed is: the
	 * platform's own discount, borne by the platform. A seller-funded promotional discount states
	 * `SELLER` and names the seller in {@link sellerId}; the one rule the table states about the pair is
	 * that a row funded by a seller names one.
	 */
	fundedBy?: AdjustmentFunding;

	/**
	 * The seller that bears the cost, when {@link fundedBy} is `SELLER`.
	 *
	 * The reference is held as an id rather than as a relation because the table this points at belongs
	 * to the marketplace package and the kernel does not depend on it; the constraint onto `seller` is
	 * added by the set that owns that table.
	 */
	sellerId?: ID;
}

/**
 * Input for appending one adjustment to the ledger.
 */
export interface IAdjustmentCreateInput
	extends Partial<Omit<IAdjustment, 'id' | 'ownerType' | 'ownerId' | 'amount' | 'currency' | 'type'>> {
	ownerType: AdjustmentOwnerType;
	ownerId: ID;
	amount: DecimalString;
	currency: CurrencyCode;
	type: AdjustmentType;
}

/**
 * The sum of one owner's adjustments.
 */
export interface IAdjustmentTotal {
	/** The owning row. */
	ownerType: AdjustmentOwnerType;
	ownerId: ID;

	/** Currency of the summed amounts. */
	currency: CurrencyCode;

	/** Exact sum, at the storage scale. */
	total: DecimalString;

	/** How many rows were summed. */
	count: number;
}
