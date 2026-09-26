import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';

/**
 * The pricing vocabulary.
 *
 * Pricing answers one question — what does one unit of this variant cost, for this context, right
 * now — and the enumerations below are the closed parts of that answer: what kind of list is
 * competing, whether the list is eligible, whether the price row is eligible, which scope a
 * tax-inclusivity preference is keyed by, and **how a price row computes the price it states**.
 * Everything contextual (channel, region, customer group, quantity, window) is data rather than an
 * enumeration, because a business adds a channel far more often than it changes the shape of the
 * question.
 */

/*
|--------------------------------------------------------------------------
| Enums
|--------------------------------------------------------------------------
*/

/**
 * How a price list competes for a context.
 *
 * `SALE` competes on price and is beaten by a cheaper price; `OVERRIDE` wins outright once it is
 * eligible, which is what a contract or a negotiated price list needs. Two eligible `OVERRIDE`
 * lists at the same priority is a configuration error rather than an arbitrary choice, and the
 * resolver refuses it instead of picking one.
 */
export enum PriceListType {
	/** Competes on price: wins only when its resolved price is lower than the default price. */
	SALE = 'SALE',
	/** Wins outright for its context, whatever the default price is. */
	OVERRIDE = 'OVERRIDE'
}

/**
 * The lifecycle of a price list.
 *
 * Only `ACTIVE` participates in resolution. `INACTIVE` is what an operator sets instead of
 * deleting a list whose prices must stay queryable, so a seasonal list can be withdrawn and
 * reinstated without rebuilding it.
 */
export enum PriceListStatus {
	/** Being built. Not eligible; its prices may be edited freely. */
	DRAFT = 'DRAFT',
	/** Eligible for resolution inside its window. */
	ACTIVE = 'ACTIVE',
	/** Deliberately withdrawn; its prices are retained and resolve to nothing. */
	INACTIVE = 'INACTIVE'
}

/** The lifecycle of a single price row. Only `ACTIVE` rows are candidates for resolution. */
export enum PriceStatus {
	/** Prepared, not yet offered. Excluded from resolution. */
	DRAFT = 'DRAFT',
	/** Eligible for resolution. */
	ACTIVE = 'ACTIVE',
	/** Retained for history, excluded from resolution. */
	INACTIVE = 'INACTIVE'
}

/**
 * The scope a tax-inclusivity preference is keyed by.
 *
 * A preference is the last answer before the region's own default, and it exists because the same
 * catalogue is presented tax-inclusive in one country and tax-exclusive in another while the price
 * rows are shared. The `value` column carries the key — an ISO currency code, a region id or code,
 * or a channel code.
 */
export enum PricePreferenceAttribute {
	/** Keyed by an ISO 4217 currency code, e.g. `USD`. */
	CURRENCY = 'CURRENCY',
	/** Keyed by a region id or region code. */
	REGION = 'REGION',
	/** Keyed by a channel code. */
	CHANNEL = 'CHANNEL'
}

/**
 * Where a resolved amount came from.
 *
 * Reported with every resolution so a caller can explain a price to a customer, and so an operator
 * can tell "this list is not being applied" from "this list is being applied and loses".
 */
export enum PriceSource {
	/** A `product_price` row belonging to an eligible price list. */
	PRICE_LIST = 'PRICE_LIST',
	/** A `product_price` row with no price list: the default price of the variant. */
	DEFAULT_PRICE = 'DEFAULT_PRICE',
	/** No candidate was eligible, so the legacy variant retail price was used. */
	VARIANT_RETAIL_PRICE = 'VARIANT_RETAIL_PRICE'
}

/**
 * How a price row computes its price.
 *
 * A closed two-value set, deliberately: the arithmetic space does not grow, so this is an
 * enumeration and not a registry. A mode a package could add would need a code path of its own, not
 * a row, and pretending otherwise is how a pricing engine becomes un-reviewable.
 */
export enum PriceComputeMode {
	/** The row's `amount` **is** the price. The only mode before this revision. */
	AMOUNT = 'AMOUNT',
	/** The price is **derived** from a base: `amount = base × (1 − percent / 100)`, then `roundTo`. */
	PERCENT_OFF = 'PERCENT_OFF'
}

