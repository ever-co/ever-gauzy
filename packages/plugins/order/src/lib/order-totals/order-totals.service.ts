import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
	AdjustmentOwnerType,
	FulfillmentStatus,
	ID,
	IOrderTotals,
	IPagination,
	OrderStatus,
	OrderTransactionType,
	OrderPaymentStatus,
	TaxLineOwnerType
} from '@gauzy/contracts';
import {
	AdjustmentService,
	CrudService,
	TaxLineService,
	EventOutboxService,
	addDecimalStrings,
	commitVersionedUpdate,
	compareDecimalStrings
} from '@gauzy/core';
import { ITotalsAdjustment, ITotalsContext, ITotalsSnapshot, ITotalsTaxLine, TotalsCalculator } from '@gauzy/plugin-cart';
import { Order } from '../order/order.entity';
import {
	ANY_ORDER_VERSION,
	ORDER_AGGREGATE_TYPE,
	ORDER_AGGREGATE_WRITER,
	OrderVersionExpectation
} from '../order.types';
import { OrderCreditLine } from '../order-credit-line/order-credit-line.entity';
import { OrderCreditLineService } from '../order-credit-line/order-credit-line.service';
import { OrderLine } from '../order-line/order-line.entity';
import { OrderLineService } from '../order-line/order-line.service';
import { OrderShippingMethod } from '../order-shipping-method/order-shipping-method.entity';
import { OrderShippingMethodService } from '../order-shipping-method/order-shipping-method.service';
import { OrderSummaryService } from '../order-summary/order-summary.service';
import { OrderTransaction } from '../order-transaction/order-transaction.entity';
import { OrderTransactionService } from '../order-transaction/order-transaction.service';
import { OrderStateMachine } from '../order-state-machine/order-state-machine';
import { TypeOrmOrderRepository } from '../order/repository/type-orm-order.repository';

/**
 * One `order.*` fact, as the move that caused it states it.
 *
 * The name is `<aggregate>.<action>` — the form the outbox, the webhook subscriptions and the
 * consumer registry all match on — and the payload is a projection rather than an entity dump: a
 * consumer that needs the order reads the order, and an event that carried the row would promise a
 * shape this package would then be unable to change.
 */
export interface IOrderEvent {
	/** `order.placed`, `order.confirmed`, `order.canceled`, `order.completed`, `order.archived`. */
	name: string;
	/** What a consumer receives beside the order's identity. */
	data?: Record<string, unknown>;
}

/**
 * What a recalculation is told beyond the order it acts on.
 */
export interface IOrderRecalculation {
	/**
	 * The fact this write announces, when the move that triggered it announces one.
	 *
	 * Stated here rather than published by the caller afterwards, because the announcement has to be
	 * bound to the write that earned it: a conditional update that was refused throws out of this
	 * method, so an event stated for it is never appended, and a caller that published on its own
	 * would have announced a placement the statement declined. A recalculation that announces nothing
	 * — a totals refresh, a subscription cycle's second pass — states no event and appends no row.
	 */
	event?: IOrderEvent;

	/**
	 * The version the caller read the order at.
	 *
	 * A route passes what its `If-Match` header stated, so a recalculation reasoned about from an
	 * order that has moved on is refused rather than applied on top of someone else's change. A caller
	 * inside the package states nothing and the write is predicated on the version the row holds when
	 * the statement runs.
	 */
	expectation?: OrderVersionExpectation;

	/**
	 * The columns the triggering operation commits in the same statement as the totals.
	 *
	 * A lifecycle move and the totals it produces are one write, not two that a reader could observe
	 * apart: the state machine's own columns ride here, so the order's version advances exactly once
	 * per move and exactly one summary row describes each version. A patch that stated a version would
	 * be ignored — the conditional update decides the version, never the caller.
	 */
	patch?: Record<string, unknown>;
}

