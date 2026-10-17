import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { ID, OrderTransactionType } from '@gauzy/contracts';
import {
	compareDecimalStrings,
	isValidDecimalString,
	normalizeDecimalString,
	subtractDecimalStrings
} from '@gauzy/core';
import { Order } from '../order/order.entity';
import { OrderService } from '../order/order.service';
import { OrderTotalsService } from '../order-totals/order-totals.service';
import { OrderTransaction } from '../order-transaction/order-transaction.entity';
import { OrderTransactionService } from '../order-transaction/order-transaction.service';
import { IOrderMoneyFact, IOrderMoneyFactResult } from '../order.types';

/** The ledger type each money fact is written as. */
const TYPE_OF_FACT: Record<IOrderMoneyFact['type'], OrderTransactionType> = {
	AUTHORIZATION: OrderTransactionType.AUTHORIZATION,
	CAPTURE: OrderTransactionType.CAPTURE,
	REFUND: OrderTransactionType.REFUND,
	VOID: OrderTransactionType.VOID
};

/**
 * The order's money ledger, as the payment domain writes to it (Q7-W1b).
 *
 * **Why it exists.** An order's payment status, paid total and outstanding total are all derived from its
 * `order_transaction` rows (`OrderTotalsService.paymentStatusFrom`), and the only writers of those rows
 * were an operator's `MANUAL` correction and an order change's `CREDIT`. Nothing wrote an
 * `AUTHORIZATION`, a `CAPTURE`, a `REFUND` or a `VOID`, so an order whose payment was authorised,
 * captured in full and refunded went on answering `NOT_PAID` with its whole total outstanding — and
 * `completeIfSettled`, which asks whether anything is outstanding, was never true and had no caller.
 *
 * The payment package reports each fact through its `PAYMENT_ORDER_LEDGER` port (bound to this service
 * by the installation's composition module) after the payment's own transaction committed; the checkout
 * reports the facts of the payments a cart carried in. Each fact is written once, re-derives the order,
 * and gives the order its chance to complete.
 *
 * **At most once.** A fact is keyed by `(order, type, referenceType, referenceId)` — the payment-side row
 * that caused it — and a key already on the ledger answers `recorded: false` and moves nothing. That is
 * what lets the synchronous report, a retried request and the outbox consumer that backs them up
 * (Q7-W3) all deliver the same fact. The check is a read before the write,
 * backed by the unique index `UQ_order_transaction_payment_fact` (`1791000000793`): of two reports that race
 * past the read, the database refuses the second insert and the writer answers it as a repeat.
 *
 * **Both ORMs.** The order is read and the row written through the tenant-aware CRUD services, which
 * dispatch to the configured ORM; the re-derivation is `OrderTotalsService.recompute` with no manager,
 * so it opens its own unit under either ORM.
 */
@Injectable()
export class OrderPaymentLedgerService {
	private readonly logger = new Logger(OrderPaymentLedgerService.name);

	constructor(
		private readonly orderService: OrderService,
		private readonly transactionService: OrderTransactionService,
		private readonly totalsService: OrderTotalsService
	) {}

	/**
	 * Records one money fact on the order's ledger, at most once, and re-derives the order.
	 *
	 * @param fact The fact.
	 * @returns Whether a row was written, and the row.
	 * @throws BadRequestException when the fact is malformed or in another currency than the order.
	 * @throws NotFoundException when the order is not in the caller's tenant.
	 */
	async record(fact: IOrderMoneyFact): Promise<IOrderMoneyFactResult> {
		const type = TYPE_OF_FACT[fact?.type];
		const magnitude = this.magnitudeOf(fact);

		if (!type || !fact.referenceType || !fact.referenceId) {
			throw new BadRequestException({
				message:
					'ORDER_MONEY_FACT_INVALID: a money fact names its type and the payment-side row that caused it.',
				code: 'ORDER_MONEY_FACT_INVALID',
				details: { type: fact?.type, referenceType: fact?.referenceType, referenceId: fact?.referenceId }
			});
		}

		const order = await this.findOrder(fact.orderId);

		if (String(fact.currency ?? '').toUpperCase() !== String(order.currency ?? '').toUpperCase()) {
			throw new BadRequestException({
				message:
					`ORDER_TRANSACTION_CURRENCY_MISMATCH: order '${order.id}' is in ${order.currency}, and every ledger ` +
					`row is counted in it; a ${fact.currency} ${fact.type} would be summed as ${order.currency}.`,
				code: 'ORDER_TRANSACTION_CURRENCY_MISMATCH',
				details: { orderId: order.id, orderCurrency: order.currency, currency: fact.currency }
			});
		}

		const existing = await this.findRecorded(order.id, type, fact.referenceType, fact.referenceId);

		if (existing) {
			// The row is there, but the re-derivation or the completion that should have followed it may not
			// be: a recompute that failed after the insert left the order's totals stale, and a repeated report
			// is the chance to finish it (Greptile on #10890).
			await this.settleIfStale(order);

			return { recorded: false, transactionId: existing.id };
		}

		let row: OrderTransaction;

		try {
			row = (await this.transactionService.create({
				orderId: order.id,
				// A refund gives money back, which the ledger counts as a negative row; every other fact is the
				// money moving towards the merchant.
				amount: (type === OrderTransactionType.REFUND
					? subtractDecimalStrings('0', magnitude)
					: magnitude) as never,
				currency: order.currency,
				type,
				referenceType: fact.referenceType,
				referenceId: fact.referenceId,
				description: `${fact.type} reported by the payment domain`,
				occurredAt: fact.occurredAt ? new Date(fact.occurredAt) : new Date(),
				metadata: { source: 'payment', ...(fact.paymentId ? { paymentId: fact.paymentId } : {}) },
				tenantId: order.tenantId,
				organizationId: order.organizationId
			} as DeepPartial<OrderTransaction>)) as OrderTransaction;
		} catch (error) {
			// Two reports of one fact raced, and `UQ_order_transaction_payment_fact` refused the second insert:
			// the fact is on the ledger, so the report is answered as a repeat (CodeRabbit on #10890).
			const raced = await this.findRecorded(order.id, type, fact.referenceType, fact.referenceId);

			if (!raced) {
				throw error;
			}

			await this.settleIfStale(order);

			return { recorded: false, transactionId: raced.id };
		}

		await this.totalsService.recompute(order.id, 'PAYMENT_RECORDED');
		await this.tryComplete(order.id);

		return { recorded: true, transactionId: row?.id };
	}

