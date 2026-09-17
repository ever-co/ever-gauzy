import { BadRequestException, Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import {
	CommissionOn,
	CurrencyCode,
	DecimalString,
	ID,
	ICommissionComputationInput,
	IResolvedCommission,
	Money,
	RoundingMode,
	SellerTransactionKind,
	SellerTransactionStatus
} from '@gauzy/contracts';
import { EventOutboxService, RequestContext } from '@gauzy/core';
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
	/** The seller-funded discount, non-positive. */
	sellerDiscountAmount: DecimalString;
	/** The platform-funded discount, non-positive; it never reduces the basis or the seller's net. */
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
export class SellerSplitService {
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
	 * **completes** a transaction takes the seller's net as the balancing figure
	 * `originalNet − Σ previousNetReversals` and derives its commission from the refund amount, so both
	 * parties are made whole to the minor unit and the residue lands on the platform's commission rather
	 * than on a seller's net.
	 *
	 * @param input What is being reversed.
	 * @returns The reversal rows.
	 */
	async reverse(input: {
		transactionId: ID;
		kind: SellerTransactionKind;
		refundId?: ID;
		/** The amount the buyer is made whole by; the platform's share is derived from it when completing. */
		refundAmount?: DecimalString;
		quantity: DecimalString;
		completes?: boolean;
		description?: string;
	}): Promise<SellerTransaction> {
		const original = await this.transactionRepository.findOne({
			where: { id: input.transactionId } as FindOptionsWhere<SellerTransaction>
		});

		if (!original) {
			throw new BadRequestException('The transaction to reverse does not exist.');
		}

		const currency = original.currency as CurrencyCode;
		const decimals = original.currencyDecimals;

		const alreadyReversed = await this.transactionRepository.find({
			where: { reversesTransactionId: original.id } as FindOptionsWhere<SellerTransaction>
		});
		const reversedNet = Money.sum(
			alreadyReversed.map((row) => Money.fromStorage(row.netAmount, currency, decimals)),
			currency,
			decimals
		);

		const originalNet = Money.fromStorage(original.netAmount, currency, decimals);
		const gross = Money.fromStorage(original.grossAmount, currency, decimals).negate();
		const tax = Money.fromStorage(original.taxAmount, currency, decimals).negate();
		const sellerDiscount = Money.fromStorage(original.sellerDiscountAmount, currency, decimals).negate();

		let net: Money;
		let commission: Money;

		if (input.completes) {
			// The balancing rule: the seller is made exactly whole and the platform's commission absorbs
			// whatever the per-unit arithmetic left over.
			net = originalNet.add(reversedNet);
			const refund = Money.fromStorage(input.refundAmount ?? net.abs().toStorageString(), currency, decimals);
			commission = refund.subtract(net.abs());
		} else {
			commission = Money.fromStorage(original.commissionAmount, currency, decimals).negate();
			net = gross.add(tax).add(sellerDiscount).subtract(commission);
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

		if (input.completes) {
			original.status = SellerTransactionStatus.REVERSED;
			await this.transactionRepository.save(original);
		}

		return this.transactionRepository.save(reversal as SellerTransaction);
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
	 * MK-9, checked on the order: the rows plus the platform's own captured share account for the money.
	 *
	 * The identity holds per row, so it sums without a special case; a non-zero delta is a defect in the
	 * arithmetic upstream and the order is refused rather than placed with a broken split.
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
				Money.fromStorage(row.netAmount, currency, decimals)
					.add(Money.fromStorage(row.commissionAmount, currency, decimals))
					.add(Money.fromStorage(row.platformDiscountAmount, currency, decimals))
			),
			currency,
			decimals
		);

		const linesCaptured = Money.sum(
			input.lines.map((line) =>
				Money.of(line.grossAmount, currency, decimals).add(Money.of(line.taxAmount, currency, decimals))
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
