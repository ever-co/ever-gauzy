import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IPagination, PermissionsEnum } from '@gauzy/contracts';
import type { ID as Id } from '@gauzy/contracts';
import {
	BulkExecutor,
	IBulkItemContext,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	bulkOptionsOf,
	toBulkItemOutcomes
} from '@gauzy/core';
import type { BulkItemRequest } from '@gauzy/core';
import { Seller } from '../seller/seller.entity';
import { SellerService } from '../seller/seller.service';
import { SellerOffering } from '../seller-offering/seller-offering.entity';
import { SellerOfferingService } from '../seller-offering/seller-offering.service';
import { SellerOfferingController } from '../seller-offering/seller-offering.controller';
import {
	IBulkSellerOfferingItem,
	IBulkSellerOfferingsInput,
	IBulkSellerOfferingsPayload,
	SELLER_OFFERING_BULK_REQUIRED_KEYS
} from '../seller-offering/seller-offering.bulk';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';
import { SellerTransactionService } from '../seller-transaction/seller-transaction.service';
import { SellerPayout } from '../seller-payout/seller-payout.entity';
import { SellerPayoutService } from '../seller-payout/seller-payout.service';
import { SellerPayoutLine } from '../seller-payout-line/seller-payout-line.entity';
import { SellerPayoutLineService } from '../seller-payout-line/seller-payout-line.service';
import { SellerSettlement } from '../seller-settlement/seller-settlement.entity';
import { SellerSettlementService } from '../seller-settlement/seller-settlement.service';
import {
	BulkSellerOfferingsPayloadType,
	SellerBalanceType,
	SellerOfferingType,
	SellerPayoutLineType,
	SellerPayoutType,
	SellerSettlementType,
	SellerSplitReconciliationType,
	SellerStatementType,
	SellerTransactionType,
	SellerType
} from './marketplace.types';

/**
 * The marketplace in GraphQL, with the parity the REST surface has.
 *
 * Parity here means more than "the fields exist": the same guard family, the same permission on the
 * same operation, the same tenant and organization scoping, and the same refusal. A mutation that the
 * REST surface refuses for a missing permission is refused here with the same permission, so a client
 * cannot reach a write through GraphQL that REST would deny.
 */
@Resolver(() => SellerType)
@UseGuards(TenantPermissionGuard, PermissionGuard)
export class SellerEntityResolver {
	constructor(
		private readonly sellerService: SellerService,
		private readonly sellerOfferingService: SellerOfferingService,
		private readonly sellerTransactionService: SellerTransactionService,
		private readonly sellerPayoutService: SellerPayoutService,
		private readonly sellerPayoutLineService: SellerPayoutLineService,
		private readonly sellerSettlementService: SellerSettlementService,
		private readonly bulkExecutor: BulkExecutor
	) {}

	/** Lists seller accounts. */
	@Query(() => [SellerType], { name: 'sellers' })
	@Permissions(PermissionsEnum.SELLERS_VIEW)
	async sellers(): Promise<Seller[]> {
		const page: IPagination<Seller> = await this.sellerService.listSellers({});

		return page.items;
	}

	/** Reads one seller by id or code. */
	@Query(() => SellerType, { name: 'seller', nullable: true })
	@Permissions(PermissionsEnum.SELLERS_VIEW)
	async seller(@Args('idOrCode', { type: () => String }) idOrCode: string): Promise<Seller> {
		return this.sellerService.getSeller(idOrCode);
	}

	/** The seller's statement over a period. */
	@Query(() => SellerStatementType, { name: 'sellerStatement', nullable: true })
	@Permissions(PermissionsEnum.SELLERS_VIEW)
	async sellerStatement(
		@Args('sellerId', { type: () => ID }) sellerId: string,
		@Args('currency', { type: () => String, nullable: true }) currency?: string
	): Promise<any> {
		return this.sellerService.getStatement(sellerId, { currency });
	}

	/** The seller's balance in one currency. */
	@Query(() => SellerBalanceType, { name: 'sellerBalance', nullable: true })
	@Permissions(PermissionsEnum.SELLERS_VIEW)
	async sellerBalance(
		@Args('sellerId', { type: () => ID }) sellerId: string,
		@Args('currency', { type: () => String, nullable: true }) currency?: string
	): Promise<any> {
		const seller = await this.sellerService.getSeller(sellerId);

		return this.sellerService.getBalance(seller, currency ?? seller.payoutCurrency ?? 'USD');
	}

