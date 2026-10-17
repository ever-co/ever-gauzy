import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	Optional,
	ServiceUnavailableException
} from '@nestjs/common';
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import {
	AddressType,
	CommerceCartStatus,
	FulfillmentStatus,
	ID,
	IPagination,
	ICommerceCart,
	ICommerceCartLine,
	ICommerceCartShippingMethod,
	OrderChangeStatus,
	OrderStatus
} from '@gauzy/contracts';
import { Money, SequenceService, TenantAwareCrudService } from '@gauzy/core';
import { Order } from './order.entity';
import { TypeOrmOrderRepository } from './repository/type-orm-order.repository';
import { MikroOrmOrderRepository } from './repository/mikro-orm-order.repository';
import {
	ANY_ORDER_VERSION,
	IOrderApprovalPort,
	ORDER_APPROVAL,
	ORDER_EVENTS,
	OrderVersionExpectation
} from '../order.types';
import { OrderAddress } from '../order-address/order-address.entity';
import { OrderAddressService } from '../order-address/order-address.service';
import { OrderChange } from '../order-change/order-change.entity';
import { OrderChangeService } from '../order-change/order-change.service';
import { OrderHistoryService } from '../order-history/order-history.service';
import { scopeOfOrderRow } from '../order-history/order-row-scope';
import { OrderLine } from '../order-line/order-line.entity';
import { OrderLineService } from '../order-line/order-line.service';
import { OrderShippingMethod } from '../order-shipping-method/order-shipping-method.entity';
import { OrderShippingMethodService } from '../order-shipping-method/order-shipping-method.service';
import { OrderStateMachine } from '../order-state-machine/order-state-machine';
import { OrderTotalsService } from '../order-totals/order-totals.service';
import { ICartToOrderRowMap, OrderCartLedgerCarryover } from '../checkout/order-cart-ledger-carryover.service';

/** The series every order number is allocated from. */
const ORDER_SEQUENCE_KEY = 'ORDER';

/** What requesting an order's approval answers: the order, and the approval request filed for it. */
export interface IOrderApprovalRequested {
	/** The order, placed and awaiting a decision. */
	order: Order;
	/** The order's version, also published as the response's `ETag`. */
	version: number;
	/** The `request_approval` row the decision is recorded on. */
	approvalId: ID;
}

/**
 * The order aggregate's service.
 *
 * Everything an order may have done to it goes through here: it is placed, cancelled, archived or
 * edited, and each of those moves the lifecycle through `OrderStateMachine` and then asks
 * `OrderTotalsService` to recompute — because a status change and a totals change are one write, not
 * two that can be observed apart.
 *
 * **That one write is version-predicated.** The order carries a version; a route requires the caller
 * to state the version it read as an `If-Match` header and publishes the version it produced as an
 * `ETag`; and the move is applied by `commitVersionedUpdate`, whose `UPDATE … WHERE id = :id AND
 * version = :expected` decides the outcome from the affected-row count. Two callers that read the same
 * order therefore cannot both write it: the second is answered with a conflict instead of silently
 * erasing the first.
 *
 * A placed order is **not** edited here. `update` refuses anything but the handful of fields a draft or
 * a note may change, and every other modification is an `order_change` handled by
 * `OrderChangeService`.
 *
 * **Each lifecycle move announces itself, and it does so as part of the write.** The package's README
 * says observable changes are emitted through the core `event_outbox`, and nothing was emitting them:
 * an order could be placed, confirmed, cancelled, completed or archived and no search index, webhook
 * subscriber or GraphQL subscription could learn of it. The fact is now stated with the move and
 * appended by the same call that commits it (`OrderTotalsService.recompute`), which is the only
 * arrangement that makes the two inseparable — a refused conditional update announces nothing, and a
 * committed one cannot lose its event to a crash. The `order_history` rows stay exactly as they were:
 * they are the order's own human-readable timeline, which is a different thing from a fact another
 * context consumes.
 */
