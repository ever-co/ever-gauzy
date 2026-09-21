import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import {
	CommissionOn,
	CurrencyCode,
	DecimalString,
	ID,
	ICommissionComputationInput,
	IResolvedCommission,
	RoundingMode,
	SellerTransactionKind,
	SellerTransactionStatus
} from '@gauzy/contracts';
import { EventOutboxService, Money, RequestContext } from '@gauzy/core';
import { SellerCommissionService } from '../commission/seller-commission.service';
import { Seller } from '../seller/seller.entity';
import { TypeOrmSellerRepository } from '../seller/repository/type-orm-seller.repository';
import { SellerOffering } from '../seller-offering/seller-offering.entity';
import { TypeOrmSellerOfferingRepository } from '../seller-offering/repository/type-orm-seller-offering.repository';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';
import { TypeOrmSellerTransactionRepository } from '../seller-transaction/repository/type-orm-seller-transaction.repository';

/** The error a split that does not balance is refused with. */
export const SELLER_SPLIT_MISMATCH = 'SELLER_SPLIT_MISMATCH';

/** One order line, as the order package hands it to the split. */
export interface IOrderSplitLine {
	orderLineId: ID;
	/** Absent for a platform-owned line, which writes no seller row at all. */
	sellerId?: ID;
	offeringId?: ID;
	quantity: DecimalString;
	/** `quantity × unitPrice`, before discounts. */
	grossAmount: DecimalString;
	taxAmount: DecimalString;
	/**
	 * The seller-funded discount, non-positive.
	 *
	 * It is read from the ledger rather than taken from the offer that produced it — every `adjustment` row
	 * of this line with `fundedBy = SELLER` — because the same promotion may be funded by the platform, by
	 * one seller or split between them, and only the rows say which. `SellerFundingService` is the reader
	 * that answers it, and this is the member it fills.
	 */
	sellerDiscountAmount: DecimalString;
	/**
	 * The platform-funded discount, non-positive; it never reduces the basis or the seller's net.
	 *
	 * The other half of the same read: the `PLATFORM`-funded rows of this line.
	 */
	platformDiscountAmount: DecimalString;
}

/** Everything the split needs about the order it is splitting. */
export interface IOrderSplitInput {
	orderId: ID;
	orderNumber?: string;
	currency: CurrencyCode;
	currencyDecimals: number;
	lines: IOrderSplitLine[];
	/**
	 * The part of the captured amount attributable to content no seller owns: platform-owned lines and
	 * platform-attributed shipping. It is what the identity is proved against.
	 */
	platformOwnCaptured?: DecimalString;
	/** A test order writes no rows: a test sale is not a liability. */
	isTest?: boolean;
}

/** What one refund or chargeback reverses, as the order or payment package states it. */
export interface IOrderSplitReversal {
	transactionId: ID;
	kind: SellerTransactionKind;
	refundId?: ID;
	/** The amount the buyer is made whole by; the platform's share is derived from it when completing. */
	refundAmount?: DecimalString;
	/**
	 * The units being reversed.
	 *
	 * It is the numerator of the proration, and it needs a denominator: the ledger row carries five
	 * monetary columns and no quantity, because a row's quantity is the order line's rather than the
	 * ledger's. A caller that reverses part of a line therefore states either the refund — which fixes
	 * the share against the row's own captured amount — or `originalQuantity` beside this one.
	 */
	quantity: DecimalString;
	/**
	 * The units the row being reversed covers, when the caller states the share as a quantity.
	 *
	 * The order package holds the line and knows it; the ledger does not. A reversal that states
	 * neither a refund nor this reverses the whole row, which is what a full refund is.
	 */
	originalQuantity?: DecimalString;
	completes?: boolean;
	description?: string;
}

/**
 * The seller split as the order lifecycle sees it.
 *
 * The marketplace is the only writer of `seller_transaction`, and the two moments it must be written
 * at belong to another package: an order is placed, and a refund is recorded against one of its lines.
 * Neither moment is observable from here — this package owns no order table and subscribes to no order
 * event — so the split has to be **called**, and a capability port is how every other cross-package
 * call on this branch is made.
 *
 * Declaring it is half the fix and the half that lives in this package; the other half is the order
 * package injecting it and `apps/api/src/plugin-composition.ts` binding it, which is where every other
 * port of the fourteen is bound. Until that binding exists nothing calls the split at all, so no
 * `SALE` row is ever written, every payout run reports `NOTHING_SETTLEABLE`, and the conservation
 * identities this package is built around are never evaluated because no row reaches them.
 */
