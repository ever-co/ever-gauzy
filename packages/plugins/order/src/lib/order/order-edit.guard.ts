import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ID, OrderStatus } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { TypeOrmOrderRepository } from './repository/type-orm-order.repository';

/**
 * Whether the generic routes of an order's children may write to it (review R3-11).
 *
 * `OrderService` states the rule — "a placed order is not edited here … every other modification is an
 * `order_change`", where it is versioned, priced, re-derived and reversible — and `updateMutable` holds the order row
 * to it. The children's own CRUD routes did not: `PUT /order-lines/:id {"unitPrice":0.01}` repriced a confirmed order
 * with no version bump and no re-derivation (until the nightly reconciliation "repaired" the totals to the edited
 * price), `PUT /order-lines/:id {"orderId":…}` moved a line to another order, and `POST /order-credit-lines` wrote a
 * credit with no matching ledger row. Those routes now write to a draft only; once the order is placed they answer
 * `ORDER_IMMUTABLE` and point at `POST /api/orders/:id/changes`.
 *
 * The guard sits on the routes and the GraphQL fields, not in the services: the order's own workflows (an order
 * change's `ITEM_ADD`/`ITEM_UPDATE`/`SHIPPING_ADD`/`CREDIT_LINE_ADD`, the fulfilment counters, checkout) write
 * children of placed orders through those services on purpose.
 */
@Injectable()
export class OrderEditGuard {
	constructor(private readonly typeOrmOrderRepository: TypeOrmOrderRepository) {}

	/**
	 * Refuses a write to a child of an order that has been placed.
	 *
	 * @param orderId The order the child belongs to (or is to belong to).
	 * @param subject What is being written, for the message (`order line`, `order address`, …).
	 * @throws NotFoundException with `ORDER_NOT_FOUND` when no order of the caller's tenant has that id.
	 * @throws BadRequestException with `ORDER_IMMUTABLE` when the order is no longer a draft.
	 */
	async assertDraft(orderId: ID | null | undefined, subject: string): Promise<void> {
		const order = orderId
			? await this.typeOrmOrderRepository.findOne({
					where: { id: orderId, tenantId: RequestContext.currentTenantId() } as never,
					withDeleted: true
				})
			: null;

		if (!order) {
			throw new NotFoundException(`ORDER_NOT_FOUND: no order exists with id ${orderId}.`);
		}

		if (order.isDraft || order.status === OrderStatus.DRAFT) {
			return;
		}

		throw new BadRequestException({
			message:
				`ORDER_IMMUTABLE: the ${subject} of a placed order (${order.status}) is changed through an order change, ` +
				`which versions, prices and re-derives it: POST /api/orders/${order.id}/changes.`,
			code: 'ORDER_IMMUTABLE',
			details: { orderId: order.id, status: order.status, changeEndpoint: `POST /api/orders/${order.id}/changes` }
		});
	}

	/**
	 * Refuses to move a child to another order: a line, an address, a delivery choice or a credit belongs to the order it
	 * was written for, and the totals of both orders were derived from where it was.
	 *
	 * @param storedOrderId The order the child belongs to.
	 * @param statedOrderId The order a body names, when it names one.
	 * @param subject What is being written, for the message.
	 * @throws BadRequestException with `ORDER_IMMUTABLE` when the body names another order.
	 */
	assertSameOrder(storedOrderId: ID, statedOrderId: ID | null | undefined, subject: string): void {
		if (statedOrderId === undefined || statedOrderId === storedOrderId) {
			return;
		}

		throw new BadRequestException({
			message: `ORDER_IMMUTABLE: an ${subject} belongs to the order it was written for and is not moved to another one.`,
			code: 'ORDER_IMMUTABLE',
			details: { orderId: storedOrderId, statedOrderId }
		});
	}
}