/**
 * The only writer of an order's total columns.
 *
 * The chain itself is not implemented here: it is `TotalsCalculator` — one function, shared with the
 * cart, so a cart and the order it becomes cannot compute a total differently. What this service adds is
 * everything an order has and a cart does not: the credit lines, the money ledger, the two materialised
 * statuses, the version bump and the summary row that makes each version's totals answerable later.
 *
 * **The version bump is a version-predicated write.** The totals, the materialised statuses, the
 * columns the triggering move carries and the version are written by one `UPDATE … WHERE id = :id AND
 * version = :expected`, through `commitVersionedUpdate`, so the comparison and the increment cannot be
 * separated by another writer. The `order_summary` row is then written for the version that statement
 * returned, which is what keeps "one row per committed version, never skipped" true.
 *
 * Everything happens in one call and is meant to run inside the transaction of the write that triggered
 * it, so a reader never sees a total that disagrees with the lines it was computed from.
 *
 * **The order's events leave from here too, for the same reason the summary row does.** The package's
 * README says observable changes are emitted through the core `event_outbox`, and this is the one
 * method that knows a lifecycle move actually committed: the conditional update either returned a
 * version or threw. A caller that published afterwards would announce placements the statement had
 * declined, and a caller that published over a bus rather than into the outbox would lose the event to
 * any crash between the commit and the publish — which is the failure the outbox exists to remove. The
 * move states the fact it announces in `options.event`; this method appends it beside the row.
 */
@Injectable()
export class OrderTotalsService {
	constructor(
		private readonly typeOrmOrderRepository: TypeOrmOrderRepository,
		private readonly lineService: OrderLineService,
		private readonly shippingMethodService: OrderShippingMethodService,
		private readonly creditLineService: OrderCreditLineService,
		private readonly transactionService: OrderTransactionService,
		private readonly summaryService: OrderSummaryService,
		private readonly adjustmentService: AdjustmentService,
		private readonly taxLineService: TaxLineService,
		private readonly outbox: EventOutboxService,
		private readonly moduleRef: ModuleRef
	) {}

	/**
	 * Recomputes an order's totals, statusses and version.
	 *
	 * @param orderId The order.
	 * @param reason Why the totals moved, recorded on the summary row: `PLACED`, `CHANGE_CONFIRMED`,
	 * `PAYMENT_RECONCILED`, `FULFILLMENT_COMMITTED`, `CASH_ROUNDED`.
	 * @param options The version the caller read the order at, and the columns the move commits with
	 * the totals.
	 * @returns The order, as written.
	 */
	public async recompute(orderId: ID, reason: string, options: IOrderRecalculation = {}): Promise<Order> {
		const order = await this.typeOrmOrderRepository.findOne({ where: { id: orderId } });

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		// The row as the triggering move will leave it. The money and fulfilment states are derived from
		// the order's own status, so a placement or a cancellation has to be read through the columns it
		// is about to write rather than from the row as it still stands.
		const moved: Order = { ...order, ...(options.patch ?? {}) } as Order;
		const snapshot = await this.computeTotals(moved);
		const paymentStatus = await this.derivePaymentStatus(moved, snapshot);
		const fulfillmentStatus = await this.deriveFulfillmentStatus(moved);
		const promisedAt = await this.promisedDate(moved);

		// `version` is deliberately absent: the conditional update writes the next version in the same
		// statement that checks the current one, and a patch that carried one would move the row past
		// the version the write was predicated on.
		//
		// The tenancy columns are stated as criteria rather than left to the service layer. A
		// conditional write whose criteria name only the row id is a write one identifier is the whole
		// key to, and the identifier travels — it is in a URL, a webhook payload, an exported report —
		// so the statement has to say whose row it is allowed to touch as well as which row. The values
		// come from the row this call just read, which is the same source `OrderReturnService` and
		// `FulfillmentService` take theirs from, and it is the only source available on the paths that
		// run with no request behind them: the checkout handler, a recurrence and the staleness sweep.
		const { version } = await commitVersionedUpdate<Order>(this.orderWriter(), {
			id: orderId,
			expectation: options.expectation ?? ANY_ORDER_VERSION,
			where: {
				...(order.tenantId ? { tenantId: order.tenantId } : {}),
				...(order.organizationId ? { organizationId: order.organizationId } : {})
			},
			patch: {
				...(options.patch ?? {}),
				itemSubtotal: snapshot.itemSubtotal,
				itemDiscountTotal: snapshot.itemDiscountTotal,
				itemTaxTotal: snapshot.itemTaxTotal,
				shippingSubtotal: snapshot.shippingSubtotal,
				shippingDiscountTotal: snapshot.shippingDiscountTotal,
				shippingTaxTotal: snapshot.shippingTaxTotal,
				discountTotal: snapshot.discountTotal,
				taxTotal: snapshot.taxTotal,
				grandTotal: snapshot.grandTotal,
				creditTotal: snapshot.creditTotal,
				paidTotal: snapshot.paidTotal,
				refundedTotal: snapshot.refundedTotal,
				outstandingTotal: snapshot.outstandingTotal,
				paymentStatus,
				fulfillmentStatus,
				sellerCount: await this.countSellers(moved),
				promisedAt
			} as Record<string, unknown>
		});

		// One row per committed version, written in the same transaction as the columns it describes.
		// The row for the current version always equals the denormalised totals; the nightly audit
		// verifies exactly that.
		await this.summaryService.create({
			orderId,
			version,
			totals: { ...snapshot },
			currency: order.currency,
			reason
		} as any);

		if (options.event) {
			await this.announce(moved, version, snapshot, options.event);
		}

		return this.typeOrmOrderRepository.findOne({ where: { id: orderId } });
	}

