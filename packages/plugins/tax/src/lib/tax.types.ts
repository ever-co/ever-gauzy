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
 * What a part of a rate does with its share of the rate.
 *
 * A rate is not one percentage: it is an ordered list of parts, and this is what tells the two kinds
 * apart. A `BASE` part declares a taxable base and produces no amount, which is how a rate states that
 * it is assessed on a reduced base; a `TAX` part produces exactly one `tax_line` row.
 */
export enum TaxPartType {
	/** Declares a taxable base without producing an amount. */
	BASE = 'BASE',
	/** Produces exactly one tax line for the owner. */
	TAX = 'TAX'
}

/**
 * How a rate or a part of one arrives at its amount.
 *
 * `PERCENT` applies the fraction to the part's own base; `FIXED` contributes a stated amount per unit of
 * the owner's quantity, which is what an excise, a deposit, an eco-fee or a stamp duty is. One
 * vocabulary serves the rate and its parts deliberately: a rate declares its default arithmetic and a
 * part may override it.
 */
export enum TaxAmountType {
	/** The part contributes its share of the rate applied to its base. */
	PERCENT = 'PERCENT',
	/** The part contributes a fixed amount per unit of the owner's quantity. */
	FIXED = 'FIXED'
}

/**
 * Which document direction a rate applies to.
 *
 * A rate that applies to a sale is not automatically the one that applies to a purchase: input tax, a
 * reverse charge and a withholding all live on the purchase side, and the same code legitimately exists
 * on both sides at different rates. `SALE` is the default, so every rate written before a direction
 * existed keeps its behaviour on the sales path.
 */
export enum TaxDirection {
	/** Applies to a sale. */
	SALE = 'SALE',
	/** Applies to a purchase — input tax and the purchase leg of a reverse charge. */
	PURCHASE = 'PURCHASE',
	/** Applies to either direction. */
	BOTH = 'BOTH'
}

/**
 * How a regime was chosen for a document.
 *
 * The party override always wins and the destination levels follow, most specific first — the same
 * ladder a rate's zone is matched at, because a regime is matched on the same destination.
 */
export enum TaxRegimeMatchLevel {
	/** The party carried the regime explicitly, so nothing was matched. */
	PARTY_OVERRIDE = 'PARTY_OVERRIDE',
	/** Country, province and postal pattern all state a value. */
	COUNTRY_PROVINCE_POSTAL = 'COUNTRY_PROVINCE_POSTAL',
	/** Country and province state a value. */
	COUNTRY_PROVINCE = 'COUNTRY_PROVINCE',
	/** Only the country states a value. */
	COUNTRY = 'COUNTRY',
	/** The regime is scoped to a region the destination belongs to. */
	REGION = 'REGION'
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
 * A request to select the regime a document is taxed under.
 *
 * The override is the party's own assignment and always wins; when it is absent the most specific
 * matching regime of the destination is selected, and when nothing matches the general set applies —
 * which is the behaviour every rate had before regimes existed.
 */
export interface TaxRegimeSelectionRequest extends TaxDestination {
	/** The regime manually assigned to the party, when the caller resolved one. */
	taxRegimeId?: ID;
	/** Whether the party carries a usable tax registration number, as a regime may require. */
	partyTaxRegistrationPresent?: boolean;
	/** The moment the regimes' validity windows are evaluated at; the current time when omitted. */
	now?: Date;
}

/**
 * A request to resolve the rates that apply to a destination.
 */
export interface TaxResolutionRequest extends TaxDestination {
	/** The category to resolve within; the organization default is used when it is omitted. */
	taxCategoryId?: ID;
	/** The regime manually assigned to the party; the destination is matched when it is omitted. */
	taxRegimeId?: ID;
	/** Whether the party carries a usable tax registration number, as a regime may require. */
	partyTaxRegistrationPresent?: boolean;
	/** The direction of the document being taxed; a sale when it is omitted. */
	documentDirection?: TaxDirection;
	/** The moment the rates' validity windows are evaluated at; the current time when omitted. */
	now?: Date;
	/** Rule narrowing, supplied by the caller that owns the evaluation context. */
	matchesRules?: TaxRuleMatcher;
}

/**
 * One part of a resolved rate, as it will be applied to a document.
 *
 * The membership rule and the arithmetic are stated once: a rate with no part row is one implied part —
 * `TAX`, 100 %, base 1 — so every rate written before parts existed keeps its exact output, and the
 * drafts of such a rate are what they always were.
 */
export interface IResolvedTaxPart {
	/** The part row this came from; absent for the implied part of a rate that declares none. */
	taxRatePartId?: ID;
	/** The order the part is applied in. */
	sequence: number;
	/** Whether the part declares a base or produces an amount. */
	partType: TaxPartType;
	/** Signed share of the rate's computed amount this part carries. */
	factorPercent: DecimalString;
	/** Share of the owner's net-after-discount this part is computed on. */
	baseFactor: DecimalString;
	/** How the part arrives at its amount. */
	amountType: TaxAmountType;
	/** The amount contributed per unit of the owner's quantity, for a fixed part. */
	fixedAmount?: DecimalString;
	/** Currency of the fixed amount. Every monetary column states its currency. */
	fixedCurrency?: CurrencyCode;
	/** The code the receiving accounting system posts this part under. */
	postingKey?: string;
	/** Printed name of the part; falls back to the rate's name. */
	label?: string;
}

/**
 * One rate that won its category's resolution.
 *
 * The result is a chain rather than a single row, because a jurisdiction may apply more than one rate to
 * the same base: the rates that are not compound are applied first, and every compound rate is applied
 * on the running total of the ones before it. Within a rate its parts apply in `sequence` order.
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
	/** The arithmetic of the rate, which its parts may override. */
	amountType: TaxAmountType;
	/** The direction of document the rate applies to. */
	direction: TaxDirection;
	/** The ordered parts the rate is made of; one implied part when it declares none. */
	parts: IResolvedTaxPart[];
	/** External engine that owns the rate, when one does. */
	providerKey?: string;
	/** The level of the ladder the rate won at. */
	matchLevel: TaxRateMatchLevel;
	/** True for the rate the ladder stopped at; the compound rates of the chain follow it. */
	isWinner: boolean;
}

