import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import {
	AddressType,
	CommerceCartStatus,
	FulfillmentStatus,
	ID,
	IPagination,
	ICommerceCart,
	OrderChangeStatus,
	OrderStatus
} from '@gauzy/contracts';
import { SequenceService, TenantAwareCrudService } from '@gauzy/core';
import { Order } from './order.entity';
import { TypeOrmOrderRepository } from './repository/type-orm-order.repository';
import { MikroOrmOrderRepository } from './repository/mikro-orm-order.repository';
import { OrderAddress } from '../order-address/order-address.entity';
import { OrderAddressService } from '../order-address/order-address.service';
import { OrderChange } from '../order-change/order-change.entity';
import { OrderChangeService } from '../order-change/order-change.service';
import { OrderHistoryService } from '../order-history/order-history.service';
import { OrderLine } from '../order-line/order-line.entity';
import { OrderLineService } from '../order-line/order-line.service';
import { OrderShippingMethod } from '../order-shipping-method/order-shipping-method.entity';
import { OrderShippingMethodService } from '../order-shipping-method/order-shipping-method.service';
import { OrderStateMachine } from '../order-state-machine/order-state-machine';
import { OrderTotalsService } from '../order-totals/order-totals.service';

/** The series every order number is allocated from. */
const ORDER_SEQUENCE_KEY = 'ORDER';

/**
 * The order aggregate's service.
 *
 * Everything an order may have done to it goes through here: it is placed, cancelled, archived or
 * edited, and each of those moves the lifecycle through `OrderStateMachine` and then asks
 * `OrderTotalsService` to recompute — because a status change and a totals change are one write, not
 * two that can be observed apart.
 *
 * A placed order is **not** edited here. `update` refuses anything but the handful of fields a draft or
 * a note may change, and every other modification is an `order_change` handled by
 * `OrderChangeService`.
 */
@Injectable()
export class OrderService extends TenantAwareCrudService<Order> {
	constructor(
		readonly typeOrmOrderRepository: TypeOrmOrderRepository,
		readonly mikroOrmOrderRepository: MikroOrmOrderRepository,
		private readonly totalsService: OrderTotalsService,
		private readonly lineService: OrderLineService,
		private readonly addressService: OrderAddressService,
		private readonly shippingMethodService: OrderShippingMethodService,
		private readonly historyService: OrderHistoryService,
		private readonly changeService: OrderChangeService,
		private readonly sequenceService: SequenceService
	) {
		super(typeOrmOrderRepository, mikroOrmOrderRepository);
	}

	/**
	 * Creates a draft order, allocating its number from the platform's sequence service.
	 *
	 * The number is not generated here: document numbering is a kernel capability, shared with returns,
	 * purchase orders, transfers and payment collections, and a bespoke counter in this package would be
	 * a second answer to the same question.
	 *
	 * @param entity The order to create.
	 * @returns The created order, with its (empty) totals computed.
	 */
	public async create(entity: DeepPartial<Order>): Promise<Order> {
		if (!entity.channelId) {
			throw new BadRequestException('ORDER_CHANNEL_REQUIRED: an order belongs to a sales channel.');
		}
		if (!entity.currency) {
			throw new BadRequestException('ORDER_CURRENCY_REQUIRED: an order is priced in one currency.');
		}

		const allocated = entity.number
			? { formatted: entity.number, value: 0, key: ORDER_SEQUENCE_KEY }
			: await this.sequenceService.allocate(ORDER_SEQUENCE_KEY, { channelId: entity.channelId });

		entity.number = entity.number ?? allocated.formatted;
		entity.displayId = entity.displayId ?? allocated.formatted;
		entity.status = OrderStatus.DRAFT;
		entity.isDraft = entity.isDraft ?? true;
		entity.version = 1;
		entity.currencyDecimals = entity.currencyDecimals ?? 2;

		const order = await super.create(entity);

		return this.totalsService.recompute(order.id, 'ORDER_CREATED');
	}

