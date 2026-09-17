import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, IsNull, Not } from 'typeorm';
import {
	DecimalString,
	ID,
	IPagination,
	ISellerSplitReconciliation,
	ISellerTransaction,
	SellerHoldReason,
	SellerTransactionKind,
	SellerTransactionStatus
} from '@gauzy/contracts';
import { EventOutboxService, Money, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { SellerTransaction } from './seller-transaction.entity';
import { MikroOrmSellerTransactionRepository } from './repository/mikro-orm-seller-transaction.repository';
import { TypeOrmSellerTransactionRepository } from './repository/type-orm-seller-transaction.repository';
import { Seller } from '../seller/seller.entity';
import { TypeOrmSellerRepository } from '../seller/repository/type-orm-seller.repository';
import { ISellerScope, assertSellerScope } from '../seller-scope/seller-scope';

/**
 * Reads and advances the seller ledger.
 *
 * The ledger's monetary columns are **append only**, and this service is where that is enforced rather
 * than described: the only fields it will move on an existing row are its status and its hold reason.
 * A correction is a reversal row — a new row naming the row it reverses — which is what lets a
 * statement be replayed and a payout stay reconcilable against the provider that executed it.
 */
@Injectable()
export class SellerTransactionService extends TenantAwareCrudService<SellerTransaction> {
	constructor(
		readonly typeOrmSellerTransactionRepository: TypeOrmSellerTransactionRepository,
		readonly mikroOrmSellerTransactionRepository: MikroOrmSellerTransactionRepository,
		private readonly sellerRepository: TypeOrmSellerRepository,
		private readonly outbox: EventOutboxService
	) {
		super(typeOrmSellerTransactionRepository, mikroOrmSellerTransactionRepository);
	}

	/**
	 * Lists the ledger rows the caller may see.
	 *
	 * @param filter The query filter.
	 * @param scope The caller's seller scope.
	 * @returns The page of rows.
	 */
	async listTransactions(filter: any = {}, scope?: ISellerScope): Promise<IPagination<SellerTransaction>> {
		const where = { ...(filter?.where ?? {}) };

		if (scope && !scope.staff) {
			// The seller predicate is applied whether or not the caller named a seller: a seller-scoped
			// credential reads its own ledger and no one else's, and asking for another seller is refused
			// rather than silently narrowed.
			assertSellerScope(scope, where.sellerId);
			where.sellerId = scope.sellerId;
		}

		return this.paginate({ ...filter, where });
	}

	/**
	 * Reads one row.
	 *
	 * @param id The row id.
	 * @param scope The caller's seller scope.
	 * @returns The row.
	 * @throws NotFoundException when it does not exist in the caller's scope.
	 */
	async getTransaction(id: ID, scope?: ISellerScope): Promise<SellerTransaction> {
		const transaction = await this.typeOrmSellerTransactionRepository.findOne({
			where: {
				id,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as FindOptionsWhere<SellerTransaction>
		});

		if (!transaction) {
			throw new NotFoundException('The seller transaction does not exist.');
		}

		if (scope && !scope.staff) {
			assertSellerScope(scope, transaction.sellerId);
		}

		return transaction;
	}

	/**
	 * Forces a row to `SETTLEABLE`.
	 *
	 * The state is advanced, never the amount: a staff caller with the settle permission can say that a
	 * row is eligible for a payout, and cannot say how much it is worth.
	 *
	 * @param id The row id.
	 * @param note Why it was advanced.
	 * @returns The updated row.
	 */
	async settle(id: ID, note?: string): Promise<SellerTransaction> {
		const transaction = await this.getTransaction(id);

		if (transaction.status === SellerTransactionStatus.SETTLED || transaction.status === SellerTransactionStatus.PAID) {
			// A row already inside a payout must not be pulled back into another one.
			throw new ConflictException('This transaction is already covered by a payout.');
		}

		transaction.status = SellerTransactionStatus.SETTLEABLE;
		transaction.settleableAt = transaction.settleableAt ?? new Date();
		transaction.holdReason = null;

		const saved = await this.typeOrmSellerTransactionRepository.save(transaction);

		await this.emit(saved, 'seller.transaction.settleable', { note });

		return saved;
	}

	/**
	 * Holds a row out of payouts, with a reason a seller can read.
	 *
	 * No outbox row is written, and that is deliberate rather than an omission: the event catalogue
	 * names a state change for a sale being recorded, a row becoming settleable and a row being
	 * reversed, and it does not name a hold. The hold is visible where it matters — on the row's own
	 * status and reason, on the statement, and through the `seller.suspended` event when a suspension is
	 * what held a seller's balance.
	 *
	 * @param id The row id.
	 * @param reason Why it is held.
	 * @param note Free-text note.
	 * @returns The updated row.
	 */
	async hold(id: ID, reason: SellerHoldReason, note?: string): Promise<SellerTransaction> {
		const transaction = await this.getTransaction(id);

		if (!reason) {
			throw new BadRequestException('A hold needs a reason.');
		}

		transaction.status = SellerTransactionStatus.HELD;
		transaction.holdReason = reason;

		if (note) {
			transaction.description = note;
		}

		return this.typeOrmSellerTransactionRepository.save(transaction);
	}

	/**
	 * The split reconciliation of the orders in a window.
	 *
	 * This is the report the invariant exists for: per order, the captured amount, the platform's own
	 * captured share, the sums of the sellers' nets, commissions and platform-funded discounts, and the
	 * **split delta** that must be zero. A non-zero delta is a severity-1 defect rather than a rounding
	 * curiosity, and the report never repairs anything — a ledger is not a cache, so there is nothing
	 * safe to recompute.
	 *
	 * @param filter The window and the optional seller or order.
	 * @returns The per-order reconciliation.
	 */
	async reconcile(filter: {
		from?: Date;
		to?: Date;
		sellerId?: ID;
		orderId?: ID;
		onlyMismatched?: boolean;
	}): Promise<IPagination<ISellerSplitReconciliation>> {
		const where: FindOptionsWhere<SellerTransaction> = {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as FindOptionsWhere<SellerTransaction>;

		if (filter.sellerId) {
			where.sellerId = filter.sellerId;
		}

		if (filter.orderId) {
			where.orderId = filter.orderId;
		}

		const rows = await this.typeOrmSellerTransactionRepository.find({
			where: { ...where, reversesTransactionId: IsNull() } as FindOptionsWhere<SellerTransaction>
		});
		const reversals = await this.typeOrmSellerTransactionRepository.find({
			where: { ...where, reversesTransactionId: Not(IsNull()) } as FindOptionsWhere<SellerTransaction>
		});

		const byOrder = new Map<string, SellerTransaction[]>([...rows, ...reversals].reduce((map, row) => {
			const key = String(row.orderId);
			map.set(key, [...(map.get(key) ?? []), row]);
			return map;
		}, new Map<string, SellerTransaction[]>()));

		const items: ISellerSplitReconciliation[] = [];

		for (const [orderId, orderRows] of byOrder) {
			const currency = orderRows[0]?.currency ?? 'USD';
			const decimals = orderRows[0]?.currencyDecimals ?? 2;
			const sum = (read: (row: SellerTransaction) => DecimalString): string =>
				Money.sum(
					orderRows.map((row) => Money.fromStorage(read(row), currency, decimals)),
					currency,
					decimals
				).toStorageString();

			const sumNet = sum((row) => row.netAmount);
			const sumCommission = sum((row) => row.commissionAmount);
			const platformDiscount = sum((row) => row.platformDiscountAmount);

			// `F` is the platform's own contribution to seller-owned lines, as a positive figure, and the
			// split delta is what remains when the rows, the platform's commission and that contribution
			// are accounted for against the money the sellers' lines captured.
			const splitDelta = Money.fromStorage(sumNet, currency, decimals)
				.add(Money.fromStorage(sumCommission, currency, decimals))
				.add(Money.fromStorage(platformDiscount, currency, decimals))
				.subtract(Money.fromStorage(sum((row) => row.grossAmount), currency, decimals))
				.subtract(Money.fromStorage(sum((row) => row.taxAmount), currency, decimals))
				.subtract(Money.fromStorage(sum((row) => row.sellerDiscountAmount), currency, decimals));

			const reconciliation: ISellerSplitReconciliation = {
				orderId: orderId as ID,
				currency,
				// Every figure is the exact decimal the ledger holds, not a rounded rendering of it: a
				// report that a reader cannot reproduce from its own rows is not a reconciliation.
				capturedAmount: Money.fromStorage(sumNet, currency, decimals)
					.add(Money.fromStorage(sumCommission, currency, decimals))
					.add(Money.fromStorage(platformDiscount, currency, decimals))
					.toStorageString(),
				// The platform-owned part of the order is not written to this ledger at all: it has no
				// seller, so the report states it as zero and lets the order-level report account for it.
				platformOwnCaptured: '0.000000',
				sumNet,
				sumCommission,
				platformDiscount: Money.fromStorage(platformDiscount, currency, decimals).negate().toStorageString(),
				splitDelta: splitDelta.toStorageString(),
				platformRetained: Money.fromStorage(sumCommission, currency, decimals)
					.add(Money.fromStorage(platformDiscount, currency, decimals))
					.toStorageString()
			};

			if (filter.onlyMismatched && splitDelta.isZero()) {
				continue;
			}

			items.push(reconciliation);
		}

		return { items, total: items.length };
	}

	/**
	 * Writes one outbox row for a ledger state change.
	 *
	 * @param transaction The row the event is about.
	 * @param name The catalogued event name.
	 * @param extra Payload fields beyond the row's own.
	 */
	async emit(transaction: SellerTransaction, name: string, extra: Record<string, any> = {}): Promise<void> {
		await this.typeOrmSellerTransactionRepository.manager.transaction(async (manager) => {
			await this.outbox.append(manager, {
				name,
				aggregateType: 'SELLER_TRANSACTION',
				aggregateId: transaction.id as ID,
				data: {
					sellerId: transaction.sellerId,
					transactionId: transaction.id,
					orderId: transaction.orderId,
					kind: transaction.kind,
					status: transaction.status,
					currency: transaction.currency,
					grossAmount: transaction.grossAmount,
					commissionAmount: transaction.commissionAmount,
					netAmount: transaction.netAmount,
					...extra
				},
				tenantId: transaction.tenantId,
				organizationId: transaction.organizationId
			});
		});
	}

	/**
	 * @param sellerId The seller.
	 * @returns The seller row, for the organization and tenant the request resolved.
	 * @throws NotFoundException when the seller does not exist in this scope.
	 */
	async requireSeller(sellerId: ID): Promise<Seller> {
		const seller = await this.sellerRepository.findOne({
			where: {
				id: sellerId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as FindOptionsWhere<Seller>
		});

		if (!seller) {
			throw new NotFoundException('The seller does not exist.');
		}

		return seller;
	}

	/**
	 * @returns The kinds that reverse an earlier row.
	 */
	static reversalKinds(): SellerTransactionKind[] {
		return [SellerTransactionKind.REFUND, SellerTransactionKind.CHARGEBACK];
	}
}
