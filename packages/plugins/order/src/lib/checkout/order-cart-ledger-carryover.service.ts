import { Injectable } from '@nestjs/common';
import {
	AdjustmentOwnerType,
	CurrencyCode,
	DecimalString,
	IAdjustment,
	ID,
	ITaxLine,
	TaxLineOwnerType
} from '@gauzy/contracts';
import { AdjustmentService, TaxLineService } from '@gauzy/core';

/**
 * Which order row each cart row became.
 *
 * The order package creates its lines and shipping methods from the cart's, one for one, and only it
 * knows which new id answers which old one — so the map is built where the rows are created and handed
 * here rather than re-derived from titles or positions, which two lines of one product would share.
 */
export interface ICartToOrderRowMap {
	/** Cart line id → order line id. */
	readonly lines: ReadonlyMap<ID, ID>;
	/** Cart shipping method id → order shipping method id. */
	readonly shippingMethods: ReadonlyMap<ID, ID>;
}

/** What one carry-over wrote, so the caller can say what the order now carries. */
export interface ICartLedgerCarryoverResult {
	/** Adjustment rows written onto the order's lines, shipping methods and the order itself. */
	readonly adjustments: number;
	/** Tax lines written onto the order's lines and shipping methods. */
	readonly taxLines: number;
}

/** The cart owner each order owner is the counterpart of (`AdjustmentOwnerType` documents the pairs). */
const ADJUSTMENT_OWNER_PAIRS: ReadonlyArray<[AdjustmentOwnerType, AdjustmentOwnerType]> = [
	[AdjustmentOwnerType.CART_LINE, AdjustmentOwnerType.ORDER_LINE],
	[AdjustmentOwnerType.CART_SHIPPING, AdjustmentOwnerType.ORDER_SHIPPING],
	[AdjustmentOwnerType.CART, AdjustmentOwnerType.ORDER]
];

/**
 * Carries a cart's money ledgers onto the order it became (Q7-W1a).
 *
 * **Why this exists.** The cart is priced through two kernel ledgers — `adjustment` (promotion discounts,
 * fees, manual credits) and `tax_line` (one row per rate) — owned by `CART_LINE`, `CART_SHIPPING` and
 * `CART`. The order is totalled from the same two ledgers, owned by `ORDER_LINE`, `ORDER_SHIPPING` and
 * `ORDER`. `OrderService.createFromCart` copied the lines, the shipping methods and the addresses and
 * **none of the ledger rows**, so every order placed through checkout re-totalled from empty ledgers:
 * its discount and tax were zero and its grand total was not the amount the buyer was shown. The
 * contract's own words for `ORDER_LINE` — "the order-level counterpart of `CART_LINE`; immutable once
 * the order is placed" — describe exactly this copy, and nothing performed it.
 *
 * **What is copied, and what is not recomputed.** Each row is copied as it stands — amount, currency,
 * basis, type, code, reference, reason, funding, seller, metadata — and stamped with where it came from
 * (`metadata.carriedFrom`). Nothing is re-evaluated: the amounts are the ones the cart's last
 * recalculation wrote (checkout recalculates immediately before it hands the cart over), so the order
 * keeps the price the buyer accepted even if a rate or a promotion changes a second later. A row whose
 * owner did not become an order row (a line the order did not take) is skipped rather than guessed at.
 *
 * **When it runs.** Between the creation of the order's rows and its placement, so the totals the
 * placement computes — and the `order.placed` event it announces — already include the discount and the
 * tax. It is asked for only by the checkout handler: the subscription path builds a cart, then writes the
 * cycle's own discount and tax onto the order itself, and copying the cart's on top would charge them
 * twice.
 *
 * **Both ORMs.** The kernel's ledger services are the only writers of the two tables and the copy goes
 * through them (`append`), so every rule they enforce on a write — the sign a type requires, a governed
 * type's reason, one basis per rate — is enforced on the copy too.
 */
@Injectable()
export class OrderCartLedgerCarryover {
	constructor(
		private readonly adjustmentService: AdjustmentService,
		private readonly taxLineService: TaxLineService
	) {}

