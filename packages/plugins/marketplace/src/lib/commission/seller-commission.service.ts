import { BadRequestException, Injectable } from '@nestjs/common';
import {
	CommissionBasis,
	CommissionSource,
	DecimalString,
	ICommissionComputationInput,
	ICommissionTier,
	IResolvedCommission,
	RoundingMode
} from '@gauzy/contracts';
import { Money } from '@gauzy/core';

/**
 * A resolved commission and the arithmetic it produced, ready to be snapshotted onto a ledger row.
 */
export interface ICommissionOutcome {
	/** The basis convention actually used. */
	basis: CommissionBasis;
	/** The amount the rate applied to. */
	basisAmount: DecimalString;
	/** The rate actually applied; zero for the fixed-fee basis. */
	rate: DecimalString;
	/** The commission, rounded once at the currency's precision. */
	commissionAmount: DecimalString;
	/** The seller's entitlement: the gross plus tax plus the seller's own discount, less the commission. */
	netAmount: DecimalString;
	/** Where the rate came from, so a statement can explain itself. */
	source: CommissionSource;
}

/**
 * Resolves and computes the platform's commission on a seller-owned line.
 *
 * Two rules carry the whole design:
 *
 * 1. **The commission is computed once, and then it is a fact.** The resolved rate, basis and basis
 *    amount are snapshotted onto the ledger row, so a later change to the offering, to the seller or
 *    to the platform's default never moves a past transaction and a statement is reproducible from
 *    its own columns.
 * 2. **Every amount goes through the platform's money helper.** No arithmetic is written inline: the
 *    basis is built by exact decimal addition, the commission is one multiplication and one rounding
 *    at the currency's precision, and the seller's net is an exact subtraction of two already rounded
 *    values — which is what leaves no residue between the two sides of a ledger row.
 */
@Injectable()
export class SellerCommissionService {
	/** The setting key the platform's own default commission is stored under. */
	static readonly DEFAULT_COMMISSION_SETTING = 'marketplace.defaultCommission';

	/**
	 * Resolves which commission applies to a line, field by field down one chain.
	 *
	 * The resolution is *total per field, not per group*: a seller that sets only a rate and no basis
	 * inherits the platform's basis rather than silently producing a zero commission, and a half
	 * configured participant cannot turn the platform's fee off by omission.
	 *
	 * @param offering The offering's own override, when it sets one.
	 * @param seller The seller's default, when it sets one.
	 * @param platformDefault The platform default from the tenant settings, when the tenant set one.
	 * @returns The resolved commission.
	 * @throws BadRequestException when no source supplies a rate and the basis is not a fixed fee.
	 */
	resolve(
		offering: Partial<IResolvedCommission> | undefined,
		seller: Partial<IResolvedCommission> | undefined,
		platformDefault: Partial<IResolvedCommission> | undefined
	): IResolvedCommission {
		const sources: Array<[Partial<IResolvedCommission> | undefined, CommissionSource]> = [
			[offering, CommissionSource.OFFERING],
			[seller, CommissionSource.SELLER],
			[platformDefault, CommissionSource.PLATFORM]
		];

		const basis = this.firstDefined(sources, (source) => source.basis) ?? CommissionBasis.ITEM_SUBTOTAL;
		const tiers = this.firstDefined(sources, (source) => source.tiers);
		const rate = this.firstDefined(sources, (source) => source.rate);
		const fixedFeePerItem = this.firstDefined(sources, (source) => source.fixedFeePerItem);
		const source = this.firstSource(sources) ?? CommissionSource.PLATFORM;

		if (this.isTiered(basis)) {
			if (!tiers?.length) {
				throw new BadRequestException('A tiered commission basis needs a tier schedule.');
			}
			this.assertTiers(tiers);

			// Two answers to one question is a defect rather than a policy: a tiered basis and a rate
			// cannot both be set.
			if (rate !== undefined && rate !== null) {
				throw new BadRequestException('A tiered commission basis must not also declare a rate.');
			}
		}

		if (basis === CommissionBasis.FIXED_PER_ITEM) {
			if (fixedFeePerItem === undefined || fixedFeePerItem === null) {
				throw new BadRequestException('A fixed per-item commission basis needs a fee per item.');
			}
		} else if (rate === undefined || rate === null) {
			// There is no implicit zero commission: a seller-owned line with no resolvable rate is
			// refused rather than sold at a rate nobody agreed to.
			throw new BadRequestException('No commission rate could be resolved for this seller-owned line.');
		}

		return {
			rate: rate ?? '0',
			basis,
			tiers,
			fixedFeePerItem,
			fixedFeeCurrency: this.firstDefined(sources, (item) => item.fixedFeeCurrency),
			source: source ?? CommissionSource.PLATFORM,
			commissionOnShipping: this.firstDefined(sources, (item) => item.commissionOnShipping) ?? true
		} as IResolvedCommission;
	}