@Injectable()
export class OrderService extends TenantAwareCrudService<Order> {
	private readonly logger = new Logger(OrderService.name);

	constructor(
		readonly typeOrmOrderRepository: TypeOrmOrderRepository,
		readonly mikroOrmOrderRepository: MikroOrmOrderRepository,
		private readonly totalsService: OrderTotalsService,
		private readonly lineService: OrderLineService,
		private readonly addressService: OrderAddressService,
		private readonly shippingMethodService: OrderShippingMethodService,
		private readonly historyService: OrderHistoryService,
		private readonly changeService: OrderChangeService,
		private readonly sequenceService: SequenceService,
		/**
		 * The platform's approval machinery. Optional: it is bound by the installation that serves the routes
		 * (`OrderPlatformAdaptersModule`), and the worker that hosts this module for its sweeps binds nothing.
		 */
		@Optional()
		@Inject(ORDER_APPROVAL)
		private readonly approvals?: IOrderApprovalPort,
		/**
		 * Copies a cart's discount and tax rows onto the order it became (Q7-W1a). Optional, and last, so a
		 * suite that constructs this service by position is unchanged; without it a checkout order is
		 * placed with the lines alone, which is what every order was before the carry-over existed.
		 */
		@Optional()
		private readonly cartLedgerCarryover?: OrderCartLedgerCarryover
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
	 * @param options The checkout request, and the order a recurrence came from when there was one.
	 * @returns The placed and confirmed order.
	 */
	public async createFromCart(
		// The lines this receives are *cart* lines, and typing them as partial order lines was a
		// convenience that stopped being true the moment the two shapes diverged: a cart's money members
		// accept the exact decimal string the GraphQL schema promises, and an order line's are numbers.
		// Naming the shape it is actually handed is what lets the conversion below be the one place the
		// two vocabularies meet.
		cart: ICommerceCart & { lines?: ICommerceCartLine[]; shippingMethods?: ICommerceCartShippingMethod[] },
		options: {
			idempotencyKey?: string;
			source?: string;
			parentOrderId?: ID;
			/**
			 * Copy the cart's adjustment and tax rows onto the order before it is placed (Q7-W1a).
			 *
			 * Stated by the checkout handler only. The subscription path builds a cart and then writes the
			 * cycle's own discount and tax onto the order itself, so the cart's would be charged twice.
			 */
			carryCartLedgers?: boolean;
		} = {}
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
			// The order a recurrence came from. A cart does not carry one — the lineage is a fact about
			// the order, not about the basket it was built from — so the caller that knows it states it.
			parentOrderId: options.parentOrderId,
			source: options.source ?? 'CHANNEL',
			isDraft: false,
			metadata: { ...(cart.metadata ?? {}), idempotencyKey: options.idempotencyKey }
		} as DeepPartial<Order>);

		const cartLines = cart.lines ?? [];
		const cartShipping = cart.shippingMethods ?? [];
		// Which order row each cart row became — the only place that knows it is the loop that creates them,
		// and the ledger carry-over below needs it to move each cart row's discount and tax to the right owner.
		const carried = options.carryCartLedgers === true;
		const lineMap = new Map<ID, ID>();
		const lineWeights = new Map<ID, string>();
		const shippingMap = new Map<ID, ID>();

		let position = 0;

		for (const line of cartLines) {
			const created = await this.lineService.create({
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
				metadata: carried && line.id ? { ...(line.metadata ?? {}), cartLineId: line.id } : line.metadata
			} as DeepPartial<OrderLine>);

			if (line.id && created?.id) {
				lineMap.set(line.id, created.id);
				// What the line is worth, which a document-level discount or fee is spread over in proportion to.
				lineWeights.set(
					created.id,
					lineValueOf(line.unitPrice, line.quantity, cart.currency, cart.currencyDecimals)
				);
			}
		}

		position = 0;