	/**
	 * Records several facts, each on its own, and reports the ones the ledger refused.
	 *
	 * The checkout calls this with the facts of the payments a cart carried in: the order is already placed,
	 * so one fact that is refused (another currency, say) is logged rather than allowed to fail the checkout
	 * that has already happened.
	 *
	 * @param facts The facts.
	 * @returns How many rows were written.
	 */
	async recordAll(facts: IOrderMoneyFact[]): Promise<number> {
		let recorded = 0;

		for (const fact of facts ?? []) {
			try {
				if ((await this.record(fact)).recorded) {
					recorded++;
				}
			} catch (error) {
				this.logger.warn(
					`ORDER_MONEY_FACT_REFUSED: ${fact?.type} ${fact?.referenceType}:${fact?.referenceId} was not recorded on ` +
						`order ${fact?.orderId}: ${describe(error)}`
				);
			}
		}

		return recorded;
	}

	/**
	 * Re-derives an order whose stored money state disagrees with its ledger, then lets it complete.
	 *
	 * Read-only when nothing is stale, so a fact reported twice does not bump the order's version twice.
	 *
	 * @param order The order, as read.
	 */
	private async settleIfStale(order: Order): Promise<void> {
		try {
			const snapshot = await this.totalsService.computeTotals(order);
			const status = await this.totalsService.derivePaymentStatus(order, snapshot);
			// Every money column the ledger drives is compared, not only the paid total: a refund moves the
			// refunded and outstanding totals and can leave the status where it was (CodeRabbit on #10897).
			const differs = (derived: unknown, stored: unknown) =>
				compareDecimalStrings(
					normalizeDecimalString(String(derived ?? 0)),
					normalizeDecimalString(String(stored ?? 0))
				) !== 0;

			if (
				status !== order.paymentStatus ||
				differs(snapshot.paidTotal, order.paidTotal) ||
				differs(snapshot.refundedTotal, order.refundedTotal) ||
				differs(snapshot.outstandingTotal, order.outstandingTotal)
			) {
				await this.totalsService.recompute(order.id, 'PAYMENT_RECORDED');
			}
		} catch (error) {
			this.logger.warn(`Order ${order.id} could not be re-derived from its money ledger: ${describe(error)}`);
		}

		await this.tryComplete(order.id);
	}

	/**
	 * Gives an order its chance to complete after its money moved.
	 *
	 * `completeIfSettled` moves a confirmed or processing order to `COMPLETED` when nothing is left to ship,
	 * nothing is outstanding and no change is open, and leaves it as it is otherwise. A completion that
	 * fails — another write moved the order in between — is logged: the money fact is recorded either way,
	 * and the next fact, fulfilment or operator completion asks again.
	 *
	 * @param orderId The order.
	 */
	async tryComplete(orderId: ID): Promise<void> {
		try {
			await this.orderService.completeIfSettled(orderId);
		} catch (error) {
			this.logger.warn(`Order ${orderId} could not be completed after its money moved: ${describe(error)}`);
		}
	}

	/**
	 * The order a fact is for, in the caller's tenant.
	 *
	 * @param orderId The order.
	 * @returns The order.
	 */
	private async findOrder(orderId: ID): Promise<Order> {
		let order: Order | undefined;

		try {
			order = orderId ? await this.orderService.findOneByIdString(orderId) : undefined;
		} catch {
			order = undefined;
		}

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		return order;
	}

	/**
	 * The ledger row a fact was already written as, if any.
	 *
	 * @param orderId The order.
	 * @param type The ledger type.
	 * @param referenceType The payment-side row type.
	 * @param referenceId The payment-side row.
	 * @returns The row, or `undefined`.
	 */
	private async findRecorded(
		orderId: ID,
		type: OrderTransactionType,
		referenceType: string,
		referenceId: ID
	): Promise<OrderTransaction | undefined> {
		const rows = (await this.transactionService.find({
			where: { orderId, type, referenceType, referenceId }
		} as never)) as OrderTransaction[];

		return rows?.[0];
	}

	/**
	 * The fact's magnitude as an exact, positive decimal.
	 *
	 * @param fact The fact.
	 * @returns The normalised magnitude.
	 * @throws BadRequestException when it is not a positive exact decimal.
	 */
	private magnitudeOf(fact: IOrderMoneyFact): string {
		const raw = String(fact?.amount ?? '');

		if (!isValidDecimalString(raw) || compareDecimalStrings(normalizeDecimalString(raw), '0') <= 0) {
			throw new BadRequestException({
				message: 'ORDER_TRANSACTION_AMOUNT_INVALID: a money fact moves a positive exact amount.',
				code: 'ORDER_TRANSACTION_AMOUNT_INVALID',
				details: { amount: fact?.amount }
			});
		}

		return normalizeDecimalString(raw);
	}
}

/**
 * The first line of an error's message.
 *
 * @param error What was thrown.
 * @returns A short description.
 */
function describe(error: unknown): string {
	return error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
}
