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
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection
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

		const listing = (await this.orderService.findAll({ where, skip, take })) as IPagination<Order>;

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