		for (const method of cartShipping) {
			const created = await this.shippingMethodService.create({
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

			if (method.id && created?.id) {
				shippingMap.set(method.id, created.id);
			}
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

		if (carried) {
			await this.carryCartLedgers(cart.id, order, {
				lines: lineMap,
				shippingMethods: shippingMap,
				lineWeights,
				currencyDecimals: cart.currencyDecimals
			});
		}

		// The timeline entry is written once, by the step that actually places the order, and it
		// carries what the placement came from.
		return this.placeAndConfirm(order.id, {
			cartId: cart.id,
			idempotencyKey: options.idempotencyKey
		});
	}

	/**
	 * Moves a draft order to `PENDING`, which is the moment its number becomes final and its stock is
	 * committed.
	 *
	 * @param orderId The order.
	 * @param placedWith What the placement is attributed to, recorded on the timeline entry.
	 * @param expectation The version the caller read the order at.
	 * @returns The placed order.
	 */
	public async place(
		orderId: ID,
		// What the placement is attributed to: the cart it came from and the retry key it was made under on
		// the checkout path, or the quote whose acceptance placed it.
		placedWith: { cartId?: ID; idempotencyKey?: string; quoteInvoiceId?: ID; approvalRequested?: boolean } = {},
		expectation: OrderVersionExpectation = ANY_ORDER_VERSION
	): Promise<Order> {
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
			fulfillmentStatus: order.fulfillmentStatus,
			paymentStatus: order.paymentStatus
		});

		// The move is committed before the timeline records it: an entry written first would describe a
		// placement the conditional update then refused, and a reader of the timeline would believe it.
		const placed = await this.totalsService.recompute(order.id, 'PLACED', {
			expectation,
			patch: { ...move, isDraft: false },
			// The announcement is stated with the move rather than made after it: the conditional update
			// either commits and appends the event beside the row, or refuses and appends nothing. An
			// `order.placed` published from here after the call returned would be lost by any crash in
			// between, which is exactly what the outbox exists to prevent.
			event: { name: ORDER_EVENTS.PLACED, data: { ...placedWith } }
		});

		// The entry carries the order's own tenancy, because a placement is also made with no request
		// behind it — the checkout handler, a recurrence — and the tenant-aware create would otherwise
		// write it with no tenant, off the timeline of the order it describes.
		await this.historyService.record(
			order.id,
			'ORDER_PLACED',
			'Order placed',
			{ number: order.number, ...placedWith },
			scopeOfOrderRow(order)
		);

		return placed;
	}

	/**
	 * Confirms a placed order.
	 *
	 * @param orderId The order.
	 * @param actor Who is confirming.
	 * @param expectation The version the caller read the order at.
	 * @returns The confirmed order.
	 */
	public async confirm(
		orderId: ID,
		actor: 'STAFF' | 'SYSTEM' = 'STAFF',
		expectation: OrderVersionExpectation = ANY_ORDER_VERSION
	): Promise<Order> {
		const order = await this.findOneByIdString(orderId);

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		const openChanges = await this.changeService.findOpenForOrder(orderId);
		// The money facts are read from the order's own ledger rather than asserted: a confirmation is
		// the platform's statement that the money question is answered, and literals here would let an
		// order be confirmed while its payment is still with the buyer (doc 10 §5.2, §5.5).
		const snapshot = await this.totalsService.computeTotals(order);
		const move = OrderStateMachine.transition(order, OrderStatus.CONFIRMED, {
			actor,
			hasCapture: Number(snapshot.paidTotal ?? 0) > 0,
			hasShipped: false,
			isSettled: await this.totalsService.isPaymentSettled(order),
			hasOpenApproval: openChanges.some(
				(change: OrderChange) => change.status === OrderChangeStatus.REQUESTED
			),
			hasShippableLines: false,
			fulfillmentStatus: order.fulfillmentStatus,
			paymentStatus: await this.totalsService.derivePaymentStatus(order, snapshot)
		});

		const confirmed = await this.totalsService.recompute(order.id, 'CONFIRMED', {
			expectation,
			patch: move as Record<string, unknown>,
			event: { name: ORDER_EVENTS.CONFIRMED, data: { actor } }
		});

		await this.historyService.record(order.id, 'ORDER_CONFIRMED', 'Order confirmed', {}, scopeOfOrderRow(order));

		// A staff member's confirmation is the approval a buyer's request was waiting for, so the request is
		// decided with it. A system confirmation — the checkout path — was never held for approval.
		if (actor === 'STAFF') {
			await this.settleApprovals(order, true);
		}

		return confirmed;
	}

