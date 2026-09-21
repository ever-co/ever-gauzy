import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IPagination, PermissionsEnum } from '@gauzy/contracts';
import type { ID as Id } from '@gauzy/contracts';
import {
	BulkExecutor,
	FeatureFlagGuard,
	GraphqlConnection,
	IBulkItemContext,
	IConnectionPageSelection,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	bulkOptionsOf,
	connectionFromOffsetPage,
	paginateRows,
	resolveConnectionWindow,
	toBulkItemOutcomes
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
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
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';
import { ISellerScope } from '../seller-scope/seller-scope';
import {
	BulkSellerOfferingsPayloadType,
	SellerBalanceType,
	SellerOfferingType,
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
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 *
 * **The seller scope is part of that parity, and it was the half that was missing.** Every payout,
 * ledger, offering and settlement service method takes an `ISellerScope` and only narrows when one is
 * supplied; the REST controllers mount `SellerAccessGuard` and hand it on, and this class mounted
 * neither. The consequence was not a subtler refusal but no isolation at all: a seller-side credential
 * holding `SELLER_PAYOUTS_VIEW` asked for `sellerPayouts` and received every seller's payouts in the
 * organization — every other seller's balances — while the same credential over REST saw only its own. The
 * guard is therefore mounted here as the controllers mount it, and the scope it resolves is read off
 * the GraphQL context and threaded into every field that takes one, so the two surfaces narrow a
 * request by the same predicate rather than only claiming to.
 *
 * It is mounted **after** the feature gate rather than before it, which is the order the answers have
 * to come in: a tenant that switched the capability off is owed the 404 a disabled capability answers,
 * and a scope refusal evaluated first would tell a caller that the capability is there by refusing it
 * for the wrong reason.
 *
 * **Every list field answers a connection, and the page the caller states is honoured.** `sellers`,
 * `sellerOfferings`, `sellerTransactions`, `sellerPayouts`, `sellerPayoutLines` and `sellerSettlements`
 * answered a bare array until now — a shape a client can neither page nor count — and each answers the
 * one connection shape the platform's other list fields answer with: the page's rows two ways, the count
 * of the filtered set, and the boundary a cursor walk resumes from. `sellerSplitReconciliation` is left as
 * a report, because it is an aggregation over settlements rather than a page of rows.
 *
 * **The window is translated rather than handed over.** The kernel's list methods state a page as a
 * 1-based page number and a size, while the connection protocol states a row offset and a size; the two
 * are not the same number, and a resolver that passed one for the other would answer the rows `skip` pages
 * in and look like it had paged correctly. Each field therefore asks its service for the one page that
 * ends where the caller's window ends — bounded by that window, not by the table — and slices the window
 * out of it. Asking for the first page and slicing that instead would answer ten rows whatever the caller
 * asked for, because ten is the store's default page size, and would report ten as the size of the whole
 * collection: a client would read a paged surface as a complete one.
 */
@Resolver(() => SellerType)
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard, SellerAccessGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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

	/**
	 * Reads one page of a listing whose read is page-numbered.
	 *
	 * `TenantAwareCrudService.paginate` reads `skip` as a one-based **page number** (`take * (skip - 1)`) and
	 * defaults `take` to ten, while a connection's window is a **row offset**. The two are different numbers,
	 * so passing one as the other answers the wrong rows — the trap this helper exists to close.
	 *
	 * The read asks for the pages the window spans and no more. Reading page one and dropping the first `skip`
	 * rows would also be correct, and is cheaper to write, but it reads every row before the window: one
	 * request naming a deep offset would turn into a scan of the table, and the count it reports would still
	 * be right, so nothing would look wrong.
	 *
	 * @param skip The offset the page starts at.
	 * @param take The page size.
	 * @param read The page-numbered listing read.
	 * @returns The connection, with the count the listing itself reported rather than the size of the page.
	 */
	private async connectionOf<T>(
		skip: number,
		take: number,
		read: (window: { skip: number; take: number }) => Promise<IPagination<T>>
	): Promise<GraphqlConnection<T>> {
		const firstPage = Math.floor(skip / take) + 1;
		// How far into that page the window starts, which is how many rows of it are not the caller's.
		const leading = skip - (firstPage - 1) * take;
		const listing = await read({ skip: firstPage, take: leading > 0 ? take * 2 : take });
		const window = paginateRows(listing.items, take, leading);

		return connectionFromOffsetPage({ items: window.items, total: listing.total }, skip);
	}

	/** Lists seller accounts, one page at a time. */
	@Query(() => Object, { name: 'sellers' })
	@Permissions(PermissionsEnum.SELLERS_VIEW)
	async sellers(
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Context() context?: any
	): Promise<GraphqlConnection<Seller>> {
		const { skip, take } = resolveConnectionWindow(page);

		return this.connectionOf(skip, take, (window) => this.sellerService.listSellers(window, this.scope(context)));
	}

	/** Reads one seller by id or code. */
	@Query(() => SellerType, { name: 'seller', nullable: true })
	@Permissions(PermissionsEnum.SELLERS_VIEW)
	async seller(
		@Args('idOrCode', { type: () => String }) idOrCode: string,
		@Context() context?: any
	): Promise<Seller> {
		return this.sellerService.getSeller(idOrCode, this.scope(context));
	}

	/** The seller's statement over a period. */
	@Query(() => SellerStatementType, { name: 'sellerStatement', nullable: true })
	@Permissions(PermissionsEnum.SELLERS_VIEW)
	async sellerStatement(
		@Args('sellerId', { type: () => ID }) sellerId: string,
		@Args('currency', { type: () => String, nullable: true }) currency?: string,
		@Context() context?: any
	): Promise<any> {
		return this.sellerService.getStatement(sellerId, { currency }, this.scope(context));
	}

	/** The seller's balance in one currency. */
	@Query(() => SellerBalanceType, { name: 'sellerBalance', nullable: true })
	@Permissions(PermissionsEnum.SELLERS_VIEW)
	async sellerBalance(
		@Args('sellerId', { type: () => ID }) sellerId: string,
		@Args('currency', { type: () => String, nullable: true }) currency?: string,
		@Context() context?: any
	): Promise<any> {
		// As on the REST route: the scope is enforced on the read of the seller, because the balance is
		// summed from that seller's own ledger rows.
		const seller = await this.sellerService.getSeller(sellerId, this.scope(context));

		return this.sellerService.getBalance(seller, currency ?? seller.payoutCurrency ?? 'USD');
	}

	/** Lists offerings, one page at a time. */
	@Query(() => Object, { name: 'sellerOfferings' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_VIEW)
	async sellerOfferings(
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Context() context?: any
	): Promise<GraphqlConnection<SellerOffering>> {
		const { skip, take } = resolveConnectionWindow(page);

		return this.connectionOf(skip, take, (window) => this.sellerOfferingService.listOfferings(window, this.scope(context)));
	}

	/** Lists the per-seller split of orders, one page at a time. */
	@Query(() => Object, { name: 'sellerTransactions' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_VIEW)
	async sellerTransactions(
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Context() context?: any
	): Promise<GraphqlConnection<SellerTransaction>> {
		const { skip, take } = resolveConnectionWindow(page);

		return this.connectionOf(skip, take, (window) => this.sellerTransactionService.listTransactions(window, this.scope(context)));
	}

	/** The split reconciliation report. */
	@Query(() => [SellerSplitReconciliationType], { name: 'sellerSplitReconciliation' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_VIEW)
	async sellerSplitReconciliation(
		@Args('orderId', { type: () => ID, nullable: true }) orderId?: string,
		@Args('sellerId', { type: () => ID, nullable: true }) sellerId?: string,
		@Context() context?: any
	): Promise<any> {
		const report = await this.sellerTransactionService.reconcile({ orderId, sellerId }, this.scope(context));

		return report.items;
	}

	/** Lists payouts, one page at a time. */
	@Query(() => Object, { name: 'sellerPayouts' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_VIEW)
	async sellerPayouts(
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Context() context?: any
	): Promise<GraphqlConnection<SellerPayout>> {
		const { skip, take } = resolveConnectionWindow(page);

		return this.connectionOf(skip, take, (window) => this.sellerPayoutService.listPayouts(window, this.scope(context)));
	}

	/** Reads one payout with its lines. */
	@Query(() => SellerPayoutType, { name: 'sellerPayout', nullable: true })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_VIEW)
	async sellerPayout(@Args('id', { type: () => ID }) id: string, @Context() context?: any): Promise<SellerPayout> {
		return this.sellerPayoutService.getPayout(id, this.scope(context));
	}

	/** Lists the lines of a payout, one page at a time. */
	@Query(() => Object, { name: 'sellerPayoutLines' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_VIEW)
	async sellerPayoutLines(
		@Args('sellerPayoutId', { type: () => ID }) sellerPayoutId: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Context() context?: any
	): Promise<GraphqlConnection<SellerPayoutLine>> {
		const { skip, take } = resolveConnectionWindow(page);

		return this.connectionOf(skip, take, (window) =>
			this.sellerPayoutLineService.listLines({ where: { sellerPayoutId }, ...window }, this.scope(context))
		);
	}

	/** Lists settlements, one page at a time. */
	@Query(() => Object, { name: 'sellerSettlements' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_VIEW)
	async sellerSettlements(
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Context() context?: any
	): Promise<GraphqlConnection<SellerSettlement>> {
		const { skip, take } = resolveConnectionWindow(page);

		return this.connectionOf(skip, take, (window) => this.sellerSettlementService.listSettlements(window, this.scope(context)));
	}

	/** Submits a seller application for review. */
	@Mutation(() => SellerType, { name: 'submitSeller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	async submitSeller(@Args('id', { type: () => ID }) id: string, @Context() context?: any): Promise<Seller> {
		return this.sellerService.submit(id, this.scope(context));
	}

	/** Activates an approved seller. */
	@Mutation(() => SellerType, { name: 'activateSeller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	async activateSeller(@Args('id', { type: () => ID }) id: string, @Context() context?: any): Promise<Seller> {
		return this.sellerService.activate(id, this.scope(context));
	}

	/** Suspends a seller. */
	@Mutation(() => SellerType, { name: 'suspendSeller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	async suspendSeller(
		@Args('id', { type: () => ID }) id: string,
		@Args('reason', { type: () => String }) reason: string,
		@Context() context?: any
	): Promise<Seller> {
		return this.sellerService.suspend(id, reason, this.scope(context));
	}

	/** Returns a suspended seller to active. */
	@Mutation(() => SellerType, { name: 'reinstateSeller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	async reinstateSeller(@Args('id', { type: () => ID }) id: string, @Context() context?: any): Promise<Seller> {
		return this.sellerService.reinstate(id, this.scope(context));
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
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string,
		@Context() context?: any
	): Promise<SellerOffering> {
		return this.sellerOfferingService.publish(id, channelIds, this.scope(context));
	}

	/** Pauses an offering. */
	@Mutation(() => SellerOfferingType, { name: 'pauseSellerOffering' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	async pauseSellerOffering(
		@Args('id', { type: () => ID }) id: string,
		@Context() context?: any
	): Promise<SellerOffering> {
		return this.sellerOfferingService.unpause(id, this.scope(context));
	}

	/** Withdraws an offering. */
	@Mutation(() => SellerOfferingType, { name: 'withdrawSellerOffering' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	async withdrawSellerOffering(
		@Args('id', { type: () => ID }) id: string,
		@Context() context?: any
	): Promise<SellerOffering> {
		return this.sellerOfferingService.withdraw(id, this.scope(context));
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
	async bulkSellerOfferings(
		@Args('input') input: IBulkSellerOfferingsInput,
		@Context() context?: any
	): Promise<IBulkSellerOfferingsPayload> {
		const scope = this.scope(context);

		const result = await this.bulkExecutor.execute<IBulkSellerOfferingItem>(
			{ items: input.items, mode: input.mode, atomic: input.atomic },
			(item, itemContext) => this.applyBulkItem(item, itemContext, scope),
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
	 * handed on with the batch's transactional manager exactly as the executor resolved it and with the
	 * scope the guard resolved, and the outcome names the offering that moved so a client can match an
	 * answer to the listing it asked about.
	 *
	 * The scope is handed on rather than stated as `undefined`, which is what the route does: a batch that
	 * dropped it would be the one write on this surface a seller-scoped caller could aim at another
	 * seller's listings, item by item, while the single-item mutations beside it refused.
	 *
	 * @param item The item.
	 * @param context What the executor resolved for it.
	 * @param scope The seller scope the guard resolved, when the caller is seller-scoped.
	 * @returns The outcome the batch reports for the item.
	 */
	private async applyBulkItem(
		item: BulkItemRequest<IBulkSellerOfferingItem>,
		context: IBulkItemContext,
		scope?: ISellerScope
	): Promise<{ index: number; id: Id }> {
		const offering = await this.sellerOfferingService.applyBulkItem(item, scope, context.manager);

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
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string,
		@Context() context?: any
	): Promise<SellerTransaction> {
		return this.sellerTransactionService.settle(id, note, this.scope(context));
	}

	/** Holds a ledger row out of payouts. */
	@Mutation(() => SellerTransactionType, { name: 'holdSellerTransaction' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_SETTLE)
	async holdSellerTransaction(
		@Args('id', { type: () => ID }) id: string,
		@Args('reason', { type: () => String }) reason: any,
		@Context() context?: any
	): Promise<SellerTransaction> {
		return this.sellerTransactionService.hold(id, reason, undefined, this.scope(context));
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
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string,
		@Context() context?: any
	): Promise<SellerPayout> {
		return this.sellerPayoutService.createPayout({ sellerId, currency, transactionIds, note }, this.scope(context));
	}

	/** Approves a payout. */
	@Mutation(() => SellerPayoutType, { name: 'approveSellerPayout' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_APPROVE)
	async approveSellerPayout(
		@Args('id', { type: () => ID }) id: string,
		@Context() context?: any
	): Promise<SellerPayout> {
		return this.sellerPayoutService.approve(id, this.scope(context));
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
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string,
		@Context() context?: any
	): Promise<SellerPayout> {
		return this.sellerPayoutService.recordExecution(
			id,
			{
				paid: true,
				providerKey,
				providerTransferId
			},
			this.scope(context)
		);
	}

	/** Cancels an unpaid payout. */
	@Mutation(() => SellerPayoutType, { name: 'cancelSellerPayout' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_CANCEL)
	async cancelSellerPayout(
		@Args('id', { type: () => ID }) id: string,
		@Args('reason', { type: () => String }) reason: string,
		@Context() context?: any
	): Promise<SellerPayout> {
		const { payout } = await this.sellerPayoutService.cancel(id, reason, this.scope(context));

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
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string,
		@Context() context?: any
	): Promise<SellerSettlement> {
		return this.sellerSettlementService.record(
			{
				sellerId,
				providerKey,
				currency,
				grossAmount,
				commissionAmount,
				feeAmount
			} as Partial<SellerSettlement>,
			this.scope(context)
		);
	}

	/**
	 * The seller scope the access guard resolved for this operation.
	 *
	 * Read off the operation's own context rather than from a thread-local, exactly as each controller
	 * reads it off the request: the scope is a property of the call, and the guard is what put it there.
	 * Both places the guard writes are read, because a GraphQL server does not have to carry a request —
	 * `context.req` is the object an HTTP-backed server builds, and the context itself is what a server
	 * without one hands the resolver.
	 *
	 * @param context The GraphQL context.
	 * @returns The scope, when the operation carries one.
	 */
	private scope(context: any): ISellerScope | undefined {
		return (context?.req?.sellerScope ?? context?.sellerScope) as ISellerScope | undefined;
	}
}
