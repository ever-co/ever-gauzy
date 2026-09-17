import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';

/**
 * The pricing vocabulary.
 *
 * Pricing answers one question — what does one unit of this variant cost, for this context, right
 * now — and the four enumerations below are the closed parts of that answer: what kind of list is
 * competing, whether the list is eligible, whether the price row is eligible, and which scope a
 * tax-inclusivity preference is keyed by. Everything contextual (channel, region, customer group,
 * quantity, window) is data rather than an enumeration, because a business adds a channel far more
 * often than it changes the shape of the question.
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
	/** Variant the price belongs to. */
	variantId: ID;
	/** Price list the price belongs to; absent means the default price of the variant. */
	priceListId?: ID;
	/** Currency of the amount. */
	currency: CurrencyCode;
	/** Selling price. */
	amount: DecimalString | number;
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