	/**
	 * Computes the commission, the basis and the seller's net for one row.
	 *
	 * @param input The line's own amounts, in the line's currency.
	 * @param commission The resolved commission.
	 * @param options.allowNegativeNet Whether a negative net is permitted for this seller or offering.
	 * @param options.isSale Whether the row is a sale, which is the only kind the negative-net rule applies to.
	 * @returns The amounts to store on the ledger row.
	 * @throws BadRequestException when the row would leave the seller with a negative net and its policy forbids it.
	 */
	compute(
		input: ICommissionComputationInput,
		commission: IResolvedCommission,
		options: { allowNegativeNet?: boolean; isSale?: boolean } = {}
	): ICommissionOutcome {
		const decimals = input.currencyDecimals;
		const currency = input.currency;

		const gross = Money.of(input.grossAmount, currency, decimals);
		const tax = Money.of(input.taxAmount, currency, decimals);
		const sellerDiscount = Money.of(input.sellerDiscountAmount, currency, decimals);

		const basisAmount = this.basisAmount(commission.basis, gross, tax, sellerDiscount);
		const rate = this.rateFor(commission, basisAmount, input.quantity, input.isShipping === true);

		const commissionAmount =
			commission.basis === CommissionBasis.FIXED_PER_ITEM
				? // A flat fee is a quote, not a boundary: it is multiplied by the quantity and rounded at
				  // the currency's precision like every other amount.
				  Money.of(commission.fixedFeePerItem ?? '0', currency, decimals).multiply(input.quantity, {
						scale: decimals
				  })
				: basisAmount.multiply(rate, { scale: decimals, mode: RoundingMode.HALF_UP });

		// One multiplication and one rounding happened above; everything from here is exact.
		const netAmount = gross.add(tax).add(sellerDiscount).subtract(commissionAmount);

		if (options.isSale !== false && !options.allowNegativeNet && netAmount.isNegative()) {
			throw new BadRequestException(
				`The commission would leave this line with a net of ${netAmount.toString()}; the seller's policy does not allow a negative net.`
			);
		}

		return {
			basis: commission.basis,
			basisAmount: basisAmount.toStorageString(),
			// The rate is normalised to the storage scale through the money helper rather than by string
			// surgery, so `0.15` and `0.150000` are one value and a value that arrived as a JavaScript
			// number cannot carry a binary fraction artefact into the column.
			rate: Money.of(rate, currency, decimals).toStorageString(),
			commissionAmount: commissionAmount.toStorageString(),
			netAmount: netAmount.toStorageString(),
			source: commission.source
		};
	}

	/**
	 * The amount a basis applies its rate to.
	 *
	 * The seller's own discount reduces the basis where the convention says it does, and the platform's
	 * own discount never does: the platform chose to fund that discount and should not thereby reduce
	 * its own fee, and a basis that moved with someone else's promotion would make a seller's
	 * commission unpredictable through no act of its own.
	 *
	 * @param basis The basis convention.
	 * @param gross `quantity × unitPrice`.
	 * @param tax The line's tax.
	 * @param sellerDiscount The seller's own discount, non-positive.
	 * @returns The basis amount.
	 */
	private basisAmount(
		basis: CommissionBasis,
		gross: Money,
		tax: Money,
		sellerDiscount: Money
	): Money {
		switch (basis) {
			case CommissionBasis.DISCOUNTED_SUBTOTAL:
				return gross.add(sellerDiscount);
			case CommissionBasis.INCLUDING_TAX:
				return gross.add(sellerDiscount).add(tax);
			case CommissionBasis.ITEM_SUBTOTAL:
			case CommissionBasis.FIXED_PER_ITEM:
			default:
				// The list amount: the seller absorbs its own promotions.
				return gross;
		}
	}

