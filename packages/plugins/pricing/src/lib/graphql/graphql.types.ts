import { GraphqlConnection, IConnectionPageSelection } from '@gauzy/core';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import {
	IProductPriceBulkItem,
	IResolvedPrice,
	PriceBaseSource,
	PriceBulkMode,
	PriceComputeMode,
	PriceListStatus,
	PriceListType,
	PricePreferenceAttribute,
	PriceStatus
} from '../pricing.types';
import { ExchangeRate } from '../exchange-rate/exchange-rate.entity';
import { PriceList } from '../price-list/price-list.entity';
import { PricePreference } from '../price-preference/price-preference.entity';
import { ProductPrice } from '../product-price/product-price.entity';

/**
 * The TypeScript side of the pricing schema contribution.
 *
 * These are the shapes the SDL declares, written once so a resolver's signature and the document it
 * answers cannot drift: the schema is authoritative, and a mismatch here is a compile error rather
 * than a field that silently resolves to null.
 */

/*
|--------------------------------------------------------------------------
| Connections
|--------------------------------------------------------------------------
*/

/**
 * Cursor pagination, exactly as the kernel declares `PageInput`.
 *
 * `first`/`after` walk forwards and `last`/`before` walk backwards, both cursors exclusive. A request that
 * states both a cursor window and a `limit`/`offset` window is refused rather than silently preferring one,
 * because the two walk differently over rows that are being inserted.
 *
 * The interface was declared here before the kernel owned it, and it was the same four members — which is
 * what made two `PageInput`s and one schema a divergence waiting to happen.
 */
export type IPageInput = IConnectionPageSelection;

/** The boundary of a page, exactly as the kernel declares `PageInfo`. */
export type IPageInfo = GraphqlConnection<unknown>['pageInfo'];

/**
 * One page of rows, as every connection root field of this domain answers.
 *
 * Bound to the kernel's connection rather than restated: this domain's page was `{ items, total, pageInfo }`,
 * which is a fifth spelling of a page and the one a client could not walk by cursor.
 */
export type IConnection<T> = GraphqlConnection<T>;

/*
|--------------------------------------------------------------------------
| Price lists
|--------------------------------------------------------------------------
*/

/** The sortable fields of a price list. */
export enum PriceListSortField {
	NAME = 'NAME',
	CODE = 'CODE',
	PRIORITY = 'PRIORITY',
	STATUS = 'STATUS',
	STARTS_AT = 'STARTS_AT',
	ENDS_AT = 'ENDS_AT',
	CREATED_AT = 'CREATED_AT',
	UPDATED_AT = 'UPDATED_AT'
}

/** How to order a list of price lists. */
export interface IPriceListSort {
	field: PriceListSortField;
	direction?: 'ASC' | 'DESC';
}

/** How to narrow a list of price lists. */
export interface IPriceListFilter {
	ids?: ID[];
	code?: string;
	name?: string;
	type?: PriceListType;
	status?: PriceListStatus;
	currency?: CurrencyCode;
	channelId?: ID;
	customerGroupId?: ID;
	regionId?: ID;
	isTaxInclusive?: boolean;
}

/** The fields a price list is created with. */
export interface ICreatePriceListInput {
	organizationId?: ID;
	name: string;
	code: string;
	description?: string;
	type?: PriceListType;
	status?: PriceListStatus;
	priority?: number;
	currency?: CurrencyCode;
	channelId?: ID;
	customerGroupId?: ID;
	regionId?: ID;
	startsAt?: Date;
	endsAt?: Date;
	isTaxInclusive?: boolean;
	metadata?: Record<string, unknown>;
}

/** The fields a price list is updated with. */
export interface IUpdatePriceListInput extends Partial<Omit<ICreatePriceListInput, 'organizationId'>> {
	id: ID;
}

/** What deleting a price list did. */
export interface IDeletePriceListPayload {
	id: ID;
	deleted: boolean;
	hard: boolean;
}

/*
|--------------------------------------------------------------------------
| Product prices
|--------------------------------------------------------------------------
*/

/** The sortable fields of a price row. */
export enum ProductPriceSortField {
	AMOUNT = 'AMOUNT',
	MIN_QUANTITY = 'MIN_QUANTITY',
	STATUS = 'STATUS',
	CREATED_AT = 'CREATED_AT',
	UPDATED_AT = 'UPDATED_AT'
}

/** How to order a list of price rows. */
export interface IProductPriceSort {
	field: ProductPriceSortField;
	direction?: 'ASC' | 'DESC';
}

/** How to narrow a list of price rows. */
export interface IProductPriceFilter {
	ids?: ID[];
	variantId?: ID;
	variantIds?: ID[];
	priceListId?: ID;
	currency?: CurrencyCode;
	status?: PriceStatus;
	computeMode?: PriceComputeMode;
	/** Only the rows that derive from this list. */
	basePriceListId?: ID;
}

/**
 * The fields a price row is created with.
 *
 * `variantId` and `amount` are both optional, and for the same reason: a row either names the variant
 * it prices or is scoped by its rules, and it either states an amount or says how to derive one.
 */