/**
 * The regime a document is taxed under.
 *
 * A regime is the named set of rates a party or a destination switches to. Selecting one is not a
 * narrowing of the candidate set: the rates it does not name are the rates it removes, which is the one
 * mechanism that can make the same catalogue line legally sellable in many jurisdictions.
 */
export interface IResolvedTaxRegime {
	/** The regime row that was selected. */
	taxRegimeId: ID;
	/** Stable code the organization quotes, for example `DOMESTIC` or `EXPORT`. */
	code?: string;
	/** Human readable name. */
	name?: string;
	/** Tie-break among equally specific regimes; the higher priority wins. */
	priority: number;
	/** How the regime was chosen. */
	matchLevel: TaxRegimeMatchLevel;
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
	/**
	 * The quantity the owner carries, as an exact decimal string; one when it is omitted.
	 *
	 * A fixed part contributes its amount per unit of this quantity, and the quantity is snapshotted on
	 * the tax line, so a fixed tax's evidence is complete: without it the unit the amount was applied per
	 * unit of is absent from the breakdown.
	 */
	quantity?: DecimalString;
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
	/** The regime manually assigned to the party; the destination is matched when it is omitted. */
	taxRegimeId?: ID;
	/** Whether the party carries a usable tax registration number, as a regime may require. */
	partyTaxRegistrationPresent?: boolean;
	/** The direction of the document being taxed; a sale when it is omitted. */
	documentDirection?: TaxDirection;
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
 * charged. A rate of several parts produces one draft per part, and the `taxRatePartId`, `postingKey`,
 * `quantity` and `taxRegimeId` members are the snapshots that make the breakdown reconcilable.
 */
export interface ITaxLineDraft {
	/** The rate row that applied; null when the amount came from the legacy per-variant fallback. */
	taxRateId?: ID;
	/** The part of the rate that produced this row; absent for a rate that declares none. */
	taxRatePartId?: ID;
	/** The regime the document was taxed under; no foreign key, because it is evidence. */
	taxRegimeId?: ID;
	/** Snapshot of the part's posting code; absent when the part declares none. */
	postingKey?: string;
	/** Jurisdiction or rate code. */
	code?: string;
	/** The rate's name at calculation time, or the part's label when it has one. */
	name: string;
	/** The rate as a fraction. */
	rate: DecimalString;
	/** Whether the amount compounds on the earlier amounts of the same line. */
	isCompound: boolean;
	/** Whether the amount is already inside the price. */
	isInclusive: boolean;
	/** The amount the rate was applied to — the part's own base. */
	baseAmount: DecimalString;
	/** The resulting tax amount, rounded once at the currency's scale. */
	amount: DecimalString;
	/** The owner's quantity at computation time, which a fixed part is applied per unit of. */
	quantity?: DecimalString;
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
	/** The regime the line was taxed under, when a regime was selected for the document. */
	taxRegimeId?: ID;
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