/**
 * Which price a derivation starts from.
 *
 * Required exactly when `computeMode` is `PERCENT_OFF`. `COST` with a negative `percent` is the
 * cost-plus **markup**; `PRICE_LIST` is the price-book case, where a derived list re-derives itself
 * when its base list changes instead of going stale.
 */
export enum PriceBaseSource {
	/** The legacy variant retail price, converted through `exchange_rate` when the currencies differ. */
	LIST = 'LIST',
	/** `product_price.costAmount` when set, else the legacy variant unit cost. */
	COST = 'COST',
	/** Another price list, named by `basePriceListId`: acyclic and depth-capped at resolution. */
	PRICE_LIST = 'PRICE_LIST'
}

/**
 * How a winning row arrived at its amount, echoed with the resolution.
 *
 * A derived row stores no amount, so a caller that reads the row directly would read null. The
 * resolution is the sanctioned read path for a price and this is the part of it that explains the
 * arithmetic: which mode produced the amount, and — for a derivation — the base, the share and the
 * price ending that were applied to it.
 */
export interface IPriceComputation {
	/** How the winning row computes. */
	computeMode: PriceComputeMode;
	/** Signed fraction of the base; positive reduces it and negative is a cost-plus markup. */
	percent?: DecimalString;
	/** Which price the derivation started from. */
	baseSource?: PriceBaseSource;
	/** The list a `PRICE_LIST` derivation read. */
	basePriceListId?: ID;
	/** The multiple the derived amount was quantised to, after the percentage and before rounding. */
	roundTo?: DecimalString;
}

/*
|--------------------------------------------------------------------------
| Resolution
|--------------------------------------------------------------------------
*/

/**
 * Everything a resolution is allowed to depend on.
 *
 * The context is the whole input of the algorithm: two calls with the same context resolve to the
 * same price, which is what makes a resolution cacheable per `(variantId, contextHash)` and what
 * makes a dry run (`simulate`) trustworthy.
 */
export interface IPriceContext {
	/** Variants being priced. */
	variantIds: ID[];
	/** Currency the caller is pricing in. A price in another currency is converted, never assumed. */
	currency: CurrencyCode;
	/** Units being priced. Quantity tiers are selected by it; defaults to one. */
	quantity?: DecimalString | number;
	/** Instant the price must be valid at; defaults to now. */
	date?: Date;
	/** Sales channel the price is being resolved for, when the caller has one. */
	channelId?: ID;
	/** Region the price is being resolved for, when the caller has one. */
	regionId?: ID;
	/** Customer the price is being resolved for, when the caller is authenticated as one. */
	customerId?: ID;
	/** Groups the customer belongs to; a list bound to a group beats an unbound one. */
	customerGroupIds?: ID[];
}

/**
 * One resolved price.
 *
 * `amount` is what the caller charges; `originalAmount` is what it would have charged without the
 * winning list, which is what a "was" label renders from. `explain` is a one-line human-readable
 * account of the decision and is deliberately not machine-parsed — `source` and `priceListId` are
 * the machine-readable part.
 */
export interface IResolvedPrice {
	/** Variant this price is for. */
	variantId: ID;
	/** Winning `product_price` row, absent when the legacy retail price was used. */
	priceId?: ID;
	/** Winning price list, absent for a default price or the legacy fallback. */
	priceListId?: ID;
	/** Currency of the amount. */
	currency: CurrencyCode;
	/** What one unit costs. */
	amount: DecimalString;
	/**
	 * The amount the winner derived from, when it derived one. Null for an `AMOUNT` row, and the
	 * honest "was" figure for a derived winner — the price the base says, before the row's share.
	 */
	baseAmount?: DecimalString;
	/** How the winning row arrived at `amount`. */
	computation?: IPriceComputation;
	/** What it would cost without the winning list: the "was" price. */
	originalAmount?: DecimalString;
	/** Display-only manufacturer's suggested price carried from the winning row. */
	compareAtAmount?: DecimalString;
	/** Whether `amount` already contains tax, after the full precedence chain. */
	taxInclusive: boolean;
	/** Which of the three sources produced `amount`. */
	source: PriceSource;
	/** Names of the conditions that narrowed the candidate set, for the resolution trace. */
	matchedRules: string[];
	/** Notices the resolution raises: a margin floor passed, a base that could not be resolved. */
	notices?: string[];
	/** Human-readable account of the decision. */
	explain: string;
}

