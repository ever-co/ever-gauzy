import { DecimalString, ID } from '@gauzy/contracts';
import { TaxCategory } from '../tax-category/tax-category.entity';
import { TaxRate } from '../tax-rate/tax-rate.entity';
import { IResolvedTaxRate } from '../tax.types';

/**
 * The TypeScript faces of the SDL this plugin contributes.
 *
 * The schema is written once, in `schema-extensions.ts`, and these interfaces are its argument and
 * result shapes. Nest reads an argument's type from the schema in the schema-first mode the platform
 * composes plugins in, so a resolver names the interface and the schema decides how it is built; keeping
 * the two beside each other is what makes a renamed field a two-line change instead of a runtime surprise.
 */

/** One entry of `sort`, whose direction values are the platform's shared `SortDirection`. */
export interface SortInput<Field extends string> {
	field: Field;
	direction: 'ASC' | 'DESC';
}

/** The cursor pagination argument the platform declares once for every connection. */
export interface PageInput {
	first?: number;
	after?: string;
	last?: number;
	before?: string;
}

/** The page boundaries every connection carries. Declared once by the platform, never by a plugin. */
export interface PageInfo {
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	startCursor?: string;
	endCursor?: string;
}

/** One entry of a connection. */
export interface Edge<Node> {
	node: Node;
	cursor: string;
}

/** A page of records with its boundaries, which is what every list root field returns. */
export interface Connection<Node> {
	nodes: Node[];
	edges: Array<Edge<Node>>;
	totalCount: number;
	pageInfo: PageInfo;
}

/** The fields a category may be sorted by. */
export type TaxCategorySortField = 'NAME' | 'CODE' | 'IS_DEFAULT' | 'CREATED_AT' | 'UPDATED_AT';

/** The fields a rate may be sorted by. */
export type TaxRateSortField =
	| 'PRIORITY'
	| 'RATE'
	| 'NAME'
	| 'CODE'
	| 'COUNTRY_CODE'
	| 'STARTS_AT'
	| 'CREATED_AT'
	| 'UPDATED_AT';

/** How a category listing is narrowed. */
export interface TaxCategoryFilterInput {
	ids?: ID[];
	code?: string;
	name?: string;
	isDefault?: boolean;
	isActive?: boolean;
	/** Matched against the name and the code. */
	search?: string;
	withDeleted?: boolean;
}

/** How a rate listing is narrowed. */
export interface TaxRateFilterInput {
	ids?: ID[];
	taxCategoryId?: ID;
	regionId?: ID;
	countryCode?: string;
	provinceCode?: string;
	postalCodePattern?: string;
	code?: string;
	name?: string;
	providerKey?: string;
	isCompound?: boolean;
	isInclusive?: boolean;
	isDefault?: boolean;
	isActive?: boolean;
	/** Only the rates whose window contains this moment. */
	liveAt?: Date;
	withDeleted?: boolean;
}

/** A page of categories. */
export type TaxCategoryConnection = Connection<TaxCategory>;

/** A page of rates. */
export type TaxRateConnection = Connection<TaxRate>;

/** What a caller supplies to create a category. */
export interface CreateTaxCategoryInput {
	name: string;
	code: string;
	description?: string;
	isDefault?: boolean;
	organizationId?: ID;
	metadata?: Record<string, unknown>;
}

/** What a caller supplies to amend a category. */
export interface UpdateTaxCategoryInput {
	id: ID;
	name?: string;
	code?: string;
	description?: string;
	isDefault?: boolean;
	metadata?: Record<string, unknown>;
}

/** What a caller supplies to create a rate. */
export interface CreateTaxRateInput {
	taxCategoryId: ID;
	name: string;
	/** The rate as a fraction — `0.2` is twenty percent. */
	rate: number | DecimalString;
	regionId?: ID;
	countryCode?: string;
	provinceCode?: string;
	postalCodePattern?: string;
	code?: string;
	isCompound?: boolean;
	isInclusive?: boolean;
	isDefault?: boolean;
	priority?: number;
	providerKey?: string;
	startsAt?: Date;
	endsAt?: Date;
	organizationId?: ID;
	metadata?: Record<string, unknown>;
}

/** What a caller supplies to amend a rate. */
export interface UpdateTaxRateInput {
	id: ID;
	taxCategoryId?: ID;
	name?: string;
	rate?: number | DecimalString;
	regionId?: ID;
	countryCode?: string;
	provinceCode?: string;
	postalCodePattern?: string;
	code?: string;
	isCompound?: boolean;
	isInclusive?: boolean;
	isDefault?: boolean;
	priority?: number;
	providerKey?: string;
	startsAt?: Date;
	endsAt?: Date;
	metadata?: Record<string, unknown>;
}

/** What a caller supplies to resolve a rate for a destination. */
export interface ResolveTaxRateInput {
	taxCategoryId?: ID;
	regionId?: ID;
	countryCode?: string;
	provinceCode?: string;
	postalCode?: string;
	regionTaxInclusive?: boolean;
	/** The moment the rates' windows are evaluated at; the current time when omitted. */
	at?: Date;
}

/** The resolution's result, which is the chain the caller applies. */
export type ResolvedTaxRate = IResolvedTaxRate;