export interface IOrderSplitPort {
	/**
	 * @param input The order and its lines.
	 * @returns The ledger rows the order produced, which is the rows that already existed when the same
	 * order is split a second time.
	 */
	split(input: IOrderSplitInput): Promise<SellerTransaction[]>;

	/**
	 * @param input What is being reversed.
	 * @returns The reversal row.
	 */
	reverse(input: IOrderSplitReversal): Promise<SellerTransaction>;
}

/**
 * Token the order split is provided under.
 *
 * A symbol rather than a string, as every other capability port on this branch declares: two packages
 * that happened to choose the same string would silently share a binding.
 */
export const MARKETPLACE_ORDER_SPLIT = Symbol('MARKETPLACE_ORDER_SPLIT');

/**
 * Writes the per-seller split of an order — the ledger the whole marketplace is reconciled against.
 *
 * The split runs inside the order's own transaction and there is no second writer. Its obligations are
 * the invariants, and each is checked rather than asserted in a comment:
 *
 * - **MK-7**, per row: `net = gross + tax + sellerDiscount − commission`, exactly, at the currency's
 *   precision, through the money helper rather than with inline arithmetic.
 * - **MK-8**, per row: the row's buyer-captured share equals the seller's entitlement plus the
 *   platform's commission plus the platform's own discount contribution — no amount is created or
 *   destroyed inside a row.
 * - **MK-9**, per order: the rows plus the platform's own captured share account for the captured
 *   money, and a split that does not balance is refused with `SELLER_SPLIT_MISMATCH` rather than
 *   written and reported later.
 * - **MK-10**: every division of a whole into parts goes through `Money.allocate`, and any residue
 *   that survives lands on the platform's commission and never on a seller's net.
 * - **MK-16**: one `SALE` row per seller-owned line; a reversal is a new row, never an edit.
 * - **MK-23**: a sale never leaves a seller with a negative net unless the seller or the offering
 *   allows it.
 */
@Injectable()
export class SellerSplitService implements IOrderSplitPort {
	constructor(
		private readonly commissionService: SellerCommissionService,
		private readonly sellerRepository: TypeOrmSellerRepository,
		private readonly offeringRepository: TypeOrmSellerOfferingRepository,
		private readonly transactionRepository: TypeOrmSellerTransactionRepository,
		private readonly outbox: EventOutboxService
	) {}

