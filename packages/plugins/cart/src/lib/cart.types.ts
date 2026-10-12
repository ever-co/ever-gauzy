import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';

/**
 * One line's stock question: which variant, at which location.
 *
 * The location is optional because a cart line only carries one when the channel resolved it; the
 * capability answers for the location it is given, and for its default location when it is given none.
 */
export interface ICartStockQuery {
	/** The variant the line is for. */
	readonly variantId: ID;
	/** The location the line was priced for, when the channel resolved one. */
	readonly warehouseId?: ID;
}

/** What the stock capability reports about one variant at one location. */
export interface ICartStockAvailability {
	/**
	 * Units that may be sold right now: what is on hand, less what is already reserved, less the
	 * location's safety stock. Reported rather than derived here, because how it is derived is the
	 * inventory domain's own rule and a second derivation would be a second answer.
	 */
	readonly sellableQuantity: number;
	/** Whether the location accepts orders beyond what is on hand. */
	readonly allowBackorder: boolean;
	/** How far beyond what is on hand an order may go, when the location allows backorders. */
	readonly backorderLimit?: number;
}

/**
 * The stock capability as this package sees it.
 *
 * Provided by the inventory package and injected under `CART_STOCK_AVAILABILITY`. The cart asks this
 * one question and nothing else: stock is the inventory domain's, this package never reads a stock
 * table, and it never reserves — the reservation is the checkout operation's own `reserve-stock` step.
 */
export interface ICartStockPort {
	/**
	 * @param query The variant and, when it is known, the location.
	 * @returns What may be sold, or the quantity the location allows past what is on hand.
	 */
	availabilityOf(query: ICartStockQuery): Promise<ICartStockAvailability | null>;
}

/**
 * One amount the tax capability is asked to rate.
 *
 * The shape is the tax package's own `TaxCalculationLineRequest` narrowed to the members a cart can
 * state. It is restated here rather than imported because the cart does not depend on the tax
 * package — the dependency runs the other way for every other capability the cart reaches — and a
 * structural type is what lets the installation bind the real service to this port without either
 * package importing the other.
 */
export interface ICartTaxLineQuery {
	/** The cart line or shipping method the amount belongs to, echoed back on the result. */
	readonly referenceId?: ID;
	/** The category the amount is taxed in; the organization default applies when it is absent. */
	readonly taxCategoryId?: ID;
	/** The amount to rate: the net when the resolved rates are exclusive, the gross when inclusive. */
	readonly amount: DecimalString;
	/** The quantity the owner carries, which a fixed part of a rate is applied per unit of. */
	readonly quantity?: DecimalString;
}

/** What the cart asks the tax capability to rate. */
export interface ICartTaxQuery {
	/** The currency every amount is expressed in. */
	readonly currency: CurrencyCode;
	/** The amounts to rate. */
	readonly lines: ICartTaxLineQuery[];
	/** The region the document is taxed in, when the cart resolved one. */
	readonly regionId?: ID;
	/** ISO 3166-1 alpha-2 country of the delivery address, when the cart carries one. */
	readonly countryCode?: string;
	/** Province, state or subdivision of the delivery address. */
	readonly provinceCode?: string;
	/** Postal code of the delivery address, which a rate may narrow on. */
	readonly postalCode?: string;
	/**
	 * Rate a destination that matches no rule at zero rather than refusing the calculation.
	 *
	 * A cart is re-priced on every edit and there is nobody to ask about an unmatched catalogue in the
	 * middle of one, so the cart always sets this: an installation with no rates configured keeps a
	 * tax-free cart, exactly as it had before the step existed, instead of a cart that cannot be
	 * edited at all.
	 */
	readonly allowUntaxedCatalog?: boolean;
}

/** One rate's contribution to one amount, in the shape the platform's tax ledger stores. */
export interface ICartTaxLineDraft {
	readonly taxRateId?: ID;
	readonly taxRatePartId?: ID;
	readonly taxRegimeId?: ID;
	readonly postingKey?: string;
	readonly code?: string;
	readonly name: string;
	readonly rate: DecimalString;
	readonly isCompound: boolean;
	readonly isInclusive: boolean;
	readonly baseAmount: DecimalString;
	readonly amount: DecimalString;
	readonly quantity?: DecimalString;
	readonly currency: CurrencyCode;
	readonly providerKey?: string;
	readonly metadata?: Record<string, unknown>;
}

/** The tax of one rated amount. */
export interface ICartTaxLineResult {
	readonly referenceId?: ID;
	readonly currency: CurrencyCode;
	readonly netAmount: DecimalString;
	readonly taxAmount: DecimalString;
	readonly grossAmount: DecimalString;
	readonly taxLines: ICartTaxLineDraft[];
}

/** The tax of a set of amounts. */
export interface ICartTaxResult {
	readonly currency: CurrencyCode;
	readonly taxTotal: DecimalString;
	readonly lines: ICartTaxLineResult[];
}

/**
 * The tax capability as this package sees it.
 *
 * The capability **computes and persists nothing**: it answers with tax-line-shaped drafts and the
 * cart writes them into the platform's own `tax_line` ledger, which is what keeps one breakdown
 * mechanism for every taxed document on the platform. The cart never reads a rate table and never
 * decides what a rate is.
 */
export interface ICartTaxPort {
	/**
	 * @param query The amounts, the currency and the destination they are taxed at.
	 * @returns The tax of each amount, with one draft per rate that applied.
	 */
	calculate(query: ICartTaxQuery): Promise<ICartTaxResult>;
}

/*
|--------------------------------------------------------------------------
| Injection tokens
|--------------------------------------------------------------------------
*/

/**
 * Token the stock capability is injected under.
 *
 * Optional on purpose: the cart is a complete package on its own, and an installation that runs it
 * without the inventory package must still create, validate and complete a cart. With no provider
 * registered the ladder reports the `STOCK` step as `SKIPPED` and the cart validates exactly as it did
 * before the step existed, so the availability is simply not known here; an installation that does
 * have the capability gets the step, and a cart that cannot be reserved is refused while the buyer can
 * still change it rather than when the checkout operation reserves it.
 */
export const CART_STOCK_AVAILABILITY = Symbol('CART_STOCK_AVAILABILITY');

/**
 * Token the tax capability is injected under.
 *
 * Optional for the same reason the stock port is, and with the same consequence stated in the
 * negative: **with no provider registered a cart's tax total stays zero, exactly as it was before
 * this port existed.** That is the behaviour the package shipped with, and it was a defect rather
 * than a decision — nothing in the cart ever wrote a tax line, so `itemTaxTotal`, `shippingTaxTotal`
 * and `taxTotal` were permanently zero and a buyer in a VAT jurisdiction was quoted a tax-free
 * total. Worse, a tax-inclusive catalogue had each line's net computed as `gross - 0`, so the tax
 * the price already contained was silently folded into the subtotal and never declared anywhere.
 *
 * The capability is the tax package's `TaxRateService`, whose `calculate` is structurally this
 * interface, so the installation binds the two with one provider and neither package imports the
 * other.
 */
export const CART_TAX_CALCULATION = Symbol('CART_TAX_CALCULATION');
