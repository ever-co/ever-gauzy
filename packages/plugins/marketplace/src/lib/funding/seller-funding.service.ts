import { BadRequestException, Injectable } from '@nestjs/common';
import { AdjustmentFunding, AdjustmentOwnerType, DecimalString, ID } from '@gauzy/contracts';
import {
	Adjustment,
	AdjustmentService,
	STORAGE_SCALE,
	addDecimalStrings,
	formatDecimalUnits,
	toUnitsAtScale
} from '@gauzy/core';

/** One order line's discounts, split by who bears them. */
export interface ILineFunding {
	/** The line the amounts belong to. */
	readonly orderLineId: ID;
	/** The seller-funded discount, non-positive on a sale. */
	sellerDiscountAmount: DecimalString;
	/** The platform-funded discount, non-positive on a sale; it never reduces the seller's net. */
	platformDiscountAmount: DecimalString;
}

/** What one seller's own funding across an order adds up to. */
export interface IFundingSummary {
	/** The discount the seller bears, non-positive. */
	sellerDiscountAmount: DecimalString;
	/** The discount the platform bears on the same lines, non-positive. */
	platformDiscountAmount: DecimalString;
	/** How many rows the seller's figure came from. */
	sellerRowCount: number;
	/** How many rows the platform's figure came from. */
	platformRowCount: number;
}

/**
 * Who funded the discounts on an order, read from the ledger the discounts were written to.
 *
 * **Why the ledger and not the offer.** The same promotion may be funded by the platform, by one seller,
 * or split between them, and a split is written as two `adjustment` rows rather than as a share column.
 * The seller's own split therefore cannot ask the promotion what a discount cost it — the promotion
 * answers a different question, about a rule rather than about money — so it reads the rows: every
 * `SELLER`-funded row is a discount that seller bears, every `PLATFORM`-funded row is one the platform
 * bears (and for which the seller is made whole), and the two are summed **separately** because the
 * commission basis moves for the first and never for the second.
 *
 * That separation is the whole point of the service: an implementation that summed the discounts and let
 * the caller say who paid would put the platform's own promotion into a seller's net, which is the error
 * the funding column exists to make impossible.
 *
 * **Why it reads through the kernel's own ledger service.** The adjustment ledger is the kernel's, and
 * `AdjustmentService` already answers "the rows of one owner, in the order they were written, inside the
 * caller's scope". Asking it means this package does not map the kernel's table a second time, does not
 * hold a second repository over it, and picks up the kernel's own scoping rules rather than restating
 * them — and it is what lets the marketplace module stay free of the entity token that would otherwise
 * have to resolve while the kernel's barrel is still initialising.
 *
 * **What it answers.** One entry per line asked about, with the two amounts as exact decimals at the
 * storage scale. A line with no adjustment answers zeroes rather than being absent, because "this line
 * carries no discount" is a fact the split needs and a missing entry would be indistinguishable from a
 * line nobody asked about.
 *
 * **What it refuses.** A row funded by a seller that names no seller — the state the table's own
 * `CHK_adjustment_funding` refuses on PostgreSQL and MySQL — is refused here by name rather than counted
 * as the platform's, because silently attributing a seller's cost to the platform is the other half of the
 * same error.
 */
@Injectable()
export class SellerFundingService {
	/** The line's own key in the ledger: an order line's adjustments are rows owned by that line. */
	private static readonly OWNER_TYPE = AdjustmentOwnerType.ORDER_LINE;

	constructor(private readonly adjustmentService: AdjustmentService) {}

	/**
	 * The funding of every line of an order, one entry per line asked about.
	 *
	 * @param orderLineIds The order's lines.
	 * @returns For each line, the seller-funded and platform-funded discount, both exact decimals at the
	 * storage scale. A line with no adjustment answers a zero for each.
	 * @throws BadRequestException when a row funded by a seller names no seller.
	 */
	async fundingByOrderLine(orderLineIds: ID[]): Promise<Map<ID, ILineFunding>> {
		const funded = new Map<ID, ILineFunding>();

		for (const orderLineId of orderLineIds ?? []) {
			funded.set(orderLineId, {
				orderLineId,
				sellerDiscountAmount: zero(),
				platformDiscountAmount: zero()
			});
		}

		if (!funded.size) {
			return funded;
		}

		for (const adjustment of await this.adjustmentsOfLines([...funded.keys()])) {
			const entry = funded.get(adjustment.ownerId);

			// A row whose owner is not among the lines asked about is not this order's funding.
			if (!entry) {
				continue;
			}

			if (adjustment.fundedBy === AdjustmentFunding.SELLER) {
				this.assertNamesItsSeller(adjustment);

				entry.sellerDiscountAmount = add(entry.sellerDiscountAmount, adjustment.amount);
			} else {
				entry.platformDiscountAmount = add(entry.platformDiscountAmount, adjustment.amount);
			}
		}

		return funded;
	}

