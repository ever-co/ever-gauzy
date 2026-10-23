import { Inject, Injectable, Optional } from '@nestjs/common';
import * as chalk from 'chalk';
import {
	IPaymentOrderLedgerPort,
	IPaymentOrderMoneyFact,
	IPaymentOrderMoneyFactResult,
	PAYMENT_ORDER_LEDGER
} from '../payment.types';

/**
 * Reports this domain's money facts to the order they are for (Q7-W1b).
 *
 * **Why it exists.** An order is totalled from its own `order_transaction` ledger, and nothing in this
 * package wrote it: a session could be authorised, a payment captured in full and a refund settled, and
 * the order went on answering `NOT_PAID` with an outstanding total that never fell — so it could never be
 * confirmed as paid or completed. The order owns its ledger and is the only writer of it; this class is
 * the one place the payment side tells it what happened, through the optional `PAYMENT_ORDER_LEDGER`
 * port, so neither package imports the other.
 *
 * **Nothing here may fail the payment.** Every call is made after the payment's own transaction has
 * committed: the money already moved at the provider, so a report that threw would tell the caller a
 * capture failed that did not, and the caller would capture again. A refused or missing report is logged
 * under a named code and answered with `undefined`; the fact is still on the payment's own rows, and the
 * order side re-applies it from the outbox (`payment.captured` / `payment.refunded`, Q7-W3) because its
 * writer is idempotent on the fact's reference.
 */
@Injectable()
export class PaymentOrderLedgerMirror {
	constructor(
		@Optional()
		@Inject(PAYMENT_ORDER_LEDGER)
		private readonly ledger?: IPaymentOrderLedgerPort
	) {}

	/** Whether an order ledger is bound in this deployment. */
	get isBound(): boolean {
		return Boolean(this.ledger);
	}

	/**
	 * Reports one fact, absorbing any failure.
	 *
	 * @param fact The fact; a fact that names no order is not reported, which is a fact rather than a gap
	 * (a payment for an invoice or a payout has no order ledger to move).
	 * @param label What the fact is about, for the log line.
	 * @returns What the ledger answered, or `undefined` when nothing was reported.
	 */
	async mirror(fact: IPaymentOrderMoneyFact, label: string): Promise<IPaymentOrderMoneyFactResult | undefined> {
		if (!fact?.orderId) {
			return undefined;
		}

		if (!this.ledger) {
			console.log(
				chalk.yellow(
					`PAYMENT_ORDER_LEDGER_UNAVAILABLE: ${label} (${fact.type} ${fact.amount} ${fact.currency}) was not ` +
						`reported to order ${fact.orderId}: no order ledger is registered in this deployment.`
				)
			);

			return undefined;
		}

		try {
			return await this.ledger.record(fact);
		} catch (error) {
			console.log(
				chalk.yellow(
					`PAYMENT_ORDER_LEDGER_FAILED: ${label} (${fact.type} ${fact.amount} ${fact.currency}) was not ` +
						`recorded on order ${fact.orderId} (${describe(error)}). The payment stands; the order ` +
						're-applies it from the outbox, or report it again.'
				)
			);

			return undefined;
		}
	}

	/**
	 * Reports several facts in order, each on its own.
	 *
	 * @param facts The facts.
	 * @param label What they are about.
	 */
	async mirrorAll(facts: IPaymentOrderMoneyFact[], label: string): Promise<void> {
		for (const fact of facts) {
			await this.mirror(fact, label);
		}
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