	/**
	 * Splits one order into its per-seller ledger rows.
	 *
	 * @param input The order and its lines, as the order package computed them.
	 * @returns The rows that were written.
	 * @throws BadRequestException when a row would break the negative-net rule or the split does not balance.
	 */
	async split(input: IOrderSplitInput): Promise<SellerTransaction[]> {
		if (input.isTest) {
			return [];
		}

		if (!input.lines?.length) {
			return [];
		}

		const currency = input.currency;
		const decimals = input.currencyDecimals;

		// MK-16 is "one `SALE` row per seller-owned line", and the split is reached through a capability
		// port from the order lifecycle: an order-placed step that is retried, an outbox event delivered
		// twice or an operation replayed from its journal would otherwise write the whole split a second
		// time, doubling every seller's entitlement and the platform's commission with nothing to refuse
		// it. The already-written rows are the answer to "split this order", so a repeat is answered with
		// them rather than refused: a caller that lost the first answer is not a caller that did something
		// wrong.
		const already = await this.transactionRepository.find({
			where: {
				orderId: input.orderId,
				kind: SellerTransactionKind.SALE,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as FindOptionsWhere<SellerTransaction>
		});

		if (already.length) {
			return already;
		}

		const rows: SellerTransaction[] = [];

		for (const line of input.lines.filter((candidate) => !!candidate.sellerId)) {
			rows.push(await this.buildSaleRow(input, line, currency, decimals));
		}

		this.assertSplitIdentity(input, rows, currency, decimals);

		return this.transactionRepository.manager.transaction(async (manager) => {
			const persisted = await manager.save(SellerTransaction, rows);

			await this.outbox.append(manager, {
				name: 'seller.transaction.recorded',
				aggregateType: 'SELLER_TRANSACTION',
				aggregateId: input.orderId,
				data: {
					orderId: input.orderId,
					orderNumber: input.orderNumber,
					transactionIds: persisted.map((row) => row.id),
					sellerIds: Array.from(new Set(persisted.map((row) => row.sellerId))),
					kind: SellerTransactionKind.SALE,
					currency,
					netAmount: this.sum(persisted, 'netAmount', currency, decimals),
					commissionAmount: this.sum(persisted, 'commissionAmount', currency, decimals),
					status: SellerTransactionStatus.PENDING
				},
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			});

			return persisted;
		});
	}

	/**
	 * Writes the reversal rows for a refund or a chargeback.
	 *
	 * Two rules make a reversal exact. It never edits the row it reverses — the original keeps its
	 * amounts and only its status moves to `REVERSED` on a full reversal — and the reversal that
	 * **completes** a transaction carries only what the reversals already written left behind, negated,
	 * with the seller's remaining net as the balancing figure and the platform's commission derived from
	 * the refund so that both parties are made whole to the minor unit and the residue lands on the
	 * platform's commission rather than on a seller's net.
	 *
	 * @param input What is being reversed.
	 * @returns The reversal rows.
	 */
	async reverse(input: IOrderSplitReversal): Promise<SellerTransaction> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		// The row is read inside the caller's own tenant and organization, like every other read in this
		// package. Without the two predicates a caller that supplied another tenant's `transactionId`
		// reversed that tenant's sale row and read its gross, commission and net back in the response —
		// the foreign key alone says nothing about who may reverse a row.
		const original = await this.transactionRepository.findOne({
			where: { id: input.transactionId, tenantId, organizationId } as FindOptionsWhere<SellerTransaction>
		});

		if (!original) {
			throw new NotFoundException('The transaction to reverse does not exist.');
		}

		const currency = original.currency as CurrencyCode;
		const decimals = original.currencyDecimals;

		const alreadyReversed = await this.transactionRepository.find({
			where: { reversesTransactionId: original.id, tenantId, organizationId } as FindOptionsWhere<SellerTransaction>
		});

		/** The exact sum of one monetary column over the reversals already written for this row. */
		const reversedSoFar = (column: 'grossAmount' | 'taxAmount' | 'sellerDiscountAmount' | 'netAmount'): Money =>
			Money.sum(
				alreadyReversed.map((row) => Money.fromStorage(row[column], currency, decimals)),
				currency,
				decimals
			);

		/** The share of the row this reversal covers. `undefined` means the whole of it. */
		const share = this.reversalShare(original, input, currency, decimals);

		/** The whole of one column of the row being reversed, carrying the sign a reversal needs. */
		const reversedWhole = (column: 'grossAmount' | 'taxAmount' | 'sellerDiscountAmount' | 'commissionAmount'): Money =>
			Money.fromStorage(original[column], currency, decimals).negate();

		/**
		 * One column of the row being reversed, scaled to the share this reversal covers.
		 *
		 * Every column is scaled by the same share, so the reversal is a proportional copy of the row
		 * rather than a second statement of it: reversing one unit of a four-unit line used to write the
		 * whole of every column, so a single returned unit took the seller's entire entitlement for the
		 * line off its balance and a second return took it off again, with nothing on this path capping
		 * either. A reversal that states no share reverses the whole row, which is what a full refund is.
		 */
		const reversedShare = (column: 'grossAmount' | 'taxAmount' | 'sellerDiscountAmount' | 'commissionAmount'): Money => {
			if (!share) {
				return reversedWhole(column);
			}

			return Money.fromStorage(original[column], currency, decimals)
				.multiply(share.numerator)
				.divide(share.denominator, { scale: decimals, mode: RoundingMode.HALF_UP })
				.negate();
		};

		const originalNet = Money.fromStorage(original.netAmount, currency, decimals);

		let gross: Money;
		let tax: Money;
		let sellerDiscount: Money;
		let net: Money;
		let commission: Money;

		if (input.completes) {
			// The reversal that **completes** a transaction is the one that makes both parties exactly
			// whole, so it carries what the reversals already written left behind — negated, because this
			// is the row that states them — rather than the whole of the original a second time. The
			// seller's net is the balancing figure and the platform's commission is what remains of the
			// refund once the seller has been made whole, so any residue lands on the platform and never
			// on a seller's net (§4.4 S9, §5.5).
			//
			// The columns are taken **whole** here and not through the share: what remains is defined by
			// what has already been reversed, which is a figure the ledger holds, not one the caller's own
			// refund amount restates. A completing row that scaled itself first would reverse a fraction of
			// a fraction and leave the row permanently short.
			gross = reversedWhole('grossAmount').subtract(reversedSoFar('grossAmount'));
			tax = reversedWhole('taxAmount').subtract(reversedSoFar('taxAmount'));
			sellerDiscount = reversedWhole('sellerDiscountAmount').subtract(reversedSoFar('sellerDiscountAmount'));
			net = originalNet.negate().subtract(reversedSoFar('netAmount'));

			// What the buyer is made whole by: what is left of the row's captured amount. Where the
			// caller states the refund, it is the refund that fixes the platform's share, and the row's
			// own identity below is what refuses a refund that disagrees with the amounts reversed.
			const refund = Money.fromStorage(
				input.refundAmount ?? gross.add(tax).add(sellerDiscount).negate().toStorageString(),
				currency,
				decimals
			);
			commission = refund.add(net).negate();
		} else {
			// The platform's share is scaled by the same figure as the seller's, and the net is derived from
			// the four columns rather than stated beside them, so MK-7 holds on the reversal by construction
			// and any minor unit the scaling could not divide lands on the commission rather than on the
			// seller's net (MK-10). What the scaling leaves over across a sequence of partials is carried by
			// the completing row, which is what `completes` is for.
			gross = reversedShare('grossAmount');
			tax = reversedShare('taxAmount');
			sellerDiscount = reversedShare('sellerDiscountAmount');
			commission = reversedShare('commissionAmount');
			net = gross.add(tax).add(sellerDiscount).subtract(commission);

			this.assertWithinRemaining(original, gross, reversedSoFar('grossAmount'), currency, decimals);
		}

		const reversal = this.transactionRepository.create({
			sellerId: original.sellerId,
			orderId: original.orderId,
			orderLineId: original.orderLineId,
			kind: input.kind,
			status: SellerTransactionStatus.PENDING,
			currency,
			currencyDecimals: decimals,
			grossAmount: gross.toStorageString(),
			taxAmount: tax.toStorageString(),
			sellerDiscountAmount: sellerDiscount.toStorageString(),
			platformDiscountAmount: Money.zero(currency, decimals).toStorageString(),
			commissionBasis: original.commissionBasis,
			// The basis is reversed proportionally to the net, which is what keeps the row's own identity
			// exact without storing a second basis figure the original never had.
			commissionBasisAmount: net.subtract(tax).subtract(sellerDiscount).toStorageString(),
			commissionRate: original.commissionRate,
			commissionAmount: commission.toStorageString(),
			netAmount: net.toStorageString(),
			commissionOn: CommissionOn.LINE,
			occurredAt: new Date(),
			reversesTransactionId: original.id,
			refundId: input.refundId,
			description: input.description,
			tenantId: original.tenantId,
			organizationId: original.organizationId
		} as Partial<SellerTransaction>);

		this.assertRowIdentity(reversal as SellerTransaction, currency, decimals);

		// The closing of the original, the reversal row and its outbox event are one transaction, as they
		// are in `split()`. They used to be three writes in a row with the event in a transaction of its
		// own, so a crash between the reversal and the append left a persisted reversal that no consumer —
		// no statement, no payout release, no projection — ever learned about, which is the exact failure
		// the transactional outbox exists to prevent.
		return this.transactionRepository.manager.transaction(async (manager) => {
			if (input.completes) {
				original.status = SellerTransactionStatus.REVERSED;
				await manager.save(SellerTransaction, original);
			}

			const persisted = (await manager.save(SellerTransaction, reversal as SellerTransaction)) as SellerTransaction;

			await this.outbox.append(manager, {
				name: 'seller.transaction.reversed',
				aggregateType: 'SELLER_TRANSACTION',
				aggregateId: persisted.id as ID,
				data: {
					sellerId: persisted.sellerId,
					transactionId: persisted.reversesTransactionId,
					reversalId: persisted.id,
					orderId: persisted.orderId,
					refundId: persisted.refundId,
					kind: persisted.kind,
					currency: persisted.currency,
					grossAmount: persisted.grossAmount,
					commissionAmount: persisted.commissionAmount,
					netAmount: persisted.netAmount
				},
				tenantId: persisted.tenantId,
				organizationId: persisted.organizationId
			});

			return persisted;
		});
	}