	/**
	 * One seller's own funding across an order.
	 *
	 * The question a seller's statement asks: what did this order's discounts cost me. Rows funded by the
	 * platform are counted separately and never added to the seller's figure, because they were not the
	 * seller's to bear — and a row another seller funded is not this seller's either, which is why the
	 * comparison names the seller rather than counting every `SELLER`-funded row.
	 *
	 * @param orderLineIds The order's lines.
	 * @param sellerId The seller.
	 * @returns The seller's own discount total, the platform's, and how many rows each came from.
	 * @throws BadRequestException when a row funded by a seller names no seller.
	 */
	async fundingSummary(orderLineIds: ID[], sellerId: ID): Promise<IFundingSummary> {
		let sellerDiscountAmount = zero();
		let platformDiscountAmount = zero();
		let sellerRowCount = 0;
		let platformRowCount = 0;

		for (const adjustment of await this.adjustmentsOfLines(orderLineIds ?? [])) {
			if (adjustment.fundedBy === AdjustmentFunding.SELLER) {
				this.assertNamesItsSeller(adjustment);

				if (adjustment.sellerId !== sellerId) {
					continue;
				}

				sellerDiscountAmount = add(sellerDiscountAmount, adjustment.amount);
				sellerRowCount += 1;
			} else {
				platformDiscountAmount = add(platformDiscountAmount, adjustment.amount);
				platformRowCount += 1;
			}
		}

		return { sellerDiscountAmount, platformDiscountAmount, sellerRowCount, platformRowCount };
	}

	/**
	 * The adjustments of one line, for a caller that needs the rows rather than their sum.
	 *
	 * @param orderLineId The line.
	 * @returns The rows, oldest first.
	 */
	async adjustmentsOfOrderLine(orderLineId: ID): Promise<Adjustment[]> {
		return this.adjustmentsOfLines([orderLineId]);
	}

	/**
	 * The adjustments of a set of lines, in the caller's own scope.
	 *
	 * The rows are read one line at a time through the kernel's service, which is the read that answers
	 * "this line's rows, oldest first, inside my scope" and is what the ledger's own readers use. An order
	 * carries a handful of lines, and the request is answered from one table by its owner index.
	 *
	 * @param orderLineIds The lines.
	 * @returns The rows, oldest first within each line, concatenated in the order the lines were given.
	 */
	private async adjustmentsOfLines(orderLineIds: ID[]): Promise<Adjustment[]> {
		const rows: Adjustment[] = [];

		for (const orderLineId of orderLineIds) {
			if (!orderLineId) {
				continue;
			}

			rows.push(...(await this.adjustmentService.findByOwner(SellerFundingService.OWNER_TYPE, orderLineId)));
		}

		return rows;
	}

	/**
	 * Refuses a seller-funded row that names no seller.
	 *
	 * @param adjustment The row about to be counted.
	 * @throws BadRequestException naming the row.
	 */
	private assertNamesItsSeller(adjustment: Adjustment): void {
		if (adjustment.sellerId) {
			return;
		}

		throw new BadRequestException(
			`ADJUSTMENT_FUNDING_SELLER_MISSING: adjustment ${String(
				adjustment.id
			)} is funded by a seller and names none, so the discount it records cannot be attributed to anybody.`
		);
	}
}

/**
 * A zero at the storage scale.
 *
 * The amounts are exact decimals and the split reads them as text, so a zero is written the way a stored
 * zero reads rather than as the number `0`.
 *
 * @returns `0.000000`.
 */
function zero(): DecimalString {
	return '0.000000';
}

/**
 * The exact sum of two amounts, expressed at the storage scale.
 *
 * The money layer adds scaled integers rather than floating point values, and the result is brought back
 * to the scale a money column holds so a part and its whole are written the same way.
 *
 * @param left The running total.
 * @param right The amount to add.
 * @returns The sum, at the storage scale.
 */
function add(left: DecimalString, right: DecimalString): DecimalString {
	return formatDecimalUnits(toUnitsAtScale(addDecimalStrings(left, right), STORAGE_SCALE), STORAGE_SCALE);
}