/** One quantity band of a price, as a caller may author it. */
export interface IProductPriceTierInput {
	/** Lower bound of the band, inclusive. Null is open-ended. */
	minQuantity?: DecimalString | number;
	/** Upper bound of the band, inclusive. Null is open-ended. */
	maxQuantity?: DecimalString | number;
	/** What one unit costs inside the band. */
	amount: DecimalString | number;
	/** Optional guard rails for this band. */
	costAmount?: DecimalString | number;
	minMarginPercent?: DecimalString | number;
	maxDiscountPercent?: DecimalString | number;
}

/** One row a bulk price upsert may write. */
export interface IProductPriceBulkItem {
	/** Existing row to update; absent means insert. */
	id?: ID;
	/**
	 * Variant the price belongs to. May be omitted only for an **open-scoped** row, whose
	 * applicability is exactly its `rule` rows with `ownerType = PRICE`.
	 */
	variantId?: ID;
	/** Price list the price belongs to; absent means the default price of the variant. */
	priceListId?: ID;
	/** Currency of the amount. */
	currency: CurrencyCode;
	/** Selling price. Absent exactly when the row derives its price. */
	amount?: DecimalString | number;
	/** How the row computes its price; `AMOUNT` when omitted. */
	computeMode?: PriceComputeMode;
	/** Signed fraction of the base; required when `computeMode` is `PERCENT_OFF`. */
	percent?: DecimalString | number;
	/** Which price the derivation starts from; required when `computeMode` is `PERCENT_OFF`. */
	baseSource?: PriceBaseSource;
	/** The list a `PRICE_LIST` derivation reads; required when `baseSource` is `PRICE_LIST`. */
	basePriceListId?: ID;
	/** The multiple the derived amount is quantised to, before the currency rounding boundary. */
	roundTo?: DecimalString | number;
	/** The unit `minQuantity` and `maxQuantity` are expressed in. */
	unitId?: ID;
	/** Display-only "was" price. */
	compareAtAmount?: DecimalString | number;
	/** Cost snapshot used by the margin guard. */
	costAmount?: DecimalString | number;
	/** Tier bounds. */
	minQuantity?: DecimalString | number;
	maxQuantity?: DecimalString | number;
	/** Row lifecycle; defaults to `ACTIVE`. */
	status?: PriceStatus;
	/** Price-level window. */
	startsAt?: Date;
	endsAt?: Date;
	/** Free-form producer trace. */
	metadata?: Record<string, unknown>;
}

/** How a bulk upsert treats rows it was not given. */
export enum PriceBulkMode {
	/** Insert or update exactly the rows supplied and leave every other row alone. */
	UPSERT = 'UPSERT',
	/** Also retire the rows of the mentioned `(variant, priceList)` pairs that were not supplied. */
	REPLACE = 'REPLACE'
}

/*
|--------------------------------------------------------------------------
| The price of one period
|--------------------------------------------------------------------------
*/

/**
 * One request for the price of a single period.
 *
 * Pricing answers what one unit of a variant costs for a context; a caller that bills the same line
 * again on a schedule asks that same question and needs the answer in the currency it bills in. The
 * two interfaces below are that question stated as one call, so such a caller neither reads a price
 * row nor re-derives the precedence between a default price, a sale and an override list: it states
 * the variant, the customer and the currency, and receives the amount and the list it came from.
 */
export interface IRecurringPriceRequest {
	/** Variant being priced. */
	readonly variantId: ID;
	/** Customer the price is resolved for, when a customer-specific price list exists. */
	readonly customerId?: ID;
	/** Currency the price must be expressed in. An amount in another currency is never returned. */
	readonly currency: CurrencyCode;
	/**
	 * What the previous period billed, when the caller knows it.
	 *
	 * It is carried by the request so a caller can state what it last charged, and it deliberately
	 * does not influence the resolution: a price list that changed since the last period must be
	 * honoured, so the answer is always the price in force now and the comparison between the two is
	 * the caller's own.
	 */
	readonly previousAmount?: DecimalString;
}

/** What one period's price resolves to. */
export interface IRecurringPriceResult {
	/** Unit price for one period, exact. */
	readonly unitPrice: DecimalString;
	/** Currency of the price. */
	readonly currency: CurrencyCode;
	/** Price list the price came from, when a list matched rather than the default price. */
	readonly priceListId?: ID;
}
