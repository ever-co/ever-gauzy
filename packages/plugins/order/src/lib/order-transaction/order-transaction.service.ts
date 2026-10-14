import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { ID, OrderTransactionType } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { OrderTransaction } from './order-transaction.entity';
import { Order } from '../order/order.entity';
import { orderLedgerAppendOnly } from '../order-ledger.append-only';
import { TypeOrmOrderTransactionRepository } from './repository/type-orm-order-transaction.repository';
import { MikroOrmOrderTransactionRepository } from './repository/mikro-orm-order-transaction.repository';

/**
 * the order payment ledger. Append-only: a correction is a new row of the opposite kind, never an edit and never a deletion.
 */
@Injectable()
export class OrderTransactionService extends TenantAwareCrudService<OrderTransaction> {
	constructor(
		readonly typeOrmOrderTransactionRepository: TypeOrmOrderTransactionRepository,
		readonly mikroOrmOrderTransactionRepository: MikroOrmOrderTransactionRepository
	) {
		super(typeOrmOrderTransactionRepository, mikroOrmOrderTransactionRepository);
	}

	/**
	 * Records an operator's `MANUAL` correction on an order's payment ledger - the one movement a caller may write
	 * directly (review R3-11, decision recorded in the PR).
	 *
	 * Every other kind is written by the operation that causes it (a capture, a refund, an order change's credit), so
	 * a caller-stated `CAPTURE` or `VOID` row is refused. The row is counted in the order's currency by every
	 * derivation, so a row in another currency is refused rather than summed as if it were the order's
	 * (`POST /order-transactions {type:"MANUAL", amount:500, currency:"JPY"}` on a USD order was 500 USD). The order
	 * is read in the caller's tenant; the caller re-derives the order's totals after the row is written.
	 *
	 * @param input The movement.
	 * @returns The stored row.
	 * @throws NotFoundException with `ORDER_NOT_FOUND` when the order is not the caller's.
	 * @throws BadRequestException with `ORDER_TRANSACTION_NOT_MANUAL`, `ORDER_TRANSACTION_CURRENCY_MISMATCH` or
	 * `ORDER_TRANSACTION_AMOUNT_INVALID`.
	 */
	async recordManual(input: DeepPartial<OrderTransaction> & { orderId: ID }): Promise<OrderTransaction> {
		if (input.type !== OrderTransactionType.MANUAL) {
			throw new BadRequestException({
				message:
					`ORDER_TRANSACTION_NOT_MANUAL: a ${input.type} row is written by the operation that causes it; ` +
					`only a MANUAL correction is recorded through this route.`,
				code: 'ORDER_TRANSACTION_NOT_MANUAL',
				details: { type: input.type }
			});
		}

		const amount = Number(input.amount);

		if (!Number.isFinite(amount) || amount === 0) {
			throw new BadRequestException({
				message: 'ORDER_TRANSACTION_AMOUNT_INVALID: a correction moves a finite, non-zero amount.',
				code: 'ORDER_TRANSACTION_AMOUNT_INVALID',
				details: { amount: input.amount }
			});
		}

		const order = await this.typeOrmOrderTransactionRepository.manager.findOne(Order, {
			where: { id: input.orderId, tenantId: RequestContext.currentTenantId() } as never
		});

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${input.orderId}.`);
		}

		if (String(input.currency ?? '').toUpperCase() !== String(order.currency ?? '').toUpperCase()) {
			throw new BadRequestException({
				message:
					`ORDER_TRANSACTION_CURRENCY_MISMATCH: order '${order.id}' is in ${order.currency}, and every ledger row ` +
					`is counted in it; a ${input.currency} correction would be summed as ${order.currency}.`,
				code: 'ORDER_TRANSACTION_CURRENCY_MISMATCH',
				details: { orderId: order.id, orderCurrency: order.currency, currency: input.currency }
			});
		}

		return this.create({ ...input, currency: order.currency, occurredAt: input.occurredAt ?? new Date() });
	}

	/**
	 * Refuses an edit of a ledger row (`ORDER_LEDGER_APPEND_ONLY`).
	 *
	 * @throws BadRequestException always.
	 */
	async update(id: unknown, partialEntity?: unknown): Promise<never> {
		void id;
		void partialEntity;

		throw orderLedgerAppendOnly('order_transaction', 'update');
	}

	/**
	 * Refuses to erase a ledger row (`ORDER_LEDGER_APPEND_ONLY`).
	 *
	 * @throws BadRequestException always.
	 */
	async delete(criteria: unknown): Promise<never> {
		void criteria;

		throw orderLedgerAppendOnly('order_transaction', 'delete');
	}

	/**
	 * Refuses to retire a ledger row: the next derivation would stop counting it with no re-derivation of its own
	 * (`ORDER_LEDGER_APPEND_ONLY`).
	 *
	 * @throws BadRequestException always.
	 */
	async softRemove(id: unknown, ...options: unknown[]): Promise<never> {
		void id;
		void options;

		throw orderLedgerAppendOnly('order_transaction', 'retire');
	}

	/**
	 * Refuses to restore a ledger row, for the reason `softRemove` gives (`ORDER_LEDGER_APPEND_ONLY`).
	 *
	 * @throws BadRequestException always.
	 */
	async softRecover(id: unknown, ...options: unknown[]): Promise<never> {
		void id;
		void options;

		throw orderLedgerAppendOnly('order_transaction', 'restore');
	}
}