	/**
	 * Creates an order from a completed cart.
	 *
	 * This is what the cart's checkout handler calls. The cart's lines, its delivery choices and its
	 * address snapshots are copied here, which is the moment the order becomes independent of the cart:
	 * afterwards, editing either one cannot change the other.
	 *
	 * @param cart The cart, with its totals already recomputed and validated by the cart package.
	 * @param options The checkout request.
	 * @returns The placed order.
	 */
	public async createFromCart(
		cart: ICommerceCart & { lines?: DeepPartial<OrderLine>[]; shippingMethods?: DeepPartial<OrderShippingMethod>[] },
		options: { idempotencyKey?: string; source?: string } = {}
	): Promise<Order> {
		if (cart.orderId) {
			throw new BadRequestException(
				`CART_ALREADY_COMPLETED: cart ${cart.id} already became order ${cart.orderId}.`
			);
		}

		const order = await this.create({
			channelId: cart.channelId,
			regionId: cart.regionId,
			customerId: cart.customerId,
			userId: cart.userId,
			email: cart.email,
			currency: cart.currency,
			currencyDecimals: cart.currencyDecimals,
			locale: cart.locale,
			cartId: cart.id,
			source: options.source ?? 'CHANNEL',
			isDraft: false,
			metadata: { ...(cart.metadata ?? {}), idempotencyKey: options.idempotencyKey }
		} as DeepPartial<Order>);

		const cartLines = cart.lines ?? [];
		const cartShipping = cart.shippingMethods ?? [];

		let position = 0;

		for (const line of cartLines) {
			await this.lineService.create({
				orderId: order.id,
				productId: line.productId,
				variantId: line.variantId,
				sellerId: line.sellerId,
				title: line.title,
				sku: line.sku,
				thumbnail: line.thumbnail,
				quantity: line.quantity,
				unitPrice: line.unitPrice,
				originalUnitPrice: line.originalUnitPrice,
				isTaxInclusive: line.isTaxInclusive,
				taxCategoryId: line.taxCategoryId,
				isDiscountable: line.isDiscountable,
				requiresShipping: line.requiresShipping,
				weight: line.weight,
				position: line.position ?? position++,
				note: line.note,
				warehouseId: line.warehouseId,
				metadata: line.metadata
			} as DeepPartial<OrderLine>);
		}

		position = 0;

		for (const method of cartShipping) {
			await this.shippingMethodService.create({
				orderId: order.id,
				shippingOptionId: method.shippingOptionId,
				name: method.name,
				amount: method.amount,
				isTaxInclusive: method.isTaxInclusive,
				taxCategoryId: method.taxCategoryId,
				data: method.data,
				position: method.position ?? position++,
				metadata: method.metadata
			} as DeepPartial<OrderShippingMethod>);
		}

		for (const [index, snapshot] of [
			cart.shippingAddressSnapshot,
			cart.billingAddressSnapshot
		].entries()) {
			if (!snapshot) {
				continue;
			}

			await this.addressService.create({
				orderId: order.id,
				type: index === 0 ? AddressType.SHIPPING : AddressType.BILLING,
				...snapshot
			} as DeepPartial<OrderAddress>);
		}

		await this.historyService.record(order.id, 'ORDER_PLACED', 'Order placed', {
			cartId: cart.id,
			idempotencyKey: options.idempotencyKey
		});

		return this.recomputeAndMaybeConfirm(order.id);
	}