	/**
	 * Cancels an order that nothing has shipped from.
	 *
	 * @param orderId The order.
	 * @param reason Why it was cancelled.
	 * @param expectation The version the caller read the order at.
	 * @returns The cancelled order.
	 */
	public async cancel(
		orderId: ID,
		reason?: string,
		expectation: OrderVersionExpectation = ANY_ORDER_VERSION
	): Promise<Order> {
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
			fulfillmentStatus: order.fulfillmentStatus,
			paymentStatus: order.paymentStatus
		});

		const cancelled = await this.totalsService.recompute(order.id, 'CANCEL', {
			expectation,
			patch: { ...move, cancelReason: reason ?? order.cancelReason },
			event: { name: ORDER_EVENTS.CANCELED, data: { reason: reason ?? order.cancelReason ?? null } }
		});

		await this.historyService.record(
			order.id,
			'ORDER_CANCELED',
			'Order canceled',
			{ reason },
			scopeOfOrderRow(order)
		);

		// A cancelled order will not be approved, so a request still awaiting a decision is refused with it.
		await this.settleApprovals(order, false);

		return cancelled;
	}

	/**
	 * Places a buyer's draft order for a staff member's approval.
	 *
	 * **The order lifecycle has no "awaiting approval" status**, so none is invented: the state machine moves
	 * a draft to `PENDING`, and `PENDING` is exactly the status a staff confirmation (`POST /orders/:id/approve`,
	 * `confirmOrder`) moves on from — the `REQUIRES_ACTION` status is the money question's, not an approver's.
	 * Requesting approval is therefore the move `placeOrder` makes (`DRAFT -> PENDING`, through `place`, with
	 * its number, its stock commitment, its event and its timeline entry) **plus** an approval request filed
	 * against the order through the platform's approval machinery (`request_approval`, type `SALES_ORDER`), so
	 * the decision is recorded where every other approval on the platform is. A staff member approves it with
	 * the existing approve route, whose confirmation decides the request; a cancellation refuses it.
	 *
	 * **A placed order that has no open request may file one.** That is the recovery path as much as a feature:
	 * the request is filed after the order's write, because the order is the record whose version decides the
	 * outcome, so a request that could not be filed leaves a placed order that the same call made again
	 * completes. Its write — no move, a summary row that records `APPROVAL_REQUESTED` — is version-predicated
	 * like the placement.
	 *
	 * @param orderId The order.
	 * @param note The buyer's note to the approver.
	 * @param expectation The version the caller read the order at.
	 * @returns The placed order, and the approval request filed for it.
	 * @throws NotFoundException when the order is not the caller's.
	 * @throws ConflictException with `ORDER_APPROVAL_NOT_REQUESTABLE` when the order is past placing, and
	 * `ORDER_APPROVAL_ALREADY_REQUESTED` when a request is already awaiting a decision.
	 * @throws ServiceUnavailableException with `ORDER_APPROVAL_UNAVAILABLE` when no approval machinery is
	 * registered — before the order moves.
	 */
	public async requestApproval(
		orderId: ID,
		note?: string,
		expectation: OrderVersionExpectation = ANY_ORDER_VERSION
	): Promise<IOrderApprovalRequested> {
		const order = await this.findOneByIdString(orderId);

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		if (order.status !== OrderStatus.DRAFT && order.status !== OrderStatus.PENDING) {
			const reason =
				order.status === OrderStatus.REQUIRES_ACTION
					? 'the order is placed and waiting on its payment, not on an approver'
					: `an order in ${order.status} is already past the decision an approval is asked for`;

			throw new ConflictException({
				message: `Order ${order.number} is ${order.status}, so its approval cannot be requested: ${reason}.`,
				code: 'ORDER_APPROVAL_NOT_REQUESTABLE',
				details: {
					orderId: order.id,
					status: order.status,
					reason,
					requestable: [OrderStatus.DRAFT, OrderStatus.PENDING]
				}
			});
		}

		if (!this.approvals) {
			throw new ServiceUnavailableException(
				'ORDER_APPROVAL_UNAVAILABLE: the approval capability is not registered in this process, so an order cannot be placed for approval.'
			);
		}

		let placed: Order;
		// Without a stated version, the write is held to the version read above, as every other write here is.
		const heldTo: OrderVersionExpectation = expectation?.wildcard
			? { wildcard: false, versions: [Number(order.version)] }
			: expectation;

		if (order.status === OrderStatus.DRAFT) {
			placed = await this.place(order.id, { approvalRequested: true }, heldTo);
		} else {
			const open = await this.approvals.findOpen(order.id);

			if (open) {
				throw new ConflictException({
					message: `Order ${order.number} already awaits a decision on approval request ${open.approvalId}.`,
					code: 'ORDER_APPROVAL_ALREADY_REQUESTED',
					details: { orderId: order.id, approvalId: open.approvalId }
				});
			}

			placed = await this.totalsService.recompute(order.id, 'APPROVAL_REQUESTED', { expectation: heldTo });
		}

		const { approvalId } = await this.approvals.requestApproval({
			orderId: order.id,
			organizationId: order.organizationId,
			name: `Order ${placed.number ?? order.number}`,
			amount: placed.grandTotal,
			currency: placed.currency ?? order.currency,
			note
		});

		await this.historyService.record(
			order.id,
			'ORDER_APPROVAL_REQUESTED',
			'Approval requested',
			{ approvalId, note: note ?? null },
			scopeOfOrderRow(order)
		);

		return { order: placed, version: Number(placed.version), approvalId };
	}

	/**
	 * Decides the order's approval requests that still await a decision, when the approval machinery is
	 * registered.
	 *
	 * It runs after the order's own write has committed, and it never fails that write: the order's status is
	 * the fact, and a request left undecided by a failure here is a row an approver can still decide, which is
	 * logged rather than turned into a refusal of a confirmation that already happened.
	 *
	 * @param order The order.
	 * @param approved True on a confirmation, false on a cancellation.
	 */
	private async settleApprovals(order: Order, approved: boolean): Promise<void> {
		if (!this.approvals) {
			return;
		}

		try {
			const settled = await this.approvals.settle(order.id, approved);

			if (settled > 0) {
				await this.historyService.record(
					order.id,
					approved ? 'ORDER_APPROVAL_APPROVED' : 'ORDER_APPROVAL_REFUSED',
					approved ? 'Approval granted' : 'Approval refused',
					{ requests: settled },
					scopeOfOrderRow(order)
				);
			}
		} catch (error) {
			this.logger.warn(
				`ORDER_APPROVAL_SETTLE_FAILED: order ${order.id} was ${approved ? 'confirmed' : 'cancelled'} and its approval request could not be decided: ${(error as Error)?.message}`
			);
		}
	}

	/**
	 * Archives a terminal order.
	 *
	 * @param orderId The order.
	 * @param expectation The version the caller read the order at.
	 * @returns The archived order.
	 */
	public async archive(orderId: ID, expectation: OrderVersionExpectation = ANY_ORDER_VERSION): Promise<Order> {
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
			fulfillmentStatus: order.fulfillmentStatus,
			paymentStatus: order.paymentStatus
		});

		// The archival rides the totals write rather than preceding it: the version has to advance on
		// every committed write of the aggregate, and a version that advanced without a summary row
		// would leave a gap the audit of the version history reads as a lost revision.
		const archived = await this.totalsService.recompute(order.id, 'ARCHIVED', {
			expectation,
			patch: { ...move, isArchived: true, archivedAt: new Date() },
			event: { name: ORDER_EVENTS.ARCHIVED }
		});

		await this.historyService.record(order.id, 'ORDER_ARCHIVED', 'Order archived', {}, scopeOfOrderRow(order));

		return archived;
	}

	/**
	 * Updates the few fields of an order that may change outside a change.
	 *
	 * Everything else — a line, a price, a quantity, an address, a delivery choice — is a modification of
	 * a placed order and belongs to an `order_change`, where it is versioned and reversible. A draft is
	 * the exception: it has not been placed, so it is freely editable.
	 *
	 * The edit is committed through the totals writer even though it changes no figure: the version is
	 * what the next caller states back, so a write that left it where it was would publish a version
	 * that no longer describes the row.
	 *
	 * @param orderId The order.
	 * @param changes The fields to change.
	 * @param expectation The version the caller read the order at.
	 * @returns The order after the change.
	 */
	public async updateMutable(
		orderId: ID,
		changes: DeepPartial<Order>,
		expectation: OrderVersionExpectation = ANY_ORDER_VERSION
	): Promise<Order> {
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

		return this.totalsService.recompute(order.id, 'ORDER_UPDATED', {
			expectation,
			patch: changes as Record<string, unknown>
		});
	}

	/**
	 * Completes an order whose lines are all fulfilled and whose money side is settled.
	 *
	 * @param orderId The order.
	 * @param expectation The version the caller read the order at.
	 * @returns The completed order, or the order unchanged when it is not yet completable.
	 */
	public async completeIfSettled(
		orderId: ID,
		expectation: OrderVersionExpectation = ANY_ORDER_VERSION
	): Promise<Order> {
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
			fulfillmentStatus: order.fulfillmentStatus,
			paymentStatus: order.paymentStatus
		});

		const completed = await this.totalsService.recompute(order.id, 'COMPLETED', {
			expectation,
			patch: move as Record<string, unknown>,
			event: { name: ORDER_EVENTS.COMPLETED }
		});

		await this.historyService.record(order.id, 'ORDER_COMPLETED', 'Order completed', {}, scopeOfOrderRow(order));

		return completed;
	}

	/**
	 * Places the order a cart became, and confirms it.
	 *
	 * Used by the checkout path: a cart that completed has nothing left to approve, so the order it
	 * became is confirmed as soon as it is placed. It is placed **through `place`** rather than moved
	 * straight to `CONFIRMED`, because the documented checkout is two steps — `create-order` inserts
	 * the order as `DRAFT` (doc 10 §3.4 step 4) and `commit-order` places it as `PENDING` with its
	 * `placedAt` (step 8) — and `DRAFT -> CONFIRMED` is not a move the transition table contains
	 * (§5.2). Jumping over `PENDING` is what made every checkout fail, after the draft order, its
	 * lines and its addresses had already been written.
	 *
	 * @param orderId The order.
	 * @param placedWith What the placement came from, recorded on the timeline entry.
	 * @returns The confirmed order.
	 */
	/**
	 * Copies the cart's money ledgers onto the order before it is placed.
	 *
	 * A failure here leaves a draft that would be placed without the discount and the tax the buyer was
	 * quoted, so the draft is cancelled and the error rethrown: the checkout fails, the cart was never
	 * attached to the order, and the buyer can complete it again. The draft is cancelled rather than left
	 * as a stray `DRAFT` because nothing else would ever close it.
	 *
	 * @param cartId The cart the order came from.
	 * @param order The draft order.
	 * @param rows Which order row each cart row became.
	 */
	private async carryCartLedgers(cartId: ID, order: Order, rows: ICartToOrderRowMap): Promise<void> {
		if (!this.cartLedgerCarryover) {
			this.logger.warn(
				`Order ${order.id} was created from cart ${cartId} without its discount and tax rows: the ledger carry-over is not provided.`
			);

			return;
		}

		try {
			await this.cartLedgerCarryover.carry(cartId, order.id, rows);
		} catch (error) {
			try {
				await this.cancelUnplacedDraft(order.id, 'CART_LEDGER_CARRYOVER_FAILED');
			} catch (cancelError) {
				this.logger.error(
					`Draft order ${order.id} could not be cancelled after its ledger carry-over failed: ${describeError(cancelError)}`
				);
			}

			throw error;
		}
	}

	/**
	 * Cancels a draft the checkout built and could not place.
	 *
	 * Not `cancel()`: that move reads "has anything shipped" from the derived fulfilment status, and a draft
	 * whose lines need no shipping derives as fulfilled, so the operator's move would refuse to cancel a
	 * draft nothing was ever sent from. A draft that was never placed has shipped nothing by construction.
	 * And it announces nothing: no `order.placed` went out for it, so an `order.canceled` would describe an
	 * order no consumer ever heard of.
	 *
	 * @param orderId The draft.
	 * @param reason Why it was cancelled, recorded on the row and the timeline.
	 */
	private async cancelUnplacedDraft(orderId: ID, reason: string): Promise<void> {
		const order = await this.findOneByIdString(orderId);

		if (!order || order.status !== OrderStatus.DRAFT) {
			return;
		}

		const move = OrderStateMachine.transition(order, OrderStatus.CANCELED, {
			actor: 'SYSTEM',
			hasCapture: false,
			hasShipped: false,
			isSettled: false,
			hasOpenApproval: false,
			hasShippableLines: false,
			fulfillmentStatus: order.fulfillmentStatus,
			paymentStatus: order.paymentStatus
		});

		await this.totalsService.recompute(order.id, 'CANCEL', {
			patch: { ...move, cancelReason: reason }
		});

		await this.historyService.record(
			order.id,
			'ORDER_CANCELED',
			'Order canceled',
			{ reason },
			scopeOfOrderRow(order)
		);
	}

	private async placeAndConfirm(orderId: ID, placedWith: { cartId?: ID; idempotencyKey?: string } = {}): Promise<Order> {
		await this.place(orderId, placedWith);

		return this.confirm(orderId, 'SYSTEM');
	}

	/**
	 * The live placed order a cart became, if there is one (R3-10).
	 *
	 * "Placed" is every status but `DRAFT` and `CANCELED`: the orders the unique index `UQ_order_cart` allows
	 * one of per cart. A draft left behind by a checkout that failed before placing it, and a cancelled
	 * order, are not the cart's order. The statuses are filtered here rather than in the criteria, so the
	 * read is the same plain equality on both ORMs.
	 *
	 * @param cartId The cart.
	 * @returns The placed order, or null when the cart has none.
	 */
	public async findPlacedForCart(cartId: ID): Promise<Order | null> {
		const page = (await this.findAll({ where: { cartId } as FindOptionsWhere<Order> })) as IPagination<Order>;

		return (
			(page.items ?? []).find(
				(order) => order.status !== OrderStatus.DRAFT && order.status !== OrderStatus.CANCELED
			) ?? null
		);
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

/**
 * The first line of an error's message, for a log line.
 *
 * @param error What was thrown.
 * @returns A short description.
 */
function describeError(error: unknown): string {
	return error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
}

/**
 * A cart line's value — unit price × quantity — as exact decimal text, or zero when it cannot be read.
 *
 * @param unitPrice The line's unit price.
 * @param quantity The line's quantity.
 * @param currency The cart's currency.
 * @param decimals The currency's decimal places.
 * @returns The value.
 */
function lineValueOf(unitPrice: unknown, quantity: unknown, currency: string, decimals?: number): string {
	try {
		return Money.fromStorage(String(unitPrice ?? '0'), currency as never, decimals)
			.multiply(String(quantity ?? '0'))
			.abs()
			.toStorageString();
	} catch {
		return '0';
	}
}