	/**
	 * The share of a row one reversal covers, as an exact numerator and denominator.
	 *
	 * Two ways to state it, because the ledger row cannot answer the question on its own — it carries five
	 * monetary columns and no quantity, so "one unit of four" is not a fact the row holds:
	 *
	 * 1. **The refund.** `refundAmount` is what the buyer is made whole by, and the row's own captured
	 *    amount is `gross + tax + sellerDiscount`, so the two are a share of the same thing. This is the
	 *    form a refund path naturally has, and it is the one §4.4 S8 states its partials in.
	 * 2. **The quantity.** `quantity` over `originalQuantity`, for a caller that reverses units rather
	 *    than money and knows what the line held.
	 *
	 * A caller that states neither reverses the whole row, which is what a full refund of the line is and
	 * what this method answers `undefined` for. A refund stated against a row whose captured amount is
	 * zero has no share to take either, and answers the same.
	 *
	 * @param original The row being reversed.
	 * @param input What the caller stated.
	 * @param currency The row's currency.
	 * @param decimals The currency's decimal places.
	 * @returns The share, or undefined when the whole row is reversed.
	 */
	private reversalShare(
		original: SellerTransaction,
		input: { refundAmount?: DecimalString; quantity?: DecimalString; originalQuantity?: DecimalString },
		currency: CurrencyCode,
		decimals: number
	): { numerator: DecimalString; denominator: DecimalString } | undefined {
		if (input.refundAmount !== undefined && input.refundAmount !== null) {
			const captured = Money.fromStorage(original.grossAmount, currency, decimals)
				.add(Money.fromStorage(original.taxAmount, currency, decimals))
				.add(Money.fromStorage(original.sellerDiscountAmount, currency, decimals));

			if (captured.isZero()) {
				return undefined;
			}

			return { numerator: Money.of(input.refundAmount, currency, decimals).amount, denominator: captured.amount };
		}

		if (input.originalQuantity === undefined || input.originalQuantity === null || input.quantity === undefined) {
			return undefined;
		}

		const whole = Money.of(input.originalQuantity, currency, decimals);

		if (whole.isZero()) {
			return undefined;
		}

		return { numerator: Money.of(input.quantity, currency, decimals).amount, denominator: whole.amount };
	}

