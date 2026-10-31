import { Injectable, Optional } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { FulfillmentStatus, ID, OrderPaymentStatus, OrderStatus } from '@gauzy/contracts';
import { IOrderRowScope } from '../order-history/order-row-scope';
import { OrderUnitOfWork, inOwnUnitOfWork } from '../order-totals/order-unit-of-work';
import { Order } from './order.entity';
import { MikroOrmOrderRepository } from './repository/mikro-orm-order.repository';
import { TypeOrmOrderRepository } from './repository/type-orm-order.repository';

/**
 * Where one order is now: its lifecycle status and its two materialised statuses, as the order row holds them.
 *
 * A projection rather than the row, so a package that asks the question is not handed a shape the order
 * package would then be unable to change.
 */
export interface IOrderStateSnapshot {
	readonly id: ID;
	readonly status: OrderStatus;
	readonly paymentStatus: OrderPaymentStatus;
	readonly fulfillmentStatus: FulfillmentStatus;
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
 * **Scope.** A consumer has no request, so there is no caller whose tenant could scope the read; the event's
 * tenant is passed in instead, and it is required. A read without a tenant answers `null` rather than looking
 * across tenants. The organization narrows the read when it is stated.
 *
 * **ORM.** The row is read through the configured ORM, inside a persistence context of its own
 * ({@link OrderUnitOfWork}): the consumer runs without a request, and under MikroORM the global entity manager
 * refuses context-specific reads.
 */
@Injectable()
export class OrderStateReader {
	constructor(
		private readonly typeOrmOrderRepository: TypeOrmOrderRepository,
		private readonly mikroOrmOrderRepository: MikroOrmOrderRepository,
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

		const where = {
			id: orderId,
			tenantId: scope.tenantId,
			...(scope.organizationId ? { organizationId: scope.organizationId } : {})
		};

		const order = await inOwnUnitOfWork(this.unitOfWork, () => this.findOrder(where));

		if (!order) {
			return null;
		}

		return {
			id: order.id,
			status: order.status,
			paymentStatus: order.paymentStatus,
			fulfillmentStatus: order.fulfillmentStatus
		};
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
}
