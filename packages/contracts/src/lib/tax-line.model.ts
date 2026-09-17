import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { CurrencyCode, DecimalString } from './money.model';

/**
 * What a tax line is the breakdown of.
 */
export enum TaxLineOwnerType {
	/** Tax breakdown of one cart line. */
	CART_LINE = 'CART_LINE',
	/** Tax breakdown of one cart shipping method. */
	CART_SHIPPING = 'CART_SHIPPING',
	/** Tax breakdown of one order line; the basis an invoice reads. */
	ORDER_LINE = 'ORDER_LINE',
	/** Tax breakdown of one order shipping method. */
	ORDER_SHIPPING = 'ORDER_SHIPPING',
	/** Tax reversal attributable to one return line. */
	RETURN_LINE = 'RETURN_LINE'
}

/**
 * One rate's contribution to the tax of one owner.
 *
 * The breakdown is stored as rows rather than as a single amount so that a compound or
 * multi-jurisdiction tax is fully represented and can be explained line by line. `name` and `rate`
 * are snapshots taken when the tax was computed: renaming a rate must not rewrite what an already
 * placed document was charged.
 */
export interface ITaxLine extends IBasePerTenantAndOrganizationEntityModel {
	/** What the line is the breakdown of. */
	ownerType: TaxLineOwnerType;

	/** Id of the owning row. Polymorphic, so it carries no foreign key. */
	ownerId: ID;

	/** The rate row that applied; null when the rate came from an external engine. */
	taxRateId?: ID;

	/** Jurisdiction or rate code, for example `US-CA-SALES`. */
	code?: string;

	/** The rate's name at calculation time. */
	name: string;

	/** The rate as a fraction, for example `0.200000`. */
	rate: DecimalString;

	/** Whether the line compounds on the running total of the earlier lines. */
	isCompound: boolean;

	/** Whether the line's amount is already inside the price. */
	isInclusive: boolean;

	/** The amount the rate was applied to. */
	baseAmount: DecimalString;

	/** The resulting tax amount. */
	amount: DecimalString;

	/** Currency of the amounts. */
	currency: CurrencyCode;

	/** External tax engine that produced the line, when one did. */
	providerKey?: string;

	/** Jurisdiction name, engine request id, exemption reason. */
	metadata?: Record<string, unknown>;
}

/**
 * Input for appending one tax line to the ledger.
 */
export interface ITaxLineCreateInput
	extends Partial<Omit<ITaxLine, 'id' | 'ownerType' | 'ownerId' | 'name' | 'rate' | 'amount' | 'currency'>> {
	ownerType: TaxLineOwnerType;
	ownerId: ID;
	name: string;
	rate: DecimalString;
	amount: DecimalString;
	currency: CurrencyCode;
}

/**
 * One rate's aggregate across the lines of an owner.
 */
export interface ITaxSummaryLine {
	/** Rate code the group was keyed on, when the lines carry one. */
	code?: string;

	/** The rate's name. */
	name: string;

	/** The rate as a fraction. */
	rate: DecimalString;

	/** Exact sum of the group's taxable bases. */
	baseAmount: DecimalString;

	/** Exact sum of the group's tax amounts. */
	amount: DecimalString;

	/** Whether every line in the group compounds. */
	isCompound: boolean;

	/** Whether every line in the group is tax inclusive. */
	isInclusive: boolean;

	/** Currency of the amounts. */
	currency: CurrencyCode;

	/** How many ledger rows the aggregate covers. */
	lineCount: number;
}

/**
 * The tax summary of one owner: what it was taxed, grouped by rate.
 */
export interface ITaxSummary {
	/** The owning row. */
	ownerType: TaxLineOwnerType;
	ownerId: ID;

	/** Currency of the amounts. */
	currency: CurrencyCode;

	/** Exact sum of every line's tax amount. */
	total: DecimalString;

	/** Exact sum of every line's taxable base. */
	baseTotal: DecimalString;

	/** One entry per rate that applied. */
	rates: ITaxSummaryLine[];
}