	/**
	 * Copies the cart's adjustment and tax rows onto the order's counterpart rows.
	 *
	 * @param cartId The cart the order came from; the owner of its document-level (`CART`) adjustments.
	 * @param orderId The order; the owner of the copied document-level adjustments.
	 * @param rows Which order row each cart row became.
	 * @returns How many rows were written.
	 */
	async carry(cartId: ID, orderId: ID, rows: ICartToOrderRowMap): Promise<ICartLedgerCarryoverResult> {
		let adjustments = 0;
		let taxLines = 0;

		for (const [cartOwnerType, orderOwnerType] of ADJUSTMENT_OWNER_PAIRS) {
			for (const [cartOwnerId, orderOwnerId] of this.ownersOf(cartOwnerType, cartId, orderId, rows)) {
				for (const row of await this.adjustmentService.findByOwner(cartOwnerType, cartOwnerId)) {
					await this.adjustmentService.append(
						copyOfAdjustment(row, orderOwnerType, orderOwnerId, cartOwnerType, cartOwnerId)
					);
					adjustments++;
				}
			}
		}

		const taxPairs: ReadonlyArray<[TaxLineOwnerType, TaxLineOwnerType, ReadonlyMap<ID, ID>]> = [
			[TaxLineOwnerType.CART_LINE, TaxLineOwnerType.ORDER_LINE, rows.lines],
			[TaxLineOwnerType.CART_SHIPPING, TaxLineOwnerType.ORDER_SHIPPING, rows.shippingMethods]
		];

		for (const [cartOwnerType, orderOwnerType, owners] of taxPairs) {
			for (const [cartOwnerId, orderOwnerId] of owners) {
				for (const row of await this.taxLineService.findByOwner(cartOwnerType, cartOwnerId)) {
					await this.taxLineService.append(
						copyOfTaxLine(row, orderOwnerType, orderOwnerId, cartOwnerType, cartOwnerId)
					);
					taxLines++;
				}
			}
		}

		return { adjustments, taxLines };
	}

	/**
	 * The cart owners of one type, each paired with the order owner its rows move to.
	 *
	 * @param ownerType The cart owner type.
	 * @param cartId The cart, for the document-level owner.
	 * @param orderId The order, for the document-level owner.
	 * @param rows The row map.
	 * @returns `[cartOwnerId, orderOwnerId]` pairs.
	 */
	private ownersOf(
		ownerType: AdjustmentOwnerType,
		cartId: ID,
		orderId: ID,
		rows: ICartToOrderRowMap
	): Iterable<[ID, ID]> {
		switch (ownerType) {
			case AdjustmentOwnerType.CART_LINE:
				return rows.lines.entries();
			case AdjustmentOwnerType.CART_SHIPPING:
				return rows.shippingMethods.entries();
			default:
				return [[cartId, orderId]];
		}
	}
}

/**
 * The append input that copies one cart adjustment onto an order owner.
 *
 * @param row The cart row.
 * @param ownerType The order owner type.
 * @param ownerId The order owner.
 * @param fromType The cart owner type, recorded in the provenance.
 * @param fromId The cart owner, recorded in the provenance.
 * @returns The input for `AdjustmentService.append`.
 */
export function copyOfAdjustment(
	row: IAdjustment,
	ownerType: AdjustmentOwnerType,
	ownerId: ID,
	fromType: AdjustmentOwnerType,
	fromId: ID
) {
	return {
		ownerType,
		ownerId,
		amount: String(row.amount) as DecimalString,
		currency: row.currency as CurrencyCode,
		isTaxInclusive: Boolean(row.isTaxInclusive),
		type: row.type,
		...(row.code ? { code: row.code } : {}),
		...(row.referenceType ? { referenceType: row.referenceType } : {}),
		...(row.referenceId ? { referenceId: row.referenceId } : {}),
		...(row.description ? { description: row.description } : {}),
		...(row.providerId ? { providerId: row.providerId } : {}),
		...(row.reasonCode ? { reasonCode: row.reasonCode } : {}),
		...(row.fundedBy ? { fundedBy: row.fundedBy } : {}),
		...(row.sellerId ? { sellerId: row.sellerId } : {}),
		metadata: {
			...(row.metadata ?? {}),
			carriedFrom: { ownerType: fromType, ownerId: fromId, adjustmentId: row.id }
		}
	};
}

/**
 * The append input that copies one cart tax line onto an order owner.
 *
 * @param row The cart row.
 * @param ownerType The order owner type.
 * @param ownerId The order owner.
 * @param fromType The cart owner type, recorded in the provenance.
 * @param fromId The cart owner, recorded in the provenance.
 * @returns The input for `TaxLineService.append`.
 */
export function copyOfTaxLine(
	row: ITaxLine,
	ownerType: TaxLineOwnerType,
	ownerId: ID,
	fromType: TaxLineOwnerType,
	fromId: ID
) {
	return {
		ownerType,
		ownerId,
		...(row.taxRateId ? { taxRateId: row.taxRateId } : {}),
		...(row.code ? { code: row.code } : {}),
		name: row.name,
		rate: String(row.rate) as DecimalString,
		isCompound: Boolean(row.isCompound),
		isInclusive: Boolean(row.isInclusive),
		baseAmount: String(row.baseAmount ?? '0') as DecimalString,
		amount: String(row.amount) as DecimalString,
		currency: row.currency as CurrencyCode,
		...(row.providerKey ? { providerKey: row.providerKey } : {}),
		metadata: {
			...(row.metadata ?? {}),
			carriedFrom: { ownerType: fromType, ownerId: fromId, taxLineId: row.id }
		}
	};
}
