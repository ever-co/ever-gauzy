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
import { AdjustmentService, CrudService, TaxLineService, commitVersionedUpdate } from '@gauzy/core';
import { ITotalsAdjustment, ITotalsContext, ITotalsSnapshot, ITotalsTaxLine, TotalsCalculator } from '@gauzy/plugin-cart';
import { Order } from '../order/order.entity';
import { ANY_ORDER_VERSION, ORDER_AGGREGATE_WRITER, OrderVersionExpectation } from '../order.types';
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
 * What a recalculation is told beyond the order it acts on.
 */
export interface IOrderRecalculation {
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
		const { version } = await commitVersionedUpdate<Order>(this.orderWriter(), {
			id: orderId,
			expectation: options.expectation ?? ANY_ORDER_VERSION,
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

		return this.typeOrmOrderRepository.findOne({ where: { id: orderId } });
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
	 * @param order The order.
	 * @param snapshot The totals just computed, whose `grandTotal` and `creditTotal` the derivation needs.
	 * @returns The payment status.
	 */
	public async derivePaymentStatus(order: Order, snapshot: ITotalsSnapshot): Promise<OrderPaymentStatus> {
		const transactions = ((await this.transactionService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderTransaction>).items;

		const sumOf = (types: OrderTransactionType[], positive: boolean) =>
			transactions
				.filter((transaction) => types.includes(transaction.type))
				.filter((transaction) => (positive ? Number(transaction.amount) > 0 : Number(transaction.amount) < 0))
				.reduce((total, transaction) => total + Math.abs(Number(transaction.amount)), 0);

		return OrderStateMachine.derivePaymentStatus({
			orderStatus: order.status,
			grandTotal: Number(snapshot.grandTotal),
			creditTotal: Number(snapshot.creditTotal ?? 0),
			authorized: sumOf([OrderTransactionType.AUTHORIZATION], true),
			voided: sumOf([OrderTransactionType.VOID], true),
			captured:
				sumOf([OrderTransactionType.CAPTURE], true) + sumOf([OrderTransactionType.MANUAL], true),
			refunded:
				sumOf([OrderTransactionType.REFUND], false) +
				sumOf([OrderTransactionType.CHARGEBACK], false) +
				sumOf([OrderTransactionType.MANUAL], false),
			hasRequiresMoreSession: false,
			hasPendingSession: false,
			hasFailedAttempt: transactions.some((transaction) => transaction.metadata?.['status'] === 'FAILED'),
			hasTransactions: transactions.length > 0
		});
	}

	/**
	 * Derives the fulfilment state from the order's lines.
	 *
	 * @param order The order.
	 * @returns The fulfilment status.
	 */
	public async deriveFulfillmentStatus(order: Order): Promise<FulfillmentStatus> {
		const lines = ((await this.lineService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderLine>).items;

		const total = (field: keyof OrderLine) =>
			lines.reduce((sum, line) => sum + Number(line[field] ?? 0), 0);

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
	 * @param order The order.
	 * @returns True when a shippable line is not fully fulfilled.
	 */
	public async hasOpenShippableLines(order: Order): Promise<boolean> {
		const lines = ((await this.lineService.findAll({
			where: { orderId: order.id }
		})) as IPagination<OrderLine>).items;

		return lines.some(
			(line) =>
				line.requiresShipping &&
				Number(line.fulfilledQuantity) + Number(line.writtenOffQuantity) < Number(line.quantity)
		);
	}

	/**
	 * Whether the payment side of an order is settled, which is one of the conditions for completion.
	 *
	 * @param order The order.
	 * @returns True when nothing is outstanding.
	 */
	public async isPaymentSettled(order: Order): Promise<boolean> {
		const snapshot = await this.computeTotals(order);

		return Number(snapshot.outstandingTotal ?? 0) <= 0;
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
