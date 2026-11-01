import { Injectable, Optional } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { FulfillmentStatus, ID, OrderPaymentStatus, OrderStatus } from '@gauzy/contracts';
import { addDecimalStrings, compareDecimalStrings } from '@gauzy/core';
import { IOrderRowScope } from '../order-history/order-row-scope';
import { OrderLine } from '../order-line/order-line.entity';
import { MikroOrmOrderLineRepository } from '../order-line/repository/mikro-orm-order-line.repository';
import { TypeOrmOrderLineRepository } from '../order-line/repository/type-orm-order-line.repository';
import { OrderUnitOfWork, inOwnUnitOfWork } from '../order-totals/order-unit-of-work';
import { Order } from './order.entity';
import { MikroOrmOrderRepository } from './repository/mikro-orm-order.repository';
import { TypeOrmOrderRepository } from './repository/type-orm-order.repository';

/** One line of an order: what was bought on it and what has been paid back, as the line row holds them. */
export interface IOrderLineStateSnapshot {
	readonly id: ID;
	readonly quantity: number;
	readonly refundedQuantity: number;
}

/**
 * Where one order is now: its lifecycle status, its two materialised statuses, when it completed or was cancelled,
 * and what is still paid for on each of its lines, as the order and line rows hold them.
 *
 * A projection rather than the rows, so a package that asks the question is not handed a shape the order
 * package would then be unable to change.
 */
export interface IOrderStateSnapshot {
	readonly id: ID;
	readonly status: OrderStatus;
	readonly paymentStatus: OrderPaymentStatus;
	readonly fulfillmentStatus: FulfillmentStatus;
	/** When the order completed. Archiving keeps it, so it still says so once the status reads `ARCHIVED`. */
	readonly completedAt: Date | null;
	/** When the order was cancelled. Archiving keeps it, so it still says so once the status reads `ARCHIVED`. */
	readonly canceledAt: Date | null;
	/**
	 * Every line of the order, with its bought and its refunded quantity; `null` when the lines' refund register
	 * does not account for all the money the order's ledger says was refunded, so it cannot say which lines are
	 * still paid for.
	 */
	readonly lines: readonly IOrderLineStateSnapshot[] | null;
}

/**
 * Answers "where is this order now" for another package, by identifier and under a tenant the caller states.
 *
 * **Why it exists.** An event consumer outside this package sometimes needs the state an order reached rather
 * than the fact that announced it: the entitlement grant path is reorderable, so an order's `order.completed`
 * can be handled before a retried `order.placed`, and the placement then has to know the order has settled
 * since (#11023). The order row is the durable record of that — `COMPLETED` is written in the same transaction
 * that appends `order.completed` — and this reader is the one way another package reads it: through a port the
 * installation binds to this class, never by reading the `order` table itself.
 *
 * **Lines.** A refund pays back lines, not the order: once part of the money is refunded, only the lines' own
 * `refundedQuantity` (the cache this package keeps over its succeeded refunds) says which purchases are still
 * paid for. The snapshot carries every line's bought and refunded quantity so the caller decides per line.
 * That register is reported to after the refund commits and a report can be lost (the payment package logs it
 * and `recomputeRefundCounters` converges it later), and a refund need not name a line at all. So the lines are
 * answered only while their `refundedAmount` adds up to at least the order's `refundedTotal`, the ledger's own
 * figure: when it does not, some refunded money is not on any line the register shows, and `lines` is `null`
 * rather than a register that would understate a refund.
 *
 * **Scope.** A consumer has no request, so there is no caller whose tenant could scope the read; the event's
 * tenant is passed in instead, and it is required. A read without a tenant answers `null` rather than looking
 * across tenants. The organization narrows the read when it is stated. The lines are read under the same scope.
 *
 * **ORM.** The rows are read through the configured ORM, inside one persistence context of its own
 * ({@link OrderUnitOfWork}): the consumer runs without a request, and under MikroORM the global entity manager
 * refuses context-specific reads.
 */