	/**
	 * Moves a draft order to `PENDING`, which is the moment its number becomes final and its stock is
	 * committed.
	 *
	 * @param orderId The order.
	 * @returns The placed order.
	 */
	public async place(orderId: ID): Promise<Order> {
		const order = await this.findOneByIdString(orderId);

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		const lines = ((await this.lineService.findAll({ where: { orderId } })) as IPagination<OrderLine>).items;

		if (lines.length === 0) {
			throw new BadRequestException('ORDER_EMPTY: an order needs at least one line before it is placed.');
		}

		const move = OrderStateMachine.transition(order, OrderStatus.PENDING, {
			actor: 'STAFF',
			hasCapture: Number(order.paidTotal) > 0,
			hasShipped: false,
			isSettled: false,
			hasOpenApproval: false,
			hasShippableLines: lines.some((line) => line.requiresShipping),
			fulfillmentStatus: order.fulfillmentStatus
		});

		await this.typeOrmOrderRepository.update(order.id, { ...move, isDraft: false } as any);
		await this.historyService.record(order.id, 'ORDER_PLACED', 'Order placed', { number: order.number });

		return this.totalsService.recompute(order.id, 'PLACED');
	}

	/**
	 * Confirms a placed order.
	 *
	 * @param orderId The order.
	 * @param actor Who is confirming.
	 * @returns The confirmed order.
	 */
	public async confirm(orderId: ID, actor: 'STAFF' | 'SYSTEM' = 'STAFF'): Promise<Order> {
		const order = await this.findOneByIdString(orderId);

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		const openChanges = await this.changeService.findOpenForOrder(orderId);
		const move = OrderStateMachine.transition(order, OrderStatus.CONFIRMED, {
			actor,
			hasCapture: false,
			hasShipped: false,
			isSettled: true,
			hasOpenApproval: openChanges.some(
				(change: OrderChange) => change.status === OrderChangeStatus.REQUESTED
			),
			hasShippableLines: false,
			fulfillmentStatus: order.fulfillmentStatus
		});

		await this.typeOrmOrderRepository.update(order.id, move as any);
		await this.historyService.record(order.id, 'ORDER_CONFIRMED', 'Order confirmed', {});

		return this.totalsService.recompute(order.id, 'CONFIRMED');
	}

	/**
	 * Cancels an order that nothing has shipped from.
	 *
	 * @param orderId The order.
	 * @param reason Why it was cancelled.
	 * @returns The cancelled order.
	 */
	public async cancel(orderId: ID, reason?: string): Promise<Order> {
		const order = await this.findOneByIdString(orderId);

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		const move = OrderStateMachine.transition(order, OrderStatus.CANCELED, {
			actor: 'STAFF',
			hasCapture: Number(order.paidTotal) > 0,
			hasShipped: [FulfillmentStatus.PARTIALLY_FULFILLED, FulfillmentStatus.FULFILLED].includes(
				order.fulfillmentStatus
			),
			isSettled: false,
			hasOpenApproval: false,
			hasShippableLines: false,
			fulfillmentStatus: order.fulfillmentStatus
		});

		await this.typeOrmOrderRepository.update(order.id, {
			...move,
			cancelReason: reason ?? order.cancelReason
		} as any);
		await this.historyService.record(order.id, 'ORDER_CANCELED', 'Order canceled', { reason });

		return this.totalsService.recompute(order.id, 'CANCEL');
	}

	/**
	 * Archives a terminal order.
	 *
	 * @param orderId The order.
	 * @returns The archived order.
	 */
	public async archive(orderId: ID): Promise<Order> {
		const order = await this.findOneByIdString(orderId);

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		const move = OrderStateMachine.transition(order, OrderStatus.ARCHIVED, {
			actor: 'STAFF',
			hasCapture: false,
			hasShipped: false,
			isSettled: true,
			hasOpenApproval: false,
			hasShippableLines: false,
			fulfillmentStatus: order.fulfillmentStatus
		});

		await this.typeOrmOrderRepository.update(order.id, {
			...move,
			isArchived: true,
			archivedAt: new Date()
		} as any);
		await this.historyService.record(order.id, 'ORDER_ARCHIVED', 'Order archived', {});

		return this.findOneByIdString(order.id);
	}

