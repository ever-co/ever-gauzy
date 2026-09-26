import { Args, Context, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { IPagination, OrderChangeType } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	IConnectionPageSelection,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned,
	connectionFromOffsetPage,
	resolveConnectionWindow,
	versionExpectationOf
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { OrderService } from '../order/order.service';
import { OrderAddressService } from '../order-address/order-address.service';
import { OrderChangeService } from '../order-change/order-change.service';
import { OrderCreditLineService } from '../order-credit-line/order-credit-line.service';
import { OrderHistoryService } from '../order-history/order-history.service';
import { OrderLineService } from '../order-line/order-line.service';
import { OrderShippingMethodService } from '../order-shipping-method/order-shipping-method.service';
import { OrderTotalsService } from '../order-totals/order-totals.service';
import { ORDER_PERMISSIONS } from '../order.permissions';
import {
	FULFILLMENT_STATUSES,
	ORDER_PAYMENT_STATUSES,
	ORDER_STATUSES,
	isFulfillmentStatus,
	isOrderPaymentStatus,
	isOrderStatus
} from './filters';
import {
	IOrderConnection,
	IOrderDeleteResult,
	Order,
	OrderAddress,
	OrderChange,
	OrderCreditLine,
	OrderHistory,
	OrderLine,
	OrderShippingMethod,
	OrderTotals
} from './types';

/**
 * The order root fields and the order's own relation fields.
 *
 * The resolver is a thin adapter over the same services the REST controller uses, with the same guards
 * and the same permissions, so a GraphQL caller and a REST caller cannot diverge in what they are
 * allowed to do or in what a rule means. Every relation is resolved by its own aggregate's service,
 * which is what makes the order graph one query without N+1 reads.
 *
 * The mutations carry the same `@Idempotent(...)` and `@Versioned(...)` declarations as the routes
 * they mirror, under the same scope names, so the two protocols answer a retry and a stale version
 * identically. A GraphQL operation travels over `POST` whichever root type it selects, so a mutation
 * states its version as the nullable `version` argument — and its retry key as `idempotencyKey` —
 * because one request may carry several mutations and a header could not say which of them either
 * belongs to.
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
@Resolver('Order')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
export class OrderResolver {
	constructor(
		private readonly orderService: OrderService,
		private readonly totalsService: OrderTotalsService,
		private readonly lineService: OrderLineService,
		private readonly addressService: OrderAddressService,
		private readonly shippingMethodService: OrderShippingMethodService,
		private readonly creditLineService: OrderCreditLineService,
		private readonly historyService: OrderHistoryService,
		private readonly changeService: OrderChangeService
	) {}

	/**
	 * Lists orders.
	 *
	 * @param filter The filter arguments.
	 * @returns A page of orders.
	 * @throws BadRequestException when a status is given that the order does not have.
	 */
	@Query(() => Object, { name: 'orders' })
	async orders(
		@Args('status', { type: () => String, nullable: true }) status?: string,
		@Args('paymentStatus', { type: () => String, nullable: true }) paymentStatus?: string,
		@Args('fulfillmentStatus', { type: () => String, nullable: true }) fulfillmentStatus?: string,
		@Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
		@Args('channelId', { type: () => ID, nullable: true }) channelId?: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<IOrderConnection> {
		const where: FindOptionsWhere<Order> = {};
		const { skip, take } = resolveConnectionWindow(page);

		if (status) {
			if (!isOrderStatus(status)) {
				throw new BadRequestException(`The order status "${status}" is not one of: ${ORDER_STATUSES.join(', ')}.`);
			}

			where.status = status;
		}

		if (paymentStatus) {
			if (!isOrderPaymentStatus(paymentStatus)) {
				throw new BadRequestException(
					`The payment status "${paymentStatus}" is not one of: ${ORDER_PAYMENT_STATUSES.join(', ')}.`
				);
			}

			where.paymentStatus = paymentStatus;
		}

		if (fulfillmentStatus) {
			if (!isFulfillmentStatus(fulfillmentStatus)) {
				throw new BadRequestException(
					`The fulfilment status "${fulfillmentStatus}" is not one of: ${FULFILLMENT_STATUSES.join(', ')}.`
				);
			}

			where.fulfillmentStatus = fulfillmentStatus;
		}

		if (customerId) {
			where.customerId = customerId;
		}

		if (channelId) {
			where.channelId = channelId;
		}

		// The visibility the REST list route offers, offered here: its `findAll` is handed the whole
		// `BaseQueryDTO`, which declares `withDeleted`, while this field builds its criterion from named
		// arguments — so the flag has to be stated rather than passed through.
		const listing = (await this.orderService.findAll({
			where,
			// Newest first, closed by the row's identity. The page is cut with LIMIT/OFFSET and its cursors are
			// offsets, so an order the store may rearrange between two pages — or none at all, which on Postgres
			// is heap order, and an `UPDATE` to an order on page one moves it to the end of the heap — repeats
			// one order and never shows another. The primary key is the one column that leaves no tie.
			order: { createdAt: 'DESC', id: 'DESC' },
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<Order>;

		return connectionFromOffsetPage(listing, skip);
	}

	/**
	 * Reads one order.
	 *
	 * A read carries the version in the response body, which is what the caller states back as the
	 * `version` argument of the mutation it is about to make.
	 *
	 * @param id The order.
	 * @returns The order.
	 */
	@Versioned({ resource: OrderService, write: false })
	@Query(() => Object, { name: 'order', nullable: true })
	async order(@Args('id', { type: () => ID }) id: string): Promise<Order> {
		return this.orderService.findOneByIdString(id);
	}

	/**
	 * Reads one order by its human number.
	 *
	 * @param number The order number.
	 * @returns The order.
	 */
	@Query(() => Object, { name: 'orderByNumber', nullable: true })
	async orderByNumber(@Args('number', { type: () => String }) number: string): Promise<Order> {
		return this.orderService.findOneByWhereOptions({ number } as any);
	}

	/**
	 * The computed totals of one order.
	 *
	 * @param id The order.
	 * @returns The totals, computed from the lines and the money ledgers.
	 */
	@Query(() => Object, { name: 'orderTotals', nullable: true })
	async orderTotals(@Args('id', { type: () => ID }) id: string): Promise<OrderTotals> {
		const order = await this.orderService.findOneByIdString(id);

		return this.totalsService.computeTotals(order);
	}

	/**
	 * Creates a draft order.
	 *
	 * @param input The order to create.
	 * @returns The created order.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_CREATE)
	@Idempotent({ scope: 'order.create', required: false, resourceType: 'order' })
	@Versioned({ resource: OrderService, required: false })
	@Mutation(() => Object, { name: 'createOrder' })
	async createOrder(@Args('input', { type: () => Object }) input: Record<string, any>): Promise<Order> {
		return this.orderService.create(input as any);
	}

	/**
	 * Updates the fields of an order that may change outside a change.
	 *
	 * @param id The order.
	 * @param input The fields to change, with the version the caller read the order at.
	 * @param context The GraphQL context, whose request carries the version the caller stated.
	 * @returns The order.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Versioned({ resource: OrderService })
	@Mutation(() => Object, { name: 'updateOrder' })
	async updateOrder(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { type: () => Object }) input: Record<string, any>,
		@Context() context: any
	): Promise<Order> {
		return this.orderService.updateMutable(id, input as any, versionExpectationOf(context?.req));
	}

	/**
	 * Places a draft order.
	 *
	 * @param id The order.
	 * @param context The GraphQL context, whose request carries the version the caller stated.
	 * @returns The placed order.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Idempotent({ scope: 'order.place', required: false, resourceType: 'order' })
	@Versioned({ resource: OrderService })
	@Mutation(() => Object, { name: 'placeOrder' })
	async placeOrder(
		@Args('id', { type: () => ID }) id: string,
		@Args('version', { type: () => Int, nullable: true }) version?: number,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string,
		@Context() context?: any
	): Promise<Order> {
		return this.orderService.place(id, {}, versionExpectationOf(context?.req));
	}

	/**
	 * Confirms a placed order.
	 *
	 * @param id The order.
	 * @param context The GraphQL context, whose request carries the version the caller stated.
	 * @returns The confirmed order.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_APPROVE)
	@Versioned({ resource: OrderService })
	@Mutation(() => Object, { name: 'confirmOrder' })
	async confirmOrder(
		@Args('id', { type: () => ID }) id: string,
		@Args('version', { type: () => Int, nullable: true }) version?: number,
		@Context() context?: any
	): Promise<Order> {
		return this.orderService.confirm(id, 'STAFF', versionExpectationOf(context?.req));
	}

	/**
	 * Cancels an order that nothing has shipped from.
	 *
	 * @param id The order.
	 * @param reason Why it was cancelled.
	 * @param context The GraphQL context, whose request carries the version the caller stated.
	 * @returns The cancelled order.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_CANCEL)
	@Idempotent({ scope: 'order.cancel', required: false, resourceType: 'order' })
	@Versioned({ resource: OrderService })
	@Mutation(() => Object, { name: 'cancelOrder' })
	async cancelOrder(
		@Args('id', { type: () => ID }) id: string,
		@Args('reason', { type: () => String, nullable: true }) reason?: string,
		@Args('version', { type: () => Int, nullable: true }) version?: number,
		@Args('idempotencyKey', { type: () => String, nullable: true }) idempotencyKey?: string,
		@Context() context?: any
	): Promise<Order> {
		return this.orderService.cancel(id, reason, versionExpectationOf(context?.req));
	}

	/**
	 * Archives a terminal order.
	 *
	 * @param id The order.
	 * @param context The GraphQL context, whose request carries the version the caller stated.
	 * @returns The archived order.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Versioned({ resource: OrderService })
	@Mutation(() => Object, { name: 'archiveOrder' })
	async archiveOrder(
		@Args('id', { type: () => ID }) id: string,
		@Args('version', { type: () => Int, nullable: true }) version?: number,
		@Context() context?: any
	): Promise<Order> {
		return this.orderService.archive(id, versionExpectationOf(context?.req));
	}

	/**
	 * Recomputes an order.
	 *
	 * @param id The order.
	 * @param context The GraphQL context, whose request carries the version the caller stated.
	 * @returns The order with its recomputed totals.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Versioned({ resource: OrderService })
	@Mutation(() => Object, { name: 'recalculateOrder' })
	async recalculateOrder(
		@Args('id', { type: () => ID }) id: string,
		@Args('version', { type: () => Int, nullable: true }) version?: number,
		@Context() context?: any
	): Promise<Order> {
		return this.totalsService.recompute(id, 'MANUAL', { expectation: versionExpectationOf(context?.req) });
	}

	/**
	 * Retires an order recoverably, keeping the row and every satellite of it.
	 *
	 * The route it mirrors is `DELETE /orders/:id/soft`, inherited from `CrudController` and overridden by
	 * the controller only to state the permission the base left unstated. Without this field an order
	 * retired over GraphQL could not be brought back over GraphQL, while a REST caller could do both — and
	 * the destructive delete this endpoint also serves drops the aggregate, which is exactly the operation
	 * the soft route exists to avoid for a record that placed tax lines, invoices and a money ledger point
	 * at.
	 *
	 * The permission is the controller's own for the route — `ORDERS_EDIT` — and not the class-level view
	 * grant, because retiring an order takes it out of every listing, total and change a reader sees.
	 *
	 * @param id The order to retire.
	 * @returns The order, as the soft delete left it.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteOrder' })
	async softDeleteOrder(@Args('id', { type: () => ID }) id: string): Promise<Order> {
		return this.orderService.softRemove(id);
	}

	/**
	 * Restores an order that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /orders/:id/recover`, inherited from `CrudController` and overridden by
	 * the controller only to state the permission the base left unstated. A restored order is a candidate
	 * for every read and every change again, which is why the route states the editing grant rather than
	 * the reading one.
	 *
	 * @param id The order to restore.
	 * @returns The restored order.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'recoverOrder' })
	async recoverOrder(@Args('id', { type: () => ID }) id: string): Promise<Order> {
		return this.orderService.softRecover(id);
	}

	/**
	 * Deletes an order outright, dropping the row and every satellite of it.
	 *
	 * The route it mirrors is `DELETE /orders/:id`, declared by the controller itself and overridden from
	 * `CrudController` only to state the permission the base class leaves unstated. It is a different act
	 * from the withdrawal above rather than a second spelling of it — that one keeps the row and every
	 * satellite, and this removes them — which is why both are served rather than one standing in for the
	 * other: a caller that may retire an order recoverably is not thereby a caller that may destroy one,
	 * and the destroy is the half that cannot be undone.
	 *
	 * The permission is the route's own — `ORDERS_EDIT` — and not the class-level view grant, because an
	 * order that placed tax lines, issued invoices and wrote a money ledger is exactly the record a reader
	 * must not be able to remove.
	 *
	 * @param id The order to delete.
	 * @returns The identifier the delete named, and whether a row was there to remove.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'deleteOrder' })
	async deleteOrder(@Args('id', { type: () => ID }) id: string): Promise<IOrderDeleteResult> {
		const result = await this.orderService.delete(id);

		return { id, deleted: Number(result?.affected ?? 0) > 0 };
	}

	/**
	 * Retires a frozen address recoverably, keeping the row an order was placed with.
	 *
	 * The route it mirrors is `DELETE /order-addresses/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. Its fields are the
	 * address the order was shipped to at the moment it was placed, so the row is evidence rather than a
	 * preference: retiring it recoverably is how a caller corrects a duplicate, and the recovery below is
	 * how it undoes that.
	 *
	 * The permission is the controller's own for the route — `ORDERS_EDIT` — which this resolver states on
	 * the field rather than leaving to its class-level view grant.
	 *
	 * @param id The frozen address to retire.
	 * @returns The address, as the soft delete left it.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteOrderAddress' })
	async softDeleteOrderAddress(@Args('id', { type: () => ID }) id: string): Promise<OrderAddress> {
		return this.addressService.softRemove(id);
	}

	/**
	 * Restores a frozen address that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-addresses/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. Without it an
	 * address retired over GraphQL could only be put back by writing the order again.
	 *
	 * @param id The frozen address to restore.
	 * @returns The restored address.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'recoverOrderAddress' })
	async recoverOrderAddress(@Args('id', { type: () => ID }) id: string): Promise<OrderAddress> {
		return this.addressService.softRecover(id);
	}

	/**
	 * Deletes a frozen address outright.
	 *
	 * The route it mirrors is `DELETE /order-addresses/:id`, declared by the controller and overridden
	 * only to state the permission the base class leaves unstated. The address route is the one satellite
	 * of this domain whose destructive delete no write path of the order can reach: a line, a delivery
	 * choice and a credit line are all removed by an action of a change this domain applies, and an
	 * address is only ever created or rewritten by `ADDRESS_UPDATE` — so a caller that has to remove a
	 * duplicate snapshot the placement wrote has this route and, before this field, had no way to say so
	 * over GraphQL.
	 *
	 * The permission is the route's own — `ORDERS_EDIT` — because the row is the address the order was
	 * shipped to as it stood when it was placed.
	 *
	 * @param id The frozen address to delete.
	 * @returns The identifier the delete named, and whether a row was there to remove.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'deleteOrderAddress' })
	async deleteOrderAddress(@Args('id', { type: () => ID }) id: string): Promise<IOrderDeleteResult> {
		const result = await this.addressService.delete(id);

		return { id, deleted: Number(result?.affected ?? 0) > 0 };
	}

	/**
	 * Retires a credit line recoverably, keeping what the order was reduced by.
	 *
	 * The route it mirrors is `DELETE /order-credit-lines/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A credit line is
	 * part of how an order's outstanding total was arrived at, so the row is retired rather than dropped
	 * and the recovery below puts it back into that arithmetic.
	 *
	 * The permission is the controller's own for the route — `ORDERS_EDIT`.
	 *
	 * @param id The credit line to retire.
	 * @returns The credit line, as the soft delete left it.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteOrderCreditLine' })
	async softDeleteOrderCreditLine(@Args('id', { type: () => ID }) id: string): Promise<OrderCreditLine> {
		return this.creditLineService.softRemove(id);
	}

	/**
	 * Restores a credit line that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-credit-lines/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored credit
	 * line is counted against the order again, which is why the route states the editing grant.
	 *
	 * @param id The credit line to restore.
	 * @returns The restored credit line.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'recoverOrderCreditLine' })
	async recoverOrderCreditLine(@Args('id', { type: () => ID }) id: string): Promise<OrderCreditLine> {
		return this.creditLineService.softRecover(id);
	}

	/**
	 * Amends a credit line that was applied to an order.
	 *
	 * The route it mirrors is `PUT /order-credit-lines/:id`, declared by the controller with the
	 * resource's writable surface as its body — amount, currency, reference and description — and
	 * overridden from `CrudController` only to state the permission the base class leaves unstated. The
	 * credit is what reduces what the customer owes, and its route is the one place a figure the totals
	 * were computed from is corrected in place rather than by a new credit.
	 *
	 * The route states no version: a credit line has no version of its own — the `version` column on it is
	 * the order version the credit was applied against — so nothing is predicated on one, on either
	 * surface.
	 *
	 * @param id The credit line.
	 * @param input The members to change.
	 * @returns The credit line, as it now stands.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'updateOrderCreditLine' })
	async updateOrderCreditLine(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { type: () => Object }) input: Record<string, any>
	): Promise<OrderCreditLine> {
		await this.creditLineService.update(id, input as any);

		return this.creditLineService.findOneByIdString(id);
	}

	/**
	 * Deletes a credit line outright.
	 *
	 * The route it mirrors is `DELETE /order-credit-lines/:id`, declared by the controller and overridden
	 * only to state the permission the base class leaves unstated. Like the order's own delete it is a
	 * different act from the withdrawal beside it: the recoverable one keeps the row for the arithmetic
	 * the order was reduced by, and this removes it.
	 *
	 * The permission is the route's own — `ORDERS_EDIT`.
	 *
	 * @param id The credit line to delete.
	 * @returns The identifier the delete named, and whether a row was there to remove.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'deleteOrderCreditLine' })
	async deleteOrderCreditLine(@Args('id', { type: () => ID }) id: string): Promise<IOrderDeleteResult> {
		const result = await this.creditLineService.delete(id);

		return { id, deleted: Number(result?.affected ?? 0) > 0 };
	}

	/**
	 * Retires a delivery choice recoverably, keeping the amount the order was placed with.
	 *
	 * The route it mirrors is `DELETE /order-shipping-methods/:id/soft`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base left unstated. A delivery
	 * choice carries the shipping amount the order's totals were computed from, so the row is kept and the
	 * recovery below is what undoes the retirement.
	 *
	 * The permission is the controller's own for the route — `ORDERS_EDIT`.
	 *
	 * @param id The delivery choice to retire.
	 * @returns The delivery choice, as the soft delete left it.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteOrderShippingMethod' })
	async softDeleteOrderShippingMethod(
		@Args('id', { type: () => ID }) id: string
	): Promise<OrderShippingMethod> {
		return this.shippingMethodService.softRemove(id);
	}

	/**
	 * Restores a delivery choice that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-shipping-methods/:id/recover`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base left unstated. A restored
	 * choice is counted into the order's shipping totals again.
	 *
	 * @param id The delivery choice to restore.
	 * @returns The restored delivery choice.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'recoverOrderShippingMethod' })
	async recoverOrderShippingMethod(
		@Args('id', { type: () => ID }) id: string
	): Promise<OrderShippingMethod> {
		return this.shippingMethodService.softRecover(id);
	}

	/**
	 * Creates a change.
	 *
	 * @param input The change and its actions.
	 * @returns The created change.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Idempotent({ scope: 'order.change.create', required: false, resourceType: 'order_change' })
	// The order is the record the change is reasoned about, and the input names it rather than the
	// resolver's own argument list, so the version is read from the order the input points at.
	@Versioned({
		resource: OrderService,
		identify: (_request: any, context: any) => context?.getArgByIndex?.(1)?.input?.orderId
	})
	@Mutation(() => Object, { name: 'requestOrderEdit' })
	async requestOrderEdit(@Args('input', { type: () => Object }) input: Record<string, any>): Promise<OrderChange> {
		return this.changeService.create({
			orderId: input.orderId,
			changeType: (input.changeType as OrderChangeType) ?? OrderChangeType.EDIT,
			note: input.note,
			actions: input.actions
		} as any);
	}

	/**
	 * Resolves an order's lines.
	 *
	 * @param order The parent order.
	 * @returns The lines.
	 */
	@ResolveField('lines', () => [Object], { nullable: true })
	async lines(@Parent() order: Order): Promise<OrderLine[]> {
		const page = (await this.lineService.findAll({ where: { orderId: order.id } })) as IPagination<OrderLine>;

		return page.items;
	}

	/**
	 * Resolves an order's frozen addresses.
	 *
	 * @param order The parent order.
	 * @returns The addresses.
	 */
	@ResolveField('addresses', () => [Object], { nullable: true })
	async addresses(@Parent() order: Order): Promise<OrderAddress[]> {
		const page = (await this.addressService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderAddress>;

		return page.items;
	}

	/**
	 * Resolves an order's delivery choices.
	 *
	 * @param order The parent order.
	 * @returns The delivery choices.
	 */
	@ResolveField('shippingMethods', () => [Object], { nullable: true })
	async shippingMethods(@Parent() order: Order): Promise<OrderShippingMethod[]> {
		const page = (await this.shippingMethodService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderShippingMethod>;

		return page.items;
	}

	/**
	 * Resolves an order's credit lines.
	 *
	 * @param order The parent order.
	 * @returns The credit lines.
	 */
	@ResolveField('creditLines', () => [Object], { nullable: true })
	async creditLines(@Parent() order: Order): Promise<OrderCreditLine[]> {
		const page = (await this.creditLineService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderCreditLine>;

		return page.items;
	}

	/**
	 * Resolves an order's changes.
	 *
	 * @param order The parent order.
	 * @returns The changes.
	 */
	@ResolveField('changes', () => [Object], { nullable: true })
	async changes(@Parent() order: Order): Promise<OrderChange[]> {
		const page = (await this.changeService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderChange>;

		return page.items;
	}

	/**
	 * Resolves an order's timeline.
	 *
	 * @param order The parent order.
	 * @returns The timeline, oldest first.
	 */
	@ResolveField('history', () => [Object], { nullable: true })
	async history(@Parent() order: Order): Promise<OrderHistory[]> {
		return this.historyService.timeline(order.id);
	}
}