@Injectable()
export class OrderStateReader {
	constructor(
		private readonly typeOrmOrderRepository: TypeOrmOrderRepository,
		private readonly mikroOrmOrderRepository: MikroOrmOrderRepository,
		private readonly typeOrmOrderLineRepository: TypeOrmOrderLineRepository,
		private readonly mikroOrmOrderLineRepository: MikroOrmOrderLineRepository,
		@Optional() private readonly unitOfWork?: OrderUnitOfWork
	) {}

	/**
	 * Reads where one order is now.
	 *
	 * @param orderId The order.
	 * @param scope The tenant the order must belong to (required) and, when stated, its organization.
	 * @returns The order's state, or `null` when no order was named, no tenant was stated, or no such order
	 * exists in that scope.
	 */
	public async findState(orderId: ID, scope: IOrderRowScope): Promise<IOrderStateSnapshot | null> {
		if (!orderId || !scope?.tenantId) {
			return null;
		}

		const scoped = {
			tenantId: scope.tenantId,
			...(scope.organizationId ? { organizationId: scope.organizationId } : {})
		};

		const read = await inOwnUnitOfWork(this.unitOfWork, async () => {
			const order = await this.findOrder({ id: orderId, ...scoped });

			return order ? { order, lines: await this.findLines({ orderId: order.id, ...scoped }) } : null;
		});

		if (!read) {
			return null;
		}

		const { order, lines } = read;

		return {
			id: order.id,
			status: order.status,
			paymentStatus: order.paymentStatus,
			fulfillmentStatus: order.fulfillmentStatus,
			completedAt: order.completedAt ?? null,
			canceledAt: order.canceledAt ?? null,
			lines: this.accountsForEveryRefund(order, lines)
				? lines.map((line) => ({
						id: line.id,
						quantity: Number(line.quantity ?? 0),
						refundedQuantity: Number(line.refundedQuantity ?? 0)
					}))
				: null
		};
	}

	/**
	 * Whether the lines' refund register accounts for every amount the order's ledger says was refunded.
	 *
	 * The sum is exact (decimal strings, never `number` arithmetic), and only a shortfall disqualifies the
	 * register: lines that show more refunded than the ledger (a ledger report that is the one still to land)
	 * only make the caller more careful, never less.
	 *
	 * @param order The order, with the ledger's `refundedTotal`.
	 * @param lines Its lines, with their `refundedAmount`.
	 * @returns True when the lines can say which purchases are still paid for.
	 */
	private accountsForEveryRefund(order: Order, lines: readonly OrderLine[]): boolean {
		const onLines = lines.reduce((sum, line) => addDecimalStrings(sum, `${line.refundedAmount ?? 0}`), '0');

		return compareDecimalStrings(onLines, `${order.refundedTotal ?? 0}`) >= 0;
	}

	/**
	 * Reads one order through the configured ORM.
	 *
	 * @param where The order, its tenant and, when stated, its organization.
	 * @returns The order, or `null`.
	 */
	private async findOrder(where: Record<string, unknown>): Promise<Order | null> {
		if (this.unitOfWork?.usesMikroOrm) {
			return (await this.mikroOrmOrderRepository.findOne(where as never)) ?? null;
		}

		return (await this.typeOrmOrderRepository.findOne({ where: where as FindOptionsWhere<Order> })) ?? null;
	}

	/**
	 * Reads an order's lines through the configured ORM.
	 *
	 * @param where The order, its tenant and, when stated, its organization.
	 * @returns The lines.
	 */
	private async findLines(where: Record<string, unknown>): Promise<OrderLine[]> {
		if (this.unitOfWork?.usesMikroOrm) {
			return (await this.mikroOrmOrderLineRepository.find(where as never)) ?? [];
		}

		return (await this.typeOrmOrderLineRepository.find({ where: where as FindOptionsWhere<OrderLine> })) ?? [];
	}
}
