import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { DeepPartial } from 'typeorm';
import { TenantOrganizationBaseEntity } from '@gauzy/core';
import { TaxRate } from './tax-rate/tax-rate.entity';

/**
 * A record as a caller supplies it: the entity's own columns, plus the tenancy columns the base entity
 * carries and a create or update call may state. The columns are declared by the base class, so they are
 * named here and never redeclared by a table.
 */
export type TaxWriteInput<T> = DeepPartial<T> & Partial<TenantOrganizationBaseEntity>;


/**
 * How specific the zone of a resolved rate is.
 *
 * The levels are the ladder the resolver walks, most specific first. The first level that yields a
 * candidate that is live, in its window and not excluded by one of its own narrowing rules wins, and
 * nothing below it is consulted — which is what makes a country-and-province rate beat the organization
 * default rather than compete with it on priority.
 */
export enum TaxRateMatchLevel {
	/** Country, province and postal pattern all state a value. */
	COUNTRY_PROVINCE_POSTAL = 'COUNTRY_PROVINCE_POSTAL',
	/** Country and province state a value. */
	COUNTRY_PROVINCE = 'COUNTRY_PROVINCE',
	/** Only the country states a value. */
	COUNTRY = 'COUNTRY',
	/** The rate is scoped to a region the destination belongs to. */
	REGION = 'REGION',
	/** The rate is the fallback of its category. */
	DEFAULT = 'DEFAULT'
}

/**
 * Where a document is taxed.
 *
 * `regionTaxInclusive` is part of the request rather than something the resolver looks up, because the
 * region is a platform table this capability reads through the caller that already resolved the
 * destination; a rate whose own `isInclusive` is null falls back to it.
 */
export interface TaxDestination {
	/** Region the destination belongs to, when the caller resolved one. */
	regionId?: ID;
	/** ISO 3166-1 alpha-2 country code of the destination. */
	countryCode?: string;
	/** Province, state or subdivision code of the destination. */
	provinceCode?: string;
	/** Postal code of the destination, matched against a rate's `postalCodePattern`. */
	postalCode?: string;
	/** Whether prices at this destination already include tax. */
	regionTaxInclusive?: boolean;
}

/**
 * Evaluates a rate's narrowing rules.
 *
 * A rate's conditional rules are `rule` rows whose `ownerType` is `TAX_RATE` and whose `ownerId` is the
 * rate's id. They narrow, they never widen: a rate whose zone matched is discarded when one of its rules
 * does not match the document's context. Evaluating them is the rule engine's job and the rule engine
 * belongs to the caller that assembled the context, so the resolver asks through this predicate rather
 * than reading rule rows itself. A rate with no matcher is treated as unconstrained.
 *
 * @param rate The candidate rate.
 * @returns Whether every rule attached to the rate matched the context.
 */
export type TaxRuleMatcher = (rate: TaxRate) => boolean | Promise<boolean>;

/**
 * A request to resolve the rates that apply to a destination.
 */
export interface TaxResolutionRequest extends TaxDestination {
	/** The category to resolve within; the organization default is used when it is omitted. */
	taxCategoryId?: ID;
	/** The moment the rates' validity windows are evaluated at; the current time when omitted. */
	now?: Date;
	/** Rule narrowing, supplied by the caller that owns the evaluation context. */
	matchesRules?: TaxRuleMatcher;
}

/**
 * One rate that won its category's resolution.
 *
 * The result is a chain rather than a single row, because a jurisdiction may apply more than one rate to
 * the same base: the rates that are not compound are applied first, and every compound rate is applied
 * on the running total of the ones before it.
 */
export interface IResolvedTaxRate {
	/** The rate row this came from; null only for the legacy per-variant fallback. */
	taxRateId?: ID;
	/** The category the rate belongs to. */
	taxCategoryId: ID;
	/** Jurisdiction code of the rate, copied onto the tax line. */
	code?: string;
	/** The rate's name at resolution time. */
	name: string;
	/** The rate as a fraction — `0.200000` is twenty percent. */
	rate: DecimalString;
	/** Whether the rate compounds on the running total of the earlier rates of the chain. */
	isCompound: boolean;
	/** Whether the amount is already inside the price. */
	isInclusive: boolean;
	/** Tie-break among equally specific rates. */
	priority: number;
	/** External engine that owns the rate, when one does. */
	providerKey?: string;
	/** The level of the ladder the rate won at. */
	matchLevel: TaxRateMatchLevel;
	/** True for the rate the ladder stopped at; the compound rates of the chain follow it. */
	isWinner: boolean;
}