	/**
	 * Appends one `order.*` event to the platform outbox.
	 *
	 * **The append rides the write, and that is the whole point of the outbox.** An event published
	 * after a commit is an event a crash between the two loses, and nothing afterwards knows it is
	 * missing; an event written as a row beside the state change is delivered by the dispatcher
	 * whenever the process comes back. It is appended through the order repository's own entity
	 * manager — the manager the conditional update and the summary row were written through — and only
	 * after that update returned, so an event is never produced for a write the version predicate
	 * refused: that refusal throws before this line is reached.
	 *
	 * The projection carries the order's identity, the version the write produced and the two
	 * materialised statuses, because those are what a consumer routes on — a search index reindexes,
	 * a notification decides whether to send, a webhook subscriber filters. It deliberately does not
	 * carry the order row: an event that shipped the entity would freeze its shape into every
	 * consumer.
	 *
	 * @param order The order as the move left it.
	 * @param version The version the conditional update produced.
	 * @param snapshot The totals written with it.
	 * @param event The fact to announce.
	 */
	private async announce(
		order: Order,
		version: number,
		snapshot: IOrderTotals,
		event: IOrderEvent
	): Promise<void> {
		await this.outbox.append(this.typeOrmOrderRepository.manager, {
			name: event.name,
			aggregateType: ORDER_AGGREGATE_TYPE,
			aggregateId: order.id,
			data: {
				orderId: order.id,
				number: order.number,
				status: order.status,
				paymentStatus: order.paymentStatus,
				fulfillmentStatus: order.fulfillmentStatus,
				currency: order.currency,
				grandTotal: this.decimalOf(snapshot.grandTotal),
				outstandingTotal: this.decimalOf(snapshot.outstandingTotal ?? 0),
				channelId: order.channelId ?? null,
				customerId: order.customerId ?? null,
				version,
				...(event.data ?? {})
			},
			tenantId: order.tenantId,
			organizationId: order.organizationId
		});
	}

	/**
	 * The service that owns the order row.
	 *
	 * Resolved when a write runs rather than injected: `OrderService` is constructed *from* this
	 * service and calls it for every move it makes, so an injected dependency would close a cycle the
	 * container cannot express. The token is registered by the order module and aliases the order
	 * service — the same late lookup the concurrency kernel's own guard performs for the service a
	 * route names. A missing registration is reported rather than absorbed, because a write that
	 * silently stopped being version-predicated would leave every caller believing it was.
	 *
	 * @returns The order aggregate's service.
	 */
	private orderWriter(): CrudService<Order> {
		const writer = this.moduleRef?.get<CrudService<Order>>(ORDER_AGGREGATE_WRITER, { strict: false });

		if (!writer || typeof writer.update !== 'function' || typeof writer.findOneByIdString !== 'function') {
			throw new InternalServerErrorException(
				'ORDER_WRITER_UNAVAILABLE: the order aggregate has no versioned writer registered.'
			);
		}

		return writer;
	}

