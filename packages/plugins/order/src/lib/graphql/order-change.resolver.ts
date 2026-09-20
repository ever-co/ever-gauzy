import { Args, Context, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { IPagination } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned,
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
	 * @returns A page of changes.
	 * @throws BadRequestException when a status is given that a change does not have.
	 */
	@Query(() => Object, { name: 'orderChanges' })
	async orderChanges(
		@Args('orderId', { type: () => ID }) orderId: string,
		@Args('status', { type: () => String, nullable: true }) status?: string
	): Promise<IOrderChangeConnection> {
		const where: FindOptionsWhere<OrderChange> = { orderId };

		if (status) {
			if (!isOrderChangeStatus(status)) {
				throw new BadRequestException(
					`The change status "${status}" is not one of: ${ORDER_CHANGE_STATUSES.join(', ')}.`
				);
			}

			where.status = status;
		}

		const page = (await this.changeService.findAll({ where, relations: ['actions'] })) as IPagination<OrderChange>;

		return { items: page.items, total: page.total };
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
	 * @param orderId The order.
	 * @returns A page of summaries, newest version first.
	 */
	@Query(() => Object, { name: 'orderSummaries' })
	async orderSummaries(@Args('orderId', { type: () => ID }) orderId: string): Promise<IOrderSummaryConnection> {
		const page = (await this.summaryService.findAll({ where: { orderId } })) as IPagination<OrderSummary>;

		return {
			items: [...page.items].sort((left, right) => Number(right.version) - Number(left.version)),
			total: page.total
		};
	}

	/**
	 * The money ledger of an order.
	 *
	 * @param orderId The order.
	 * @param type Optional transaction-type filter.
	 * @returns A page of transactions.
	 * @throws BadRequestException when a type is given that the ledger does not carry.
	 */
	@Query(() => Object, { name: 'orderTransactions' })
	async orderTransactions(
		@Args('orderId', { type: () => ID }) orderId: string,
		@Args('type', { type: () => String, nullable: true }) type?: string
	): Promise<IOrderTransactionConnection> {
		const where: FindOptionsWhere<OrderTransaction> = { orderId };

		if (type) {
			if (!isOrderTransactionType(type)) {
				throw new BadRequestException(
					`The transaction type "${type}" is not one of: ${ORDER_TRANSACTION_TYPES.join(', ')}.`
				);
			}

			where.type = type;
		}

		const page = (await this.transactionService.findAll({ where })) as IPagination<OrderTransaction>;

		return { items: page.items, total: page.total };
	}

	/**
	 * The timeline of an order.
	 *
	 * @param orderId The order.
	 * @returns The timeline entries.
	 */
	@Query(() => [Object], { name: 'orderHistory' })
	async orderHistory(@Args('orderId', { type: () => ID }) orderId: string): Promise<OrderHistory[]> {
		return this.historyService.timeline(orderId);
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