/**
 * One line to compute tax for.
 *
 * The amount is the line's net when the resolved rates are exclusive and the line's gross when they are
 * inclusive; the resolver decides which it is from the resolved chain, exactly as the totals chain
 * decides it from the price row.
 */
export interface TaxCalculationLineRequest extends TaxDestination {
	/** The caller's identifier for the line, echoed back so a result can be matched to its line. */
	referenceId?: ID;
	/** The category to tax the line in; the request-level or organization default applies when omitted. */
	taxCategoryId?: ID;
	/** Net or gross amount of the line, as an exact decimal string. */
	amount: DecimalString;
}

/**
 * A request to compute the tax of a set of amounts.
 */
export interface TaxCalculationRequest extends TaxDestination {
	/** Currency the amounts are expressed in. */
	currency: CurrencyCode;
	/** The lines to compute. */
	lines: TaxCalculationLineRequest[];
	/** The category every line that names none is taxed in; the organization default applies when omitted. */
	taxCategoryId?: ID;
	/** The moment the rates' validity windows are evaluated at; the current time when omitted. */
	now?: Date;
	/** Rule narrowing, supplied by the caller that owns the evaluation context. */
	matchesRules?: TaxRuleMatcher;
	/** Tax a destination no rate matches at zero instead of refusing the calculation. */
	allowUntaxedCatalog?: boolean;
}

/**
 * One rate's contribution to one line, in the shape of a tax-line row.
 *
 * This is a draft: the tax ledger belongs to the platform, and the caller persists these rows through it.
 * The `taxRateId`, `code`, `name`, `rate`, `isCompound` and `isInclusive` members are snapshots taken
 * when the tax was computed, so a later edit of the rate cannot rewrite what a placed document was
 * charged.
 */
export interface ITaxLineDraft {
	/** The rate row that applied; null when the amount came from the legacy per-variant fallback. */
	taxRateId?: ID;
	/** Jurisdiction or rate code. */
	code?: string;
	/** The rate's name at calculation time. */
	name: string;
	/** The rate as a fraction. */
	rate: DecimalString;
	/** Whether the amount compounds on the earlier amounts of the same line. */
	isCompound: boolean;
	/** Whether the amount is already inside the price. */
	isInclusive: boolean;
	/** The amount the rate was applied to. */
	baseAmount: DecimalString;
	/** The resulting tax amount, rounded once at the currency's scale. */
	amount: DecimalString;
	/** Currency of the amounts. */
	currency: CurrencyCode;
	/** External engine that produced the amount, when one did. */
	providerKey?: string;
	/** Jurisdiction name, engine request id, exemption reason. */
	metadata?: Record<string, unknown>;
}

/**
 * The tax of one line.
 */
export interface TaxCalculationLineResult {
	/** The caller's identifier for the line. */
	referenceId?: ID;
	/** The category the line was taxed in. */
	taxCategoryId: ID;
	/** Currency of the amounts. */
	currency: CurrencyCode;
	/** The line's amount without tax. */
	netAmount: DecimalString;
	/** The line's tax. */
	taxAmount: DecimalString;
	/** What the customer pays for the line: the net plus the tax, or the gross that was given. */
	grossAmount: DecimalString;
	/** One draft per rate that applied, in the order the rates were applied. */
	taxLines: ITaxLineDraft[];
}

/**
 * The tax of a set of lines.
 */
export interface TaxCalculationResult {
	/** Currency of the amounts. */
	currency: CurrencyCode;
	/** Exact sum of the lines' amounts without tax. */
	netTotal: DecimalString;
	/** Exact sum of the lines' tax. */
	taxTotal: DecimalString;
	/** Exact sum of what the customer pays. */
	grossTotal: DecimalString;
	/** One entry per line, in the order the lines were given. */
	lines: TaxCalculationLineResult[];
}