	/**
	 * Refuses a reversal that would take more off a row than the row ever carried.
	 *
	 * A reversal is a new row rather than an edit (MK-16), so nothing about writing one consults what has
	 * already been written — which means a caller that repeated a partial refund could reverse a line
	 * twice over and drive the seller's balance negative with no rule stopping it. The cap is stated on
	 * the gross because that is the column every other one is scaled from.
	 *
	 * @param original The row being reversed.
	 * @param gross This reversal's gross, already negated.
	 * @param reversedGross The gross of the reversals already written for this row.
	 * @param currency The row's currency.
	 * @param decimals The currency's decimal places.
	 * @throws BadRequestException carrying `SELLER_SPLIT_MISMATCH` when the row is over-reversed.
	 */
	private assertWithinRemaining(
		original: SellerTransaction,
		gross: Money,
		reversedGross: Money,
		currency: CurrencyCode,
		decimals: number
	): void {
		const whole = Money.fromStorage(original.grossAmount, currency, decimals);
		const attempted = reversedGross.add(gross);

		if (attempted.abs().greaterThan(whole.abs())) {
			throw new BadRequestException(
				`${SELLER_SPLIT_MISMATCH}: reversing ${gross.abs().toString()} of transaction '${String(
					original.id
				)}' would take the reversals to ${attempted.abs().toString()}, beyond the ${whole
					.abs()
					.toString()} the row carries.`
			);
		}
	}

