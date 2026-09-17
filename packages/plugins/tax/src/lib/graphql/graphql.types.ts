import { DecimalString, ID } from '@gauzy/contracts';
import { TaxCategory } from '../tax-category/tax-category.entity';
import { TaxRate } from '../tax-rate/tax-rate.entity';
import { TaxRatePart } from '../tax-rate-part/tax-rate-part.entity';
import { TaxRegimeRate } from '../tax-regime-rate/tax-regime-rate.entity';
import { TaxRegime } from '../tax-regime/tax-regime.entity';
import {
	IResolvedTaxPart,
	IResolvedTaxRate,
	IResolvedTaxRegime,
	TaxAmountType,
	TaxDirection,
	TaxPartType,
	TaxRegimeMatchLevel
} from '../tax.types';

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
	| 'DIRECTION'
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
	/** The arithmetic of the rate, which its parts may override. */
	amountType?: TaxAmountType;
	/** The side of a document the rate applies to. */
	direction?: TaxDirection;
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
	/** The arithmetic of the rate; a percentage when it is omitted. */
	amountType?: TaxAmountType;
	/** The side of a document the rate applies to; a sale when it is omitted. */
	direction?: TaxDirection;
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
	amountType?: TaxAmountType;
	direction?: TaxDirection;
	providerKey?: string;
	startsAt?: Date;
	endsAt?: Date;
	metadata?: Record<string, unknown>;
}

/** What a caller supplies to resolve a rate for a destination. */
export interface ResolveTaxRateInput {
	taxCategoryId?: ID;
	/** The regime assigned to the party; the destination is matched when it is omitted. */
	taxRegimeId?: ID;
	/** Whether the party states a usable registration number, which a regime may require. */
	partyTaxRegistrationPresent?: boolean;
	/** The side of the document being taxed; a sale when it is omitted. */
	documentDirection?: TaxDirection;
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

/** One part of a resolved rate, as it will be applied to a document. */
export type ResolvedTaxPart = IResolvedTaxPart;

/** The regime a document is taxed under. */
export type ResolvedTaxRegime = IResolvedTaxRegime;

/** The arithmetic of a rate and of its parts. */
export type TaxAmountTypeValue = TaxAmountType;

/** What a part of a rate does with its share of the rate. */
export type TaxPartTypeValue = TaxPartType;

/** The side of a document a rate applies to. */
export type TaxDirectionValue = TaxDirection;

/** How a regime was chosen for a document. */
export type TaxRegimeMatchLevelValue = TaxRegimeMatchLevel;

/** One part of a rate, as the resource carries it. */
export type TaxRatePartNode = TaxRatePart;

/** One membership row, as the regime resource carries it. */
export type TaxRegimeRateNode = TaxRegimeRate;

/** The fields a regime may be sorted by. */
export type TaxRegimeSortField = 'PRIORITY' | 'NAME' | 'CODE' | 'STARTS_AT' | 'CREATED_AT' | 'UPDATED_AT';

/** How a regime listing is narrowed. */
export interface TaxRegimeFilterInput {
	ids?: ID[];
	code?: string;
	name?: string;
	regionId?: ID;
	countryCode?: string;
	provinceCode?: string;
	postalCodePattern?: string;
	requiresPartyTaxRegistration?: boolean;
	isActive?: boolean;
	/** Only the regimes whose window contains this moment. */
	liveAt?: Date;
	withDeleted?: boolean;
}

/** A page of regimes. */
export type TaxRegimeConnection = Connection<TaxRegime>;

/** A page of the parts of one rate. */
export type TaxRatePartConnection = Connection<TaxRatePart>;

/** What a caller supplies to create a regime. */
export interface CreateTaxRegimeInput {
	name: string;
	code: string;
	priority?: number;
	regionId?: ID;
	countryCode?: string;
	provinceCode?: string;
	postalCodePattern?: string;
	requiresPartyTaxRegistration?: boolean;
	startsAt?: Date;
	endsAt?: Date;
	description?: string;
	organizationId?: ID;
	metadata?: Record<string, unknown>;
}

/** What a caller supplies to amend a regime. */
export interface UpdateTaxRegimeInput {
	id: ID;
	name?: string;
	code?: string;
	priority?: number;
	regionId?: ID;
	countryCode?: string;
	provinceCode?: string;
	postalCodePattern?: string;
	requiresPartyTaxRegistration?: boolean;
	startsAt?: Date;
	endsAt?: Date;
	description?: string;
	metadata?: Record<string, unknown>;
}

/** What a caller supplies to set which rates a regime selects. */
export interface SetTaxRegimeRatesInput {
	id: ID;
	taxRateIds: ID[];
}

/** What a caller supplies to resolve the regime of a document. */
export interface ResolveTaxRegimeInput {
	taxRegimeId?: ID;
	partyTaxRegistrationPresent?: boolean;
	regionId?: ID;
	countryCode?: string;
	provinceCode?: string;
	postalCode?: string;
	/** The moment the regimes' windows are evaluated at; the current time when omitted. */
	at?: Date;
}

/** One part as a caller supplies it when a rate's breakdown is written. */
export interface TaxRatePartInput {
	sequence?: number;
	partType?: TaxPartType;
	factorPercent: number | DecimalString;
	baseFactor?: number | DecimalString;
	amountType?: TaxAmountType;
	fixedAmount?: number | DecimalString;
	fixedCurrency?: string;
	postingKey?: string;
	label?: string;
	metadata?: Record<string, unknown>;
}

/** What a caller supplies to replace the parts of a rate. */
export interface SetTaxRatePartsInput {
	id: ID;
	/** The complete ordered list; an empty list returns the rate to its one implied part. */
	parts: TaxRatePartInput[];
}
