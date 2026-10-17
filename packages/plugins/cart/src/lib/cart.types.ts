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

/*
|--------------------------------------------------------------------------
| The promotion capability (R3-07)
|--------------------------------------------------------------------------
*/

/**
 * One line the promotion capability may discount.
 *
 * The promotion package's own `IPromotionEvaluationLine`, restated for the reason the tax shapes above
 * are: the cart does not depend on the promotion package, and a structural type is what lets the
 * installation bind the engine to this port without either package importing the other.
 */
export interface ICartPromotionLineQuery {
	/** The cart line, echoed back on the allocations. */
	readonly id: ID;
	/** What the line costs before any promotion: its unit price times its quantity. */
	readonly amount: DecimalString;
	readonly quantity: number;
	readonly variantId?: ID;
	readonly sku?: string;
}

/** One delivery choice the promotion capability may discount. */
export interface ICartPromotionShippingQuery {
	readonly id: ID;
	readonly amount: DecimalString;
}

/** What the cart asks the promotion capability to evaluate: the cart as it is, and the codes presented. */
export interface ICartPromotionQuery {
	readonly currency: string;
	readonly channelId?: ID;
	readonly customerId?: ID;
	/** Every code the cart carries, the one being applied included, so stacking is judged on all of them. */
	readonly codes?: string[];
	readonly lines: ICartPromotionLineQuery[];
	readonly shipping?: ICartPromotionShippingQuery[];
	readonly at?: Date;
}

/** One promotion the capability granted, with the amount it gives away. */
export interface ICartPromotionApplication {
	readonly promotionId: ID;
	readonly couponId?: ID;
	readonly code?: string;
	readonly isAutomatic: boolean;
	/** The discount, as a positive decimal string in the cart's currency. */
	readonly amount: DecimalString;
	readonly currency: string;
}

/** Why the capability did not grant a promotion (an unknown code, a stacking conflict, a spent budget …). */
export interface ICartPromotionNotice {
	readonly promotionId: ID;
	readonly code: string;
	readonly notice: string;
	readonly message: string;
}

/**
 * One amount the capability takes off one owner: a cart line (`LINE`) or a delivery choice (`SHIPPING`).
 *
 * The cart records only the `LINE` part of a promotion for now - it spreads a promotion's amount across its
 * lines - so a `SHIPPING` part is never moved onto the items.
 */
export interface ICartPromotionAllocation {
	readonly ownerType: 'LINE' | 'SHIPPING';
	readonly ownerId: ID;
	readonly promotionId: ID;
	readonly code?: string;
	readonly amount: DecimalString;
}

/** What the capability decided. */
export interface ICartPromotionEvaluation {
	readonly result: {
		readonly applications: ICartPromotionApplication[];
		readonly notices: ICartPromotionNotice[];
		readonly discountTotal: DecimalString;
		readonly currency: string;
	};
	/** Where each granted amount was taken from. */
	readonly allocations?: ICartPromotionAllocation[];
}

/**
 * The promotion capability as this package sees it.
 *
 * **It is the only source of a cart's discount (R3-07).** The cart used to record whatever amount the
 * caller stated beside a code — `POST /carts/:id/promotions` and `applyCartPromotion` both took it — so a
 * buyer could grant themselves any discount. The cart now hands the capability the cart itself and the
 * codes it carries, and records only what the capability granted. The capability computes and persists
 * nothing: it answers, and the cart writes the answer into its own promotion snapshot and the platform's
 * `adjustment` ledger, exactly as it does with tax.
 *
 * The capability is the promotion package's `PromotionService`, whose `evaluate` is structurally this
 * interface, so the installation binds the two with one provider.
 */
export interface ICartPromotionPort {
	/**
	 * @param query The cart's lines, delivery choices, currency, buyer and codes.
	 * @returns The promotions granted, and the reasons for the ones that were not.
	 */
	evaluate(query: ICartPromotionQuery): Promise<ICartPromotionEvaluation>;
}

/**
 * Token the promotion capability is injected under.
 *
 * Optional, like the stock and tax ports — but **unbound, it fails closed**: an installation with no
 * promotion engine refuses to apply a promotion (`CART_PROMOTION_ENGINE_MISSING`) rather than falling back
 * to an amount the caller stated, because that fallback is the defect this port exists to close.
 */
export const CART_PROMOTION_EVALUATION = Symbol('CART_PROMOTION_EVALUATION');


/*
|--------------------------------------------------------------------------
| The price capability (R3-07b)
|--------------------------------------------------------------------------
*/

/**
 * What the cart asks the price capability to resolve: the pricing package's own `IPriceContext`, restated.
 *
 * Restated for the reason the tax and promotion shapes above are: the cart does not depend on the pricing
 * package, and a structural type is what lets the installation bind `ProductPriceService` to this port.
 * Customer groups are not stated: the platform has no server-side record of a customer's groups, and a
 * group stated by the caller is exactly the kind of input this port exists to stop trusting. A price list
 * bound to a group is therefore not applied to a cart line.
 */
export interface ICartPriceQuery {
	readonly variantIds: ID[];
	readonly currency: CurrencyCode;
	/** Units being priced; quantity bands are selected by it. */
	readonly quantity?: DecimalString | number;
	readonly date?: Date;
	readonly channelId?: ID;
	readonly regionId?: ID;
	readonly customerId?: ID;
}

/** One resolved price, as the cart reads it. */
export interface ICartResolvedPrice {
	readonly variantId: ID;
	/** The winning `product_price` row, absent for the legacy variant price. */
	readonly priceId?: ID;
	/** The winning price list, absent for a default price. */
	readonly priceListId?: ID;
	readonly currency: CurrencyCode;
	/** What one unit costs. */
	readonly amount: DecimalString;
	/** What it would cost without the winning list: the "was" price. */
	readonly originalAmount?: DecimalString;
	/** Whether `amount` already contains tax. */
	readonly taxInclusive: boolean;
}

/**
 * The price capability as this package sees it.
 *
 * **It is the only source of a cart line's price (R3-07b).** A line used to carry whatever `unitPrice` the
 * caller stated — `POST /carts/:id/lines`, `addCartLine` and `updateCartLine` all took one — so a buyer could
 * name their own price. A line added or changed through a route is now priced by this capability, for the
 * cart's currency, channel, region and buyer and for the line's quantity, and re-priced at checkout; the
 * stated price is accepted for compatibility and ignored. Only an in-process caller that resolved the price
 * itself (the subscription cycle's cart) states one, explicitly.
 *
 * The capability is the pricing package's `ProductPriceService`, whose `resolvePrices` is structurally this
 * interface.
 */
export interface ICartPricePort {
	/**
	 * @param query The variants, the currency, the quantity and who is buying.
	 * @returns One price per variant that has one; a variant with none is omitted.
	 */
	resolvePrices(query: ICartPriceQuery): Promise<ICartResolvedPrice[]>;
}

/**
 * Token the price capability is injected under.
 *
 * Optional like the other ports, and **unbound it fails closed**: a line added or changed through a route is
 * refused (`CART_PRICE_ENGINE_MISSING`) rather than priced at what its caller stated.
 */
export const CART_PRICE_RESOLUTION = Symbol('CART_PRICE_RESOLUTION');