export interface ICreateProductPriceInput {
	organizationId?: ID;
	variantId?: ID;
	priceListId?: ID;
	currency: CurrencyCode;
	amount?: DecimalString;
	computeMode?: PriceComputeMode;
	percent?: DecimalString;
	baseSource?: PriceBaseSource;
	basePriceListId?: ID;
	roundTo?: DecimalString;
	unitId?: ID;
	compareAtAmount?: DecimalString;
	costAmount?: DecimalString;
	minQuantity?: DecimalString;
	maxQuantity?: DecimalString;
	taxInclusive?: boolean;
	minMarginPercent?: DecimalString;
	maxDiscountPercent?: DecimalString;
	status?: PriceStatus;
	startsAt?: Date;
	endsAt?: Date;
	metadata?: Record<string, unknown>;
}

/** The fields a price row is updated with. */
export interface IUpdateProductPriceInput extends Partial<Omit<ICreateProductPriceInput, 'organizationId' | 'variantId'>> {
	id: ID;
}

/** What deleting a price row did. */
export interface IDeleteProductPricePayload {
	id: ID;
	deleted: boolean;
	hard: boolean;
}

/** One row of a bulk price batch. */
export interface IProductPriceBulkItemInput extends IProductPriceBulkItem {}

/** A price matrix to write. */
export interface IBulkUpsertProductPricesInput {
	organizationId?: ID;
	items: IProductPriceBulkItemInput[];
	mode?: PriceBulkMode;
	atomic?: boolean;
}

/** One row of a bulk batch that was refused. */
export interface IBulkPriceFailure {
	index: number;
	variantId?: ID;
	message: string;
}

/** What a bulk price upsert did. */
export interface IBulkUpsertProductPricesPayload {
	succeeded: ProductPrice[];
	failed: IBulkPriceFailure[];
	succeededCount: number;
	failedCount: number;
}

/*
|--------------------------------------------------------------------------
| Price preferences
|--------------------------------------------------------------------------
*/

/** The sortable fields of a tax-inclusivity preference. */
export enum PricePreferenceSortField {
	ATTRIBUTE = 'ATTRIBUTE',
	VALUE = 'VALUE',
	CREATED_AT = 'CREATED_AT',
	UPDATED_AT = 'UPDATED_AT'
}

/** How to order a list of tax-inclusivity preferences. */
export interface IPricePreferenceSort {
	field: PricePreferenceSortField;
	direction?: 'ASC' | 'DESC';
}

/** How to narrow a list of tax-inclusivity preferences. */
export interface IPricePreferenceFilter {
	ids?: ID[];
	attribute?: PricePreferenceAttribute;
	value?: string;
}

/** The answer a scope gives about tax-inclusive presentation. */
export interface IUpdatePricePreferenceInput {
	id: ID;
	isTaxInclusive: boolean;
}

/*
|--------------------------------------------------------------------------
| Exchange rates
|--------------------------------------------------------------------------
*/

/** The sortable fields of an exchange rate. */
export enum ExchangeRateSortField {
	FROM_CURRENCY = 'FROM_CURRENCY',
	TO_CURRENCY = 'TO_CURRENCY',
	VALID_FROM = 'VALID_FROM',
	RATE = 'RATE',
	CREATED_AT = 'CREATED_AT'
}

/** How to order a list of exchange rates. */
export interface IExchangeRateSort {
	field: ExchangeRateSortField;
	direction?: 'ASC' | 'DESC';
}

/** How to narrow a list of exchange rates. */
export interface IExchangeRateFilter {
	ids?: ID[];
	fromCurrency?: CurrencyCode;
	toCurrency?: CurrencyCode;
	isManual?: boolean;
}

/** The fields an exchange rate is created with. */
export interface ICreateExchangeRateInput {
	organizationId?: ID;
	fromCurrency: CurrencyCode;
	toCurrency: CurrencyCode;
	rate: DecimalString;
	providerKey?: string;
	validFrom: Date;
	validUntil?: Date;
	isManual?: boolean;
}

/** The fields an exchange rate is updated with. */
export interface IUpdateExchangeRateInput {
	id: ID;
	rate?: DecimalString;
	providerKey?: string;
	validUntil?: Date;
	isManual?: boolean;
}

/** What deleting an exchange rate did. */
export interface IDeleteExchangeRatePayload {
	id: ID;
	deleted: boolean;
	hard: boolean;
}

/*
|--------------------------------------------------------------------------
| Resolution
|--------------------------------------------------------------------------
*/

/** The context a price is resolved against. */
export interface IResolvePriceInput {
	variantIds: ID[];
	currency: CurrencyCode;
	quantity?: DecimalString;
	channelId?: ID;
	regionId?: ID;
	customerId?: ID;
	customerGroupIds?: ID[];
	date?: Date;
}

/** The rows a connection root field answers with, by type name. */
export type PriceListConnection = IConnection<PriceList>;
export type ProductPriceConnection = IConnection<ProductPrice>;
export type PricePreferenceConnection = IConnection<PricePreference>;
export type ExchangeRateConnection = IConnection<ExchangeRate>;

/** The resolution a query answers with, unchanged from the service's own shape. */
export type ResolvedPrice = IResolvedPrice;