	/**
	 * The rate a row takes, from the band it falls in for a tiered basis and from the resolved rate
	 * otherwise.
	 *
	 * Bands are half open — `from <= x < to`, with `to = null` open ended — and a graduated schedule
	 * gives the whole amount the band's rate rather than applying bands marginally: two sellers
	 * comparing statements must be able to reproduce the figure from the stored basis and rate alone.
	 *
	 * @param commission The resolved commission.
	 * @param basisAmount The basis amount.
	 * @param quantity The line's quantity.
	 * @param isShipping Whether the row is a shipping charge, which has no quantity of its own.
	 * @returns The rate to apply.
	 */
	private rateFor(
		commission: IResolvedCommission,
		basisAmount: Money,
		quantity: DecimalString,
		isShipping: boolean
	): DecimalString {
		if (commission.basis === CommissionBasis.TIERED_AMOUNT) {
			return this.tierRate(commission.tiers, Number(basisAmount.amount));
		}

		if (commission.basis === CommissionBasis.TIERED_QUANTITY) {
			// A shipping row has no quantity and takes the band evaluated at one, because buying the band
			// with the order's total quantity would let a large order move a seller's shipping commission
			// tier — which neither party would expect.
			return this.tierRate(commission.tiers, isShipping ? 1 : Number(quantity));
		}

		return commission.rate;
	}

	/**
	 * The rate of the band a value falls in.
	 *
	 * @param tiers The schedule.
	 * @param value The amount or quantity.
	 * @returns The rate.
	 * @throws BadRequestException when no band contains the value, which a validated schedule cannot produce.
	 */
	private tierRate(tiers: ICommissionTier[] | undefined, value: number): DecimalString {
		const band = (tiers ?? []).find(
			(tier) => value >= Number(tier.from) && (tier.to === null || tier.to === undefined || value < Number(tier.to))
		);

		if (!band) {
			throw new BadRequestException(`The commission schedule has no band containing ${value}.`);
		}

		return String(band.rate);
	}

	/**
	 * Refuses a schedule whose bands overlap or leave a gap.
	 *
	 * @param tiers The schedule.
	 * @throws BadRequestException when the schedule is not a partition of the number line.
	 */
	assertTiers(tiers: ICommissionTier[]): void {
		const ordered = [...tiers].sort((left, right) => Number(left.from) - Number(right.from));

		ordered.forEach((tier, index) => {
			if (tier.to !== null && tier.to !== undefined && Number(tier.to) <= Number(tier.from)) {
				throw new BadRequestException(`The commission band starting at ${tier.from} does not end after it starts.`);
			}

			const next = ordered[index + 1];

			if (!next) {
				return;
			}

			if (tier.to === null || tier.to === undefined) {
				throw new BadRequestException('An open-ended commission band must be the last one.');
			}

			if (Number(tier.to) !== Number(next.from)) {
				throw new BadRequestException(
					`The commission schedule leaves a gap or an overlap between ${tier.to} and ${next.from}.`
				);
			}
		});
	}

	/**
	 * @param basis The basis convention.
	 * @returns True when the basis takes its rate from a band.
	 */
	private isTiered(basis: CommissionBasis): boolean {
		return basis === CommissionBasis.TIERED_AMOUNT || basis === CommissionBasis.TIERED_QUANTITY;
	}

	/**
	 * The first value any source defines, in precedence order.
	 *
	 * @param sources The sources, most specific first.
	 * @param read How to read the field off a source.
	 * @returns The value, or undefined when no source defines it.
	 */
	private firstDefined<T>(
		sources: Array<[Partial<IResolvedCommission> | undefined, CommissionSource]>,
		read: (source: Partial<IResolvedCommission>) => T | undefined
	): T | undefined {
		for (const [source] of sources) {
			const value = source ? read(source) : undefined;

			if (value !== undefined && value !== null) {
				return value;
			}
		}

		return undefined;
	}

	/**
	 * The source that supplied the commission, used to label a statement line.
	 *
	 * @param sources The sources, most specific first.
	 * @returns The first source that defines a rate, a fee or a schedule.
	 */
	private firstSource(
		sources: Array<[Partial<IResolvedCommission> | undefined, CommissionSource]>
	): CommissionSource | undefined {
		for (const [source, kind] of sources) {
			if (!source) {
				continue;
			}

			if (
				(source.rate !== undefined && source.rate !== null) ||
				(source.fixedFeePerItem !== undefined && source.fixedFeePerItem !== null) ||
				(source.tiers?.length ?? 0) > 0
			) {
				return kind;
			}
		}

		return undefined;
	}
}
