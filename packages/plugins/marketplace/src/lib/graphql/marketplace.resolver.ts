import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IPagination, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { Seller } from '../seller/seller.entity';
import { SellerService } from '../seller/seller.service';
import { SellerOffering } from '../seller-offering/seller-offering.entity';
import { SellerOfferingService } from '../seller-offering/seller-offering.service';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';
import { SellerTransactionService } from '../seller-transaction/seller-transaction.service';
import { SellerPayout } from '../seller-payout/seller-payout.entity';
import { SellerPayoutService } from '../seller-payout/seller-payout.service';
import { SellerPayoutLine } from '../seller-payout-line/seller-payout-line.entity';
import { SellerPayoutLineService } from '../seller-payout-line/seller-payout-line.service';
import { SellerSettlement } from '../seller-settlement/seller-settlement.entity';
import { SellerSettlementService } from '../seller-settlement/seller-settlement.service';
import {
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
		private readonly sellerSettlementService: SellerSettlementService
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

	/** Publishes an offering. */
	@Mutation(() => SellerOfferingType, { name: 'publishSellerOffering' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	async publishSellerOffering(
		@Args('id', { type: () => ID }) id: string,
		@Args('channelIds', { type: () => [String], nullable: true }) channelIds?: string[]
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

	/** Forces a ledger row to settleable. */
	@Mutation(() => SellerTransactionType, { name: 'settleSellerTransaction' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_SETTLE)
	async settleSellerTransaction(
		@Args('id', { type: () => ID }) id: string,
		@Args('note', { type: () => String, nullable: true }) note?: string
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

	/** Creates a payout from settleable transactions. */
	@Mutation(() => SellerPayoutType, { name: 'createSellerPayout' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_CREATE)
	async createSellerPayout(
		@Args('sellerId', { type: () => ID }) sellerId: string,
		@Args('currency', { type: () => String }) currency: string,
		@Args('transactionIds', { type: () => [String], nullable: true }) transactionIds?: string[],
		@Args('note', { type: () => String, nullable: true }) note?: string
	): Promise<SellerPayout> {
		return this.sellerPayoutService.createPayout({ sellerId, currency, transactionIds, note });
	}

	/** Approves a payout. */
	@Mutation(() => SellerPayoutType, { name: 'approveSellerPayout' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_APPROVE)
	async approveSellerPayout(@Args('id', { type: () => ID }) id: string): Promise<SellerPayout> {
		return this.sellerPayoutService.approve(id);
	}

	/** Records the provider's execution of a payout. */
	@Mutation(() => SellerPayoutType, { name: 'markSellerPayoutPaid' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_APPROVE)
	async markSellerPayoutPaid(
		@Args('id', { type: () => ID }) id: string,
		@Args('providerKey', { type: () => String, nullable: true }) providerKey?: string,
		@Args('providerTransferId', { type: () => String, nullable: true }) providerTransferId?: string
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

	/** Records a settlement reported by a provider. */
	@Mutation(() => SellerSettlementType, { name: 'createSellerSettlement' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	async createSellerSettlement(
		@Args('sellerId', { type: () => ID }) sellerId: string,
		@Args('providerKey', { type: () => String }) providerKey: string,
		@Args('currency', { type: () => String }) currency: string,
		@Args('grossAmount', { type: () => String }) grossAmount: string,
		@Args('commissionAmount', { type: () => String, nullable: true }) commissionAmount?: string,
		@Args('feeAmount', { type: () => String, nullable: true }) feeAmount?: string
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