	/**
	 * Distributes a whole amount across weights so that the parts sum to it exactly.
	 *
	 * Used for an order-level discount across the lines it applies to and for a commission computed on
	 * the order as a whole. Rounding each part independently is how a one-minor-unit hole appears in a
	 * split, and a hole in a split is a defect rather than a curiosity.
	 *
	 * @param whole The amount to distribute.
	 * @param weights The prior amounts to distribute it in proportion to.
	 * @returns One part per weight, summing exactly to the whole.
	 */
	allocate(whole: Money, weights: Money[]): Money[] {
		return whole.allocateBy(weights);
	}

	/** Builds one `SALE` row, resolving the commission and computing the amounts through the money helper. */
	private async buildSaleRow(
		input: IOrderSplitInput,
		line: IOrderSplitLine,
		currency: CurrencyCode,
		decimals: number
	): Promise<SellerTransaction> {
		const seller = await this.requireSeller(line.sellerId as ID);
		const commission = await this.resolveCommission(seller, line.offeringId);

		const computation: ICommissionComputationInput = {
			sellerId: seller.id as ID,
			offeringId: line.offeringId,
			grossAmount: line.grossAmount,
			sellerDiscountAmount: line.sellerDiscountAmount,
			platformDiscountAmount: line.platformDiscountAmount,
			taxAmount: line.taxAmount,
			quantity: line.quantity,
			currency,
			currencyDecimals: decimals
		};

		const outcome = this.commissionService.compute(computation, commission, {
			allowNegativeNet: await this.allowsNegativeNet(seller, line.offeringId),
			isSale: true
		});

		const row = this.transactionRepository.create({
			sellerId: seller.id,
			orderId: input.orderId,
			orderLineId: line.orderLineId,
			kind: SellerTransactionKind.SALE,
			status: SellerTransactionStatus.PENDING,
			currency,
			currencyDecimals: decimals,
			grossAmount: Money.of(line.grossAmount, currency, decimals).toStorageString(),
			taxAmount: Money.of(line.taxAmount, currency, decimals).toStorageString(),
			sellerDiscountAmount: Money.of(line.sellerDiscountAmount, currency, decimals).toStorageString(),
			platformDiscountAmount: Money.of(line.platformDiscountAmount, currency, decimals).toStorageString(),
			commissionBasis: outcome.basis,
			commissionBasisAmount: outcome.basisAmount,
			commissionRate: outcome.rate,
			commissionAmount: outcome.commissionAmount,
			netAmount: outcome.netAmount,
			commissionOn: CommissionOn.LINE,
			occurredAt: new Date(),
			organizationId: seller.organizationId,
			tenantId: seller.tenantId,
			description: input.orderNumber ? `Sale on order ${input.orderNumber}` : undefined
		} as Partial<SellerTransaction>);

		this.assertRowIdentity(row as SellerTransaction, currency, decimals);

		return row as SellerTransaction;
	}

	/** Resolves the commission from the offering, the seller and the platform default, in that order. */
	private async resolveCommission(seller: Seller, offeringId?: ID): Promise<IResolvedCommission> {
		const offering = offeringId
			? await this.offeringRepository.findOne({ where: { id: offeringId } as FindOptionsWhere<SellerOffering> })
			: undefined;

		return this.commissionService.resolve(
			offering
				? {
						rate: offering.commissionRate,
						basis: offering.commissionBasis,
						tiers: offering.commissionTiers
					}
				: undefined,
			{
				rate: seller.defaultCommissionRate,
				basis: seller.commissionBasis,
				tiers: seller.commissionTiers,
				fixedFeePerItem: seller.fixedFeePerItem,
				fixedFeeCurrency: seller.fixedFeeCurrency,
				commissionOnShipping: seller.commissionOnShipping
			},
			// The platform default lives in the tenant settings; a tenant that has not set one has no
			// implicit zero, and a seller-owned line without a resolvable rate is refused.
			undefined
		);
	}

	/** Whether a negative net is permitted for this seller, or for this offering of it. */
	private async allowsNegativeNet(seller: Seller, offeringId?: ID): Promise<boolean> {
		if (seller.allowNegativeNet) {
			return true;
		}

		if (!offeringId) {
			return false;
		}

		const offering = await this.offeringRepository.findOne({
			where: { id: offeringId } as FindOptionsWhere<SellerOffering>
		});

		return offering?.allowNegativeNet === true;
	}