	/**
	 * Updates the few fields of an order that may change outside a change.
	 *
	 * Everything else — a line, a price, a quantity, an address, a delivery choice — is a modification of
	 * a placed order and belongs to an `order_change`, where it is versioned and reversible. A draft is
	 * the exception: it has not been placed, so it is freely editable.
	 *
	 * @param orderId The order.
	 * @param changes The fields to change.
	 * @returns The order after the change.
	 */
	public async updateMutable(orderId: ID, changes: DeepPartial<Order>): Promise<Order> {
		const order = await this.findOneByIdString(orderId);

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		const mutable = ['email', 'phone', 'locale', 'note', 'metadata', 'externalId', 'cancelReason'];
		const requested = Object.keys(changes ?? {});
		const illegal = requested.filter(
			(key) => !mutable.includes(key) && !(order.isDraft || order.status === OrderStatus.DRAFT)
		);

		if (illegal.length > 0) {
			throw new BadRequestException({
				message: 'A placed order is changed through an order change, not by an update.',
				code: 'ORDER_IMMUTABLE',
				details: { fields: illegal, changeEndpoint: `POST /api/orders/${orderId}/changes` }
			});
		}

		await this.typeOrmOrderRepository.update(order.id, changes as any);

		return this.findOneByIdString(order.id);
	}

	/**
	 * Completes an order whose lines are all fulfilled and whose money side is settled.
	 *
	 * @param orderId The order.
	 * @returns The completed order, or the order unchanged when it is not yet completable.
	 */
	public async completeIfSettled(orderId: ID): Promise<Order> {
		const order = await this.findOneByIdString(orderId);

		if (!order || !this.totalsService.canComplete(order)) {
			return order;
		}

		const hasOpenLines = await this.totalsService.hasOpenShippableLines(order);
		const paymentSettled = await this.totalsService.isPaymentSettled(order);
		const openChange = (await this.changeService.findOpenForOrder(orderId)).length > 0;

		if (hasOpenLines || !paymentSettled || openChange) {
			return order;
		}

		const move = OrderStateMachine.transition(order, OrderStatus.COMPLETED, {
			actor: 'SYSTEM',
			hasCapture: true,
			hasShipped: true,
			isSettled: true,
			hasOpenApproval: false,
			hasShippableLines: false,
			fulfillmentStatus: order.fulfillmentStatus
		});

		await this.typeOrmOrderRepository.update(order.id, move as any);
		await this.historyService.record(order.id, 'ORDER_COMPLETED', 'Order completed', {});

		return this.totalsService.recompute(order.id, 'COMPLETED');
	}

	/**
	 * Recomputes an order and, when it is already placed but not yet confirmed, confirms it.
	 *
	 * Used by the checkout path: an order created from a cart has nothing left to approve when the
	 * money side is handled, so it moves straight to `CONFIRMED`.
	 *
	 * @param orderId The order.
	 * @returns The order.
	 */
	private async recomputeAndMaybeConfirm(orderId: ID): Promise<Order> {
		let order = await this.totalsService.recompute(orderId, 'PLACED');

		if (order.status === OrderStatus.DRAFT) {
			order = await this.confirm(orderId, 'SYSTEM');
		}

		return order;
	}

	/**
	 * Whether a cart may become an order, which the cart package and the checkout handler both state the
	 * same way instead of each restating it.
	 *
	 * @param cart The cart.
	 * @returns True when the cart is in a status an order may be created from.
	 */
	public canCreateFromCart(cart: ICommerceCart): boolean {
		return COMPLETABLE_CART_STATUSES.includes(cart.status);
	}
}

/**
 * The statuses a cart must be in for an order to be created from it.
 *
 * Exported so the checkout handler and the cart package agree on the precondition instead of each
 * restating it.
 */
export const COMPLETABLE_CART_STATUSES = [CommerceCartStatus.ACTIVE, CommerceCartStatus.ABANDONED];