	/** Lists offerings. */
	@Query(() => [SellerOfferingType], { name: 'sellerOfferings' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_VIEW)
	async sellerOfferings(): Promise<SellerOffering[]> {
		const page: IPagination<SellerOffering> = await this.sellerOfferingService.listOfferings({});

		return page.items;
	}

	/** Lists the per-seller split of orders. */
	@Query(() => [SellerTransactionType], { name: 'sellerTransactions' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_VIEW)
	async sellerTransactions(): Promise<SellerTransaction[]> {
		const page: IPagination<SellerTransaction> = await this.sellerTransactionService.listTransactions({});

		return page.items;
	}

	/** The split reconciliation report. */
	@Query(() => [SellerSplitReconciliationType], { name: 'sellerSplitReconciliation' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_VIEW)
	async sellerSplitReconciliation(
		@Args('orderId', { type: () => ID, nullable: true }) orderId?: string,
		@Args('sellerId', { type: () => ID, nullable: true }) sellerId?: string
	): Promise<any> {
		const report = await this.sellerTransactionService.reconcile({ orderId, sellerId });

		return report.items;
	}

	/** Lists payouts. */
	@Query(() => [SellerPayoutType], { name: 'sellerPayouts' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_VIEW)
	async sellerPayouts(): Promise<SellerPayout[]> {
		const page: IPagination<SellerPayout> = await this.sellerPayoutService.listPayouts({});

		return page.items;
	}

	/** Reads one payout with its lines. */
	@Query(() => SellerPayoutType, { name: 'sellerPayout', nullable: true })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_VIEW)
	async sellerPayout(@Args('id', { type: () => ID }) id: string): Promise<SellerPayout> {
		return this.sellerPayoutService.getPayout(id);
	}

	/** Lists the lines of a payout. */
	@Query(() => [SellerPayoutLineType], { name: 'sellerPayoutLines' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_VIEW)
	async sellerPayoutLines(@Args('sellerPayoutId', { type: () => ID }) sellerPayoutId: string): Promise<SellerPayoutLine[]> {
		const page: IPagination<SellerPayoutLine> = await this.sellerPayoutLineService.listLines({
			where: { sellerPayoutId }
		});

		return page.items;
	}

	/** Lists settlements. */
	@Query(() => [SellerSettlementType], { name: 'sellerSettlements' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_VIEW)
	async sellerSettlements(): Promise<SellerSettlement[]> {
		const page: IPagination<SellerSettlement> = await this.sellerSettlementService.listSettlements({});

		return page.items;
	}

	/** Submits a seller application for review. */
	@Mutation(() => SellerType, { name: 'submitSeller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	async submitSeller(@Args('id', { type: () => ID }) id: string): Promise<Seller> {
		return this.sellerService.submit(id);
	}

	/** Activates an approved seller. */
	@Mutation(() => SellerType, { name: 'activateSeller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	async activateSeller(@Args('id', { type: () => ID }) id: string): Promise<Seller> {
		return this.sellerService.activate(id);
	}

	/** Suspends a seller. */
	@Mutation(() => SellerType, { name: 'suspendSeller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	async suspendSeller(
		@Args('id', { type: () => ID }) id: string,
		@Args('reason', { type: () => String }) reason: string
	): Promise<Seller> {
		return this.sellerService.suspend(id, reason);
	}

	/** Returns a suspended seller to active. */
	@Mutation(() => SellerType, { name: 'reinstateSeller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	async reinstateSeller(@Args('id', { type: () => ID }) id: string): Promise<Seller> {
		return this.sellerService.reinstate(id);
	}

	/**
	 * Publishes an offering.
	 *
	 * The mutation mirrors `POST /api/seller-offerings/:id/publish` and carries that route's scope, so a
	 * client that presents one key to both protocols is answered the same way by both. The key is
	 * declared nullable because the route's own key is optional: a caller that states none is served
	 * exactly as it was before the convention was adopted.
	 */
	@Idempotent({ scope: 'seller_offering.publish', required: false, resourceType: 'seller_offering' })
	@Mutation(() => SellerOfferingType, { name: 'publishSellerOffering' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	async publishSellerOffering(
		@Args('id', { type: () => ID }) id: string,
		@Args('channelIds', { type: () => [String], nullable: true }) channelIds?: string[],
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string
	): Promise<SellerOffering> {
		return this.sellerOfferingService.publish(id, channelIds);
	}

	/** Pauses an offering. */
	@Mutation(() => SellerOfferingType, { name: 'pauseSellerOffering' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	async pauseSellerOffering(@Args('id', { type: () => ID }) id: string): Promise<SellerOffering> {
		return this.sellerOfferingService.unpause(id);
	}

	/** Withdraws an offering. */
	@Mutation(() => SellerOfferingType, { name: 'withdrawSellerOffering' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	async withdrawSellerOffering(@Args('id', { type: () => ID }) id: string): Promise<SellerOffering> {
		return this.sellerOfferingService.withdraw(id);
	}

	/**
	 * Applies a batch of offerings, one outcome per item.
	 *
	 * The batch is the same one the route applies, and it is run by the same executor from the same
	 * declaration: the options are read off the controller's own `@BulkOperation`, so the resource name,
	 * the cap, the permission and the members an item must carry cannot differ between the two surfaces.
	 * The items go through the service method the route's items go through, with the same transaction
	 * runner, so an atomic batch means the same thing on both.
	 *
	 * The field carries the guard stack and the permission the delivered mutations of this class carry, and
	 * no more: the REST route's seller scope is the access guard's, which every mutation here states none of,
	 * so the batch adds no scope of its own on either surface. A caller reaches the batch over GraphQL on the
	 * same terms as it reaches the single-item mutations.
	 *
	 * `idempotencyKey` is read from the input by the platform's idempotency kernel rather than here, which
	 * is why the input carries it and this field does nothing with it: a key the kernel cannot use is
	 * refused with the same code the route answers.
	 */
	@Idempotent({ scope: 'seller_offering.bulk', required: false, resourceType: 'seller_offering' })
	@Mutation(() => BulkSellerOfferingsPayloadType, { name: 'bulkSellerOfferings' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	async bulkSellerOfferings(@Args('input') input: IBulkSellerOfferingsInput): Promise<IBulkSellerOfferingsPayload> {
		const result = await this.bulkExecutor.execute<IBulkSellerOfferingItem>(
			{ items: input.items, mode: input.mode, atomic: input.atomic },
			(item, context) => this.applyBulkItem(item, context),
			bulkOptionsOf(SellerOfferingController, 'bulk', {
				requiredKeys: SELLER_OFFERING_BULK_REQUIRED_KEYS,
				transaction: this.sellerOfferingService.transaction
			})
		);

		// The per-item view is the platform's own projection of the batch result, so the counters and the
		// item codes are the numbers the REST body carries. The path each item's outcome belongs to is
		// stated here because only the payload knows where its items came from.
		return {
			results: toBulkItemOutcomes(result).map((outcome) => ({
				index: outcome.index,
				ok: outcome.ok,
				id: outcome.id,
				resource: outcome.resource,
				error: outcome.error
					? { ...outcome.error, path: ['items', String(outcome.index)] }
					: undefined
			})),
			succeeded: result.succeededCount,
			failed: result.failedCount,
			total: result.total
		};
	}

	/**
	 * Applies one item of a batch through the service that owns the offering's writes.
	 *
	 * The field owns no write of its own, for the reason every other field here owns none: the item is
	 * handed on with the batch's transactional manager exactly as the executor resolved it, and the outcome
	 * names the offering that moved so a client can match an answer to the listing it asked about.
	 */
	private async applyBulkItem(
		item: BulkItemRequest<IBulkSellerOfferingItem>,
		context: IBulkItemContext
	): Promise<{ index: number; id: Id }> {
		const offering = await this.sellerOfferingService.applyBulkItem(item, undefined, context.manager);

		return { index: context.index, id: offering.id };
	}

	/**
	 * Forces a ledger row to settleable.
	 *
	 * The mutation mirrors `POST /api/seller-transactions/:id/settle` and carries that route's scope, so
	 * the two protocols answer a retry identically. The key is nullable because the route's own key is
	 * optional.
	 */
	@Idempotent({ scope: 'seller.transaction.settle', required: false, resourceType: 'seller_transaction' })
	@Mutation(() => SellerTransactionType, { name: 'settleSellerTransaction' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_SETTLE)
	async settleSellerTransaction(
		@Args('id', { type: () => ID }) id: string,
		@Args('note', { type: () => String, nullable: true }) note?: string,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string
	): Promise<SellerTransaction> {
		return this.sellerTransactionService.settle(id, note);
	}

	/** Holds a ledger row out of payouts. */
	@Mutation(() => SellerTransactionType, { name: 'holdSellerTransaction' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_SETTLE)
	async holdSellerTransaction(
		@Args('id', { type: () => ID }) id: string,
		@Args('reason', { type: () => String }) reason: any
	): Promise<SellerTransaction> {
		return this.sellerTransactionService.hold(id, reason);
	}

	/**
	 * Creates a payout from settleable transactions.
	 *
	 * The mutation mirrors `POST /api/seller-payouts` and carries that route's scope, so a retry of one
	 * operation is a retry whichever protocol it arrives on. The key is nullable because the route's own
	 * key is optional.
	 */
	@Idempotent({ scope: 'seller.payout.create', required: false, resourceType: 'seller_payout' })
	@Mutation(() => SellerPayoutType, { name: 'createSellerPayout' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_CREATE)
	async createSellerPayout(
		@Args('sellerId', { type: () => ID }) sellerId: string,
		@Args('currency', { type: () => String }) currency: string,
		@Args('transactionIds', { type: () => [String], nullable: true }) transactionIds?: string[],
		@Args('note', { type: () => String, nullable: true }) note?: string,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string
	): Promise<SellerPayout> {
		return this.sellerPayoutService.createPayout({ sellerId, currency, transactionIds, note });
	}

	/** Approves a payout. */
	@Mutation(() => SellerPayoutType, { name: 'approveSellerPayout' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_APPROVE)
	async approveSellerPayout(@Args('id', { type: () => ID }) id: string): Promise<SellerPayout> {
		return this.sellerPayoutService.approve(id);
	}

	/**
	 * Records the provider's execution of a payout.
	 *
	 * The mutation mirrors `POST /api/seller-payouts/:id/pay`, and it is the mirror that matters most:
	 * this is the operation that moves money, so it carries the same scope and the same `required: true`
	 * as the route, and a mutation sent without a key is refused. The schema declares the member
	 * nullable all the same — the refusal is the kernel's and arrives as the platform's own
	 * `IDEMPOTENCY_KEY_REQUIRED`, which is the answer the route gives rather than a schema rejection.
	 */
	@Idempotent({ scope: 'seller.payout.pay', required: true, resourceType: 'seller_payout' })
	@Mutation(() => SellerPayoutType, { name: 'markSellerPayoutPaid' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_APPROVE)
	async markSellerPayoutPaid(
		@Args('id', { type: () => ID }) id: string,
		@Args('providerKey', { type: () => String, nullable: true }) providerKey?: string,
		@Args('providerTransferId', { type: () => String, nullable: true }) providerTransferId?: string,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string
	): Promise<SellerPayout> {
		return this.sellerPayoutService.recordExecution(id, {
			paid: true,
			providerKey,
			providerTransferId
		});
	}

	/** Cancels an unpaid payout. */
	@Mutation(() => SellerPayoutType, { name: 'cancelSellerPayout' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_CANCEL)
	async cancelSellerPayout(
		@Args('id', { type: () => ID }) id: string,
		@Args('reason', { type: () => String }) reason: string
	): Promise<SellerPayout> {
		const { payout } = await this.sellerPayoutService.cancel(id, reason);

		return payout;
	}

	/**
	 * Records a settlement reported by a provider.
	 *
	 * The mutation mirrors `POST /api/seller-settlements` and carries that route's scope: a provider
	 * callback delivered twice must record one settlement, and a callback that presents a key for
	 * retrying is answered from its first attempt over either protocol. The key is nullable because the
	 * route's own key is optional.
	 */
	@Idempotent({ scope: 'seller.settlement.record', required: false, resourceType: 'seller_settlement' })
	@Mutation(() => SellerSettlementType, { name: 'createSellerSettlement' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	async createSellerSettlement(
		@Args('sellerId', { type: () => ID }) sellerId: string,
		@Args('providerKey', { type: () => String }) providerKey: string,
		@Args('currency', { type: () => String }) currency: string,
		@Args('grossAmount', { type: () => String }) grossAmount: string,
		@Args('commissionAmount', { type: () => String, nullable: true }) commissionAmount?: string,
		@Args('feeAmount', { type: () => String, nullable: true }) feeAmount?: string,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string
	): Promise<SellerSettlement> {
		return this.sellerSettlementService.record({
			sellerId,
			providerKey,
			currency,
			grossAmount,
			commissionAmount,
			feeAmount
		} as Partial<SellerSettlement>);
	}
}