	/** MK-7, checked on the row itself. */
	private assertRowIdentity(row: SellerTransaction, currency: CurrencyCode, decimals: number): void {
		const expected = Money.fromStorage(row.grossAmount, currency, decimals)
			.add(Money.fromStorage(row.taxAmount, currency, decimals))
			.add(Money.fromStorage(row.sellerDiscountAmount, currency, decimals))
			.subtract(Money.fromStorage(row.commissionAmount, currency, decimals));

		if (!expected.equals(Money.fromStorage(row.netAmount, currency, decimals))) {
			throw new BadRequestException(
				`The split row for line '${row.orderLineId}' does not satisfy net = gross + tax + sellerDiscount − commission.`
			);
		}
	}

	/**
	 * MK-9, checked on the order: the rows and the platform's own captured share account for the money
	 * the buyer actually paid.
	 *
	 * The identity is stated against the **captured** amount, which is what a line's buyer paid for it,
	 * not the list amount: a line's captured money is
	 * `grossAmount + taxAmount + sellerDiscountAmount + platformDiscountAmount`, because a discount of
	 * either funding lowers what the buyer pays (§4.5). Comparing the rows against the list amount
	 * instead would make every discounted line fail the identity by exactly its discount, and would
	 * mean no order carrying a promotion could be placed at all.
	 *
	 * The platform's own share is therefore read as a **signed** position on the order: positive for
	 * content no seller owns — a platform-owned line or a platform-attributed shipping method — and
	 * negative for a discount the platform funded on a seller-owned line, which it paid out of its own
	 * pocket. With it, the statement is the plain one: the sellers' entitlement plus the platform's
	 * commission plus what the platform itself captured is the money the buyer paid.
	 *
	 * The identity holds per row (MK-8), so it sums without a special case; a non-zero delta is a
	 * defect in the arithmetic upstream and the order is refused rather than placed with a broken split.
	 */
	private assertSplitIdentity(
		input: IOrderSplitInput,
		rows: SellerTransaction[],
		currency: CurrencyCode,
		decimals: number
	): void {
		const platformOwn = Money.fromStorage(input.platformOwnCaptured ?? '0', currency, decimals);

		const sellersCaptured = Money.sum(
			rows.map((row) =>
				Money.fromStorage(row.netAmount, currency, decimals).add(
					Money.fromStorage(row.commissionAmount, currency, decimals)
				)
			),
			currency,
			decimals
		);

		const linesCaptured = Money.sum(
			input.lines.map((line) =>
				Money.of(line.grossAmount, currency, decimals)
					.add(Money.of(line.taxAmount, currency, decimals))
					.add(Money.of(line.sellerDiscountAmount ?? '0', currency, decimals))
					.add(Money.of(line.platformDiscountAmount ?? '0', currency, decimals))
			),
			currency,
			decimals
		);

		const delta = sellersCaptured.add(platformOwn).subtract(linesCaptured).round(RoundingMode.HALF_UP, decimals);

		if (!delta.isZero()) {
			throw new BadRequestException(
				`The split for order '${input.orderNumber ?? input.orderId}' does not balance: delta ${delta.toString()}.`
			);
		}
	}

	/** The exact sum of one monetary column over a set of rows. */
	private sum(
		rows: SellerTransaction[],
		column: 'netAmount' | 'commissionAmount',
		currency: CurrencyCode,
		decimals: number
	): string {
		return Money.sum(
			rows.map((row) => Money.fromStorage(row[column], currency, decimals)),
			currency,
			decimals
		).toStorageString();
	}

	/** Reads the seller a row is being written for, in the request's own organization. */
	private async requireSeller(sellerId: ID): Promise<Seller> {
		const seller = await this.sellerRepository.findOne({
			where: {
				id: sellerId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as FindOptionsWhere<Seller>
		});

		if (!seller) {
			throw new BadRequestException('A seller-owned line names a seller this organization does not have.');
		}

		if (seller.organizationId !== RequestContext.currentOrganizationId()) {
			// A leaked cross-organization seller would leak a balance, so the write path refuses it rather
			// than trusting the foreign key alone.
			throw new BadRequestException('The seller belongs to another organization.');
		}

		return seller;
	}
}
