import { Args, Context, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { IPagination } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	GraphqlConnection,
	IConnectionPageSelection,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned,
	connectionFromOffsetPage,
	paginateRows,
	resolveConnectionWindow,
	versionExpectationOf
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { OrderChangeService } from './../order-change/order-change.service';
import { OrderChangeActionService } from './../order-change-action/order-change-action.service';
import { OrderHistoryService } from './../order-history/order-history.service';
import { OrderSummaryService } from './../order-summary/order-summary.service';
import { OrderTransactionService } from './../order-transaction/order-transaction.service';
import { ORDER_PERMISSIONS } from './../order.permissions';
import {
	ORDER_CHANGE_STATUSES,
	ORDER_TRANSACTION_TYPES,
	isOrderChangeStatus,
	isOrderTransactionType
} from './filters';
import {
	IOrderChangeConnection,
	IOrderDeleteResult,
	IOrderSummaryConnection,
	IOrderTransactionConnection,
	OrderChange,
	OrderChangeAction,
	OrderHistory,
	OrderSummary,
	OrderTransaction
} from './types';

/**
 * The order's ledgers and its changes.
 *
 * These are separate root fields rather than fields of the order because they are read on their own:
 * an operator looks at a transaction ledger, a totals history or a change without loading the whole
 * order graph, and a return or a claim reads the changes of an order directly.
 *
 * Everything here delegates to the service that owns the rule, so the change lifecycle — including the
 * exclusivity rule and the atomic application of an action set — exists once.
 *
 * The mutations that write a change carry `@Versioned(...)`, and the version they take is the
 * **order's**, never the change's: the `version` column on a change is the order version the change
 * produces, which is a different fact. A mutation names only the change, so no resource is declared —
 * the handler resolves the order and the order's own conditional update compares the stated version.
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
 */
@Resolver('OrderChange')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
export class OrderChangeResolver {
	constructor(
		private readonly changeService: OrderChangeService,
		private readonly actionService: OrderChangeActionService,
		private readonly summaryService: OrderSummaryService,
		private readonly transactionService: OrderTransactionService,
		private readonly historyService: OrderHistoryService
	) {}

	/**
	 * Lists the changes of an order.
	 *
	 * @param orderId The order.
	 * @param status Optional status filter.
	 * @param page The page.
	 * @param withDeleted Whether retired changes are included, as the REST list route's own
	 * `withDeleted` is.
	 * @returns A page of changes.
	 * @throws BadRequestException when a status is given that a change does not have.
	 */
	@Query(() => Object, { name: 'orderChanges' })
	async orderChanges(
		@Args('orderId', { type: () => ID }) orderId: string,
		@Args('status', { type: () => String, nullable: true }) status?: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<IOrderChangeConnection> {
		const where: FindOptionsWhere<OrderChange> = { orderId };
		const { skip, take } = resolveConnectionWindow(page);

		if (status) {
			if (!isOrderChangeStatus(status)) {
				throw new BadRequestException(
					`The change status "${status}" is not one of: ${ORDER_CHANGE_STATUSES.join(', ')}.`
				);
			}

			where.status = status;
		}

		const listing = (await this.changeService.findAll({
			where,
			relations: ['actions'],
			// Newest first, closed by the row's identity: an offset cursor is a position, and a position means
			// nothing in an order the store may rearrange between two pages.
			order: { createdAt: 'DESC', id: 'DESC' },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<OrderChange>;

		return connectionFromOffsetPage(listing, skip);
	}

	/**
	 * Reads one change.
	 *
	 * @param id The change.
	 * @returns The change with its actions.
	 */
	@Query(() => Object, { name: 'orderChange', nullable: true })
	async orderChange(@Args('id', { type: () => ID }) id: string): Promise<OrderChange> {
		return this.changeService.findOneByIdString(id, { relations: ['actions'] });
	}

	/**
	 * The totals history of an order.
	 *
	 * The order the field means — newest version first — is asked of the store rather than applied to the
	 * rows afterwards: a list that is sorted after it was paged answers the wrong page whenever the rows
	 * do not already arrive in that order, which is exactly what the sort was there to fix.
	 *
	 * @param orderId The order.
	 * @param page The page.
	 * @param withDeleted Whether retired summaries are included, as the REST list route's own
	 * `withDeleted` is.
	 * @returns A page of summaries, newest version first.
	 */
	@Query(() => Object, { name: 'orderSummaries' })
	async orderSummaries(
		@Args('orderId', { type: () => ID }) orderId: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<IOrderSummaryConnection> {
		const { skip, take } = resolveConnectionWindow(page);
		const listing = (await this.summaryService.findAll({
			where: { orderId },
			// The version is unique per order among the live summaries only: a retired one read back with
			// `withDeleted` can share it, so the identity closes the order.
			order: { version: 'DESC', id: 'DESC' },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<OrderSummary>;

		return connectionFromOffsetPage(listing, skip);
	}

	/**
	 * The money ledger of an order.
	 *
	 * @param orderId The order.
	 * @param type Optional transaction-type filter.
	 * @param page The page.
	 * @param withDeleted Whether retired ledger rows are included, as the REST list route's own
	 * `withDeleted` is.
	 * @returns A page of transactions.
	 * @throws BadRequestException when a type is given that the ledger does not carry.
	 */
	@Query(() => Object, { name: 'orderTransactions' })
	async orderTransactions(
		@Args('orderId', { type: () => ID }) orderId: string,
		@Args('type', { type: () => String, nullable: true }) type?: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<IOrderTransactionConnection> {
		const where: FindOptionsWhere<OrderTransaction> = { orderId };
		const { skip, take } = resolveConnectionWindow(page);

		if (type) {
			if (!isOrderTransactionType(type)) {
				throw new BadRequestException(
					`The transaction type "${type}" is not one of: ${ORDER_TRANSACTION_TYPES.join(', ')}.`
				);
			}

			where.type = type;
		}

		const listing = (await this.transactionService.findAll({
			where,
			// A ledger reads in the order it was written, closed by the row's identity so two rows posted in
			// one instant page in one arrangement.
			order: { createdAt: 'ASC', id: 'ASC' },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<OrderTransaction>;

		return connectionFromOffsetPage(listing, skip);
	}

	/**
	 * The timeline of an order.
	 *
	 * `timeline` answers every entry of the order in the order it happened and takes no window of its
	 * own, so the page is cut here rather than asked of the store: a store-side window would have to
	 * re-state the timeline's order, and a page cut after the rows were re-ordered answers a different
	 * page than the offset names.
	 *
	 * @param orderId The order.
	 * @param page The page.
	 * @param withDeleted Whether retired entries are included, as the REST list route's own
	 * `withDeleted` is. The flag belongs to `timeline`, which is the read that decided which rows exist
	 * — filtering the page afterwards would answer a short page with a `totalCount` that disagrees with
	 * it.
	 * @returns A page of timeline entries, oldest first.
	 */
	@Query(() => Object, { name: 'orderHistory' })
	async orderHistory(
		@Args('orderId', { type: () => ID }) orderId: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<OrderHistory>> {
		const { skip, take } = resolveConnectionWindow(page);
		const rows = await this.historyService.timeline(orderId, withDeleted);

		return connectionFromOffsetPage(paginateRows(rows, take, skip), skip);
	}

	/**
	 * Retires a change recoverably, keeping what was asked for and what was done.
	 *
	 * The route it mirrors is `DELETE /order-changes/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A change is the
	 * record of a post-placement modification, so a change retired by mistake has to be restorable: the
	 * recovery below is that, and serving the withdrawal without it would leave a caller able to retire a
	 * change from the endpoint it could not bring it back on.
	 *
	 * The permission is the controller's own for the route — `ORDERS_EDIT` — and not the class-level view
	 * grant, because retiring a change takes it out of every read of the order it belongs to.
	 *
	 * @param id The change to retire.
	 * @returns The change, as the soft delete left it.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteOrderChange' })
	async softDeleteOrderChange(@Args('id', { type: () => ID }) id: string): Promise<OrderChange> {
		return this.changeService.softRemove(id);
	}

	/**
	 * Restores a change that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-changes/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored change
	 * is read with its actions again, which is why the route states the editing grant rather than the
	 * reading one.
	 *
	 * @param id The change to restore.
	 * @returns The restored change.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'recoverOrderChange' })
	async recoverOrderChange(@Args('id', { type: () => ID }) id: string): Promise<OrderChange> {
		return this.changeService.softRecover(id);
	}

	/**
	 * Amends a pending change's own columns.
	 *
	 * The route it mirrors is `PUT /order-changes/:id`, which hands the service `commitChange` the body's
	 * members and the version the caller stated, and which the controller declares with `@Versioned({})`
	 * rather than with a resource: a change has no version of its own, so the guard reads and validates
	 * what the caller presented and `commitChange` resolves the order the change belongs to and predicated
	 * the order's own write on it. The field states the same declaration and takes the same version as the
	 * nullable `version` argument every mutation of this resolver states it as.
	 *
	 * Amending a pending change is a designed capability of this domain rather than a spare route: the
	 * endpoint table declares `PUT /order-changes/:id/actions` for the draft-change case, and a change that
	 * has been confirmed is reversed by a new change of type `UNDO` rather than by an edit — which is what
	 * this route's own contract leaves to `requestOrderEdit`.
	 *
	 * The permission is the route's own — `ORDERS_EDIT` — and not the class-level view grant.
	 *
	 * @param id The change.
	 * @param input The members to change.
	 * @param version The order version the caller read the change's order at.
	 * @param context The GraphQL context, whose request carries the version the caller stated.
	 * @returns The change, as it now stands.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Versioned({})
	@Mutation(() => Object, { name: 'updateOrderChange' })
	async updateOrderChange(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { type: () => Object }) input: Record<string, any>,
		@Args('version', { type: () => Int, nullable: true }) version?: number,
		@Context() context?: any
	): Promise<OrderChange> {
		return this.changeService.commitChange(id, input as any, versionExpectationOf(context?.req));
	}

	/**
	 * Deletes a change outright, with the actions it carries.
	 *
	 * The route it mirrors is `DELETE /order-changes/:id`, declared by the controller and overridden only
	 * to state the permission the base class leaves unstated. It is the destructive half of what the pair
	 * above does recoverably: a change retained explains a modification after the fact, and this is how a
	 * change recorded in error is removed rather than retired.
	 *
	 * The permission is the route's own — `ORDERS_EDIT`.
	 *
	 * @param id The change to delete.
	 * @returns The identifier the delete named, and whether a row was there to remove.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'deleteOrderChange' })
	async deleteOrderChange(@Args('id', { type: () => ID }) id: string): Promise<IOrderDeleteResult> {
		const result = await this.changeService.delete(id);

		return { id, deleted: Number(result?.affected ?? 0) > 0 };
	}

	/**
	 * Retires one action of a change recoverably.
	 *
	 * The route it mirrors is `DELETE /order-change-actions/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. An action is one
	 * step of the set a change is applied as, in application order, so the row is what explains a
	 * modification after the fact — kept, and restorable by the field below.
	 *
	 * The permission is the controller's own for the route — `ORDERS_EDIT`.
	 *
	 * @param id The action to retire.
	 * @returns The action, as the soft delete left it.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteOrderChangeAction' })
	async softDeleteOrderChangeAction(@Args('id', { type: () => ID }) id: string): Promise<OrderChangeAction> {
		return this.actionService.softRemove(id);
	}

	/**
	 * Restores an action that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-change-actions/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored action
	 * is applied with the rest of its set again.
	 *
	 * @param id The action to restore.
	 * @returns The restored action.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'recoverOrderChangeAction' })
	async recoverOrderChangeAction(@Args('id', { type: () => ID }) id: string): Promise<OrderChangeAction> {
		return this.actionService.softRecover(id);
	}

	/**
	 * Amends one action of a pending change.
	 *
	 * The route it mirrors is `PUT /order-change-actions/:id`, declared by the controller with the
	 * action's writable surface as its body — what it does, its payload, its amount, what it references
	 * and where it sits in the sequence — and overridden from `CrudController` only to state the
	 * permission the base class leaves unstated. An action is the unit a change is applied as, so this is
	 * how the plan of a change that has not run yet is corrected.
	 *
	 * **Two calls, because the route's own answer is a count.** The route hands the service
	 * `update(id, entity)` and passes its return on, which on this platform's ORM path is the driver's
	 * `UpdateResult` rather than the row; every sibling mutation of this resource answers the row instead,
	 * and the schema declares this field as answering one. The row is therefore read back with the same
	 * base read the write itself performs as its precondition, exactly as the route's write does. Nothing
	 * else is added: no version is stated, because the route states none.
	 *
	 * @param id The action.
	 * @param input The members to change.
	 * @returns The action, as it now stands.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'updateOrderChangeAction' })
	async updateOrderChangeAction(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { type: () => Object }) input: Record<string, any>
	): Promise<OrderChangeAction> {
		await this.actionService.update(id, input as any);

		return this.actionService.findOneByIdString(id);
	}

	/**
	 * Deletes one action of a pending change outright.
	 *
	 * The route it mirrors is `DELETE /order-change-actions/:id`, declared by the controller and
	 * overridden only to state the permission the base class leaves unstated. The withdrawal beside it
	 * keeps the row that explains a modification; this removes it.
	 *
	 * The permission is the route's own — `ORDERS_EDIT`.
	 *
	 * @param id The action to delete.
	 * @returns The identifier the delete named, and whether a row was there to remove.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'deleteOrderChangeAction' })
	async deleteOrderChangeAction(@Args('id', { type: () => ID }) id: string): Promise<IOrderDeleteResult> {
		const result = await this.actionService.delete(id);

		return { id, deleted: Number(result?.affected ?? 0) > 0 };
	}

	/**
	 * Retires one totals summary recoverably.
	 *
	 * The route it mirrors is `DELETE /order-summaries/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A summary is what
	 * an order totalled at one committed version, so the row is the answer to "what did this total at
	 * version 3, and why?" — retired recoverably rather than dropped, and restorable by the field below.
	 *
	 * The permission is the controller's own for the route — `ORDERS_EDIT`.
	 *
	 * @param id The summary to retire.
	 * @returns The summary, as the soft delete left it.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteOrderSummary' })
	async softDeleteOrderSummary(@Args('id', { type: () => ID }) id: string): Promise<OrderSummary> {
		return this.summaryService.softRemove(id);
	}

	/**
	 * Restores a totals summary that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-summaries/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored summary
	 * is part of the order's totals history again.
	 *
	 * @param id The summary to restore.
	 * @returns The restored summary.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'recoverOrderSummary' })
	async recoverOrderSummary(@Args('id', { type: () => ID }) id: string): Promise<OrderSummary> {
		return this.summaryService.softRecover(id);
	}

	/**
	 * Retires one ledger transaction recoverably.
	 *
	 * The route it mirrors is `DELETE /order-transactions/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. The ledger is
	 * append-only and its rows are what the paid, refunded and outstanding totals are read from, so a row
	 * entered in error is retired rather than dropped — and the field below is how that is undone.
	 *
	 * The permission is the controller's own for the route — `ORDERS_EDIT`.
	 *
	 * @param id The transaction to retire.
	 * @returns The transaction, as the soft delete left it.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteOrderTransaction' })
	async softDeleteOrderTransaction(@Args('id', { type: () => ID }) id: string): Promise<OrderTransaction> {
		return this.transactionService.softRemove(id);
	}

	/**
	 * Restores a ledger transaction that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-transactions/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored
	 * transaction moves the order's money totals again.
	 *
	 * @param id The transaction to restore.
	 * @returns The restored transaction.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'recoverOrderTransaction' })
	async recoverOrderTransaction(@Args('id', { type: () => ID }) id: string): Promise<OrderTransaction> {
		return this.transactionService.softRecover(id);
	}

	/**
	 * Retires one timeline entry recoverably.
	 *
	 * The route it mirrors is `DELETE /order-history/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. The timeline is
	 * append-only and is what explains an order after the fact, so an entry recorded in error is retired
	 * rather than dropped — and the field below is how that is undone.
	 *
	 * The permission is the controller's own for the route — `ORDERS_EDIT`.
	 *
	 * @param id The timeline entry to retire.
	 * @returns The entry, as the soft delete left it.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteOrderHistory' })
	async softDeleteOrderHistory(@Args('id', { type: () => ID }) id: string): Promise<OrderHistory> {
		return this.historyService.softRemove(id);
	}

	/**
	 * Restores a timeline entry that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-history/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored entry
	 * is part of the order's timeline again.
	 *
	 * @param id The timeline entry to restore.
	 * @returns The restored entry.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'recoverOrderHistory' })
	async recoverOrderHistory(@Args('id', { type: () => ID }) id: string): Promise<OrderHistory> {
		return this.historyService.softRecover(id);
	}

	/**
	 * Applies a change.
	 *
	 * A key is mandatory here, exactly as it is on the route this mutation mirrors: applying a change
	 * twice moves the order twice, and a client that never saw the first answer has no other way to tell
	 * whether it landed.
	 *
	 * The mutation names the change and not the order, so no resource is declared: the handler resolves
	 * the order the change belongs to, and the order's own conditional update is what compares the
	 * version the caller stated and refuses an order that has moved on.
	 *
	 * @param id The change.
	 * @param context The GraphQL context, whose request carries the version the caller stated.
	 * @returns The applied change.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Idempotent({ scope: 'order.change.confirm', required: true, resourceType: 'order_change' })
	@Versioned({})
	@Mutation(() => Object, { name: 'confirmOrderChange' })
	async confirmOrderChange(
		@Args('id', { type: () => ID }) id: string,
		@Args('version', { type: () => Int, nullable: true }) version?: number,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string,
		@Context() context?: any
	): Promise<OrderChange> {
		const result = await this.changeService.confirm(id, versionExpectationOf(context?.req));

		return result.change;
	}

	/**
	 * Declines a change.
	 *
	 * @param id The change.
	 * @param reason Why it was declined.
	 * @param context The GraphQL context, whose request carries the version the caller stated.
	 * @returns The declined change.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Versioned({})
	@Mutation(() => Object, { name: 'declineOrderChange' })
	async declineOrderChange(
		@Args('id', { type: () => ID }) id: string,
		@Args('reason', { type: () => String, nullable: true }) reason?: string,
		@Args('version', { type: () => Int, nullable: true }) version?: number,
		@Context() context?: any
	): Promise<OrderChange> {
		return this.changeService.decline(id, reason, versionExpectationOf(context?.req));
	}

	/**
	 * Cancels a pending change.
	 *
	 * @param id The change.
	 * @param reason Why it was cancelled.
	 * @param context The GraphQL context, whose request carries the version the caller stated.
	 * @returns The cancelled change.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Versioned({})
	@Mutation(() => Object, { name: 'cancelOrderChange' })
	async cancelOrderChange(
		@Args('id', { type: () => ID }) id: string,
		@Args('reason', { type: () => String, nullable: true }) reason?: string,
		@Args('version', { type: () => Int, nullable: true }) version?: number,
		@Context() context?: any
	): Promise<OrderChange> {
		return this.changeService.cancel(id, reason, versionExpectationOf(context?.req));
	}

	/**
	 * Resolves a change's actions.
	 *
	 * @param change The parent change.
	 * @returns The actions, in application order.
	 */
	@ResolveField('actions', () => [Object], { nullable: true })
	async actions(@Parent() change: OrderChange): Promise<OrderChangeAction[]> {
		const page = (await this.actionService.findAll({
			where: { changeId: change.id }
		})) as IPagination<OrderChangeAction>;

		return [...page.items].sort((left, right) => Number(left.ordering) - Number(right.ordering));
	}
}
