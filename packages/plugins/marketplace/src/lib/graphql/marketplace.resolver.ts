import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IPagination, PermissionsEnum } from '@gauzy/contracts';
import type { ID as Id, ISellerPayoutRunResult } from '@gauzy/contracts';
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
	ICreateSellerInput,
	ICreateSellerOfferingInput,
	IReconcileSellerSettlementInput,
	IRunSellerPayoutInput,
	IUpdateSellerInput,
	IUpdateSellerOfferingInput,
	IUpdateSellerPayoutInput,
	IUpdateSellerSettlementInput,
	IVerifySellerInput,
	SellerBalanceType,
	SellerDeleteResultType,
	SellerOfferingType,
	SellerPayoutLineType,
	SellerPayoutRunResultType,
	SellerPayoutType,
	SellerSettlementReconciliationType,
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
 * in and look like it had paged correctly. Each field therefore asks its service for the pages the caller's
 * window spans — one, or two when the window starts part-way into a page, each at the window's own size —
 * and slices the window out of them. Asking for the first page and slicing that instead would answer ten
 * rows whatever the caller asked for, because ten is the store's default page size, and would report ten
 * as the size of the whole collection: a client would read a paged surface as a complete one.
 *
 * **Every list field offers the soft-delete visibility its route offers.** Each REST list route reads
 * through `BaseQueryDTO`, so its caller can ask for the rows a tenant retired; the six fields here state
 * the same `withDeleted` argument and hand it to the read, which forwards it into `paginate`. A field that
 * declared the argument and dropped it would answer the live rows however the caller asked, so a client
 * would be told it could ask and be given the same page either way.
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
	 * **A window that does not start on a page boundary spans two pages, and both are read at the page size
	 * the page number was computed in.** The page number means "rows `take × (n − 1)` onwards" only for the
	 * `take` it was computed with. Asking for page `n` at *twice* that size — the shortcut this used to take
	 * — moves the page to rows `2·take × (n − 1)` onwards: for `skip = 30, take = 20` it read rows 40–79 and
	 * answered rows 50–69 as rows 30–49, silently skipping twenty rows. Only a window inside the first page
	 * happened to come out right, which is the only one the earlier specs walked. The two pages are therefore
	 * read separately with the same `take` and joined, and the second read is skipped when the first page
	 * already reaches the end of the set, because there is nothing after it to read.
	 *
	 * **An empty window is answered without a page read.** A backward walk from the first row
	 * (`before: <offset 0>`) resolves to `take: 0`, because nothing lies before the cursor. There is no page
	 * number for it — `skip / 0` is `NaN` at offset zero — and a zero size is not one the list read can be
	 * handed either: `paginate` reads a zero `take` as "not stated", which is ten rows on the TypeORM branch
	 * and every row of the filtered set on the MikroORM one, so the old path issued an unbounded read only to
	 * slice it down to nothing. The connection still owes the caller the count, so the set is asked for the
	 * smallest page there is — one row, which is dropped — and the answer is the empty page with that total.
	 *
	 * The soft-delete flag rides in the same options object as the window, because that object is what the
	 * read forwards into `paginate`: a field that declared the argument and dropped it here would answer the
	 * live rows however the caller asked, while the document said otherwise.
	 *
	 * @param skip The offset the page starts at.
	 * @param take The page size; zero for the empty window before the first row.
	 * @param read The page-numbered listing read.
	 * @param withDeleted Whether retired rows are included, as the REST list route's own `withDeleted` is.
	 * @returns The connection, with the count the listing itself reported rather than the size of the page.
	 */
	private async connectionOf<T>(
		skip: number,
		take: number,
		read: (window: { skip: number; take: number; withDeleted?: boolean }) => Promise<IPagination<T>>,
		withDeleted?: boolean
	): Promise<GraphqlConnection<T>> {
		const visibility = withDeleted ? { withDeleted: true } : {};

		if (take <= 0) {
			const counted = await read({ skip: 1, take: 1, ...visibility });

			return connectionFromOffsetPage({ items: [], total: counted.total }, skip, take);
		}

		const firstPage = Math.floor(skip / take) + 1;
		// How far into that page the window starts, which is how many rows of it are not the caller's.
		const leading = skip - (firstPage - 1) * take;
		const listing = await read({ skip: firstPage, take, ...visibility });
		let rows: T[] = listing.items ?? [];

		// The window's tail lies on the next page when it starts part-way into this one, unless this page is
		// already the last one the set has.
		if (leading > 0 && firstPage * take < Number(listing.total ?? 0)) {
			const next = await read({ skip: firstPage + 1, take, ...visibility });

			rows = rows.concat(next.items ?? []);
		}

		const window = paginateRows(rows, take, leading);

		// The page size is passed on so `hasNextPage` is decided against the depth ceiling the window was
		// accepted under, rather than against however many rows this page happened to carry.
		return connectionFromOffsetPage({ items: window.items, total: listing.total }, skip, take);
	}

	/** Lists seller accounts, one page at a time. */
	@Query(() => Object, { name: 'sellers' })
	@Permissions(PermissionsEnum.SELLERS_VIEW)
	async sellers(
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean,
		@Context() context?: any
	): Promise<GraphqlConnection<Seller>> {
		const { skip, take } = resolveConnectionWindow(page);

		return this.connectionOf(
			skip,
			take,
			(window) => this.sellerService.listSellers(window, this.scope(context)),
			withDeleted
		);
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
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean,
		@Context() context?: any
	): Promise<GraphqlConnection<SellerOffering>> {
		const { skip, take } = resolveConnectionWindow(page);

		return this.connectionOf(
			skip,
			take,
			(window) => this.sellerOfferingService.listOfferings(window, this.scope(context)),
			withDeleted
		);
	}

	/** Lists the per-seller split of orders, one page at a time. */
	@Query(() => Object, { name: 'sellerTransactions' })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_VIEW)
	async sellerTransactions(
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean,
		@Context() context?: any
	): Promise<GraphqlConnection<SellerTransaction>> {
		const { skip, take } = resolveConnectionWindow(page);

		return this.connectionOf(
			skip,
			take,
			(window) => this.sellerTransactionService.listTransactions(window, this.scope(context)),
			withDeleted
		);
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
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean,
		@Context() context?: any
	): Promise<GraphqlConnection<SellerPayout>> {
		const { skip, take } = resolveConnectionWindow(page);

		return this.connectionOf(
			skip,
			take,
			(window) => this.sellerPayoutService.listPayouts(window, this.scope(context)),
			withDeleted
		);
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
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean,
		@Context() context?: any
	): Promise<GraphqlConnection<SellerPayoutLine>> {
		const { skip, take } = resolveConnectionWindow(page);

		return this.connectionOf(
			skip,
			take,
			(window) =>
				this.sellerPayoutLineService.listLines({ where: { sellerPayoutId }, ...window }, this.scope(context)),
			withDeleted
		);
	}

	/** Lists settlements, one page at a time. */
	@Query(() => Object, { name: 'sellerSettlements' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_VIEW)
	async sellerSettlements(
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean,
		@Context() context?: any
	): Promise<GraphqlConnection<SellerSettlement>> {
		const { skip, take } = resolveConnectionWindow(page);

		return this.connectionOf(
			skip,
			take,
			(window) => this.sellerSettlementService.listSettlements(window, this.scope(context)),
			withDeleted
		);
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
	 * Opens a seller account on the seller's behalf.
	 *
	 * The mutation mirrors `POST /sellers` and makes the call that route makes: the applicant is born
	 * `DRAFT`, bound to the organization the request carries rather than to one the input names, and its
	 * verification statuses start `UNVERIFIED`. `SELLERS_CREATE` is stated here because the route states
	 * it, and the class-level read grant would otherwise be the only thing in front of a write.
	 *
	 * The seller scope is deliberately not handed on, because the route does not hand it on either: the
	 * service takes none for a creation, and a field that narrowed here while REST did not would refuse a
	 * caller the other protocol served — a divergence in the opposite direction from the one this class
	 * exists to close, and just as invisible.
	 *
	 * `seller.create` is declared with the route's own scope and the route's own `required: false`, so an
	 * applicant that re-sends an application it never saw acknowledged is answered from its first attempt
	 * over either protocol rather than with the collision its own code would cause.
	 */
	@Idempotent({ scope: 'seller.create', required: false, resourceType: 'seller' })
	@Mutation(() => SellerType, { name: 'createSeller' })
	@Permissions(PermissionsEnum.SELLERS_CREATE)
	async createSeller(
		@Args('input') input: ICreateSellerInput,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string
	): Promise<Seller> {
		return this.sellerService.createSeller(input as Partial<Seller>);
	}

	/**
	 * Amends a seller's profile, commission defaults, payout terms and tax identifiers.
	 *
	 * The mutation mirrors `PUT /sellers/:id`, and it is the one seller write whose service method
	 * narrows by the scope it is handed — a seller-scoped caller reaching another seller's account is
	 * refused by `assertSellerScope` inside `updateSeller`, not by the guard. A field that dropped the
	 * scope would therefore run unscoped and look exactly like its siblings from the outside, which is
	 * why the scope is threaded here rather than stated as `undefined`.
	 */
	@Mutation(() => SellerType, { name: 'updateSeller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	async updateSeller(
		@Args('id', { type: () => ID }) id: string,
		@Args('input') input: IUpdateSellerInput,
		@Context() context?: any
	): Promise<Seller> {
		return this.sellerService.updateSeller(id, input as Partial<Seller>, this.scope(context));
	}

	/**
	 * Records one verification kind's result.
	 *
	 * The mutation mirrors `POST /sellers/:id/verify` and makes that route's call: the three required
	 * kinds are the service's own default, so a verdict that completes the set moves an `IN_REVIEW`
	 * seller to `APPROVED` here exactly as it does over REST. The route threads no seller scope and the
	 * service takes none, so none is invented here.
	 *
	 * `seller.verify` is declared with the route's own scope and its `required: false`: a verifier that
	 * re-sends a verdict it never saw acknowledged would otherwise stamp a fresh verification date over
	 * the one already recorded, so the key answers it from the first attempt instead.
	 */
	@Idempotent({ scope: 'seller.verify', required: false, resourceType: 'seller' })
	@Mutation(() => SellerType, { name: 'verifySeller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	async verifySeller(
		@Args('id', { type: () => ID }) id: string,
		@Args('input') input: IVerifySellerInput,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string
	): Promise<Seller> {
		return this.sellerService.verify(id, input);
	}

	/**
	 * Refuses an application.
	 *
	 * The mutation mirrors `POST /sellers/:id/reject`. The reason is a required argument rather than a
	 * nullable one because the service refuses a rejection without one, and a document that let it be
	 * omitted would let a client reach a `BAD_REQUEST` the schema could have made unreachable.
	 */
	@Mutation(() => SellerType, { name: 'rejectSeller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	async rejectSeller(
		@Args('id', { type: () => ID }) id: string,
		@Args('reason', { type: () => String }) reason: string
	): Promise<Seller> {
		return this.sellerService.reject(id, reason);
	}

	/**
	 * Starts winding a seller down.
	 *
	 * The mutation mirrors `POST /sellers/:id/offboard`, whose handler calls `startOffboarding` rather
	 * than a method named after the route. The move is one lifecycle transition and no more: the final
	 * payout and the erasure behind it are the durable operation's steps, so a failure later cannot leave
	 * the seller in a state the operation cannot resume from.
	 *
	 * `seller.offboard` is declared with the route's own scope and its `required: false`: a second
	 * attempt is refused by the state machine rather than applied twice, so answering a keyed retry from
	 * the first attempt's record is the more useful of the two answers.
	 */
	@Idempotent({ scope: 'seller.offboard', required: false, resourceType: 'seller' })
	@Mutation(() => SellerType, { name: 'offboardSeller' })
	@Permissions(PermissionsEnum.SELLERS_EDIT)
	async offboardSeller(
		@Args('id', { type: () => ID }) id: string,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string
	): Promise<Seller> {
		return this.sellerService.startOffboarding(id);
	}

	/**
	 * Removes a seller account.
	 *
	 * The mutation mirrors `DELETE /sellers/:id` and answers what that route answers: the count the
	 * deletion reports, projected from the ORM result rather than withheld. It is `SELLERS_DELETE` and
	 * not the edit grant beside it because the route states `SELLERS_DELETE`, and a caller that may amend
	 * a seller is not thereby a caller that may remove one.
	 *
	 * The row is not read back before or after the deletion: the route does not read it, so a field that
	 * did would be answering a seller the route never returned and would turn one capability into two.
	 */
	@Mutation(() => SellerDeleteResultType, { name: 'deleteSeller' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async deleteSeller(@Args('id', { type: () => ID }) id: string): Promise<{ affected: number }> {
		const result = await this.sellerService.delete(id);

		return { affected: result?.affected ?? 0 };
	}

	/**
	 * Archives a seller account, keeping the row.
	 *
	 * The mutation mirrors `DELETE /sellers/:id/soft` and answers the archived seller, as that route
	 * does. The inherited route hands `CrudController.softRemove` its rest parameter — an empty array —
	 * which the service normalises to no find options, so the call stated here is the one that
	 * normalisation reaches rather than an array the service would only discard.
	 */
	@Mutation(() => SellerType, { name: 'softDeleteSeller' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async softDeleteSeller(@Args('id', { type: () => ID }) id: string): Promise<Seller> {
		return this.sellerService.softRemove(id);
	}

	/**
	 * Restores a soft-deleted seller account.
	 *
	 * The mutation mirrors `PUT /sellers/:id/recover` and answers the restored seller. It carries
	 * `SELLERS_DELETE` rather than the edit grant because restoring is the same destructive authority
	 * read backwards: the route states `SELLERS_DELETE`, and the service reads the row `withDeleted`,
	 * which is a visibility no ordinary read has.
	 *
	 * `restoreSeller` is the name the specification's own table gives this act — `PUT /<resource>/:id/recover`
	 * is `restore<Type>(id: ID!)` in `17-graphql-api-specification.md` §10 — even though the rest of the
	 * composed schema spells it `recover*` in a hundred and eleven fields. The divergence is recorded rather
	 * than resolved here: renaming those hundred and eleven is a breaking schema change, and this field is
	 * the one that already matches what the document says.
	 */
	@Mutation(() => SellerType, { name: 'restoreSeller' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async restoreSeller(@Args('id', { type: () => ID }) id: string): Promise<Seller> {
		return this.sellerService.softRecover(id);
	}

	/**
	 * Offers a variant, born `DRAFT`.
	 *
	 * The mutation mirrors `POST /seller-offerings` and makes the call that route makes: the offering is
	 * authored through the service that owns the offering's writes, with the seller scope the guard
	 * resolved, and it is born `DRAFT` — publishing it is a separate act with its own field beside this
	 * one. `SELLER_OFFERINGS_EDIT` is stated here because the route states it: a caller that may read the
	 * listings is not thereby a caller that may author one.
	 *
	 * `seller_offering.create` is declared with the route's own scope and the route's own
	 * `required: false`, so a seller that re-sends an offer it never saw acknowledged is answered from
	 * its first attempt over either protocol rather than with the collision its own write would cause.
	 */
	@Idempotent({ scope: 'seller_offering.create', required: false, resourceType: 'seller_offering' })
	@Mutation(() => SellerOfferingType, { name: 'createSellerOffering' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	async createSellerOffering(
		@Args('input') input: ICreateSellerOfferingInput,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string,
		@Context() context?: any
	): Promise<SellerOffering> {
		return this.sellerOfferingService.createOffering(input as Partial<SellerOffering>, this.scope(context));
	}

	/**
	 * Amends an offering's price, window, commission and publication set.
	 *
	 * The mutation mirrors `PUT /seller-offerings/:id`, and it is the offering write whose service method
	 * narrows by the scope it is handed: `updateOffering` reads the row through `getOffering`, which
	 * refuses a seller-scoped caller naming another seller's listing. A field that dropped the scope
	 * would therefore run unscoped and look exactly like the lifecycle fields beside it, which is why the
	 * scope is threaded rather than stated as `undefined`.
	 *
	 * The subject of the offering is not an argument: `UpdateSellerOfferingInput` omits the seller and the
	 * variant because the route's own DTO omits them, so neither surface offers a caller a member the
	 * service would delete from the body anyway.
	 */
	@Mutation(() => SellerOfferingType, { name: 'updateSellerOffering' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	async updateSellerOffering(
		@Args('id', { type: () => ID }) id: string,
		@Args('input') input: IUpdateSellerOfferingInput,
		@Context() context?: any
	): Promise<SellerOffering> {
		return this.sellerOfferingService.updateOffering(id, input as Partial<SellerOffering>, this.scope(context));
	}

	/**
	 * Submits an offering for moderation: the door a marketplace that does not let its sellers publish
	 * opens, and the one this surface did not have.
	 *
	 * **The capability, stated as a capability.** `marketplace.sellerSelfPublish` is the module's own
	 * setting — "Whether a seller may publish its own offerings, or only submit them for moderation" —
	 * and a channel that leaves it `false` is a marketplace where publishing is a moderator's act and
	 * `POST /api/seller-offerings/:id/submit` is the *only* way an offering reaches `PENDING_REVIEW`.
	 * Until this field existed, a seller on such a marketplace could author an offering over GraphQL
	 * (`createSellerOffering`), amend it (`updateSellerOffering`) and then not advance it: the surface
	 * offered `publishSellerOffering`, `pauseSellerOffering` and `withdrawSellerOffering` — the acts of a
	 * seller that publishes for itself — while `publish` is that seller's transition and not the request
	 * for a moderator's. The same act was one route away over REST, so the gap was a capability a REST
	 * caller had and a GraphQL caller did not.
	 *
	 * **Why a name-matching reading missed it, which is why the suite beside this file pins it.** An audit
	 * that matches a route's verb plus the opening characters of its resource name reads `submit` beside
	 * `SellerOffering` as `submitSeller` — a field that already exists here and serves a different
	 * resource's route, `SellerController`'s own `POST /sellers/:id/submit`. Two capabilities on two rows,
	 * one name between them, which is why this field keeps the naming convention the fields beside it use
	 * — the act, then the resource — and why the suite asserts that each of the two reaches its own
	 * service.
	 *
	 * The service is what decides whether the transition is legal — it refuses anything that is not
	 * `DRAFT` or `PAUSED` with a `ConflictException` — so this field makes the call the route makes, with
	 * the scope the guard resolved, and neither loosens that rule nor restates it.
	 */
	@Mutation(() => SellerOfferingType, { name: 'submitSellerOffering' })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_EDIT)
	async submitSellerOffering(
		@Args('id', { type: () => ID }) id: string,
		@Context() context?: any
	): Promise<SellerOffering> {
		return this.sellerOfferingService.submit(id, this.scope(context));
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
	 * Archives an offering, keeping the row.
	 *
	 * The mutation mirrors `DELETE /seller-offerings/:id/soft` and answers the archived offering, as that
	 * route does. It states `SELLERS_DELETE` because the route's own override states it: an offering is a
	 * child row of the seller, and the catalogue declares the destructive grant on the seller rather than a
	 * separate one per child. The row is kept rather than withdrawn a second way, because it is what
	 * explains a past line's price and commission.
	 *
	 * The inherited route hands `CrudController.softRemove` its rest parameter — an empty array — which the
	 * service normalises to no find options, so the call stated here is the one that normalisation reaches
	 * rather than an array the service would only discard.
	 */
	@Mutation(() => SellerOfferingType, { name: 'softDeleteSellerOffering' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async softDeleteSellerOffering(@Args('id', { type: () => ID }) id: string): Promise<SellerOffering> {
		return this.sellerOfferingService.softRemove(id);
	}

	/**
	 * Restores a soft-deleted offering.
	 *
	 * The mutation mirrors `PUT /seller-offerings/:id/recover` and answers the restored offering. It carries
	 * `SELLERS_DELETE` rather than the edit grant because restoring is the same destructive authority read
	 * backwards: the route states `SELLERS_DELETE`, and the service reads the row `withDeleted`, which is a
	 * visibility no ordinary read has.
	 */
	@Mutation(() => SellerOfferingType, { name: 'recoverSellerOffering' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async recoverSellerOffering(@Args('id', { type: () => ID }) id: string): Promise<SellerOffering> {
		return this.sellerOfferingService.softRecover(id);
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
	 * Removes a ledger row, answering the count the deletion reports.
	 *
	 * The mutation mirrors `DELETE /seller-transactions/:id`, which takes `SELLERS_DELETE` rather than the
	 * settle grant the two fields beside it state, and it removes where the archive keeps: the ledger is
	 * the truth about what a seller earned, so a caller that removes a row is destroying that record
	 * rather than retiring it from the reads that resolve it. The hard delete and `softDeleteSellerTransaction`
	 * are therefore two acts and not two spellings of one, which is why both are served.
	 */
	@Mutation(() => SellerDeleteResultType, { name: 'deleteSellerTransaction' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async deleteSellerTransaction(@Args('id', { type: () => ID }) id: string): Promise<{ affected: number }> {
		const result = await this.sellerTransactionService.delete(id);

		return { affected: result?.affected ?? 0 };
	}

	/**
	 * Archives a ledger row, keeping it.
	 *
	 * The mutation mirrors `DELETE /seller-transactions/:id/soft` and answers the archived row, as that
	 * route does. It states `SELLERS_DELETE` because the route's own override states it: a ledger row is a
	 * child row of the seller, and the catalogue declares the destructive grant on the seller whose ledger
	 * it is. The row is archived rather than removed because the ledger is the truth about what a seller
	 * earned, and a statement read for a past period resolves through it.
	 *
	 * The inherited route hands `CrudController.softRemove` its rest parameter — an empty array — which the
	 * service normalises to no find options, so the call stated here is the one that normalisation reaches
	 * rather than an array the service would only discard.
	 */
	@Mutation(() => SellerTransactionType, { name: 'softDeleteSellerTransaction' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async softDeleteSellerTransaction(@Args('id', { type: () => ID }) id: string): Promise<SellerTransaction> {
		return this.sellerTransactionService.softRemove(id);
	}

	/**
	 * Restores a soft-deleted ledger row.
	 *
	 * The mutation mirrors `PUT /seller-transactions/:id/recover` and answers the restored row. It carries
	 * `SELLERS_DELETE` rather than the settle grant beside it because the route states `SELLERS_DELETE`, and
	 * a caller that may advance a row is not thereby a caller that may put one back into what a balance is
	 * summed from: the service reads the row `withDeleted`, which is a visibility no ordinary read has.
	 */
	@Mutation(() => SellerTransactionType, { name: 'recoverSellerTransaction' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async recoverSellerTransaction(@Args('id', { type: () => ID }) id: string): Promise<SellerTransaction> {
		return this.sellerTransactionService.softRecover(id);
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

	/**
	 * Amends what a payout states about itself: its note, its provider references, its period and schedule
	 * and its metadata.
	 *
	 * The mutation mirrors `PUT /seller-payouts/:id`, which takes `SELLER_PAYOUTS_CREATE` and not the
	 * approve grant beside it — preparing a payout is creating one, while approving it is what moves
	 * money — so a caller that may build a payout is exactly the caller that may annotate one, **and no
	 * more**. The input used to carry `status`, `feeAmount` and `transactionIds`, so that caller could mark
	 * a draft payout `PAID` without the approver or the required-idempotent `seller.payout.pay`, or move a
	 * paid one back to `APPROVED`. Those members are gone from `UpdateSellerPayoutInput` as they are from
	 * the route's DTO, and `SellerPayoutService.update` refuses them whichever surface names them.
	 *
	 * **Two calls, because the write answers a count.** The route hands the service `update(id, entity)`
	 * and passes its return on, which on this platform's ORM path is the driver's `UpdateResult` rather
	 * than the row; `06-api-specification.md` states the convention the surface owes a caller — a `PUT`
	 * answers the updated resource, "not a bare `UpdateResult`" — and every sibling mutation on this
	 * resource answers the row. The row is therefore read back with the same base read the write itself
	 * performs as its precondition, which is the shape the fulfilment plugin's own update field settled
	 * on. Nothing else is added: no scope is threaded, exactly as the route threads none, so a
	 * seller-scoped caller reaches what REST already lets it reach and no more.
	 */
	@Mutation(() => SellerPayoutType, { name: 'updateSellerPayout' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_CREATE)
	async updateSellerPayout(
		@Args('id', { type: () => ID }) id: string,
		@Args('input') input: IUpdateSellerPayoutInput
	): Promise<SellerPayout> {
		// The cast is the route's own: `UpdateSellerPayoutDTO` is a partial of the entity's shape rather
		// than a `QueryDeepPartialEntity`, so the controller hands it on as `any` and this does the same.
		await this.sellerPayoutService.update(id, input as any);

		return this.sellerPayoutService.findOneByIdString(id);
	}

	/**
	 * Runs the payout pass for the sellers whose schedule is due.
	 *
	 * The mutation mirrors `POST /seller-payouts/run` and makes that route's call, including its
	 * coercions: the two period members reach the service as `Date`s and `dryRun` reaches it as a
	 * boolean, so a pass the caller asked to be reported rather than paid is reported on both surfaces
	 * rather than paid on one of them. It answers one decision per seller — what the run saw, what the
	 * reserve withheld, what was payable and either the payout it created or why it created none —
	 * because that is what the route answers.
	 *
	 * The run threads no seller scope, as the route threads none: the pass decides for every seller whose
	 * schedule is due, and narrowing it to one seller is a request the caller makes by naming them.
	 *
	 * `seller.payout.run` is declared with the route's own scope and its `required: false`: a scheduler
	 * that re-sends a pass it never received an answer for is answered from the first attempt's result
	 * rather than repeating the pass.
	 */
	@Idempotent({ scope: 'seller.payout.run', required: false, resourceType: 'seller_payout' })
	@Mutation(() => [SellerPayoutRunResultType], { name: 'runSellerPayout' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_CREATE)
	async runSellerPayout(
		@Args('input', { nullable: true }) input?: IRunSellerPayoutInput,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string
	): Promise<ISellerPayoutRunResult[]> {
		return this.sellerPayoutService.run({
			periodStart: input?.periodStart ? new Date(input.periodStart) : undefined,
			periodEnd: input?.periodEnd ? new Date(input.periodEnd) : undefined,
			sellerIds: input?.sellerIds,
			currency: input?.currency,
			dryRun: input?.dryRun === true
		});
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
	 * Re-drives a failed payout.
	 *
	 * The mutation mirrors `POST /seller-payouts/:id/retry` and carries that route's grant rather than the
	 * one the create, update and run fields beside it carry: re-driving a transfer that failed is the
	 * authority approving one is, because the step after it is the execution that moves money. The scope
	 * is threaded as the route threads it.
	 *
	 * `seller.payout.retry` is declared with the route's own scope and its `required: false`: a retry that
	 * re-drives a payout the client never saw the answer for would clear a failure an operator is still
	 * reading, so a client that presents a key is answered from its first attempt instead.
	 */
	@Idempotent({ scope: 'seller.payout.retry', required: false, resourceType: 'seller_payout' })
	@Mutation(() => SellerPayoutType, { name: 'retrySellerPayout' })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_APPROVE)
	async retrySellerPayout(
		@Args('id', { type: () => ID }) id: string,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string,
		@Context() context?: any
	): Promise<SellerPayout> {
		return this.sellerPayoutService.retry(id, this.scope(context));
	}

	/**
	 * Removes a payout, answering the count the deletion reports.
	 *
	 * The mutation mirrors `DELETE /seller-payouts/:id` and answers what that route answers: the count the
	 * deletion reports, projected from the ORM result rather than withheld, because the row is gone and
	 * there is no payout left to hand back. It is `SELLERS_DELETE` and neither of the two payout grants
	 * beside it — a caller that may approve or cancel a payout is not thereby a caller that may remove one
	 * from the table — and it is a different act from `softDeleteSellerPayout`, which keeps the row.
	 */
	@Mutation(() => SellerDeleteResultType, { name: 'deleteSellerPayout' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async deleteSellerPayout(@Args('id', { type: () => ID }) id: string): Promise<{ affected: number }> {
		const result = await this.sellerPayoutService.delete(id);

		return { affected: result?.affected ?? 0 };
	}

	/**
	 * Archives a payout, keeping the row.
	 *
	 * The mutation mirrors `DELETE /seller-payouts/:id/soft` and answers the archived payout, as that route
	 * does. It states `SELLERS_DELETE` because the route's own override states it: a payout is a child row of
	 * the seller, and the catalogue declares the destructive grant on the seller it moves money for. It is
	 * `SELLERS_DELETE` and neither of the two payout grants beside it — a caller that may approve or cancel a
	 * payout is not thereby a caller that may retire one from every read that resolves it.
	 *
	 * The inherited route hands `CrudController.softRemove` its rest parameter — an empty array — which the
	 * service normalises to no find options, so the call stated here is the one that normalisation reaches
	 * rather than an array the service would only discard.
	 */
	@Mutation(() => SellerPayoutType, { name: 'softDeleteSellerPayout' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async softDeleteSellerPayout(@Args('id', { type: () => ID }) id: string): Promise<SellerPayout> {
		return this.sellerPayoutService.softRemove(id);
	}

	/**
	 * Restores a soft-deleted payout.
	 *
	 * The mutation mirrors `PUT /seller-payouts/:id/recover` and answers the restored payout. It carries
	 * `SELLERS_DELETE` rather than the payout grants because restoring is the same destructive authority read
	 * backwards: the route states `SELLERS_DELETE`, and putting a payout back is putting it back in front of
	 * every read that decides what a seller is still owed.
	 */
	@Mutation(() => SellerPayoutType, { name: 'recoverSellerPayout' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async recoverSellerPayout(@Args('id', { type: () => ID }) id: string): Promise<SellerPayout> {
		return this.sellerPayoutService.softRecover(id);
	}

	/**
	 * Removes a payout line, answering the count the deletion reports.
	 *
	 * The mutation mirrors `DELETE /seller-payout-lines/:id`, which takes `SELLERS_DELETE`: a line is the
	 * join row of one payout and one ledger row, and the catalogue declares the destructive grant on the
	 * seller whose rows every row under it belongs to. It answers the count rather than a line, because
	 * the row is gone — the archive beside it, `softDeleteSellerPayoutLine`, is the one that keeps a row
	 * to hand back.
	 */
	@Mutation(() => SellerDeleteResultType, { name: 'deleteSellerPayoutLine' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async deleteSellerPayoutLine(@Args('id', { type: () => ID }) id: string): Promise<{ affected: number }> {
		const result = await this.sellerPayoutLineService.delete(id);

		return { affected: result?.affected ?? 0 };
	}

	/**
	 * Archives a payout line, keeping the row.
	 *
	 * The mutation mirrors `DELETE /seller-payout-lines/:id/soft` and answers the archived line, as that
	 * route does. It states `SELLERS_DELETE` because the route's own override states it: a line is the join
	 * row of one payout and one ledger row, and the catalogue declares the destructive grant on the seller
	 * whose rows every row under it belongs to. A line has no sibling mutation here — it is written by the
	 * payout run and released by a cancellation, never authored by a caller — so the type it answers with is
	 * the one its own read declares rather than a mutation's.
	 *
	 * The inherited route hands `CrudController.softRemove` its rest parameter — an empty array — which the
	 * service normalises to no find options, so the call stated here is the one that normalisation reaches
	 * rather than an array the service would only discard.
	 */
	@Mutation(() => SellerPayoutLineType, { name: 'softDeleteSellerPayoutLine' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async softDeleteSellerPayoutLine(@Args('id', { type: () => ID }) id: string): Promise<SellerPayoutLine> {
		return this.sellerPayoutLineService.softRemove(id);
	}

	/**
	 * Restores a soft-deleted payout line.
	 *
	 * The mutation mirrors `PUT /seller-payout-lines/:id/recover` and answers the restored line. It carries
	 * `SELLERS_DELETE` rather than the payout grants because the route states `SELLERS_DELETE`, and restoring
	 * a join row is what makes a ledger row payable at most once again: the service reads the row
	 * `withDeleted`, which is a visibility no ordinary read has.
	 */
	@Mutation(() => SellerPayoutLineType, { name: 'recoverSellerPayoutLine' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async recoverSellerPayoutLine(@Args('id', { type: () => ID }) id: string): Promise<SellerPayoutLine> {
		return this.sellerPayoutLineService.softRecover(id);
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
	 * Amends what a settlement states about itself: its period, its report and external references, the
	 * holder it pays, its note and its metadata.
	 *
	 * The mutation mirrors `PUT /seller-settlements/:id`, which takes `SELLER_SETTLEMENTS_EDIT` — the same
	 * grant the recording, reconciling, closing and disputing routes state. The grant is the same, the
	 * checks are not: reconciling compares against the ledger, closing is final and disputing needs a
	 * reason, and an edit that could write `status` or the figures skipped all three — closing a settlement
	 * without the close, or stating a net its own gross, commission and fee do not produce. Those members
	 * are gone from `UpdateSellerSettlementInput` as they are from the route's DTO, and
	 * `SellerSettlementService.update` refuses them whichever surface names them. The no-seller-scope note
	 * the payout update field carries applies here for the same reason: the route hands the write no scope,
	 * so neither does the field.
	 *
	 * **Two calls, because the write answers a count.** The route passes the service's own return on,
	 * which is the driver's `UpdateResult` rather than the row; the row is therefore read back with the
	 * base read the write performs as its precondition, so the field answers the settlement a client asked
	 * to amend rather than a write envelope.
	 */
	@Mutation(() => SellerSettlementType, { name: 'updateSellerSettlement' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	async updateSellerSettlement(
		@Args('id', { type: () => ID }) id: string,
		@Args('input') input: IUpdateSellerSettlementInput
	): Promise<SellerSettlement> {
		// The cast is the route's own, for the reason the payout update field states: the DTO is not a
		// `QueryDeepPartialEntity`, and the controller hands it on as `any`.
		await this.sellerSettlementService.update(id, input as any);

		return this.sellerSettlementService.findOneByIdString(id);
	}

	/**
	 * Reconciles a settlement against the platform's lines for its period.
	 *
	 * The mutation mirrors `POST /seller-settlements/:id/reconcile` and answers both halves of what that
	 * route answers: the settlement the comparison moved — `RECONCILED` when the figures agree and
	 * `DISPUTED` when they do not, because a discrepancy is recorded and reported rather than repaired —
	 * and the platform's lines the comparison was made over, each with the net the ledger carries. A
	 * discrepancy a client could not attribute to a line is one it could not take to the provider.
	 *
	 * `seller.settlement.reconcile` is declared with the route's own scope and its `required: false`: a
	 * client that re-sends a reconciliation it never saw the answer to would stamp a second reconciled
	 * date over the first, so a client that presents a key is answered from its first attempt instead.
	 */
	@Idempotent({ scope: 'seller.settlement.reconcile', required: false, resourceType: 'seller_settlement' })
	@Mutation(() => SellerSettlementReconciliationType, { name: 'reconcileSellerSettlement' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	async reconcileSellerSettlement(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { nullable: true }) input?: IReconcileSellerSettlementInput,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string
	): Promise<{ settlement: SellerSettlement; differences: Array<{ transactionId: string; platformNet: string }> }> {
		return this.sellerSettlementService.reconcile(id, input);
	}

	/**
	 * Closes a settlement, which accepts no further lines.
	 *
	 * The mutation mirrors `POST /seller-settlements/:id/close` and answers the closed settlement. The
	 * note is nullable because the route's body states it as optional: a close with no note keeps the one
	 * the settlement already carries, which is what the service does with an absent argument.
	 */
	@Mutation(() => SellerSettlementType, { name: 'closeSellerSettlement' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	async closeSellerSettlement(
		@Args('id', { type: () => ID }) id: string,
		@Args('note', { type: () => String, nullable: true }) note?: string
	): Promise<SellerSettlement> {
		return this.sellerSettlementService.close(id, note);
	}

	/**
	 * Marks a settlement disputed, which requires a reason.
	 *
	 * The mutation mirrors `POST /seller-settlements/:id/dispute`. The reason is a required argument rather
	 * than a nullable one because the service refuses a dispute without one, and a document that let it be
	 * omitted would let a client reach a `BAD_REQUEST` the schema could have made unreachable — the same
	 * choice `rejectSeller` makes for its own reason.
	 */
	@Mutation(() => SellerSettlementType, { name: 'disputeSellerSettlement' })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_EDIT)
	async disputeSellerSettlement(
		@Args('id', { type: () => ID }) id: string,
		@Args('reason', { type: () => String }) reason: string
	): Promise<SellerSettlement> {
		return this.sellerSettlementService.dispute(id, reason);
	}

	/**
	 * Removes a settlement, answering the count the deletion reports.
	 *
	 * The mutation mirrors `DELETE /seller-settlements/:id`, which takes `SELLERS_DELETE` rather than the
	 * settlement edit grant the recording, reconciling, closing and disputing fields state: the ledger is
	 * never edited to agree with an external report, so removing one is the destructive authority rather
	 * than another way to correct it. It answers the count because the row is gone; the archive beside it
	 * is the field that keeps one.
	 */
	@Mutation(() => SellerDeleteResultType, { name: 'deleteSellerSettlement' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async deleteSellerSettlement(@Args('id', { type: () => ID }) id: string): Promise<{ affected: number }> {
		const result = await this.sellerSettlementService.delete(id);

		return { affected: result?.affected ?? 0 };
	}

	/**
	 * Archives a settlement, keeping the row.
	 *
	 * The mutation mirrors `DELETE /seller-settlements/:id/soft` and answers the archived settlement, as that
	 * route does. It states `SELLERS_DELETE` because the route's own override states it — not the settlement
	 * edit grant the recording, reconciliation and closing routes state — and the ledger is never edited to
	 * agree with a report, so retiring one is the destructive authority rather than another way to correct it.
	 *
	 * The inherited route hands `CrudController.softRemove` its rest parameter — an empty array — which the
	 * service normalises to no find options, so the call stated here is the one that normalisation reaches
	 * rather than an array the service would only discard.
	 */
	@Mutation(() => SellerSettlementType, { name: 'softDeleteSellerSettlement' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async softDeleteSellerSettlement(@Args('id', { type: () => ID }) id: string): Promise<SellerSettlement> {
		return this.sellerSettlementService.softRemove(id);
	}

	/**
	 * Restores a soft-deleted settlement.
	 *
	 * The mutation mirrors `PUT /seller-settlements/:id/recover` and answers the restored settlement. It
	 * carries `SELLERS_DELETE` rather than the settlement edit grant because the route states
	 * `SELLERS_DELETE`, and a restored report is one the discrepancy of a period is read against again.
	 */
	@Mutation(() => SellerSettlementType, { name: 'recoverSellerSettlement' })
	@Permissions(PermissionsEnum.SELLERS_DELETE)
	async recoverSellerSettlement(@Args('id', { type: () => ID }) id: string): Promise<SellerSettlement> {
		return this.sellerSettlementService.softRecover(id);
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