	/**
	 * Computes an order's totals without writing anything.
	 *
	 * The calculator marks the four order-only totals optional, because a cart runs neither the credit
	 * lines nor the money ledger step and has no such totals. An order always runs both, so they are
	 * stated here rather than left for every reader to narrow.
	 *
	 * @param order The order.
	 * @returns The computed totals, including the order-only tail.
	 */
	public async computeTotals(order: Order): Promise<IOrderTotals> {
		const lines = ((await this.lineService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderLine>).items;
		const shippingMethods = ((await this.shippingMethodService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderShippingMethod>).items;
		const creditLines = ((await this.creditLineService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderCreditLine>).items;
		const transactions = ((await this.transactionService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderTransaction>).items;

		const lineAdjustments: ITotalsAdjustment[] = [];
		const shippingAdjustments: ITotalsAdjustment[] = [];
		const lineTaxLines: ITotalsTaxLine[] = [];
		const shippingTaxLines: ITotalsTaxLine[] = [];

		for (const line of lines) {
			for (const adjustment of await this.adjustmentService.findByOwner(AdjustmentOwnerType.ORDER_LINE, line.id)) {
				lineAdjustments.push({
					ownerId: line.id,
					amount: Number(adjustment.amount),
					isTaxInclusive: Boolean(adjustment.isTaxInclusive),
					netAmount: this.netAmountOf(adjustment.metadata)
				});
			}

			for (const taxLine of await this.taxLineService.findByOwner(TaxLineOwnerType.ORDER_LINE, line.id)) {
				lineTaxLines.push({ ownerId: line.id, amount: Number(taxLine.amount) });
			}
		}

		for (const method of shippingMethods) {
			for (const adjustment of await this.adjustmentService.findByOwner(
				AdjustmentOwnerType.ORDER_SHIPPING,
				method.id
			)) {
				shippingAdjustments.push({
					ownerId: method.id,
					amount: Number(adjustment.amount),
					isTaxInclusive: Boolean(adjustment.isTaxInclusive),
					netAmount: this.netAmountOf(adjustment.metadata)
				});
			}

			for (const taxLine of await this.taxLineService.findByOwner(TaxLineOwnerType.ORDER_SHIPPING, method.id)) {
				shippingTaxLines.push({ ownerId: method.id, amount: Number(taxLine.amount) });
			}
		}

		const context: ITotalsContext = {
			currency: order.currency,
			currencyDecimals: order.currencyDecimals ?? 2,
			lines: lines.map((line) => ({
				id: line.id,
				quantity: Number(line.quantity),
				unitPrice: Number(line.unitPrice),
				isTaxInclusive: Boolean(line.isTaxInclusive)
			})),
			shippingMethods: shippingMethods.map((method) => ({
				id: method.id,
				amount: Number(method.amount),
				isTaxInclusive: Boolean(method.isTaxInclusive)
			})),
			lineAdjustments,
			shippingAdjustments,
			lineTaxLines,
			shippingTaxLines,
			creditLines: creditLines.map((creditLine) => Number(creditLine.amount)),
			transactions: transactions.map((transaction) => ({
				amount: Number(transaction.amount),
				type: transaction.type as string
			}))
		};

		const snapshot = TotalsCalculator.compute(context);

		return {
			...snapshot,
			creditTotal: snapshot.creditTotal ?? 0,
			paidTotal: snapshot.paidTotal ?? 0,
			refundedTotal: snapshot.refundedTotal ?? 0,
			outstandingTotal: snapshot.outstandingTotal ?? 0
		};
	}

	/**
	 * Derives the money state from the order's own ledger.
	 *
	 * **The ledger is summed on the digits, not with `+`.** The state machine compares exactly, but a
	 * comparison can only be as exact as what it is handed, and every member below but `payable` is a
	 * running sum over the order's transaction rows. Accumulated in binary floating point, an order
	 * whose grand total is `0.80` and which was captured by two transactions of `0.10` and `0.70`
	 * produces `0.7999999999999999`, which compares below `0.80`: the fully captured order is stamped
	 * `PARTIALLY_CAPTURED`, and because `PARTIALLY_CAPTURED` is not one of the statuses a confirmation
	 * admits, a fully paid order can then never be confirmed or completed. The accumulation therefore
	 * runs through the platform's decimal kernel and the two aggregate members are combined with
	 * `addDecimalStrings` rather than with `+`; the state machine accepts the digits as digits.
	 *
	 * @param order The order.
	 * @param snapshot The totals just computed, whose `grandTotal` and `creditTotal` the derivation needs.
	 * @returns The payment status.
	 */
	public async derivePaymentStatus(order: Order, snapshot: ITotalsSnapshot): Promise<OrderPaymentStatus> {
		const transactions = ((await this.transactionService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderTransaction>).items;

		const sumOf = (types: OrderTransactionType[], positive: boolean): string =>
			transactions
				.filter((transaction) => types.includes(transaction.type))
				.map((transaction) => this.decimalOf(transaction.amount))
				.filter((amount) =>
					positive ? compareDecimalStrings(amount, '0') > 0 : compareDecimalStrings(amount, '0') < 0
				)
				.reduce((total, amount) => addDecimalStrings(total, this.absolute(amount)), '0');

		return OrderStateMachine.derivePaymentStatus({
			orderStatus: order.status,
			grandTotal: this.decimalOf(snapshot.grandTotal),
			creditTotal: this.decimalOf(snapshot.creditTotal ?? 0),
			authorized: sumOf([OrderTransactionType.AUTHORIZATION], true),
			voided: sumOf([OrderTransactionType.VOID], true),
			captured: addDecimalStrings(
				sumOf([OrderTransactionType.CAPTURE], true),
				sumOf([OrderTransactionType.MANUAL], true)
			),
			refunded: addDecimalStrings(
				addDecimalStrings(
					sumOf([OrderTransactionType.REFUND], false),
					sumOf([OrderTransactionType.CHARGEBACK], false)
				),
				sumOf([OrderTransactionType.MANUAL], false)
			),
			hasRequiresMoreSession: false,
			hasPendingSession: false,
			hasFailedAttempt: transactions.some((transaction) => transaction.metadata?.['status'] === 'FAILED'),
			hasTransactions: transactions.length > 0
		});
	}

	/**
	 * Derives the fulfilment state from the order's lines.
	 *
	 * The per-line counters are totalled on their digits for the same reason the ledger above is: a
	 * `numeric(20,6)` quantity summed with `+` lands beside the value it should be, and the derivation
	 * it feeds tests a difference for being *exactly* zero — the one test a floating point sum can never
	 * pass.
	 *
	 * @param order The order.
	 * @returns The fulfilment status.
	 */
	public async deriveFulfillmentStatus(order: Order): Promise<FulfillmentStatus> {
		const lines = ((await this.lineService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderLine>).items;

		const total = (field: keyof OrderLine): string =>
			lines.reduce<string>((sum, line) => addDecimalStrings(sum, this.decimalOf(line[field] ?? 0)), '0');

		return OrderStateMachine.deriveFulfillmentStatus({
			orderStatus: order.status,
			orderedQuantity: total('quantity'),
			writtenOffQuantity: total('writtenOffQuantity'),
			dismissedQuantity: total('returnDismissedQuantity'),
			fulfilledQuantity: total('fulfilledQuantity'),
			receivedReturnQuantity: total('returnReceivedQuantity')
		});
	}

	/**
	 * One stored figure as the decimal text it is summed and compared as.
	 *
	 * The column is a `numeric(20,6)` and the transformer hands it back as a `number`, so this is where
	 * the digits are recovered: a `number` is rendered in its shortest round-trip form, and an
	 * exponential rendering — `String(1e-7)` is `'1e-7'`, which the decimal kernel refuses rather than
	 * guesses at — is laid out in full so that a very small credit does not escape a totals
	 * recomputation as a `MONEY_NOT_DECIMAL_STRING` server fault. A value that already arrives as text
	 * is passed through untouched, because re-rendering it through a double is exactly the step that
	 * loses it.
	 *
	 * @param value The figure, as a column or a calculator handed it over.
	 * @returns The figure as exact decimal text.
	 */
	private decimalOf(value: unknown): string {
		if (typeof value === 'string') {
			const text = value.trim();

			return text === '' ? '0' : this.expandExponential(text);
		}

		if (typeof value === 'number') {
			return Number.isFinite(value) ? this.expandExponential(String(value)) : '0';
		}

		if (value === null || value === undefined) {
			return '0';
		}

		return this.decimalOf(String(value));
	}

	/**
	 * @param text A decimal rendering, possibly in exponential form.
	 * @returns The same value written as plain decimal digits, which is the only form the decimal
	 * kernel parses.
	 */
	private expandExponential(text: string): string {
		const match = /^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);

		if (!match) {
			return text;
		}

		const [, sign, whole, fraction = '', exponentText] = match;
		const digits = `${whole}${fraction}`;
		const point = whole.length + Number(exponentText);

		if (point <= 0) {
			return `${sign}0.${'0'.repeat(-point)}${digits}`;
		}

		if (point >= digits.length) {
			return `${sign}${digits}${'0'.repeat(point - digits.length)}`;
		}

		return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
	}

	/**
	 * The magnitude of a decimal, taken from its sign rather than through `Math.abs`.
	 *
	 * A ledger row's direction is carried by its sign and its magnitude is what a running total
	 * accumulates, so the sign is dropped as text: routing the value through `Math.abs` would put it
	 * back into a double for no reason other than to remove one character.
	 *
	 * @param value Decimal text.
	 * @returns The same value without its sign.
	 */
	private absolute(value: string): string {
		return value.startsWith('-') ? value.slice(1) : value;
	}

	/**
	 * The date the order's goods were promised, derived from its lines.
	 *
	 * A promise is made per deliverable — lines ship separately — so the order's own date is the latest
	 * of them and nothing else: it is a cache of the lines, and the totals write is the one place that
	 * already runs whenever a line moves. An order whose lines carry no promise has no promised date
	 * rather than a fabricated one.
	 *
	 * @param order The order.
	 * @returns The latest promised date among the lines, or null when none of them carries one.
	 */
	private async promisedDate(order: Order): Promise<Date | null> {
		const lines = ((await this.lineService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderLine>).items;

		const promised = lines
			.map((line) => line.promisedAt)
			.filter((value): value is Date => value != null)
			.map((value) => new Date(value).getTime());

		return promised.length ? new Date(Math.max(...promised)) : null;
	}

	/**
	 * Counts the distinct sellers among the lines, which is derived and never authored.
	 *
	 * @param order The order.
	 * @returns The number of distinct sellers.
	 */
	private async countSellers(order: Order): Promise<number> {
		const lines = ((await this.lineService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderLine>).items;

		return new Set(lines.map((line) => line.sellerId).filter(Boolean)).size;
	}

	/**
	 * Reads the net part an inclusive adjustment recorded in its metadata.
	 *
	 * @param metadata The ledger row's metadata.
	 * @returns The net amount, or undefined when the row does not carry one.
	 */
	private netAmountOf(metadata: Record<string, unknown> | undefined): number | undefined {
		const netAmount = metadata?.['netAmount'];

		return typeof netAmount === 'number' ? netAmount : undefined;
	}

	/**
	 * Whether an order has any line that still has to ship.
	 *
	 * The comparison decides whether an order may complete, and it is made on the digits for the same
	 * reason the fulfilment status is: a line ordered for `0.3` that shipped `0.1` and was written off
	 * `0.2` has `0.1 + 0.2 = 0.30000000000000004` in binary floating point, which is *not* below `0.3` —
	 * and the mirrored case, where the sum lands just under, reports an open line on an order that has
	 * nothing left to ship and leaves it in the picking queue for ever.
	 *
	 * @param order The order.
	 * @returns True when a shippable line is not fully fulfilled.
	 */
	public async hasOpenShippableLines(order: Order): Promise<boolean> {
		const lines = ((await this.lineService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderLine>).items;

		return lines.some((line) => {
			if (!line.requiresShipping) {
				return false;
			}

			const accounted = addDecimalStrings(
				this.decimalOf(line.fulfilledQuantity ?? 0),
				this.decimalOf(line.writtenOffQuantity ?? 0)
			);

			return compareDecimalStrings(accounted, this.decimalOf(line.quantity ?? 0)) < 0;
		});
	}

	/**
	 * Whether the payment side of an order is settled, which is one of the conditions for completion.
	 *
	 * The test is "nothing is outstanding", and an outstanding total that is a rounding error away from
	 * zero is nothing outstanding — but only a comparison on the digits says so. Compared as a double,
	 * an order settled to the last cent can hold an outstanding total of `2.7e-17` and never complete.
	 *
	 * @param order The order.
	 * @returns True when nothing is outstanding.
	 */
	public async isPaymentSettled(order: Order): Promise<boolean> {
		const snapshot = await this.computeTotals(order);

		return compareDecimalStrings(this.decimalOf(snapshot.outstandingTotal ?? 0), '0') <= 0;
	}

	/**
	 * Whether an order is in a status that may still be completed.
	 *
	 * @param order The order.
	 * @returns True when completion is a legal move.
	 */
	public canComplete(order: Order): boolean {
		return [OrderStatus.CONFIRMED, OrderStatus.PROCESSING].includes(order.status);
	}
}
